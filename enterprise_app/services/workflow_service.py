"""
Workflow service for loading and managing KYC workflow configurations.
"""

import json
import os
from typing import Dict, Any, Optional
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class WorkflowService:
    """Service for managing KYC workflow configurations."""
    
    def __init__(self):
        self.workflow_cache: Dict[str, Dict[str, Any]] = {}
        self.workflow_dir = Path(__file__).parent.parent / "config"
    
    def load_workflow(self, workflow_type: str = "kyc") -> Dict[str, Any]:
        """
        Load workflow configuration from JSON file.
        
        Args:
            workflow_type: Type of workflow to load (default: "kyc")
            
        Returns:
            Workflow configuration dictionary
            
        Raises:
            FileNotFoundError: If workflow file doesn't exist
            ValueError: If workflow file is invalid JSON
        """
        try:
            # Check cache first
            if workflow_type in self.workflow_cache:
                logger.info(f"🎯 WORKFLOW: Using cached workflow for type: {workflow_type}")
                return self.workflow_cache[workflow_type]
            
            # Construct file path
            workflow_file = self.workflow_dir / f"{workflow_type}_workflow.json"
            
            if not workflow_file.exists():
                raise FileNotFoundError(f"Workflow file not found: {workflow_file}")
            
            # Load and parse JSON
            with open(workflow_file, 'r', encoding='utf-8') as f:
                workflow_data = json.load(f)
            
            # Validate workflow structure
            if not self._validate_workflow(workflow_data):
                raise ValueError(f"Invalid workflow structure in {workflow_file}")
            
            # Cache the workflow
            self.workflow_cache[workflow_type] = workflow_data
            
            logger.info(f"🎯 WORKFLOW: Successfully loaded workflow for type: {workflow_type}")
            logger.info(f"🎯 WORKFLOW: Found {len(workflow_data.get('actionables', []))} actionables")
            
            return workflow_data
            
        except FileNotFoundError as e:
            logger.error(f"🎯 WORKFLOW: Workflow file not found: {e}")
            raise
        except json.JSONDecodeError as e:
            logger.error(f"🎯 WORKFLOW: Invalid JSON in workflow file: {e}")
            raise ValueError(f"Invalid JSON in workflow file: {e}")
        except Exception as e:
            logger.error(f"🎯 WORKFLOW: Error loading workflow: {e}")
            raise
    
    def _validate_workflow(self, workflow_data: Dict[str, Any]) -> bool:
        """
        Validate workflow structure.
        
        Args:
            workflow_data: Workflow configuration dictionary
            
        Returns:
            True if valid, False otherwise
        """
        try:
            # Check required top-level keys
            if not isinstance(workflow_data, dict):
                return False
            
            if 'actionables' not in workflow_data:
                return False
            
            actionables = workflow_data['actionables']
            if not isinstance(actionables, list):
                return False
            
            # Validate each actionable
            for actionable in actionables:
                if not isinstance(actionable, dict):
                    return False
                
                required_keys = ['type', 'action_ref', 'title', 'description']
                if not all(key in actionable for key in required_keys):
                    return False
                
                # Validate sub_actions if present
                if 'sub_actions' in actionable:
                    sub_actions = actionable['sub_actions']
                    if not isinstance(sub_actions, list):
                        return False
                    
                    for sub_action in sub_actions:
                        if not isinstance(sub_action, dict):
                            return False
                        
                        if 'type' not in sub_action or 'sub_action_step' not in sub_action:
                            return False
            
            return True
            
        except Exception as e:
            logger.error(f"🎯 WORKFLOW: Error validating workflow: {e}")
            return False
    
    def get_workflow_steps(self, workflow_type: str = "kyc", step_phase: str = "in_call") -> list:
        """
        Get workflow steps filtered by phase.
        
        Args:
            workflow_type: Type of workflow to load
            step_phase: Phase to filter by ("in_call", "pre", etc.)
            
        Returns:
            List of workflow steps matching the phase
        """
        try:
            workflow_data = self.load_workflow(workflow_type)
            steps = []
            
            for actionable in workflow_data.get('actionables', []):
                for sub_action in actionable.get('sub_actions', []):
                    if sub_action.get('sub_action_step') == step_phase:
                        steps.append(sub_action)
            
            logger.info(f"🎯 WORKFLOW: Found {len(steps)} {step_phase} steps")
            return steps
            
        except Exception as e:
            logger.error(f"🎯 WORKFLOW: Error getting workflow steps: {e}")
            return []
    
    def clear_cache(self):
        """Clear the workflow cache."""
        self.workflow_cache.clear()
        logger.info("🎯 WORKFLOW: Cache cleared")

# Global workflow service instance
workflow_service = WorkflowService()
