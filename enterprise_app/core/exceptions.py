"""
Custom exceptions for the Enterprise AI Video KYC System.

This module defines all custom exceptions used throughout the application,
providing clear error handling and debugging capabilities.
"""

from typing import Any, Dict, Optional


class EnterpriseKYCError(Exception):
    """Base exception for all Enterprise KYC errors."""
    
    def __init__(
        self, 
        message: str, 
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.details = details or {}


class AgentError(EnterpriseKYCError):
    """Raised when agent-related operations fail."""
    pass


class PipelineError(EnterpriseKYCError):
    """Raised when pipeline operations fail."""
    pass


class WorkflowError(EnterpriseKYCError):
    """Raised when workflow operations fail."""
    pass


class IntegrationError(EnterpriseKYCError):
    """Raised when external service integrations fail."""
    pass


class ConfigurationError(EnterpriseKYCError):
    """Raised when configuration is invalid or missing."""
    pass


class SessionError(EnterpriseKYCError):
    """Raised when session management operations fail."""
    pass


class ValidationError(EnterpriseKYCError):
    """Raised when data validation fails."""
    pass


class AuthenticationError(EnterpriseKYCError):
    """Raised when authentication fails."""
    pass


class AuthorizationError(EnterpriseKYCError):
    """Raised when authorization fails."""
    pass


class RateLimitError(EnterpriseKYCError):
    """Raised when rate limits are exceeded."""
    pass


class ServiceUnavailableError(EnterpriseKYCError):
    """Raised when a service is temporarily unavailable."""
    pass
