"""
Main application entry point for the Enterprise AI Video KYC System.

This module provides the FastAPI application with all routes, middleware,
and startup/shutdown handlers.
"""

import asyncio
from contextlib import asynccontextmanager
from typing import Dict, Any

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from utils.settings import get_settings
from utils.logger import get_logger, setup_logging, log_banner, log_dict
from utils.health_checker import health_checker
from core.exceptions import EnterpriseKYCError

# Import API routers
from api.v1.router import api_router

# Initialize logging
setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    settings = get_settings()
    
    # Startup
    log_banner(f"Starting {settings.app_name} v{settings.app_version}")
    logger.info("Application startup initiated")
    
    # Log configuration (masked)
    log_dict("info", "Application configuration", settings.get_masked_config())
    
    # Initialize health checks
    await health_checker.check_all_components()
    logger.info("Health checks initialized")
    
    # Add any other startup tasks here
    # e.g., database initialization, cache warming, etc.
    
    logger.info("Application startup completed successfully")
    
    yield
    
    # Shutdown
    log_banner(f"Shutting down {settings.app_name}")
    logger.info("Application shutdown initiated")
    
    # Cleanup tasks
    health_checker.clear_cache()
    logger.info("Health check cache cleared")
    
    # Add any other cleanup tasks here
    # e.g., close database connections, cleanup resources, etc.
    
    logger.info("Application shutdown completed")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()
    
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="Enterprise-grade AI Video KYC System with modular architecture",
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        openapi_url="/openapi.json" if settings.debug else None,
        lifespan=lifespan
    )
    
    # Add middleware
    setup_middleware(app, settings)
    
    # Add exception handlers
    setup_exception_handlers(app)
    
    # Include API routers
    app.include_router(api_router, prefix="/api/v1")
    
    # Add root endpoints
    setup_root_endpoints(app, settings)
    
    return app


def setup_middleware(app: FastAPI, settings) -> None:
    """Set up application middleware."""
    
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=settings.cors_credentials,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["*"],
    )
    
    # Trusted host middleware (for production)
    if settings.is_production:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=["*"]  # Configure with actual hosts in production
        )
    
    # Request logging middleware
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start_time = asyncio.get_event_loop().time()
        
        # Log request
        logger.info(
            "Request started",
            extra={
                "method": request.method,
                "url": str(request.url),
                "client_ip": request.client.host if request.client else None,
                "user_agent": request.headers.get("user-agent")
            }
        )
        
        # Process request
        response = await call_next(request)
        
        # Log response
        process_time = asyncio.get_event_loop().time() - start_time
        logger.info(
            "Request completed",
            extra={
                "method": request.method,
                "url": str(request.url),
                "status_code": response.status_code,
                "process_time_ms": round(process_time * 1000, 2)
            }
        )
        
        return response


def setup_exception_handlers(app: FastAPI) -> None:
    """Set up exception handlers."""
    
    @app.exception_handler(EnterpriseKYCError)
    async def enterprise_kyc_exception_handler(request: Request, exc: EnterpriseKYCError):
        """Handle custom enterprise KYC exceptions."""
        logger.error(
            "Enterprise KYC error occurred",
            extra={
                "error_code": exc.error_code,
                "error_message": exc.message,
                "details": exc.details,
                "url": str(request.url),
                "method": request.method
            }
        )
        
        return JSONResponse(
            status_code=500,
            content={
                "error": "Internal Server Error",
                "error_code": exc.error_code,
                "message": exc.message,
                "details": exc.details if app.debug else None
            }
        )
    
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """Handle request validation errors."""
        logger.warning(
            "Request validation error",
            extra={
                "errors": exc.errors(),
                "url": str(request.url),
                "method": request.method
            }
        )
        
        return JSONResponse(
            status_code=422,
            content={
                "error": "Validation Error",
                "message": "Request validation failed",
                "details": exc.errors() if app.debug else None
            }
        )
    
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        """Handle HTTP exceptions."""
        logger.warning(
            "HTTP exception occurred",
            extra={
                "status_code": exc.status_code,
                "detail": exc.detail,
                "url": str(request.url),
                "method": request.method
            }
        )
        
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": "HTTP Error",
                "message": exc.detail,
                "status_code": exc.status_code
            }
        )
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        """Handle general exceptions."""
        logger.exception(
            "Unhandled exception occurred",
            extra={
                "exception_type": type(exc).__name__,
                "exception_message": str(exc),
                "url": str(request.url),
                "method": request.method
            }
        )
        
        return JSONResponse(
            status_code=500,
            content={
                "error": "Internal Server Error",
                "message": "An unexpected error occurred"
            }
        )


def setup_root_endpoints(app: FastAPI, settings) -> None:
    """Set up root endpoints."""
    
    @app.get("/", tags=["Root"])
    async def root() -> Dict[str, Any]:
        """Root endpoint with application information."""
        return {
            "name": settings.app_name,
            "version": settings.app_version,
            "environment": settings.environment,
            "status": "running",
            "endpoints": {
                "health": "/health",
                "docs": "/docs" if settings.debug else "disabled",
                "api": "/api/v1"
            }
        }
    
    @app.get("/health", tags=["Health"])
    async def health_check() -> Dict[str, Any]:
        """Health check endpoint."""
        try:
            health_status = await health_checker.get_overall_health()
            status_code = 200 if health_status["overall_status"] == "healthy" else 503
            return JSONResponse(content=health_status, status_code=status_code)
        except Exception as e:
            logger.exception("Health check failed")
            return JSONResponse(
                content={
                    "overall_status": "unhealthy",
                    "message": "Health check failed",
                    "error": str(e)
                },
                status_code=503
            )
    
    @app.get("/health/live", tags=["Health"])
    async def liveness_check() -> Dict[str, str]:
        """Kubernetes liveness probe endpoint."""
        return {"status": "alive"}
    
    @app.get("/health/ready", tags=["Health"])
    async def readiness_check() -> Dict[str, Any]:
        """Kubernetes readiness probe endpoint."""
        try:
            health_status = await health_checker.get_overall_health()
            is_ready = health_status["overall_status"] in ["healthy", "degraded"]
            return {
                "status": "ready" if is_ready else "not_ready",
                "overall_health": health_status["overall_status"]
            }
        except Exception:
            return {"status": "not_ready", "error": "Health check failed"}


# Create the application instance
app = create_app()

if __name__ == "__main__":
    import uvicorn
    
    settings = get_settings()
    
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        workers=1 if settings.debug else settings.workers,
        log_level=settings.log_level.lower(),
        access_log=True
    )
