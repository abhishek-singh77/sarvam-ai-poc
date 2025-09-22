"""
Base agent class for the Enterprise AI Video KYC System.

This module defines the abstract base class that all agents must implement,
providing a consistent interface for agent operations.
"""

from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Dict, List, Optional, Protocol
from dataclasses import dataclass
from datetime import datetime

from ..exceptions import AgentError


class AgentStatus(Enum):
    """Agent status enumeration."""
    IDLE = "idle"
    INITIALIZING = "initializing"
    ACTIVE = "active"
    PAUSED = "paused"
    ERROR = "error"
    STOPPED = "stopped"


@dataclass
class AgentConfig:
    """Configuration for an agent."""
    agent_id: str
    agent_type: str
    instructions: str
    language: str = "en"
    voice_settings: Optional[Dict[str, Any]] = None
    timeout_seconds: int = 300
    max_retries: int = 3
    enable_interruption: bool = True
    custom_settings: Optional[Dict[str, Any]] = None


class AgentCapabilities(Protocol):
    """Protocol defining agent capabilities."""
    
    async def can_handle_workflow(self, workflow_type: str) -> bool:
        """Check if agent can handle a specific workflow type."""
        ...
    
    async def get_supported_languages(self) -> List[str]:
        """Get list of supported languages."""
        ...
    
    async def get_required_integrations(self) -> List[str]:
        """Get list of required integrations."""
        ...


class BaseAgent(ABC):
    """
    Abstract base class for all agents in the system.
    
    This class defines the interface that all agents must implement,
    ensuring consistency and extensibility across different agent types.
    """
    
    def __init__(self, config: AgentConfig):
        """Initialize the agent with configuration."""
        self.config = config
        self.status = AgentStatus.IDLE
        self.session_id: Optional[str] = None
        self.room_id: Optional[str] = None
        self.created_at = datetime.utcnow()
        self.last_activity = datetime.utcnow()
        self.error_count = 0
        self.metrics: Dict[str, Any] = {}
        
    @property
    def agent_id(self) -> str:
        """Get the agent ID."""
        return self.config.agent_id
    
    @property
    def agent_type(self) -> str:
        """Get the agent type."""
        return self.config.agent_type
    
    @abstractmethod
    async def initialize(self) -> None:
        """
        Initialize the agent.
        
        This method should set up any required resources, connections,
        or configurations needed for the agent to operate.
        
        Raises:
            AgentError: If initialization fails
        """
        pass
    
    @abstractmethod
    async def start_session(self, session_id: str, room_id: str, **kwargs) -> None:
        """
        Start a new session for the agent.
        
        Args:
            session_id: Unique session identifier
            room_id: VideoSDK room identifier
            **kwargs: Additional session parameters
            
        Raises:
            AgentError: If session start fails
        """
        pass
    
    @abstractmethod
    async def process_message(self, message: str, **kwargs) -> str:
        """
        Process a message from the user.
        
        Args:
            message: User message to process
            **kwargs: Additional processing parameters
            
        Returns:
            Agent response message
            
        Raises:
            AgentError: If message processing fails
        """
        pass
    
    @abstractmethod
    async def handle_workflow_step(self, step_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle a workflow step.
        
        Args:
            step_data: Workflow step data
            
        Returns:
            Step processing result
            
        Raises:
            AgentError: If step handling fails
        """
        pass
    
    @abstractmethod
    async def pause_session(self) -> None:
        """
        Pause the current session.
        
        Raises:
            AgentError: If pause fails
        """
        pass
    
    @abstractmethod
    async def resume_session(self) -> None:
        """
        Resume a paused session.
        
        Raises:
            AgentError: If resume fails
        """
        pass
    
    @abstractmethod
    async def stop_session(self) -> None:
        """
        Stop the current session.
        
        Raises:
            AgentError: If stop fails
        """
        pass
    
    @abstractmethod
    async def cleanup(self) -> None:
        """
        Clean up agent resources.
        
        This method should release any resources, close connections,
        and perform any necessary cleanup operations.
        
        Raises:
            AgentError: If cleanup fails
        """
        pass
    
    async def get_status(self) -> Dict[str, Any]:
        """
        Get current agent status and metrics.
        
        Returns:
            Dictionary containing agent status information
        """
        return {
            "agent_id": self.agent_id,
            "agent_type": self.agent_type,
            "status": self.status.value,
            "session_id": self.session_id,
            "room_id": self.room_id,
            "created_at": self.created_at.isoformat(),
            "last_activity": self.last_activity.isoformat(),
            "error_count": self.error_count,
            "metrics": self.metrics
        }
    
    async def update_metrics(self, metrics: Dict[str, Any]) -> None:
        """
        Update agent metrics.
        
        Args:
            metrics: Dictionary of metrics to update
        """
        self.metrics.update(metrics)
        self.last_activity = datetime.utcnow()
    
    async def handle_error(self, error: Exception) -> None:
        """
        Handle an error that occurred during agent operation.
        
        Args:
            error: The exception that occurred
        """
        self.error_count += 1
        self.status = AgentStatus.ERROR
        
        # Log the error (this would be handled by the logging system)
        error_details = {
            "error_type": type(error).__name__,
            "error_message": str(error),
            "agent_id": self.agent_id,
            "session_id": self.session_id,
            "room_id": self.room_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Update metrics with error information
        await self.update_metrics({
            "last_error": error_details,
            "total_errors": self.error_count
        })
        
        # Re-raise as AgentError for proper error handling
        raise AgentError(
            message=f"Agent error: {str(error)}",
            error_code="AGENT_ERROR",
            details=error_details
        )
    
    def __str__(self) -> str:
        """String representation of the agent."""
        return f"{self.agent_type}(id={self.agent_id}, status={self.status.value})"
    
    def __repr__(self) -> str:
        """Detailed string representation of the agent."""
        return (
            f"{self.__class__.__name__}("
            f"id={self.agent_id}, "
            f"type={self.agent_type}, "
            f"status={self.status.value}, "
            f"session_id={self.session_id}, "
            f"room_id={self.room_id})"
        )
