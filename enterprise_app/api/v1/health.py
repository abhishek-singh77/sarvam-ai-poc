"""
Health check API endpoints.

This module provides endpoints for health monitoring and system status.
"""

from typing import Dict, Any
from fastapi import APIRouter, HTTPException

from utils.logger import get_logger
from utils.health_checker import health_checker

router = APIRouter()
logger = get_logger(__name__)


@router.get("/")
async def get_health_status() -> Dict[str, Any]:
    """
    Get overall system health status.
    
    Returns:
        System health information
    """
    logger.info("Getting system health status")
    
    try:
        health_status = await health_checker.get_overall_health()
        return health_status
    except Exception as e:
        logger.error("Failed to get health status", extra={"error": str(e)})
        raise HTTPException(status_code=500, detail="Failed to get health status")


@router.get("/components")
async def get_components_health() -> Dict[str, Any]:
    """
    Get health status of all components.
    
    Returns:
        Components health information
    """
    logger.info("Getting components health status")
    
    try:
        components_health = await health_checker.check_all_components()
        return {
            "components": {name: health.__dict__ for name, health in components_health.items()},
            "timestamp": "2024-01-01T00:00:00Z"
        }
    except Exception as e:
        logger.error("Failed to get components health", extra={"error": str(e)})
        raise HTTPException(status_code=500, detail="Failed to get components health")


@router.get("/components/{component_name}")
async def get_component_health(component_name: str) -> Dict[str, Any]:
    """
    Get health status of a specific component.
    
    Args:
        component_name: Name of the component
        
    Returns:
        Component health information
        
    Raises:
        HTTPException: If component not found
    """
    logger.info("Getting component health", extra={"component_name": component_name})
    
    try:
        component_health = await health_checker.check_component(component_name)
        return component_health.__dict__
    except Exception as e:
        logger.error("Failed to get component health", extra={"component_name": component_name, "error": str(e)})
        raise HTTPException(status_code=500, detail="Failed to get component health")


@router.post("/components/{component_name}/check")
async def check_component(component_name: str) -> Dict[str, Any]:
    """
    Force a health check for a specific component.
    
    Args:
        component_name: Name of the component
        
    Returns:
        Component health check result
        
    Raises:
        HTTPException: If component check fails
    """
    logger.info("Force checking component health", extra={"component_name": component_name})
    
    try:
        # Clear cache for this component to force a fresh check
        if component_name in health_checker.health_cache:
            del health_checker.health_cache[component_name]
        
        component_health = await health_checker.check_component(component_name)
        return {
            "status": "success",
            "component": component_name,
            "health": component_health.__dict__
        }
    except Exception as e:
        logger.error("Failed to check component", extra={"component_name": component_name, "error": str(e)})
        raise HTTPException(status_code=500, detail="Failed to check component")


@router.post("/cache/clear")
async def clear_health_cache() -> Dict[str, Any]:
    """
    Clear the health check cache.
    
    Returns:
        Cache clear result
    """
    logger.info("Clearing health check cache")
    
    try:
        health_checker.clear_cache()
        return {
            "status": "success",
            "message": "Health check cache cleared successfully"
        }
    except Exception as e:
        logger.error("Failed to clear health cache", extra={"error": str(e)})
        raise HTTPException(status_code=500, detail="Failed to clear health cache")
