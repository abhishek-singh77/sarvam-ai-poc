"""
Agent factory for creating and managing agents.

This module provides a factory pattern for creating different types of agents
and managing their lifecycle.
"""

from typing import Dict, Type, Optional, Any
from .base import BaseAgent, AgentConfig, AgentStatus
from .kyc_agent import KYCAgent
from .interview_agent import InterviewAgent
from .survey_agent import SurveyAgent
from ..exceptions import AgentError, ConfigurationError


class AgentFactory:
    """
    Factory class for creating and managing agents.
    
    This factory provides a centralized way to create different types of agents
    and ensures proper configuration and initialization.
    """
    
    # Registry of available agent types
    _agent_registry: Dict[str, Type[BaseAgent]] = {
        "kyc": KYCAgent,
        "interview": InterviewAgent,
        "survey": SurveyAgent,
    }
    
    # Active agents registry
    _active_agents: Dict[str, BaseAgent] = {}
    
    @classmethod
    def register_agent_type(cls, agent_type: str, agent_class: Type[BaseAgent]) -> None:
        """
        Register a new agent type.
        
        Args:
            agent_type: Type identifier for the agent
            agent_class: Agent class to register
            
        Raises:
            ConfigurationError: If agent_type already exists
        """
        if agent_type in cls._agent_registry:
            raise ConfigurationError(f"Agent type '{agent_type}' is already registered")
        
        if not issubclass(agent_class, BaseAgent):
            raise ConfigurationError(f"Agent class must inherit from BaseAgent")
        
        cls._agent_registry[agent_type] = agent_class
    
    @classmethod
    def get_available_agent_types(cls) -> list[str]:
        """
        Get list of available agent types.
        
        Returns:
            List of available agent type names
        """
        return list(cls._agent_registry.keys())
    
    @classmethod
    async def create_agent(
        self,
        agent_type: str,
        config: AgentConfig,
        **kwargs
    ) -> BaseAgent:
        """
        Create a new agent instance.
        
        Args:
            agent_type: Type of agent to create
            config: Agent configuration
            **kwargs: Additional creation parameters
            
        Returns:
            Initialized agent instance
            
        Raises:
            ConfigurationError: If agent type is not supported
            AgentError: If agent creation fails
        """
        if agent_type not in cls._agent_registry:
            available_types = ", ".join(cls.get_available_agent_types())
            raise ConfigurationError(
                f"Unsupported agent type '{agent_type}'. "
                f"Available types: {available_types}"
            )
        
        try:
            # Get the agent class
            agent_class = cls._agent_registry[agent_type]
            
            # Create agent instance
            agent = agent_class(config, **kwargs)
            
            # Initialize the agent
            await agent.initialize()
            
            # Register as active agent
            cls._active_agents[config.agent_id] = agent
            
            return agent
            
        except Exception as e:
            raise AgentError(
                message=f"Failed to create agent of type '{agent_type}': {str(e)}",
                error_code="AGENT_CREATION_FAILED",
                details={"agent_type": agent_type, "config": config.__dict__}
            )
    
    @classmethod
    def get_agent(cls, agent_id: str) -> Optional[BaseAgent]:
        """
        Get an active agent by ID.
        
        Args:
            agent_id: Agent identifier
            
        Returns:
            Agent instance if found, None otherwise
        """
        return cls._active_agents.get(agent_id)
    
    @classmethod
    def get_active_agents(cls) -> Dict[str, BaseAgent]:
        """
        Get all active agents.
        
        Returns:
            Dictionary of active agents (agent_id -> agent_instance)
        """
        return cls._active_agents.copy()
    
    @classmethod
    async def destroy_agent(cls, agent_id: str) -> bool:
        """
        Destroy an agent and clean up its resources.
        
        Args:
            agent_id: Agent identifier
            
        Returns:
            True if agent was destroyed, False if not found
            
        Raises:
            AgentError: If agent destruction fails
        """
        agent = cls._active_agents.get(agent_id)
        if not agent:
            return False
        
        try:
            # Clean up agent resources
            await agent.cleanup()
            
            # Remove from active agents
            del cls._active_agents[agent_id]
            
            return True
            
        except Exception as e:
            raise AgentError(
                message=f"Failed to destroy agent '{agent_id}': {str(e)}",
                error_code="AGENT_DESTRUCTION_FAILED",
                details={"agent_id": agent_id}
            )
    
    @classmethod
    async def destroy_all_agents(cls) -> None:
        """
        Destroy all active agents and clean up their resources.
        
        Raises:
            AgentError: If any agent destruction fails
        """
        agent_ids = list(cls._active_agents.keys())
        errors = []
        
        for agent_id in agent_ids:
            try:
                await cls.destroy_agent(agent_id)
            except AgentError as e:
                errors.append(f"Agent {agent_id}: {str(e)}")
        
        if errors:
            raise AgentError(
                message="Failed to destroy some agents",
                error_code="BULK_AGENT_DESTRUCTION_FAILED",
                details={"errors": errors}
            )
    
    @classmethod
    def get_agent_status_summary(cls) -> Dict[str, Any]:
        """
        Get summary of all active agents.
        
        Returns:
            Dictionary containing agent status summary
        """
        summary = {
            "total_agents": len(cls._active_agents),
            "agents_by_type": {},
            "agents_by_status": {},
            "agent_details": {}
        }
        
        for agent_id, agent in cls._active_agents.items():
            # Count by type
            agent_type = agent.agent_type
            summary["agents_by_type"][agent_type] = summary["agents_by_type"].get(agent_type, 0) + 1
            
            # Count by status
            status = agent.status.value
            summary["agents_by_status"][status] = summary["agents_by_status"].get(status, 0) + 1
            
            # Add agent details
            summary["agent_details"][agent_id] = {
                "type": agent_type,
                "status": status,
                "session_id": agent.session_id,
                "room_id": agent.room_id,
                "error_count": agent.error_count
            }
        
        return summary
