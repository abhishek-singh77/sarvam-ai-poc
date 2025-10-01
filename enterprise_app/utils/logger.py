"""
Clean and structured logging implementation for the Enterprise AI Video KYC System.

This module provides a clean, readable logging system with proper JSON formatting
and clear separation between different log types.
"""

import logging
import logging.config
import json
import sys
import time
from typing import Any, Dict, Optional, Union
from datetime import datetime
from pathlib import Path

from .settings import get_settings


class CleanJSONFormatter(logging.Formatter):
    """Clean JSON formatter that creates readable, structured logs."""
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as clean JSON."""
        # Base log entry
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Add extra fields if present (these come from structured logging calls)
        for key, value in record.__dict__.items():
            if key not in ['name', 'msg', 'args', 'levelname', 'levelno', 'pathname', 
                          'filename', 'module', 'exc_info', 'exc_text', 'stack_info',
                          'lineno', 'funcName', 'created', 'msecs', 'relativeCreated',
                          'thread', 'threadName', 'processName', 'process', 'getMessage']:
                log_entry[key] = value
        
        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        
        return json.dumps(log_entry, ensure_ascii=False, separators=(',', ':'))


class CleanConsoleFormatter(logging.Formatter):
    """Clean console formatter for development environments."""
    
    COLORS = {
        "DEBUG": "\033[36m",    # Cyan
        "INFO": "\033[32m",     # Green
        "WARNING": "\033[33m",  # Yellow
        "ERROR": "\033[31m",    # Red
        "CRITICAL": "\033[35m", # Magenta
    }
    RESET = "\033[0m"
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record with colors and clean structure."""
        color = self.COLORS.get(record.levelname, "")
        reset = self.RESET
        
        timestamp = datetime.utcnow().strftime("%H:%M:%S.%f")[:-3]  # Include milliseconds
        level = f"{color}{record.levelname:8}{reset}"
        logger_name = record.name.split('.')[-1]  # Just the last part of logger name
        
        # Base message
        message = record.getMessage()
        
        # Add extra fields if present
        extra_fields = []
        for key, value in record.__dict__.items():
            if key not in ['name', 'msg', 'args', 'levelname', 'levelno', 'pathname', 
                          'filename', 'module', 'exc_info', 'exc_text', 'stack_info',
                          'lineno', 'funcName', 'created', 'msecs', 'relativeCreated',
                          'thread', 'threadName', 'processName', 'process', 'getMessage']:
                extra_fields.append(f"{key}={value}")
        
        # Format the log line
        if extra_fields:
            extra_str = " | " + " | ".join(extra_fields)
        else:
            extra_str = ""
        
        return f"{timestamp} | {level} | {logger_name:20} | {message}{extra_str}"


def setup_logging() -> None:
    """Set up clean logging configuration."""
    settings = get_settings()
    
    # Create logs directory if it doesn't exist
    log_file_path = Path(settings.log_file_path)
    log_file_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, settings.log_level.upper()))
    
    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, settings.log_level.upper()))
    
    if settings.log_format == "json":
        console_handler.setFormatter(CleanJSONFormatter())
    else:
        console_handler.setFormatter(CleanConsoleFormatter())
    
    root_logger.addHandler(console_handler)
    
    # File handler (always JSON for file logs)
    file_handler = logging.FileHandler(settings.log_file_path)
    file_handler.setLevel(getattr(logging, settings.log_level.upper()))
    file_handler.setFormatter(CleanJSONFormatter())
    root_logger.addHandler(file_handler)
    
    # Configure specific loggers
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)  # Reduce uvicorn access logs
    logging.getLogger("fastapi").setLevel(logging.INFO)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    
    # Disable uvicorn access logs to avoid duplication
    logging.getLogger("uvicorn.access").disabled = True


def get_logger(name: str) -> logging.Logger:
    """
    Get a clean logger instance.
    
    Args:
        name: Logger name (usually __name__)
        
    Returns:
        Logger instance
    """
    return logging.getLogger(name)


def log_banner(message: str, level: str = "INFO") -> None:
    """
    Log a banner message with visual separation.
    
    Args:
        message: Banner message
        level: Log level
    """
    logger = get_logger("banner")
    banner = "=" * 80
    logger.info(f"\n{banner}\n{message}\n{banner}")


def log_dict(level: str, message: str, data: Dict[str, Any]) -> None:
    """
    Log a dictionary as structured data.
    
    Args:
        level: Log level
        message: Log message
        data: Dictionary to log
    """
    logger = get_logger("structured")
    
    # Log with data as extra fields
    if level.upper() == "DEBUG":
        logger.debug(message, extra=data)
    elif level.upper() == "INFO":
        logger.info(message, extra=data)
    elif level.upper() == "WARNING":
        logger.warning(message, extra=data)
    elif level.upper() == "ERROR":
        logger.error(message, extra=data)
    elif level.upper() == "CRITICAL":
        logger.critical(message, extra=data)
    else:
        logger.info(message, extra=data)


class LoggerMixin:
    """Mixin class to add logging capabilities to any class."""
    
    @property
    def logger(self) -> logging.Logger:
        """Get logger for this class."""
        return get_logger(self.__class__.__module__ + "." + self.__class__.__name__)
    
    def log_info(self, message: str, **kwargs) -> None:
        """Log info message."""
        self.logger.info(message, extra=kwargs)
    
    def log_warning(self, message: str, **kwargs) -> None:
        """Log warning message."""
        self.logger.warning(message, extra=kwargs)
    
    def log_error(self, message: str, **kwargs) -> None:
        """Log error message."""
        self.logger.error(message, extra=kwargs)
    
    def log_debug(self, message: str, **kwargs) -> None:
        """Log debug message."""
        self.logger.debug(message, extra=kwargs)
    
    def log_exception(self, message: str, **kwargs) -> None:
        """Log exception with traceback."""
        self.logger.exception(message, extra=kwargs)


# Performance logging decorator
def log_performance(func):
    """Decorator to log function performance."""
    import functools
    import asyncio
    
    @functools.wraps(func)
    async def async_wrapper(*args, **kwargs):
        logger = get_logger("performance")
        start_time = time.time()
        
        try:
            result = await func(*args, **kwargs)
            execution_time = time.time() - start_time
            logger.info(
                f"Function {func.__name__} completed successfully",
                extra={
                    "function": func.__name__,
                    "execution_time_ms": round(execution_time * 1000, 2),
                    "status": "success"
                }
            )
            return result
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(
                f"Function {func.__name__} failed",
                extra={
                    "function": func.__name__,
                    "execution_time_ms": round(execution_time * 1000, 2),
                    "status": "error",
                    "error": str(e)
                }
            )
            raise
    
    @functools.wraps(func)
    def sync_wrapper(*args, **kwargs):
        logger = get_logger("performance")
        start_time = time.time()
        
        try:
            result = func(*args, **kwargs)
            execution_time = time.time() - start_time
            logger.info(
                f"Function {func.__name__} completed successfully",
                extra={
                    "function": func.__name__,
                    "execution_time_ms": round(execution_time * 1000, 2),
                    "status": "success"
                }
            )
            return result
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(
                f"Function {func.__name__} failed",
                extra={
                    "function": func.__name__,
                    "execution_time_ms": round(execution_time * 1000, 2),
                    "status": "error",
                    "error": str(e)
                }
            )
            raise
    
    if asyncio.iscoroutinefunction(func):
        return async_wrapper
    else:
        return sync_wrapper


# Initialize logging when module is imported
setup_logging()