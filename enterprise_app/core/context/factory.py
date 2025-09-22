"""
Context Factory for creating session contexts from JSON configuration.

This module provides a factory pattern for creating different types of session
contexts (KYC, Interview, Survey) based on JSON configuration files.
"""

import json
import asyncio
from typing import Dict, Any, Optional, List
from pathlib import Path
from dataclasses import dataclass

from utils.logging.logger import get_logger
from core.agents.factory import AgentFactory
from core.agents.base import AgentConfig
from core.workflows.factory import WorkflowFactory
from core.workflows.base import WorkflowConfig

logger = get_logger(__name__)


@dataclass
class SessionContext:
    """Represents a complete session context with agent and workflow."""
    session_id: str
    room_id: str
    context_type: str
    agent: Any
    workflow: Any
    config: Dict[str, Any]


class ContextFactory:
    """Factory for creating session contexts from JSON configuration."""
    
    def __init__(self, config_dir: str = "configs/sessions"):
        """
        Initialize the context factory.
        
        Args:
            config_dir: Directory containing JSON configuration files
        """
        self.config_dir = Path(config_dir)
        self.config_dir.mkdir(parents=True, exist_ok=True)
        self._config_cache: Dict[str, Dict[str, Any]] = {}
    
    def _load_config(self, config_name: str) -> Dict[str, Any]:
        """
        Load configuration from JSON file.
        
        Args:
            config_name: Name of the configuration file (without .json extension)
            
        Returns:
            Configuration dictionary
        """
        if config_name in self._config_cache:
            return self._config_cache[config_name]
        
        config_file = self.config_dir / f"{config_name}.json"
        
        if not config_file.exists():
            raise FileNotFoundError(f"Configuration file not found: {config_file}")
        
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
            
            self._config_cache[config_name] = config
            logger.info(f"Loaded configuration: {config_name}")
            return config
            
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in configuration file {config_file}: {e}")
            raise
        except Exception as e:
            logger.error(f"Failed to load configuration {config_name}: {e}")
            raise
    
    def _create_agent_config(self, agent_config_data: Dict[str, Any]) -> AgentConfig:
        """
        Create AgentConfig from configuration data.
        
        Args:
            agent_config_data: Agent configuration data
            
        Returns:
            AgentConfig instance
        """
        return AgentConfig(
            agent_id=agent_config_data.get("agent_id"),
            agent_type=agent_config_data.get("agent_type"),
            instructions=agent_config_data.get("instructions"),
            language=agent_config_data.get("language", "en"),
            model=agent_config_data.get("model"),
            temperature=agent_config_data.get("temperature", 0.7),
            max_tokens=agent_config_data.get("max_tokens"),
            system_prompt=agent_config_data.get("system_prompt"),
            metadata=agent_config_data.get("metadata", {})
        )
    
    def _create_workflow_config(self, workflow_config_data: Dict[str, Any]) -> WorkflowConfig:
        """
        Create WorkflowConfig from configuration data.
        
        Args:
            workflow_config_data: Workflow configuration data
            
        Returns:
            WorkflowConfig instance
        """
        return WorkflowConfig(
            workflow_id=workflow_config_data.get("workflow_id"),
            workflow_type=workflow_config_data.get("workflow_type"),
            name=workflow_config_data.get("name"),
            description=workflow_config_data.get("description"),
            version=workflow_config_data.get("version", "1.0.0"),
            steps=workflow_config_data.get("steps", []),
            metadata=workflow_config_data.get("metadata", {})
        )
    
    async def create_context(
        self, 
        context_type: str, 
        session_id: str, 
        room_id: str,
        config_overrides: Optional[Dict[str, Any]] = None
    ) -> SessionContext:
        """
        Create a session context from configuration.
        
        Args:
            context_type: Type of context (kyc, interview, survey, etc.)
            session_id: Unique session identifier
            room_id: VideoSDK room identifier
            config_overrides: Optional configuration overrides
            
        Returns:
            SessionContext instance
        """
        logger.info(f"Creating {context_type} context", extra={
            "session_id": session_id,
            "room_id": room_id
        })
        
        try:
            # Load configuration
            config = self._load_config(context_type)
            
            # Apply overrides if provided
            if config_overrides:
                config = self._deep_merge(config, config_overrides)
            
            # Create agent
            agent_config = self._create_agent_config(config["agent"])
            agent = await AgentFactory.create_agent(
                config["agent"]["agent_type"], 
                agent_config
            )
            
            # Create workflow
            workflow_config = self._create_workflow_config(config["workflow"])
            workflow = await WorkflowFactory.create_workflow(
                config["workflow"]["workflow_type"], 
                workflow_config
            )
            
            # Create session context
            context = SessionContext(
                session_id=session_id,
                room_id=room_id,
                context_type=context_type,
                agent=agent,
                workflow=workflow,
                config=config
            )
            
            logger.info(f"Successfully created {context_type} context", extra={
                "session_id": session_id,
                "room_id": room_id
            })
            
            return context
            
        except Exception as e:
            logger.error(f"Failed to create {context_type} context", extra={
                "session_id": session_id,
                "room_id": room_id,
                "error": str(e)
            })
            raise
    
    async def start_session(self, context: SessionContext) -> None:
        """
        Start a session with the given context.
        
        Args:
            context: Session context to start
        """
        logger.info(f"Starting {context.context_type} session", extra={
            "session_id": context.session_id,
            "room_id": context.room_id
        })
        
        try:
            # Start agent session
            await context.agent.start_session(context.session_id, context.room_id)
            
            # Start workflow
            await context.workflow.start_workflow(context.session_id, context.room_id)
            
            logger.info(f"Successfully started {context.context_type} session", extra={
                "session_id": context.session_id,
                "room_id": context.room_id
            })
            
        except Exception as e:
            logger.error(f"Failed to start {context.context_type} session", extra={
                "session_id": context.session_id,
                "room_id": context.room_id,
                "error": str(e)
            })
            raise
    
    async def cleanup_session(self, context: SessionContext) -> None:
        """
        Cleanup a session with the given context.
        
        Args:
            context: Session context to cleanup
        """
        logger.info(f"Cleaning up {context.context_type} session", extra={
            "session_id": context.session_id,
            "room_id": context.room_id
        })
        
        try:
            # Cleanup agent
            await context.agent.cleanup()
            
            # Cleanup workflow
            await context.workflow.cleanup()
            
            logger.info(f"Successfully cleaned up {context.context_type} session", extra={
                "session_id": context.session_id,
                "room_id": context.room_id
            })
            
        except Exception as e:
            logger.error(f"Failed to cleanup {context.context_type} session", extra={
                "session_id": context.session_id,
                "room_id": context.room_id,
                "error": str(e)
            })
            raise
    
    def _deep_merge(self, base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
        """
        Deep merge two dictionaries.
        
        Args:
            base: Base dictionary
            override: Override dictionary
            
        Returns:
            Merged dictionary
        """
        result = base.copy()
        
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value
        
        return result
    
    def get_available_contexts(self) -> List[str]:
        """
        Get list of available context types.
        
        Returns:
            List of available context type names
        """
        if not self.config_dir.exists():
            return []
        
        contexts = []
        for config_file in self.config_dir.glob("*.json"):
            contexts.append(config_file.stem)
        
        return sorted(contexts)
    
    def validate_config(self, context_type: str) -> bool:
        """
        Validate a configuration file.
        
        Args:
            context_type: Type of context to validate
            
        Returns:
            True if valid, False otherwise
        """
        try:
            config = self._load_config(context_type)
            
            # Check required fields
            required_fields = ["agent", "workflow"]
            for field in required_fields:
                if field not in config:
                    logger.error(f"Missing required field '{field}' in {context_type} config")
                    return False
            
            # Validate agent config
            agent_config = config["agent"]
            agent_required = ["agent_id", "agent_type", "instructions"]
            for field in agent_required:
                if field not in agent_config:
                    logger.error(f"Missing required agent field '{field}' in {context_type} config")
                    return False
            
            # Validate workflow config
            workflow_config = config["workflow"]
            workflow_required = ["workflow_id", "workflow_type", "name", "description"]
            for field in workflow_required:
                if field not in workflow_config:
                    logger.error(f"Missing required workflow field '{field}' in {context_type} config")
                    return False
            
            logger.info(f"Configuration {context_type} is valid")
            return True
            
        except Exception as e:
            logger.error(f"Failed to validate {context_type} config: {e}")
            return False


# Global factory instance
context_factory = ContextFactory()
