"""
Context module for session context management.

This module provides factory patterns and utilities for creating
and managing different types of session contexts.
"""

from .factory import ContextFactory, SessionContext, context_factory

__all__ = [
    "ContextFactory",
    "SessionContext", 
    "context_factory"
]
