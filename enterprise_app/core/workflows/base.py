"""
Base workflow class for the Enterprise AI Video KYC System.

This module defines the abstract base class that all workflows must implement,
providing a consistent interface for workflow operations.
"""

from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from dataclasses import dataclass, field
from datetime import datetime

from ..exceptions import WorkflowError


class WorkflowStatus(Enum):
    """Workflow status enumeration."""
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StepStatus(Enum):
    """Step status enumeration."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class WorkflowStep:
    """Represents a single workflow step."""
    id: str
    type: str
    title: str
    description: str
    status: StepStatus = StepStatus.PENDING
    data: Optional[Dict[str, Any]] = None
    instructions: Optional[str] = None
    questions: List[Dict[str, Any]] = field(default_factory=list)
    document_types: List[str] = field(default_factory=list)
    required: bool = True
    order: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert step to dictionary."""
        return {
            "id": self.id,
            "type": self.type,
            "title": self.title,
            "description": self.description,
            "status": self.status.value,
            "data": self.data,
            "instructions": self.instructions,
            "questions": self.questions,
            "document_types": self.document_types,
            "required": self.required,
            "order": self.order,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None
        }
    
    def update_status(self, status: StepStatus) -> None:
        """Update step status."""
        self.status = status
        self.updated_at = datetime.utcnow()
        if status == StepStatus.COMPLETED:
            self.completed_at = datetime.utcnow()
    
    def update_data(self, data: Dict[str, Any]) -> None:
        """Update step data."""
        self.data = data
        self.updated_at = datetime.utcnow()
    
    def is_completed(self) -> bool:
        """Check if step is completed."""
        return self.status == StepStatus.COMPLETED
    
    def is_in_progress(self) -> bool:
        """Check if step is in progress."""
        return self.status == StepStatus.IN_PROGRESS


@dataclass
class WorkflowConfig:
    """Configuration for a workflow."""
    workflow_id: str
    workflow_type: str
    name: str
    description: str
    version: str = "1.0.0"
    steps: List[Dict[str, Any]] = field(default_factory=list)
    settings: Dict[str, Any] = field(default_factory=dict)
    timeout_minutes: int = 60
    max_retries: int = 3
    enable_parallel_steps: bool = False
    custom_settings: Optional[Dict[str, Any]] = None


class BaseWorkflow(ABC):
    """
    Abstract base class for all workflows in the system.
    
    This class defines the interface that all workflows must implement,
    ensuring consistency and extensibility across different workflow types.
    """
    
    def __init__(self, config: WorkflowConfig):
        """Initialize the workflow with configuration."""
        self.config = config
        self.status = WorkflowStatus.DRAFT
        self.session_id: Optional[str] = None
        self.room_id: Optional[str] = None
        self.created_at = datetime.utcnow()
        self.last_activity = datetime.utcnow()
        self.error_count = 0
        self.metrics: Dict[str, Any] = {}
        self.steps: List[WorkflowStep] = []
        self.current_step_index = 0
        self.collected_data: Dict[str, Any] = {}
        
    @property
    def workflow_id(self) -> str:
        """Get the workflow ID."""
        return self.config.workflow_id
    
    @property
    def workflow_type(self) -> str:
        """Get the workflow type."""
        return self.config.workflow_type
    
    @abstractmethod
    async def initialize(self) -> None:
        """
        Initialize the workflow.
        
        This method should set up the workflow steps, validate configuration,
        and prepare the workflow for execution.
        
        Raises:
            WorkflowError: If initialization fails
        """
        pass
    
    @abstractmethod
    async def start_workflow(self, session_id: str, room_id: str, **kwargs) -> None:
        """
        Start the workflow execution.
        
        Args:
            session_id: Unique session identifier
            room_id: VideoSDK room identifier
            **kwargs: Additional workflow parameters
            
        Raises:
            WorkflowError: If workflow start fails
        """
        pass
    
    @abstractmethod
    async def execute_step(self, step_id: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Execute a specific workflow step.
        
        Args:
            step_id: Step identifier
            data: Optional data for step execution
            
        Returns:
            Step execution result
            
        Raises:
            WorkflowError: If step execution fails
        """
        pass
    
    @abstractmethod
    async def complete_step(self, step_id: str, result: Dict[str, Any]) -> None:
        """
        Complete a workflow step.
        
        Args:
            step_id: Step identifier
            result: Step completion result
            
        Raises:
            WorkflowError: If step completion fails
        """
        pass
    
    @abstractmethod
    async def pause_workflow(self) -> None:
        """
        Pause the workflow execution.
        
        Raises:
            WorkflowError: If pause fails
        """
        pass
    
    @abstractmethod
    async def resume_workflow(self) -> None:
        """
        Resume a paused workflow.
        
        Raises:
            WorkflowError: If resume fails
        """
        pass
    
    @abstractmethod
    async def cancel_workflow(self) -> None:
        """
        Cancel the workflow execution.
        
        Raises:
            WorkflowError: If cancellation fails
        """
        pass
    
    @abstractmethod
    async def cleanup(self) -> None:
        """
        Clean up workflow resources.
        
        This method should release any resources and perform cleanup operations.
        
        Raises:
            WorkflowError: If cleanup fails
        """
        pass
    
    async def get_current_step(self) -> Optional[WorkflowStep]:
        """
        Get the current workflow step.
        
        Returns:
            Current step if available, None otherwise
        """
        if 0 <= self.current_step_index < len(self.steps):
            return self.steps[self.current_step_index]
        return None
    
    async def get_step_by_id(self, step_id: str) -> Optional[WorkflowStep]:
        """
        Get a workflow step by ID.
        
        Args:
            step_id: Step identifier
            
        Returns:
            Step if found, None otherwise
        """
        for step in self.steps:
            if step.id == step_id:
                return step
        return None
    
    async def get_progress(self) -> Dict[str, Any]:
        """
        Get workflow progress information.
        
        Returns:
            Dictionary containing progress information
        """
        total_steps = len(self.steps)
        completed_steps = sum(1 for step in self.steps if step.is_completed())
        current_step = await self.get_current_step()
        
        return {
            "total_steps": total_steps,
            "completed_steps": completed_steps,
            "current_step": self.current_step_index + 1,
            "progress_percentage": (completed_steps / total_steps * 100) if total_steps > 0 else 0,
            "current_step_info": current_step.to_dict() if current_step else None,
            "status": self.status.value
        }
    
    async def get_status(self) -> Dict[str, Any]:
        """
        Get current workflow status and metrics.
        
        Returns:
            Dictionary containing workflow status information
        """
        return {
            "workflow_id": self.workflow_id,
            "workflow_type": self.workflow_type,
            "status": self.status.value,
            "session_id": self.session_id,
            "room_id": self.room_id,
            "created_at": self.created_at.isoformat(),
            "last_activity": self.last_activity.isoformat(),
            "error_count": self.error_count,
            "metrics": self.metrics,
            "progress": await self.get_progress()
        }
    
    async def update_metrics(self, metrics: Dict[str, Any]) -> None:
        """
        Update workflow metrics.
        
        Args:
            metrics: Dictionary of metrics to update
        """
        self.metrics.update(metrics)
        self.last_activity = datetime.utcnow()
    
    async def move_to_next_step(self) -> bool:
        """
        Move to the next workflow step.
        
        Returns:
            True if moved to next step, False if no more steps
        """
        if self.current_step_index < len(self.steps) - 1:
            self.current_step_index += 1
            current_step = await self.get_current_step()
            if current_step:
                current_step.update_status(StepStatus.IN_PROGRESS)
            
            await self.update_metrics({
                "current_step": self.current_step_index + 1,
                "progress_percentage": ((self.current_step_index + 1) / len(self.steps)) * 100
            })
            return True
        return False
    
    async def handle_error(self, error: Exception) -> None:
        """
        Handle an error that occurred during workflow operation.
        
        Args:
            error: The exception that occurred
        """
        self.error_count += 1
        self.status = WorkflowStatus.FAILED
        
        # Log the error (this would be handled by the logging system)
        error_details = {
            "error_type": type(error).__name__,
            "error_message": str(error),
            "workflow_id": self.workflow_id,
            "session_id": self.session_id,
            "room_id": self.room_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Update metrics with error information
        await self.update_metrics({
            "last_error": error_details,
            "total_errors": self.error_count
        })
        
        # Re-raise as WorkflowError for proper error handling
        raise WorkflowError(
            message=f"Workflow error: {str(error)}",
            error_code="WORKFLOW_ERROR",
            details=error_details
        )
    
    def __str__(self) -> str:
        """String representation of the workflow."""
        return f"{self.workflow_type}(id={self.workflow_id}, status={self.status.value})"
    
    def __repr__(self) -> str:
        """Detailed string representation of the workflow."""
        return (
            f"{self.__class__.__name__}("
            f"id={self.workflow_id}, "
            f"type={self.workflow_type}, "
            f"status={self.status.value}, "
            f"session_id={self.session_id}, "
            f"room_id={self.room_id})"
        )
