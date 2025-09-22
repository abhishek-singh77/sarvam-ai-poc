"""
Configuration management for the Enterprise AI Video KYC System.

This module provides centralized configuration management using Pydantic settings.
"""

from .settings import Settings, get_settings

__all__ = ["Settings", "get_settings"]
