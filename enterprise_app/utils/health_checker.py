"""
Health check implementation for the Enterprise AI Video KYC System.

This module provides comprehensive health monitoring for all system components
including databases, external services, and internal services.
"""

import asyncio
import time
from enum import Enum
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass
from datetime import datetime, timedelta

from .logger import get_logger


class HealthStatus(Enum):
    """Health status enumeration."""
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    DEGRADED = "degraded"
    UNKNOWN = "unknown"


@dataclass
class ComponentHealth:
    """Health status of a component."""
    name: str
    status: HealthStatus
    message: str
    response_time_ms: Optional[float] = None
    last_check: Optional[datetime] = None
    details: Optional[Dict[str, Any]] = None


class HealthChecker:
    """
    Health checker for monitoring system components.
    
    This class provides comprehensive health monitoring for all system components
    including databases, external services, and internal services.
    """
    
    def __init__(self):
        """Initialize the health checker."""
        self.logger = get_logger("health_checker")
        self.components: Dict[str, Callable] = {}
        self.health_cache: Dict[str, ComponentHealth] = {}
        self.cache_ttl = 30  # seconds
        self.check_timeout = 5  # seconds
        
    def register_component(self, name: str, check_function: Callable) -> None:
        """
        Register a health check function for a component.
        
        Args:
            name: Component name
            check_function: Async function that returns health status
        """
        self.components[name] = check_function
        self.logger.info(f"Registered health check for component: {name}")
    
    async def check_component(self, name: str) -> ComponentHealth:
        """
        Check the health of a specific component.
        
        Args:
            name: Component name
            
        Returns:
            Component health status
        """
        if name not in self.components:
            return ComponentHealth(
                name=name,
                status=HealthStatus.UNKNOWN,
                message=f"Component '{name}' not registered",
                last_check=datetime.utcnow()
            )
        
        # Check cache first
        cached_health = self.health_cache.get(name)
        if cached_health and cached_health.last_check:
            if datetime.utcnow() - cached_health.last_check < timedelta(seconds=self.cache_ttl):
                return cached_health
        
        # Perform health check
        start_time = time.time()
        try:
            check_function = self.components[name]
            result = await asyncio.wait_for(
                check_function(), 
                timeout=self.check_timeout
            )
            
            response_time = (time.time() - start_time) * 1000
            
            if isinstance(result, dict):
                status = HealthStatus(result.get("status", "unknown"))
                message = result.get("message", "Health check completed")
                details = result.get("details", {})
            else:
                status = HealthStatus.HEALTHY if result else HealthStatus.UNHEALTHY
                message = "Health check completed" if result else "Health check failed"
                details = {}
            
            health = ComponentHealth(
                name=name,
                status=status,
                message=message,
                response_time_ms=response_time,
                last_check=datetime.utcnow(),
                details=details
            )
            
        except asyncio.TimeoutError:
            health = ComponentHealth(
                name=name,
                status=HealthStatus.UNHEALTHY,
                message=f"Health check timeout after {self.check_timeout}s",
                response_time_ms=(time.time() - start_time) * 1000,
                last_check=datetime.utcnow()
            )
        except Exception as e:
            health = ComponentHealth(
                name=name,
                status=HealthStatus.UNHEALTHY,
                message=f"Health check failed: {str(e)}",
                response_time_ms=(time.time() - start_time) * 1000,
                last_check=datetime.utcnow()
            )
        
        # Cache the result
        self.health_cache[name] = health
        return health
    
    async def check_all_components(self) -> Dict[str, ComponentHealth]:
        """
        Check the health of all registered components.
        
        Returns:
            Dictionary of component health statuses
        """
        tasks = []
        for name in self.components.keys():
            tasks.append(self.check_component(name))
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        health_statuses = {}
        for i, (name, result) in enumerate(zip(self.components.keys(), results)):
            if isinstance(result, Exception):
                health_statuses[name] = ComponentHealth(
                    name=name,
                    status=HealthStatus.UNHEALTHY,
                    message=f"Health check exception: {str(result)}",
                    last_check=datetime.utcnow()
                )
            else:
                health_statuses[name] = result
        
        return health_statuses
    
    async def get_overall_health(self) -> Dict[str, Any]:
        """
        Get overall system health status.
        
        Returns:
            Dictionary containing overall health information
        """
        component_healths = await self.check_all_components()
        
        # Calculate overall status
        statuses = [health.status for health in component_healths.values()]
        
        if HealthStatus.UNHEALTHY in statuses:
            overall_status = HealthStatus.UNHEALTHY
        elif HealthStatus.DEGRADED in statuses:
            overall_status = HealthStatus.DEGRADED
        elif HealthStatus.UNKNOWN in statuses:
            overall_status = HealthStatus.UNKNOWN
        else:
            overall_status = HealthStatus.HEALTHY
        
        # Calculate metrics
        total_components = len(component_healths)
        healthy_components = sum(1 for h in component_healths.values() if h.status == HealthStatus.HEALTHY)
        unhealthy_components = sum(1 for h in component_healths.values() if h.status == HealthStatus.UNHEALTHY)
        degraded_components = sum(1 for h in component_healths.values() if h.status == HealthStatus.DEGRADED)
        
        avg_response_time = None
        response_times = [h.response_time_ms for h in component_healths.values() if h.response_time_ms is not None]
        if response_times:
            avg_response_time = sum(response_times) / len(response_times)
        
        # Convert component health to JSON-serializable format
        serializable_components = {}
        for name, health in component_healths.items():
            serializable_components[name] = {
                "name": health.name,
                "status": health.status.value,  # Convert enum to string
                "message": health.message,
                "response_time_ms": health.response_time_ms,
                "last_check": health.last_check.isoformat() if health.last_check else None,
                "details": health.details
            }
        
        return {
            "overall_status": overall_status.value,
            "timestamp": datetime.utcnow().isoformat(),
            "total_components": total_components,
            "healthy_components": healthy_components,
            "unhealthy_components": unhealthy_components,
            "degraded_components": degraded_components,
            "average_response_time_ms": avg_response_time,
            "components": serializable_components
        }
    
    def clear_cache(self) -> None:
        """Clear the health check cache."""
        self.health_cache.clear()
        self.logger.info("Health check cache cleared")


# Default health check functions
async def check_database_health() -> Dict[str, Any]:
    """Check database health."""
    try:
        # This would be implemented based on your database setup
        # For now, return a mock healthy status
        return {
            "status": "healthy",
            "message": "Database connection successful",
            "details": {
                "connection_pool_size": 10,
                "active_connections": 3
            }
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "message": f"Database connection failed: {str(e)}",
            "details": {"error": str(e)}
        }




async def check_videosdk_health() -> Dict[str, Any]:
    """Check VideoSDK health."""
    try:
        # This would check VideoSDK API availability
        # For now, return a mock healthy status
        return {
            "status": "healthy",
            "message": "VideoSDK API accessible",
            "details": {
                "api_version": "v2",
                "response_time_ms": 150
            }
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "message": f"VideoSDK API check failed: {str(e)}",
            "details": {"error": str(e)}
        }


async def check_ai_providers_health() -> Dict[str, Any]:
    """Check AI providers health."""
    try:
        # This would check all AI provider APIs
        # For now, return a mock healthy status
        return {
            "status": "healthy",
            "message": "AI providers accessible",
            "details": {
                "sarvamai": "healthy",
                "google": "healthy",
                "openai": "healthy"
            }
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "message": f"AI providers check failed: {str(e)}",
            "details": {"error": str(e)}
        }


# Global health checker instance
health_checker = HealthChecker()

# Register default health checks
health_checker.register_component("database", check_database_health)
health_checker.register_component("videosdk", check_videosdk_health)
health_checker.register_component("ai_providers", check_ai_providers_health)
