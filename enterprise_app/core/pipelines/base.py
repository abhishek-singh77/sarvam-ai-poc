"""
Base pipeline class for the Enterprise AI Video KYC System.

This module defines the abstract base class that all pipelines must implement,
providing a consistent interface for pipeline operations.
"""

from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Dict, List, Optional, Protocol, Union
from dataclasses import dataclass
from datetime import datetime

from ..exceptions import PipelineError


class PipelineStatus(Enum):
    """Pipeline status enumeration."""
    IDLE = "idle"
    INITIALIZING = "initializing"
    ACTIVE = "active"
    PROCESSING = "processing"
    PAUSED = "paused"
    ERROR = "error"
    STOPPED = "stopped"


@dataclass
class PipelineConfig:
    """Configuration for a pipeline."""
    pipeline_id: str
    pipeline_type: str
    provider_configs: Dict[str, Dict[str, Any]]
    processing_config: Dict[str, Any]
    timeout_seconds: int = 300
    max_retries: int = 3
    enable_monitoring: bool = True
    custom_settings: Optional[Dict[str, Any]] = None


class PipelineComponent(Protocol):
    """Protocol defining pipeline component interface."""
    
    async def initialize(self) -> None:
        """Initialize the component."""
        ...
    
    async def process(self, data: Any, **kwargs) -> Any:
        """Process data through the component."""
        ...
    
    async def cleanup(self) -> None:
        """Clean up component resources."""
        ...


class BasePipeline(ABC):
    """
    Abstract base class for all pipelines in the system.
    
    This class defines the interface that all pipelines must implement,
    ensuring consistency and extensibility across different pipeline types.
    """
    
    def __init__(self, config: PipelineConfig):
        """Initialize the pipeline with configuration."""
        self.config = config
        self.status = PipelineStatus.IDLE
        self.session_id: Optional[str] = None
        self.room_id: Optional[str] = None
        self.created_at = datetime.utcnow()
        self.last_activity = datetime.utcnow()
        self.error_count = 0
        self.metrics: Dict[str, Any] = {}
        self.components: Dict[str, PipelineComponent] = {}
        self.processing_queue: List[Dict[str, Any]] = []
        
    @property
    def pipeline_id(self) -> str:
        """Get the pipeline ID."""
        return self.config.pipeline_id
    
    @property
    def pipeline_type(self) -> str:
        """Get the pipeline type."""
        return self.config.pipeline_type
    
    @abstractmethod
    async def initialize(self) -> None:
        """
        Initialize the pipeline.
        
        This method should set up all pipeline components, establish connections,
        and prepare the pipeline for processing.
        
        Raises:
            PipelineError: If initialization fails
        """
        pass
    
    @abstractmethod
    async def start_session(self, session_id: str, room_id: str, **kwargs) -> None:
        """
        Start a new session for the pipeline.
        
        Args:
            session_id: Unique session identifier
            room_id: VideoSDK room identifier
            **kwargs: Additional session parameters
            
        Raises:
            PipelineError: If session start fails
        """
        pass
    
    @abstractmethod
    async def process_audio(self, audio_data: bytes, **kwargs) -> Dict[str, Any]:
        """
        Process audio data through the pipeline.
        
        Args:
            audio_data: Raw audio data
            **kwargs: Additional processing parameters
            
        Returns:
            Processing result dictionary
            
        Raises:
            PipelineError: If audio processing fails
        """
        pass
    
    @abstractmethod
    async def process_text(self, text: str, **kwargs) -> Dict[str, Any]:
        """
        Process text data through the pipeline.
        
        Args:
            text: Text to process
            **kwargs: Additional processing parameters
            
        Returns:
            Processing result dictionary
            
        Raises:
            PipelineError: If text processing fails
        """
        pass
    
    @abstractmethod
    async def generate_response(self, context: Dict[str, Any], **kwargs) -> str:
        """
        Generate a response based on context.
        
        Args:
            context: Context data for response generation
            **kwargs: Additional generation parameters
            
        Returns:
            Generated response text
            
        Raises:
            PipelineError: If response generation fails
        """
        pass
    
    @abstractmethod
    async def synthesize_speech(self, text: str, **kwargs) -> bytes:
        """
        Synthesize speech from text.
        
        Args:
            text: Text to synthesize
            **kwargs: Additional synthesis parameters
            
        Returns:
            Synthesized audio data
            
        Raises:
            PipelineError: If speech synthesis fails
        """
        pass
    
    @abstractmethod
    async def pause_processing(self) -> None:
        """
        Pause pipeline processing.
        
        Raises:
            PipelineError: If pause fails
        """
        pass
    
    @abstractmethod
    async def resume_processing(self) -> None:
        """
        Resume pipeline processing.
        
        Raises:
            PipelineError: If resume fails
        """
        pass
    
    @abstractmethod
    async def stop_session(self) -> None:
        """
        Stop the current session.
        
        Raises:
            PipelineError: If stop fails
        """
        pass
    
    @abstractmethod
    async def cleanup(self) -> None:
        """
        Clean up pipeline resources.
        
        This method should release any resources, close connections,
        and perform any necessary cleanup operations.
        
        Raises:
            PipelineError: If cleanup fails
        """
        pass
    
    async def get_status(self) -> Dict[str, Any]:
        """
        Get current pipeline status and metrics.
        
        Returns:
            Dictionary containing pipeline status information
        """
        return {
            "pipeline_id": self.pipeline_id,
            "pipeline_type": self.pipeline_type,
            "status": self.status.value,
            "session_id": self.session_id,
            "room_id": self.room_id,
            "created_at": self.created_at.isoformat(),
            "last_activity": self.last_activity.isoformat(),
            "error_count": self.error_count,
            "metrics": self.metrics,
            "components": list(self.components.keys()),
            "queue_size": len(self.processing_queue)
        }
    
    async def update_metrics(self, metrics: Dict[str, Any]) -> None:
        """
        Update pipeline metrics.
        
        Args:
            metrics: Dictionary of metrics to update
        """
        self.metrics.update(metrics)
        self.last_activity = datetime.utcnow()
    
    async def add_component(self, name: str, component: PipelineComponent) -> None:
        """
        Add a component to the pipeline.
        
        Args:
            name: Component name
            component: Component instance
            
        Raises:
            PipelineError: If component addition fails
        """
        try:
            await component.initialize()
            self.components[name] = component
            await self.update_metrics({f"component_{name}_added": True})
        except Exception as e:
            raise PipelineError(
                message=f"Failed to add component '{name}': {str(e)}",
                error_code="COMPONENT_ADD_FAILED",
                details={"component_name": name}
            )
    
    async def remove_component(self, name: str) -> None:
        """
        Remove a component from the pipeline.
        
        Args:
            name: Component name
            
        Raises:
            PipelineError: If component removal fails
        """
        if name in self.components:
            try:
                await self.components[name].cleanup()
                del self.components[name]
                await self.update_metrics({f"component_{name}_removed": True})
            except Exception as e:
                raise PipelineError(
                    message=f"Failed to remove component '{name}': {str(e)}",
                    error_code="COMPONENT_REMOVE_FAILED",
                    details={"component_name": name}
                )
    
    async def get_component(self, name: str) -> Optional[PipelineComponent]:
        """
        Get a pipeline component by name.
        
        Args:
            name: Component name
            
        Returns:
            Component instance if found, None otherwise
        """
        return self.components.get(name)
    
    async def handle_error(self, error: Exception) -> None:
        """
        Handle an error that occurred during pipeline operation.
        
        Args:
            error: The exception that occurred
        """
        self.error_count += 1
        self.status = PipelineStatus.ERROR
        
        # Log the error (this would be handled by the logging system)
        error_details = {
            "error_type": type(error).__name__,
            "error_message": str(error),
            "pipeline_id": self.pipeline_id,
            "session_id": self.session_id,
            "room_id": self.room_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Update metrics with error information
        await self.update_metrics({
            "last_error": error_details,
            "total_errors": self.error_count
        })
        
        # Re-raise as PipelineError for proper error handling
        raise PipelineError(
            message=f"Pipeline error: {str(error)}",
            error_code="PIPELINE_ERROR",
            details=error_details
        )
    
    def __str__(self) -> str:
        """String representation of the pipeline."""
        return f"{self.pipeline_type}(id={self.pipeline_id}, status={self.status.value})"
    
    def __repr__(self) -> str:
        """Detailed string representation of the pipeline."""
        return (
            f"{self.__class__.__name__}("
            f"id={self.pipeline_id}, "
            f"type={self.pipeline_type}, "
            f"status={self.status.value}, "
            f"session_id={self.session_id}, "
            f"room_id={self.room_id})"
        )
