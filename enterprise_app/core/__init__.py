"""
Core framework for the Enterprise AI Video KYC System.

This module provides the foundational classes and interfaces for building
extensible AI agents, workflows, and pipelines.
"""

from .agents.base import BaseAgent, AgentConfig
from .agents.factory import AgentFactory
from .pipelines.base import BasePipeline, PipelineConfig
from .workflows.base import BaseWorkflow, WorkflowConfig, WorkflowStatus, WorkflowStep
from .exceptions import (
    AgentError,
    PipelineError,
    WorkflowError,
    IntegrationError,
    ConfigurationError
)

__all__ = [
    # Agents
    "BaseAgent",
    "AgentConfig", 
    "AgentFactory",
    
    # Pipelines
    "BasePipeline",
    "PipelineConfig",
    
    # Workflows
    "BaseWorkflow",
    "WorkflowConfig",
    "WorkflowStatus",
    "WorkflowStep",
    
    # Exceptions
    "AgentError",
    "PipelineError", 
    "WorkflowError",
    "IntegrationError",
    "ConfigurationError"
]
