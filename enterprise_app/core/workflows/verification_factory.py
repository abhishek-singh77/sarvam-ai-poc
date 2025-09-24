#!/usr/bin/env python3
"""
Verification Workflow Factory for creating verification workflows.

This factory creates and manages verification workflows with different
configurations and step orders as defined in the workflow JSON.
"""

import json
import os
from typing import Dict, Any, Optional, List
from datetime import datetime

from .base import WorkflowConfig, WorkflowStatus
from .verification_workflow import VerificationWorkflow
from ..exceptions import WorkflowError
from ...utils.logging.logger import get_logger

logger = get_logger(__name__)


class VerificationWorkflowFactory:
    """Factory for creating verification workflows."""
    
    def __init__(self):
        """Initialize the verification workflow factory."""
        self.workflow_templates: Dict[str, Dict[str, Any]] = {}
        self.active_workflows: Dict[str, VerificationWorkflow] = {}
        self._load_workflow_templates()
    
    def _load_workflow_templates(self) -> None:
        """Load verification workflow templates."""
        try:
            # Load verification workflow template
            verification_workflow_path = os.path.join(
                os.path.dirname(__file__), 
                "..", 
                "..", 
                "workflows", 
                "verification", 
                "verification_workflow.json"
            )
            
            if os.path.exists(verification_workflow_path):
                with open(verification_workflow_path, 'r') as f:
                    self.workflow_templates["verification"] = json.load(f)
                    logger.info("📋 Loaded verification workflow template")
            else:
                logger.warning("⚠️ Verification workflow template not found, using default")
                self._create_default_verification_template()
                
        except Exception as e:
            logger.error(f"❌ Failed to load verification workflow templates: {e}")
            self._create_default_verification_template()
    
    def _create_default_verification_template(self) -> None:
        """Create a default verification workflow template."""
        self.workflow_templates["verification"] = {
            "name": "Default Verification Workflow",
            "description": "Default verification workflow with basic steps",
            "version": "1.0.0",
            "workflow_type": "verification",
            "settings": {
                "timeout_minutes": 30,
                "max_retries": 3,
                "enable_parallel_steps": False,
                "allow_step_reordering": True,
                "require_all_steps": False
            },
            "steps": [
                {
                    "id": "introduction",
                    "type": "introduction",
                    "title": "Welcome to Verification",
                    "description": "Welcome to our verification process.",
                    "status": "pending",
                    "order": 1,
                    "required": True,
                    "instructions": "Welcome the user and explain the verification process"
                },
                {
                    "id": "selfie_capture",
                    "type": "selfie_capture",
                    "title": "Capture Selfie",
                    "description": "Please capture a clear selfie for verification purposes.",
                    "status": "pending",
                    "order": 2,
                    "required": True,
                    "instructions": "Look directly at the camera and ensure good lighting."
                },
                {
                    "id": "liveness_detection",
                    "type": "liveness_detection",
                    "title": "Liveness Check",
                    "description": "We'll verify that you're a real person.",
                    "status": "pending",
                    "order": 3,
                    "required": True,
                    "instructions": "Follow the on-screen instructions for liveness verification.",
                    "data": {
                        "source_image": "selfie_capture",
                        "liveness_type": "passive",
                        "threshold": 0.8
                    }
                },
                {
                    "id": "completion",
                    "type": "completion",
                    "title": "Verification Complete",
                    "description": "Your verification has been completed successfully.",
                    "status": "pending",
                    "order": 4,
                    "required": True,
                    "instructions": "Thank the user and provide verification results."
                }
            ],
            "conditional_flows": {},
            "data_mapping": {
                "selfie_capture": {
                    "output_field": "selfie_image",
                    "storage_type": "file",
                    "format": "base64"
                },
                "liveness_detection": {
                    "output_field": "liveness_score",
                    "storage_type": "value",
                    "format": "float"
                }
            }
        }
        logger.info("📋 Created default verification workflow template")
    
    def create_workflow(
        self, 
        workflow_id: str, 
        workflow_type: str = "verification",
        custom_config: Optional[Dict[str, Any]] = None
    ) -> VerificationWorkflow:
        """
        Create a new verification workflow.
        
        Args:
            workflow_id: Unique workflow identifier
            workflow_type: Type of workflow to create
            custom_config: Custom configuration overrides
            
        Returns:
            Created verification workflow
            
        Raises:
            WorkflowError: If workflow creation fails
        """
        try:
            logger.info(f"🏭 Creating verification workflow: {workflow_id}")
            
            # Get workflow template
            template = self.workflow_templates.get(workflow_type)
            if not template:
                raise WorkflowError(f"Workflow template '{workflow_type}' not found")
            
            # Create workflow configuration
            config = WorkflowConfig(
                workflow_id=workflow_id,
                workflow_type=workflow_type,
                name=template.get('name', 'Verification Workflow'),
                description=template.get('description', 'Flexible verification workflow'),
                version=template.get('version', '1.0.0'),
                steps=template.get('steps', []),
                settings=template.get('settings', {}),
                timeout_minutes=template.get('settings', {}).get('timeout_minutes', 30),
                max_retries=template.get('settings', {}).get('max_retries', 3),
                enable_parallel_steps=template.get('settings', {}).get('enable_parallel_steps', False),
                custom_settings=custom_config
            )
            
            # Create verification workflow
            workflow = VerificationWorkflow(config)
            
            # Store active workflow
            self.active_workflows[workflow_id] = workflow
            
            logger.info(f"✅ Created verification workflow: {workflow_id}")
            return workflow
            
        except Exception as e:
            logger.error(f"❌ Failed to create verification workflow: {e}")
            raise WorkflowError(f"Failed to create verification workflow: {str(e)}")
    
    def get_workflow(self, workflow_id: str) -> Optional[VerificationWorkflow]:
        """
        Get an active verification workflow.
        
        Args:
            workflow_id: Workflow identifier
            
        Returns:
            Verification workflow if found, None otherwise
        """
        return self.active_workflows.get(workflow_id)
    
    def remove_workflow(self, workflow_id: str) -> bool:
        """
        Remove an active verification workflow.
        
        Args:
            workflow_id: Workflow identifier
            
        Returns:
            True if workflow was removed, False if not found
        """
        if workflow_id in self.active_workflows:
            workflow = self.active_workflows[workflow_id]
            
            # Cleanup workflow if it's still active
            if workflow.status in [WorkflowStatus.ACTIVE, WorkflowStatus.PAUSED]:
                try:
                    # Note: In a real implementation, you'd want to properly cleanup
                    # This is a simplified version
                    pass
                except Exception as e:
                    logger.error(f"❌ Failed to cleanup workflow {workflow_id}: {e}")
            
            del self.active_workflows[workflow_id]
            logger.info(f"🗑️ Removed verification workflow: {workflow_id}")
            return True
        
        return False
    
    def list_active_workflows(self) -> List[Dict[str, Any]]:
        """
        List all active verification workflows.
        
        Returns:
            List of active workflow information
        """
        workflows = []
        
        for workflow_id, workflow in self.active_workflows.items():
            try:
                workflow_info = {
                    "workflow_id": workflow_id,
                    "workflow_type": workflow.workflow_type,
                    "status": workflow.status.value,
                    "session_id": workflow.session_id,
                    "room_id": workflow.room_id,
                    "created_at": workflow.created_at.isoformat(),
                    "last_activity": workflow.last_activity.isoformat(),
                    "total_steps": len(workflow.steps),
                    "completed_steps": len([s for s in workflow.steps if s.is_completed()])
                }
                workflows.append(workflow_info)
                
            except Exception as e:
                logger.error(f"❌ Failed to get workflow info for {workflow_id}: {e}")
        
        return workflows
    
    def create_custom_workflow(
        self, 
        workflow_id: str, 
        steps_config: List[Dict[str, Any]],
        settings: Optional[Dict[str, Any]] = None
    ) -> VerificationWorkflow:
        """
        Create a custom verification workflow with specific steps.
        
        Args:
            workflow_id: Unique workflow identifier
            steps_config: Custom steps configuration
            settings: Custom settings
            
        Returns:
            Created custom verification workflow
            
        Raises:
            WorkflowError: If workflow creation fails
        """
        try:
            logger.info(f"🏭 Creating custom verification workflow: {workflow_id}")
            
            # Create custom workflow configuration
            config = WorkflowConfig(
                workflow_id=workflow_id,
                workflow_type="verification",
                name="Custom Verification Workflow",
                description="Custom verification workflow with user-defined steps",
                version="1.0.0",
                steps=steps_config,
                settings=settings or {},
                timeout_minutes=settings.get('timeout_minutes', 30) if settings else 30,
                max_retries=settings.get('max_retries', 3) if settings else 3,
                enable_parallel_steps=settings.get('enable_parallel_steps', False) if settings else False
            )
            
            # Create verification workflow
            workflow = VerificationWorkflow(config)
            
            # Store active workflow
            self.active_workflows[workflow_id] = workflow
            
            logger.info(f"✅ Created custom verification workflow: {workflow_id}")
            return workflow
            
        except Exception as e:
            logger.error(f"❌ Failed to create custom verification workflow: {e}")
            raise WorkflowError(f"Failed to create custom verification workflow: {str(e)}")
    
    def get_workflow_template(self, workflow_type: str) -> Optional[Dict[str, Any]]:
        """
        Get a workflow template.
        
        Args:
            workflow_type: Type of workflow template
            
        Returns:
            Workflow template if found, None otherwise
        """
        return self.workflow_templates.get(workflow_type)
    
    def list_available_templates(self) -> List[str]:
        """
        List available workflow templates.
        
        Returns:
            List of available template names
        """
        return list(self.workflow_templates.keys())
    
    def cleanup_inactive_workflows(self) -> int:
        """
        Cleanup inactive workflows.
        
        Returns:
            Number of workflows cleaned up
        """
        cleaned_count = 0
        inactive_workflows = []
        
        for workflow_id, workflow in self.active_workflows.items():
            try:
                if workflow.status in [WorkflowStatus.COMPLETED, WorkflowStatus.FAILED, WorkflowStatus.CANCELLED]:
                    inactive_workflows.append(workflow_id)
            except Exception as e:
                logger.error(f"❌ Failed to check workflow status for {workflow_id}: {e}")
                # Consider it inactive if we can't check status
                inactive_workflows.append(workflow_id)
        
        # Remove inactive workflows
        for workflow_id in inactive_workflows:
            if self.remove_workflow(workflow_id):
                cleaned_count += 1
        
        if cleaned_count > 0:
            logger.info(f"🧹 Cleaned up {cleaned_count} inactive verification workflows")
        
        return cleaned_count


# Global factory instance
verification_workflow_factory = VerificationWorkflowFactory()
