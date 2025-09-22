"""
Pipeline framework for the Enterprise AI Video KYC System.

This module provides the base pipeline classes and interfaces for creating
extensible AI processing pipelines with multiple providers.
"""

from .base import BasePipeline, PipelineConfig, PipelineStatus

__all__ = [
    "BasePipeline",
    "PipelineConfig",
    "PipelineStatus"
]
