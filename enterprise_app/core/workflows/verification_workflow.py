#!/usr/bin/env python3
"""
Flexible Verification Workflow for handling various verification steps.

This workflow supports multiple verification operations including selfie capture,
liveness detection, face matching, fuzzy matching, and ID document verification
in any order as defined in the workflow configuration.
"""

import asyncio
import json
import os
from typing import Dict, Any, Optional, List, Union
from datetime import datetime

from .base import BaseWorkflow, WorkflowConfig, WorkflowStep, StepStatus, WorkflowStatus
from ..exceptions import WorkflowError
from ..agents.verification_agent import VerificationAgent, AgentConfig
from ...utils.logging.logger import get_logger

logger = get_logger(__name__)


class VerificationWorkflow(BaseWorkflow):
    """Flexible workflow for various verification operations."""
    
    def __init__(self, config: WorkflowConfig):
        """Initialize the verification workflow."""
        super().__init__(config)
        self.verification_agent: Optional[VerificationAgent] = None
        self.workflow_data: Dict[str, Any] = {}
        self.conditional_flows: Dict[str, Any] = {}
        self.data_mapping: Dict[str, Any] = {}
        
    async def initialize(self) -> None:
        """Initialize the verification workflow."""
        try:
            logger.info(f"🔧 Initializing verification workflow: {self.workflow_id}")
            
            # Load workflow configuration
            await self._load_workflow_config()
            
            # Initialize verification agent
            agent_config = AgentConfig(
                agent_id=f"verification_agent_{self.workflow_id}",
                agent_type="verification",
                instructions="Handle various verification operations including selfie capture, liveness detection, face matching, and ID verification.",
                language="en",
                timeout_seconds=300,
                max_retries=3
            )
            
            self.verification_agent = VerificationAgent(agent_config)
            await self.verification_agent.initialize()
            
            # Create workflow steps from configuration
            await self._create_workflow_steps()
            
            self.status = WorkflowStatus.ACTIVE
            logger.info(f"✅ Verification workflow initialized successfully with {len(self.steps)} steps")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize verification workflow: {e}")
            await self.handle_error(e)
    
    async def _load_workflow_config(self) -> None:
        """Load workflow configuration from JSON file."""
        try:
            # Try to load from workflow file
            workflow_file = os.path.join(
                os.path.dirname(__file__), 
                "..", 
                "..", 
                "workflows", 
                "verification", 
                "verification_workflow.json"
            )
            
            if os.path.exists(workflow_file):
                with open(workflow_file, 'r') as f:
                    workflow_config = json.load(f)
                    
                self.workflow_data = workflow_config
                self.conditional_flows = workflow_config.get('conditional_flows', {})
                self.data_mapping = workflow_config.get('data_mapping', {})
                
                logger.info("📋 Loaded verification workflow configuration from file")
            else:
                # Use default configuration
                self.workflow_data = self.config.settings
                logger.info("📋 Using default verification workflow configuration")
                
        except Exception as e:
            logger.error(f"❌ Failed to load workflow configuration: {e}")
            raise WorkflowError(f"Failed to load workflow configuration: {str(e)}")
    
    async def _create_workflow_steps(self) -> None:
        """Create workflow steps from configuration."""
        try:
            steps_config = self.workflow_data.get('steps', [])
            
            for step_config in steps_config:
                step = WorkflowStep(
                    id=step_config['id'],
                    type=step_config['type'],
                    title=step_config['title'],
                    description=step_config['description'],
                    status=StepStatus.PENDING,
                    data=step_config.get('data'),
                    instructions=step_config.get('instructions'),
                    questions=step_config.get('questions', []),
                    document_types=step_config.get('document_types', []),
                    required=step_config.get('required', True),
                    order=step_config.get('order', 0)
                )
                
                self.steps.append(step)
            
            # Sort steps by order
            self.steps.sort(key=lambda x: x.order)
            
            logger.info(f"📋 Created {len(self.steps)} workflow steps")
            
        except Exception as e:
            logger.error(f"❌ Failed to create workflow steps: {e}")
            raise WorkflowError(f"Failed to create workflow steps: {str(e)}")
    
    async def start_workflow(self, session_id: str, room_id: str, **kwargs) -> None:
        """Start the verification workflow execution."""
        try:
            logger.info(f"🚀 Starting verification workflow: {self.workflow_id}")
            
            self.session_id = session_id
            self.room_id = room_id
            
            # Start verification agent session
            if self.verification_agent:
                await self.verification_agent.start_session(session_id, room_id, **kwargs)
            
            # Initialize first step
            if self.steps:
                first_step = self.steps[0]
                first_step.update_status(StepStatus.IN_PROGRESS)
                self.current_step_index = 0
            
            self.status = WorkflowStatus.ACTIVE
            self.last_activity = datetime.utcnow()
            
            await self.update_metrics({
                "workflow_started": True,
                "session_id": session_id,
                "room_id": room_id,
                "total_steps": len(self.steps)
            })
            
            logger.info(f"✅ Verification workflow started successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to start verification workflow: {e}")
            await self.handle_error(e)
    
    async def execute_step(self, step_id: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Execute a specific verification workflow step."""
        try:
            logger.info(f"🔄 Executing verification step: {step_id}")
            
            # Find the step
            step = await self.get_step_by_id(step_id)
            if not step:
                raise WorkflowError(f"Step '{step_id}' not found")
            
            # Update step status
            step.update_status(StepStatus.IN_PROGRESS)
            
            # Prepare step data
            step_data = {
                "id": step.id,
                "type": step.type,
                "title": step.title,
                "description": step.description,
                "data": step.data or {},
                "instructions": step.instructions,
                "questions": step.questions,
                "document_types": step.document_types
            }
            
            # Merge with provided data
            if data:
                step_data["data"].update(data)
            
            # Execute step using verification agent
            if self.verification_agent:
                result = await self.verification_agent.handle_workflow_step(step_data)
            else:
                result = {
                    "status": "error",
                    "message": "Verification agent not available"
                }
            
            # Update step with result
            step.update_data(result)
            
            # Store workflow data based on mapping
            await self._store_workflow_data(step_id, result)
            
            logger.info(f"✅ Verification step {step_id} executed with status: {result.get('status')}")
            return result
            
        except Exception as e:
            logger.error(f"❌ Failed to execute verification step {step_id}: {e}")
            await self.handle_error(e)
            return {
                "status": "error",
                "message": f"Step execution failed: {str(e)}"
            }
    
    async def complete_step(self, step_id: str, result: Dict[str, Any]) -> None:
        """Complete a verification workflow step."""
        try:
            logger.info(f"✅ Completing verification step: {step_id}")
            
            # Find the step
            step = await self.get_step_by_id(step_id)
            if not step:
                raise WorkflowError(f"Step '{step_id}' not found")
            
            # Update step status and data
            step.update_status(StepStatus.COMPLETED)
            step.update_data(result)
            
            # Store workflow data
            await self._store_workflow_data(step_id, result)
            
            # Check if workflow is complete
            if await self._is_workflow_complete():
                await self._complete_workflow()
            else:
                # Move to next step
                await self._move_to_next_step()
            
            await self.update_metrics({
                f"step_{step_id}_completed": True,
                "completed_steps": len([s for s in self.steps if s.is_completed()])
            })
            
            logger.info(f"✅ Verification step {step_id} completed successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to complete verification step {step_id}: {e}")
            await self.handle_error(e)
    
    async def _store_workflow_data(self, step_id: str, result: Dict[str, Any]) -> None:
        """Store workflow data based on mapping configuration."""
        try:
            if step_id in self.data_mapping:
                mapping_config = self.data_mapping[step_id]
                output_field = mapping_config.get('output_field')
                storage_type = mapping_config.get('storage_type', 'value')
                
                if output_field:
                    if storage_type == 'file':
                        # Handle file storage
                        self.collected_data[output_field] = result.get('data', {})
                    else:
                        # Handle value storage
                        self.collected_data[output_field] = result
                        
        except Exception as e:
            logger.error(f"❌ Failed to store workflow data: {e}")
    
    async def _is_workflow_complete(self) -> bool:
        """Check if the workflow is complete."""
        try:
            required_steps = [step for step in self.steps if step.required]
            completed_required_steps = [step for step in required_steps if step.is_completed()]
            
            return len(completed_required_steps) == len(required_steps)
            
        except Exception as e:
            logger.error(f"❌ Failed to check workflow completion: {e}")
            return False
    
    async def _complete_workflow(self) -> None:
        """Complete the verification workflow."""
        try:
            logger.info(f"🎉 Completing verification workflow: {self.workflow_id}")
            
            self.status = WorkflowStatus.COMPLETED
            
            # Generate final report
            final_report = await self._generate_final_report()
            
            # Stop verification agent session
            if self.verification_agent:
                await self.verification_agent.stop_session()
            
            await self.update_metrics({
                "workflow_completed": True,
                "completion_time": datetime.utcnow().isoformat(),
                "final_report": final_report
            })
            
            logger.info(f"✅ Verification workflow completed successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to complete verification workflow: {e}")
            await self.handle_error(e)
    
    async def _generate_final_report(self) -> Dict[str, Any]:
        """Generate a final verification report."""
        try:
            report = {
                "workflow_id": self.workflow_id,
                "workflow_type": self.workflow_type,
                "session_id": self.session_id,
                "room_id": self.room_id,
                "completed_at": datetime.utcnow().isoformat(),
                "total_steps": len(self.steps),
                "completed_steps": len([s for s in self.steps if s.is_completed()]),
                "failed_steps": len([s for s in self.steps if s.status == StepStatus.FAILED]),
                "collected_data": self.collected_data,
                "step_results": {step.id: step.data for step in self.steps if step.data},
                "overall_status": "completed"
            }
            
            return report
            
        except Exception as e:
            logger.error(f"❌ Failed to generate final report: {e}")
            return {}
    
    async def _move_to_next_step(self) -> None:
        """Move to the next workflow step."""
        try:
            if await self.move_to_next_step():
                current_step = await self.get_current_step()
                if current_step:
                    logger.info(f"➡️ Moved to next step: {current_step.id}")
            else:
                logger.info("🏁 No more steps in workflow")
                
        except Exception as e:
            logger.error(f"❌ Failed to move to next step: {e}")
    
    async def pause_workflow(self) -> None:
        """Pause the verification workflow."""
        try:
            logger.info(f"⏸️ Pausing verification workflow: {self.workflow_id}")
            
            self.status = WorkflowStatus.PAUSED
            
            # Pause verification agent
            if self.verification_agent:
                await self.verification_agent.pause_session()
            
            logger.info(f"✅ Verification workflow paused")
            
        except Exception as e:
            logger.error(f"❌ Failed to pause verification workflow: {e}")
            await self.handle_error(e)
    
    async def resume_workflow(self) -> None:
        """Resume the verification workflow."""
        try:
            logger.info(f"▶️ Resuming verification workflow: {self.workflow_id}")
            
            self.status = WorkflowStatus.ACTIVE
            
            # Resume verification agent
            if self.verification_agent:
                await self.verification_agent.resume_session()
            
            logger.info(f"✅ Verification workflow resumed")
            
        except Exception as e:
            logger.error(f"❌ Failed to resume verification workflow: {e}")
            await self.handle_error(e)
    
    async def cancel_workflow(self) -> None:
        """Cancel the verification workflow."""
        try:
            logger.info(f"🛑 Cancelling verification workflow: {self.workflow_id}")
            
            self.status = WorkflowStatus.CANCELLED
            
            # Stop verification agent
            if self.verification_agent:
                await self.verification_agent.stop_session()
            
            logger.info(f"✅ Verification workflow cancelled")
            
        except Exception as e:
            logger.error(f"❌ Failed to cancel verification workflow: {e}")
            await self.handle_error(e)
    
    async def cleanup(self) -> None:
        """Clean up verification workflow resources."""
        try:
            logger.info(f"🧹 Cleaning up verification workflow: {self.workflow_id}")
            
            # Cleanup verification agent
            if self.verification_agent:
                await self.verification_agent.cleanup()
            
            # Clear workflow data
            self.workflow_data = {}
            self.conditional_flows = {}
            self.data_mapping = {}
            self.collected_data = {}
            
            self.status = WorkflowStatus.CANCELLED
            logger.info(f"✅ Verification workflow cleanup completed")
            
        except Exception as e:
            logger.error(f"❌ Failed to cleanup verification workflow: {e}")
            await self.handle_error(e)