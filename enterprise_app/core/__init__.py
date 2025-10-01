"""
Core framework for the Enterprise AI Video KYC System.

This module provides the foundational classes and interfaces for building
extensible AI agents and error handling.
"""

from .exceptions import (
    AgentError,
    PipelineError,
    WorkflowError,
    IntegrationError,
    ConfigurationError
)

__all__ = [
    # Exceptions
    "AgentError",
    "PipelineError", 
    "WorkflowError",
    "IntegrationError",
    "ConfigurationError"
]
