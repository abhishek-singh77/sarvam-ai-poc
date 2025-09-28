"""
Application settings and configuration management.

This module provides centralized configuration management using Pydantic settings
with environment variable support and validation.
"""

from functools import lru_cache
from typing import List, Optional, Dict, Any
from pydantic import Field, validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # Application Configuration
    app_name: str = Field(default="Enterprise AI Video KYC System", alias="APP_NAME")
    app_version: str = Field(default="1.0.0", alias="APP_VERSION")
    debug: bool = Field(default=False, alias="DEBUG")
    environment: str = Field(default="production", alias="ENVIRONMENT")
    
    # Server Configuration
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")
    workers: int = Field(default=4, alias="WORKERS")
    
    # Database Configuration
    database_url: str = Field(default="mysql+aiomysql://user:password@localhost:3306/kyc_db", alias="DATABASE_URL")
    database_pool_size: int = Field(default=10, alias="DATABASE_POOL_SIZE")
    database_max_overflow: int = Field(default=20, alias="DATABASE_MAX_OVERFLOW")
    
    
    # VideoSDK Configuration
    videosdk_api_key: Optional[str] = Field(default=None, alias="VIDEOSDK_API_KEY")
    videosdk_api_secret: Optional[str] = Field(default=None, alias="VIDEOSDK_API_SECRET")
    videosdk_base_url: str = Field(default="https://api.videosdk.live/", alias="VIDEOSDK_BASE_URL")
    
    # AI Provider Configuration
    sarvamai_api_key: Optional[str] = Field(default=None, alias="SARVAMAI_API_KEY")
    google_api_key: Optional[str] = Field(default=None, alias="GOOGLE_API_KEY")
    openai_api_key: Optional[str] = Field(default=None, alias="OPENAI_API_KEY")
    
    # Logging Configuration
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    log_format: str = Field(default="json", alias="LOG_FORMAT")
    log_file_path: str = Field(default="logs/app.log", alias="LOG_FILE_PATH")
    
    # Security Configuration
    secret_key: str = Field(default="your-secret-key-here-change-this-in-production", alias="SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_expiration_hours: int = Field(default=24, alias="JWT_EXPIRATION_HOURS")
    
    # CORS Configuration
    cors_origins: List[str] = Field(default=["http://localhost:4200", "http://localhost:3000", "http://127.0.0.1:4200", "http://127.0.0.1:3000"], alias="CORS_ORIGINS")
    cors_credentials: bool = Field(default=True, alias="CORS_CREDENTIALS")
    
    # Health Check Configuration
    health_check_interval: int = Field(default=30, alias="HEALTH_CHECK_INTERVAL")
    health_check_timeout: int = Field(default=5, alias="HEALTH_CHECK_TIMEOUT")
    
    # Session Configuration
    session_timeout_minutes: int = Field(default=60, alias="SESSION_TIMEOUT_MINUTES")
    max_concurrent_sessions: int = Field(default=100, alias="MAX_CONCURRENT_SESSIONS")
    
    # File Upload Configuration
    max_file_size_mb: int = Field(default=10, alias="MAX_FILE_SIZE_MB")
    allowed_file_types: List[str] = Field(
        default=["image/jpeg", "image/png", "application/pdf"], 
        alias="ALLOWED_FILE_TYPES"
    )
    
    # Monitoring Configuration
    enable_metrics: bool = Field(default=True, alias="ENABLE_METRICS")
    metrics_port: int = Field(default=9090, alias="METRICS_PORT")
    
    # Wav2Lip Plugin Configuration
    wav2lip_enabled: bool = Field(default=True, alias="WAV2LIP_ENABLED")
    wav2lip_url: Optional[str] = Field(default="ws://35.207.229.235:8001/ws", alias="WAV2LIP_URL")
    avatar_implementation: str = Field(default="true_sync", alias="AVATAR_IMPLEMENTATION", description="Avatar implementation: 'wav2lip' or 'true_sync'")
    
    # TTS Configuration
    tts_pace: float = Field(default=0.9, alias="TTS_PACE", description="TTS speech pace (0.5-2.0, 1.0 = normal speed)")
    tts_pitch: float = Field(default=0.0, alias="TTS_PITCH", description="TTS pitch adjustment (-1.0 to 1.0)")
    tts_loudness: float = Field(default=1.0, alias="TTS_LOUDNESS", description="TTS volume level (0.5-2.0)")
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        validate_default=True,
        env_ignore_empty=False,
    )
    
    @validator("cors_origins", pre=True)
    def parse_cors_origins(cls, v):
        """Parse CORS origins from string or list."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v
    
    @validator("allowed_file_types", pre=True)
    def parse_allowed_file_types(cls, v):
        """Parse allowed file types from string or list."""
        if isinstance(v, str):
            return [file_type.strip() for file_type in v.split(",")]
        return v
    
    @validator("log_level")
    def validate_log_level(cls, v):
        """Validate log level."""
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if v.upper() not in valid_levels:
            raise ValueError(f"Log level must be one of: {valid_levels}")
        return v.upper()
    
    @validator("environment")
    def validate_environment(cls, v):
        """Validate environment."""
        valid_environments = ["localhost", "development", "staging", "production"]
        if v.lower() not in valid_environments:
            raise ValueError(f"Environment must be one of: {valid_environments}")
        return v.lower()
    
    @validator("avatar_implementation")
    def validate_avatar_implementation(cls, v):
        """Validate avatar implementation."""
        valid_implementations = ["wav2lip", "true_sync"]
        if v.lower() not in valid_implementations:
            raise ValueError(f"Avatar implementation must be one of: {valid_implementations}")
        return v.lower()
    
    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.environment == "development"
    
    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.environment == "production"
    
    @property
    def database_config(self) -> Dict[str, Any]:
        """Get database configuration."""
        return {
            "url": self.database_url,
            "pool_size": self.database_pool_size,
            "max_overflow": self.database_max_overflow
        }
    
    
    @property
    def videosdk_config(self) -> Dict[str, Any]:
        """Get VideoSDK configuration."""
        return {
            "api_key": self.videosdk_api_key,
            "api_secret": self.videosdk_api_secret,
            "base_url": self.videosdk_base_url
        }
    
    @property
    def ai_providers_config(self) -> Dict[str, Any]:
        """Get AI providers configuration."""
        return {
            "sarvamai": {"api_key": self.sarvamai_api_key},
            "google": {"api_key": self.google_api_key},
            "openai": {"api_key": self.openai_api_key}
        }
    
    @property
    def security_config(self) -> Dict[str, Any]:
        """Get security configuration."""
        return {
            "secret_key": self.secret_key,
            "jwt_algorithm": self.jwt_algorithm,
            "jwt_expiration_hours": self.jwt_expiration_hours
        }
    
    @property
    def wav2lip_config(self) -> Dict[str, Any]:
        """Get Wav2Lip plugin configuration."""
        return {
            "enabled": self.wav2lip_enabled,
            "url": self.wav2lip_url,
            "implementation": self.avatar_implementation
        }
    
    def get_masked_config(self) -> Dict[str, Any]:
        """Get configuration with sensitive values masked."""
        def mask_sensitive(value: Optional[str]) -> str:
            if not value:
                return "None"
            if len(value) <= 6:
                return "***"
            return value[:3] + "***" + value[-3:]
        
        return {
            "app_name": self.app_name,
            "app_version": self.app_version,
            "debug": self.debug,
            "environment": self.environment,
            "host": self.host,
            "port": self.port,
            "workers": self.workers,
            "database_url": mask_sensitive(self.database_url),
            "videosdk_api_key": mask_sensitive(self.videosdk_api_key),
            "videosdk_api_secret": mask_sensitive(self.videosdk_api_secret),
            "sarvamai_api_key": mask_sensitive(self.sarvamai_api_key),
            "google_api_key": mask_sensitive(self.google_api_key),
            "openai_api_key": mask_sensitive(self.openai_api_key),
            "secret_key": mask_sensitive(self.secret_key),
            "log_level": self.log_level,
            "log_format": self.log_format,
            "cors_origins": self.cors_origins,
            "session_timeout_minutes": self.session_timeout_minutes,
            "max_concurrent_sessions": self.max_concurrent_sessions,
            "enable_metrics": self.enable_metrics,
            "metrics_port": self.metrics_port
        }


@lru_cache()
def get_settings() -> Settings:
    """
    Get application settings (cached).
    
    Returns:
        Settings instance
    """
    return Settings()
