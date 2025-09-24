"""
Main API router for v1 endpoints.

This module provides the main router that includes all v1 API endpoints.
"""

from fastapi import APIRouter

from .sessions import router as sessions_router
from .workflows import router as workflows_router
from .agents import router as agents_router
from .health import router as health_router
from .enhanced_kyc import router as enhanced_kyc_router

# Create main API router
api_router = APIRouter()

# Include all sub-routers
api_router.include_router(sessions_router, prefix="/sessions", tags=["Sessions"])
api_router.include_router(workflows_router, prefix="/workflows", tags=["Workflows"])
api_router.include_router(agents_router, prefix="/agents", tags=["Agents"])
api_router.include_router(health_router, prefix="/health", tags=["Health"])
api_router.include_router(enhanced_kyc_router, prefix="/enhanced-kyc", tags=["Enhanced KYC"])
