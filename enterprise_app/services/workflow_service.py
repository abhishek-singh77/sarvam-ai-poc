#!/usr/bin/env python3
"""
Workflow Service for managing KYC workflow steps and progress
"""

import json
import os
from typing import Dict, Any, List, Optional
from utils.logging.logger import get_logger

logger = get_logger(__name__)

class WorkflowStep:
    """Represents a single workflow step"""
    
    def __init__(self, step_data: Dict[str, Any]):
        self.id = step_data.get("id")
        self.type = step_data.get("type")
        self.title = step_data.get("title")
        self.description = step_data.get("description")
        self.status = step_data.get("status", "pending")  # pending, in_progress, completed, failed
        self.data = step_data.get("data")
        self.instructions = step_data.get("instructions")
        self.questions = step_data.get("questions", [])
        self.document_types = step_data.get("document_types", [])
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert step to dictionary"""
        return {
            "id": self.id,
            "type": self.type,
            "title": self.title,
            "description": self.description,
            "status": self.status,
            "data": self.data,
            "instructions": self.instructions,
            "questions": self.questions,
            "document_types": self.document_types
        }
    
    def update_status(self, status: str):
        """Update step status"""
        self.status = status
        logger.info(f"📋 Step {self.id} status updated to: {status}")
    
    def update_data(self, data: Any):
        """Update step data"""
        self.data = data
        logger.info(f"📋 Step {self.id} data updated")
    
    def is_completed(self) -> bool:
        """Check if step is completed"""
        return self.status == "completed"
    
    def is_in_progress(self) -> bool:
        """Check if step is in progress"""
        return self.status == "in_progress"
    
    def is_pending(self) -> bool:
        """Check if step is pending"""
        return self.status == "pending"

class WorkflowService:
    """Service for managing workflow steps and progress"""
    
    def __init__(self):
        self.workflows: Dict[str, List[WorkflowStep]] = {}
        self.current_steps: Dict[str, str] = {}  # room_id -> current_step_id
        self.workflow_templates: Dict[str, Dict[str, Any]] = {}
        self._load_workflow_templates()
    
    def _load_workflow_templates(self):
        """Load workflow templates from JSON files"""
        try:
            # Load KYC workflow
            kyc_workflow_path = os.path.join(os.path.dirname(__file__), "..", "workflows", "kyc", "kyc_workflow.json")
            if os.path.exists(kyc_workflow_path):
                with open(kyc_workflow_path, 'r') as f:
                    self.workflow_templates["kyc"] = json.load(f)
                    logger.info("📋 Loaded KYC workflow template")
            
            # Load Interview workflow
            interview_workflow_path = os.path.join(os.path.dirname(__file__), "..", "workflows", "interview", "interview_workflow.json")
            if os.path.exists(interview_workflow_path):
                with open(interview_workflow_path, 'r') as f:
                    self.workflow_templates["interview"] = json.load(f)
                    logger.info("📋 Loaded Interview workflow template")
            
            # Load Survey workflow
            survey_workflow_path = os.path.join(os.path.dirname(__file__), "..", "workflows", "survey", "survey_workflow.json")
            if os.path.exists(survey_workflow_path):
                with open(survey_workflow_path, 'r') as f:
                    self.workflow_templates["survey"] = json.load(f)
                    logger.info("📋 Loaded Survey workflow template")
            
            # Load default workflow if no specific templates found
            if not self.workflow_templates:
                self._create_default_workflow()
                
        except Exception as e:
            logger.error(f"❌ Failed to load workflow templates: {e}")
            self._create_default_workflow()
    
    def _create_default_workflow(self):
        """Create a default workflow template"""
        self.workflow_templates["default"] = {
            "name": "Default KYC Workflow",
            "description": "Default KYC verification workflow",
            "steps": [
                {
                    "id": "welcome",
                    "type": "greeting",
                    "title": "Welcome",
                    "description": "Welcome the user and explain the process",
                    "status": "pending",
                    "instructions": "Greet the user and explain the KYC process",
                    "questions": ["Hello! Welcome to our KYC verification process."]
                },
                {
                    "id": "identity_verification",
                    "type": "document_verification",
                    "title": "Identity Verification",
                    "description": "Verify user's identity documents",
                    "status": "pending",
                    "instructions": "Ask user to show their identity document",
                    "document_types": ["passport", "driving_license", "national_id"]
                },
                {
                    "id": "completion",
                    "type": "completion",
                    "title": "Process Complete",
                    "description": "KYC process completed successfully",
                    "status": "pending",
                    "instructions": "Thank the user and confirm completion"
                }
            ]
        }
        logger.info("📋 Created default workflow template")
    
    def load_workflow(self, room_id: str, workflow_type: str = "kyc") -> Dict[str, Any]:
        """Load a workflow for a room"""
        try:
            # Try to load new format first, fallback to old format
            workflow_config = self._load_workflow_config(workflow_type)
            
            if not workflow_config:
                raise ValueError(f"Workflow template '{workflow_type}' not found")
            
            # Create workflow steps based on format
            steps = []
            if "actionables" in workflow_config:
                # New format with actionables
                steps = self._parse_new_format(workflow_config)
            elif "workflow" in workflow_config and "steps" in workflow_config["workflow"]:
                # Old format with workflow.steps
                steps = self._parse_old_format(workflow_config)
            else:
                raise ValueError("Invalid workflow format")
            
            # Store workflow
            self.workflows[room_id] = steps
            self.current_steps[room_id] = steps[0].id if steps else None
            
            logger.info(f"📋 Loaded {workflow_type} workflow for room {room_id} with {len(steps)} steps")
            
            return {
                "status": "success",
                "room_id": room_id,
                "workflow_type": workflow_type,
                "total_steps": len(steps),
                "current_step": self.current_steps[room_id],
                "workflow": workflow_config
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to load workflow for room {room_id}: {e}")
            return {
                "status": "error",
                "room_id": room_id,
                "error": str(e)
            }
    
    def _load_workflow_config(self, workflow_type: str) -> Dict[str, Any]:
        """Load workflow configuration from file"""
        try:
            # Try new format first
            new_config_path = f"configs/sessions/{workflow_type}_new.json"
            if os.path.exists(new_config_path):
                with open(new_config_path, 'r') as f:
                    return json.load(f)
            
            # Fallback to old format
            old_config_path = f"configs/sessions/{workflow_type}.json"
            if os.path.exists(old_config_path):
                with open(old_config_path, 'r') as f:
                    return json.load(f)
            
            return None
        except Exception as e:
            logger.error(f"❌ Failed to load workflow config: {e}")
            return None
    
    def _parse_new_format(self, config: Dict[str, Any]) -> List[WorkflowStep]:
        """Parse new workflow format with actionables"""
        steps = []
        
        for actionable in config.get("actionables", []):
            for sub_action in actionable.get("sub_actions", []):
                step_data = {
                    "id": sub_action.get("sub_action_ref", f"{sub_action.get('type', 'unknown')}-{len(steps)}"),
                    "type": sub_action.get("type", "unknown"),
                    "title": sub_action.get("title", sub_action.get("sub_action_name", "Unknown Step")),
                    "description": sub_action.get("description", ""),
                    "status": "pending",
                    "data": {
                        "sub_action_step": sub_action.get("sub_action_step", "in_call"),
                        "captureType": sub_action.get("frame_capture_type"),
                        "questions": sub_action.get("questionnaire", {}).get("questions", []),
                        "optional": sub_action.get("optional", False),
                        "validation_type": sub_action.get("strict_validation_type"),
                        "face_match_sources": sub_action.get("face_match_sources", []),
                        "perform_face_match_in_sync": sub_action.get("perform_face_match_in_sync", False),
                        "perform_central_db_check_in_sync": sub_action.get("perform_central_db_check_in_sync", False)
                    }
                }
                steps.append(WorkflowStep(step_data))
        
        # Sort steps by phase (pre, in_call, post)
        phase_order = {"pre": 0, "in_call": 1, "post": 2}
        steps.sort(key=lambda x: phase_order.get(x.data.get("sub_action_step", "in_call"), 1))
        
        return steps
    
    def _parse_old_format(self, config: Dict[str, Any]) -> List[WorkflowStep]:
        """Parse old workflow format with workflow.steps"""
        steps = []
        for step_data in config.get("workflow", {}).get("steps", []):
            steps.append(WorkflowStep(step_data))
        return steps
    
    def get_workflow_progress(self, room_id: str) -> Dict[str, Any]:
        """Get workflow progress for a room"""
        try:
            if room_id not in self.workflows:
                return {
                    "status": "error",
                    "room_id": room_id,
                    "error": "No workflow found for this room"
                }
            
            steps = self.workflows[room_id]
            current_step_id = self.current_steps.get(room_id)
            
            # Calculate progress
            total_steps = len(steps)
            completed_steps = len([s for s in steps if s.is_completed()])
            progress_percentage = (completed_steps / total_steps * 100) if total_steps > 0 else 0
            
            # Get current step details
            current_step = None
            if current_step_id:
                current_step = next((s for s in steps if s.id == current_step_id), None)
            
            return {
                "status": "success",
                "room_id": room_id,
                "total_steps": total_steps,
                "completed_steps": completed_steps,
                "progress_percentage": progress_percentage,
                "current_step": current_step.to_dict() if current_step else None,
                "all_steps": [step.to_dict() for step in steps]
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get workflow progress for room {room_id}: {e}")
            return {
                "status": "error",
                "room_id": room_id,
                "error": str(e)
            }
    
    def start_workflow_step(self, room_id: str, step_id: str, data: Any = None) -> Dict[str, Any]:
        """Start a workflow step"""
        try:
            if room_id not in self.workflows:
                return {
                    "status": "error",
                    "room_id": room_id,
                    "error": "No workflow found for this room"
                }
            
            # Find the step
            step = next((s for s in self.workflows[room_id] if s.id == step_id), None)
            if not step:
                return {
                    "status": "error",
                    "room_id": room_id,
                    "error": f"Step '{step_id}' not found"
                }
            
            # Update step status and data
            step.update_status("in_progress")
            if data is not None:
                step.update_data(data)
            
            # Update current step
            self.current_steps[room_id] = step_id
            
            logger.info(f"📋 Started step '{step_id}' for room {room_id}")
            
            return {
                "status": "success",
                "room_id": room_id,
                "step_id": step_id,
                "step": step.to_dict()
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to start workflow step for room {room_id}: {e}")
            return {
                "status": "error",
                "room_id": room_id,
                "error": str(e)
            }
    
    def complete_workflow_step(self, room_id: str, step_id: str, data: Any = None) -> Dict[str, Any]:
        """Complete a workflow step"""
        try:
            if room_id not in self.workflows:
                return {
                    "status": "error",
                    "room_id": room_id,
                    "error": "No workflow found for this room"
                }
            
            # Find the step
            step = next((s for s in self.workflows[room_id] if s.id == step_id), None)
            if not step:
                return {
                    "status": "error",
                    "room_id": room_id,
                    "error": f"Step '{step_id}' not found"
                }
            
            # Update step status and data
            step.update_status("completed")
            if data is not None:
                step.update_data(data)
            
            # Move to next step
            next_step = self._get_next_step(room_id, step_id)
            if next_step:
                self.current_steps[room_id] = next_step.id
                logger.info(f"📋 Moved to next step '{next_step.id}' for room {room_id}")
            else:
                # Workflow completed
                self.current_steps[room_id] = None
                logger.info(f"📋 Workflow completed for room {room_id}")
            
            return {
                "status": "success",
                "room_id": room_id,
                "step_id": step_id,
                "step": step.to_dict(),
                "next_step": next_step.to_dict() if next_step else None,
                "workflow_completed": next_step is None
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to complete workflow step for room {room_id}: {e}")
            return {
                "status": "error",
                "room_id": room_id,
                "error": str(e)
            }
    
    def _get_next_step(self, room_id: str, current_step_id: str) -> Optional[WorkflowStep]:
        """Get the next step in the workflow"""
        if room_id not in self.workflows:
            return None
        
        steps = self.workflows[room_id]
        current_index = next((i for i, s in enumerate(steps) if s.id == current_step_id), -1)
        
        if current_index >= 0 and current_index < len(steps) - 1:
            return steps[current_index + 1]
        
        return None
    
    def get_current_step(self, room_id: str) -> Optional[WorkflowStep]:
        """Get the current step for a room"""
        if room_id not in self.workflows:
            return None
        
        current_step_id = self.current_steps.get(room_id)
        if not current_step_id:
            return None
        
        return next((s for s in self.workflows[room_id] if s.id == current_step_id), None)
    
    def reset_workflow(self, room_id: str) -> Dict[str, Any]:
        """Reset workflow for a room"""
        try:
            if room_id in self.workflows:
                # Reset all steps to pending
                for step in self.workflows[room_id]:
                    step.update_status("pending")
                
                # Set first step as current
                if self.workflows[room_id]:
                    self.current_steps[room_id] = self.workflows[room_id][0].id
                
                logger.info(f"📋 Reset workflow for room {room_id}")
                
                return {
                    "status": "success",
                    "room_id": room_id,
                    "message": "Workflow reset successfully"
                }
            else:
                return {
                    "status": "error",
                    "room_id": room_id,
                    "error": "No workflow found for this room"
                }
                
        except Exception as e:
            logger.error(f"❌ Failed to reset workflow for room {room_id}: {e}")
            return {
                "status": "error",
                "room_id": room_id,
                "error": str(e)
            }
    
    def clear_session_data(self, room_id: str) -> Dict[str, Any]:
        """Clear all session data for a room (used when session is deleted)"""
        try:
            # Remove workflow data
            if room_id in self.workflows:
                del self.workflows[room_id]
                logger.info(f"📋 Cleared workflow data for room {room_id}")
            
            # Remove current step tracking
            if room_id in self.current_steps:
                del self.current_steps[room_id]
                logger.info(f"📋 Cleared current step tracking for room {room_id}")
            
            return {
                "status": "success",
                "room_id": room_id,
                "message": "Session data cleared successfully"
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to clear session data for room {room_id}: {e}")
            return {
                "status": "error",
                "room_id": room_id,
                "error": str(e)
            }

# Global instance
workflow_service = WorkflowService()
