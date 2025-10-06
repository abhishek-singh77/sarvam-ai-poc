"""
Main application entry point for the Enterprise AI Video KYC System.
LAN-accessible version for testing from devices like iPad.
"""

import asyncio
from contextlib import asynccontextmanager
from typing import Dict, Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from utils.settings import get_settings
from utils.logger import get_logger, setup_logging, log_banner, log_dict
from utils.health_checker import health_checker
from core.exceptions import EnterpriseKYCError

from api.v1.router import api_router

# Initialize logging
setup_logging()
logger = get_logger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    log_banner(f"Starting {settings.app_name} v{settings.app_version}")
    logger.info("Application startup initiated")
    log_dict("info", "Application configuration", settings.get_masked_config())
    
    # Initialize health checks
    await health_checker.check_all_components()
    logger.info("Health checks initialized")
    
    yield
    
    log_banner(f"Shutting down {settings.app_name}")
    logger.info("Application shutdown initiated")
    health_checker.clear_cache()
    logger.info("Health check cache cleared")
    logger.info("Application shutdown completed")

def create_app() -> FastAPI:
    settings = get_settings()
    
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="Enterprise AI Video KYC System",
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        openapi_url="/openapi.json" if settings.debug else None,
        lifespan=lifespan
    )
    
    # CORS middleware for LAN testing
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # <-- allow all origins for testing
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # TrustedHost (optional, mostly for prod)
    if settings.is_production:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=["*"]
        )
    
    # Include routers
    app.include_router(api_router, prefix="/api/v1")
    
    # Exception handlers
    setup_exception_handlers(app)
    
    # Root & health endpoints
    setup_root_endpoints(app, settings)
    
    return app

def setup_exception_handlers(app: FastAPI):
    @app.exception_handler(EnterpriseKYCError)
    async def kyc_error_handler(request: Request, exc: EnterpriseKYCError):
        logger.error(f"Enterprise KYC error: {exc.message}")
        return JSONResponse(
            status_code=500,
            content={"error": exc.message, "code": exc.error_code}
        )
    
    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(status_code=422, content={"error": "Validation Error", "details": exc.errors()})
    
    @app.exception_handler(StarletteHTTPException)
    async def http_handler(request: Request, exc: StarletteHTTPException):
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
    
    @app.exception_handler(Exception)
    async def general_handler(request: Request, exc: Exception):
        logger.exception(f"Unhandled exception: {exc}")
        return JSONResponse(status_code=500, content={"error": "Internal Server Error"})

def setup_root_endpoints(app: FastAPI, settings):
    @app.get("/", tags=["Root"])
    async def root():
        return {
            "name": settings.app_name,
            "version": settings.app_version,
            "status": "running",
            "endpoints": {
                "health": "/health",
                "docs": "/docs" if settings.debug else "disabled",
                "api": "/api/v1"
            }
        }
    
    @app.get("/health", tags=["Health"])
    async def health_check():
        try:
            health_status = await health_checker.get_overall_health()
            status_code = 200 if health_status["overall_status"] == "healthy" else 503
            return JSONResponse(content=health_status, status_code=status_code)
        except Exception as e:
            return JSONResponse({"overall_status": "unhealthy", "error": str(e)}, status_code=503)

# Create app
app = create_app()

if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    
    # IMPORTANT: Use 0.0.0.0 to allow LAN/iPad access
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # keep reload=True for dev
        log_level="info"
    )