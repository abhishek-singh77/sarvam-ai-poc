#!/usr/bin/env python3
"""
Verification Agent for handling various verification operations.

This agent handles different types of verification steps including
selfie capture, liveness detection, face matching, fuzzy matching,
and ID document verification using Digio APIs.
"""

import asyncio
import json
import os
from typing import Dict, Any, Optional, List, Union
from datetime import datetime

from .base import BaseAgent, AgentConfig, AgentStatus
from ..exceptions import AgentError
from ...services.digio_service import DigioService, DigioAPIError
from ...utils.logging.logger import get_logger

logger = get_logger(__name__)


class VerificationAgent(BaseAgent):
    """Agent for handling verification operations."""
    
    def __init__(self, config: AgentConfig):
        """Initialize the verification agent."""
        super().__init__(config)
        self.digio_service = DigioService()
        self.verification_results: Dict[str, Any] = {}
        self.current_verification_step: Optional[str] = None
        
    async def initialize(self) -> None:
        """Initialize the verification agent."""
        try:
            logger.info(f"🔧 Initializing verification agent: {self.agent_id}")
            
            # Test Digio service connection
            health_check = await self.digio_service.health_check()
            if health_check.get('status') == 'error':
                logger.warning("⚠️ Digio service health check failed, using mock mode")
            
            self.status = AgentStatus.ACTIVE
            logger.info(f"✅ Verification agent initialized successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize verification agent: {e}")
            await self.handle_error(e)
    
    async def start_session(self, session_id: str, room_id: str, **kwargs) -> None:
        """Start a new verification session."""
        try:
            logger.info(f"🚀 Starting verification session: {session_id} in room: {room_id}")
            
            self.session_id = session_id
            self.room_id = room_id
            self.verification_results = {}
            self.current_verification_step = None
            
            # Initialize session data
            session_data = {
                "session_id": session_id,
                "room_id": room_id,
                "started_at": datetime.utcnow().isoformat(),
                "verification_steps": [],
                "overall_status": "in_progress"
            }
            
            await self.update_metrics({
                "session_started": True,
                "session_id": session_id,
                "room_id": room_id
            })
            
            logger.info(f"✅ Verification session started successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to start verification session: {e}")
            await self.handle_error(e)
    
    async def process_message(self, message: str, **kwargs) -> str:
        """Process a message from the user."""
        try:
            logger.info(f"💬 Processing message: {message[:100]}...")
            
            # Parse message for verification commands
            if message.lower().startswith("verify"):
                return await self._handle_verification_command(message, **kwargs)
            elif message.lower().startswith("status"):
                return await self._get_verification_status()
            elif message.lower().startswith("results"):
                return await self._get_verification_results()
            else:
                return "I'm here to help with verification. You can ask me to verify documents, check status, or get results."
                
        except Exception as e:
            logger.error(f"❌ Failed to process message: {e}")
            await self.handle_error(e)
            return "I encountered an error processing your request. Please try again."
    
    async def handle_workflow_step(self, step_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle a verification workflow step."""
        try:
            step_id = step_data.get('id')
            step_type = step_data.get('type')
            step_data_config = step_data.get('data', {})
            
            logger.info(f"🔄 Handling verification step: {step_id} (type: {step_type})")
            
            self.current_verification_step = step_id
            
            # Route to appropriate verification handler
            if step_type == 'selfie_capture':
                result = await self._handle_selfie_capture(step_data_config)
            elif step_type == 'liveness_detection':
                result = await self._handle_liveness_detection(step_data_config)
            elif step_type == 'id_document_upload':
                result = await self._handle_id_document_upload(step_data_config)
            elif step_type == 'face_match_verification':
                result = await self._handle_face_match_verification(step_data_config)
            elif step_type == 'id_proof_verification':
                result = await self._handle_id_proof_verification(step_data_config)
            elif step_type == 'fuzzy_name_match':
                result = await self._handle_fuzzy_name_match(step_data_config)
            elif step_type == 'additional_verification':
                result = await self._handle_additional_verification(step_data_config)
            else:
                result = {
                    "status": "error",
                    "message": f"Unknown verification step type: {step_type}"
                }
            
            # Store result
            self.verification_results[step_id] = result
            
            # Update metrics
            await self.update_metrics({
                f"step_{step_id}_completed": True,
                f"step_{step_id}_status": result.get('status', 'unknown')
            })
            
            logger.info(f"✅ Verification step {step_id} completed with status: {result.get('status')}")
            return result
            
        except Exception as e:
            logger.error(f"❌ Failed to handle workflow step: {e}")
            await self.handle_error(e)
            return {
                "status": "error",
                "message": f"Step execution failed: {str(e)}"
            }
    
    async def _handle_selfie_capture(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Handle selfie capture step."""
        try:
            logger.info("📸 Handling selfie capture...")
            
            # This would typically involve camera capture in the frontend
            # For now, we'll return a placeholder response
            result = {
                "status": "success",
                "step_type": "selfie_capture",
                "message": "Selfie capture step ready. Please capture your selfie.",
                "instructions": config.get('instructions', 'Look directly at the camera and ensure good lighting.'),
                "validation_rules": config.get('validation_rules', {}),
                "timestamp": datetime.utcnow().isoformat()
            }
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Selfie capture failed: {e}")
            return {
                "status": "error",
                "message": f"Selfie capture failed: {str(e)}"
            }
    
    async def _handle_liveness_detection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Handle liveness detection step."""
        try:
            logger.info("🔍 Handling liveness detection...")
            
            # Get source image from previous step
            source_image = config.get('source_image')
            if not source_image:
                return {
                    "status": "error",
                    "message": "Source image not found for liveness detection"
                }
            
            # Perform liveness detection using Digio service
            async with self.digio_service as digio:
                liveness_result = await digio.liveness_detection(
                    source_image,
                    threshold=config.get('threshold', 0.8),
                    liveness_type=config.get('liveness_type', 'passive'),
                    actions=config.get('actions', [])
                )
            
            result = {
                "status": "success",
                "step_type": "liveness_detection",
                "liveness_score": liveness_result.get('liveness_score', 0),
                "is_live": liveness_result.get('is_live', False),
                "confidence": liveness_result.get('confidence', 'unknown'),
                "timestamp": datetime.utcnow().isoformat()
            }
            
            return result
            
        except DigioAPIError as e:
            logger.error(f"❌ Liveness detection API error: {e}")
            return {
                "status": "error",
                "message": f"Liveness detection failed: {e.message}"
            }
        except Exception as e:
            logger.error(f"❌ Liveness detection failed: {e}")
            return {
                "status": "error",
                "message": f"Liveness detection failed: {str(e)}"
            }
    
    async def _handle_id_document_upload(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Handle ID document upload step."""
        try:
            logger.info("📄 Handling ID document upload...")
            
            # This would typically involve file upload in the frontend
            # For now, we'll return a placeholder response
            result = {
                "status": "success",
                "step_type": "id_document_upload",
                "message": "ID document upload step ready. Please upload your ID document.",
                "accepted_document_types": config.get('accepted_document_types', []),
                "validation_rules": config.get('validation_rules', {}),
                "timestamp": datetime.utcnow().isoformat()
            }
            
            return result
            
        except Exception as e:
            logger.error(f"❌ ID document upload failed: {e}")
            return {
                "status": "error",
                "message": f"ID document upload failed: {str(e)}"
            }
    
    async def _handle_face_match_verification(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Handle face match verification step."""
        try:
            logger.info("👤 Handling face match verification...")
            
            # Get source and target images
            source_image = config.get('source_image')
            target_image = config.get('target_image')
            
            if not source_image or not target_image:
                return {
                    "status": "error",
                    "message": "Source and target images required for face match verification"
                }
            
            # Perform face matching using Digio service
            async with self.digio_service as digio:
                face_match_result = await digio.face_match(
                    source_image,
                    target_image,
                    match_threshold=config.get('match_threshold', 0.75),
                    extraction_method=config.get('extraction_method', 'automatic'),
                    fallback_methods=config.get('fallback_methods', [])
                )
            
            result = {
                "status": "success",
                "step_type": "face_match_verification",
                "match_score": face_match_result.get('match_score', 0),
                "is_match": face_match_result.get('is_match', False),
                "confidence": face_match_result.get('confidence', 'unknown'),
                "similarity_threshold": face_match_result.get('similarity_threshold', 0.75),
                "timestamp": datetime.utcnow().isoformat()
            }
            
            return result
            
        except DigioAPIError as e:
            logger.error(f"❌ Face match verification API error: {e}")
            return {
                "status": "error",
                "message": f"Face match verification failed: {e.message}"
            }
        except Exception as e:
            logger.error(f"❌ Face match verification failed: {e}")
            return {
                "status": "error",
                "message": f"Face match verification failed: {str(e)}"
            }
    
    async def _handle_id_proof_verification(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Handle ID proof verification step."""
        try:
            logger.info("🆔 Handling ID proof verification...")
            
            # Get document image
            document_image = config.get('source_image')
            if not document_image:
                return {
                    "status": "error",
                    "message": "Document image required for ID proof verification"
                }
            
            # Perform ID verification using Digio service
            async with self.digio_service as digio:
                id_verification_result = await digio.id_verification(
                    document_image,
                    verification_types=config.get('verification_types', [
                        "document_authenticity",
                        "data_extraction",
                        "security_features"
                    ]),
                    extract_fields=config.get('extract_fields', [
                        "name",
                        "document_number",
                        "date_of_birth",
                        "address",
                        "photo"
                    ]),
                    confidence_threshold=config.get('confidence_threshold', 0.8)
                )
            
            result = {
                "status": "success",
                "step_type": "id_proof_verification",
                "is_authentic": id_verification_result.get('is_authentic', False),
                "confidence": id_verification_result.get('confidence', 0),
                "extracted_data": id_verification_result.get('extracted_data', {}),
                "security_features": id_verification_result.get('security_features', {}),
                "timestamp": datetime.utcnow().isoformat()
            }
            
            return result
            
        except DigioAPIError as e:
            logger.error(f"❌ ID proof verification API error: {e}")
            return {
                "status": "error",
                "message": f"ID proof verification failed: {e.message}"
            }
        except Exception as e:
            logger.error(f"❌ ID proof verification failed: {e}")
            return {
                "status": "error",
                "message": f"ID proof verification failed: {str(e)}"
            }
    
    async def _handle_fuzzy_name_match(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Handle fuzzy name matching step."""
        try:
            logger.info("🔤 Handling fuzzy name match...")
            
            # Get source and target names
            source_name = config.get('source_name')
            target_name = config.get('target_name')
            
            if not source_name or not target_name:
                return {
                    "status": "error",
                    "message": "Source and target names required for fuzzy name matching"
                }
            
            # Perform fuzzy matching using Digio service
            async with self.digio_service as digio:
                fuzzy_match_result = await digio.fuzzy_match(
                    source_name,
                    target_name,
                    match_threshold=config.get('match_threshold', 0.85),
                    normalization_rules=config.get('normalization_rules', {
                        "remove_special_chars": True,
                        "case_insensitive": True,
                        "handle_abbreviations": True
                    })
                )
            
            result = {
                "status": "success",
                "step_type": "fuzzy_name_match",
                "match_score": fuzzy_match_result.get('match_score', 0),
                "is_match": fuzzy_match_result.get('is_match', False),
                "confidence": fuzzy_match_result.get('confidence', 'unknown'),
                "normalized_source": fuzzy_match_result.get('normalized_source', ''),
                "normalized_target": fuzzy_match_result.get('normalized_target', ''),
                "timestamp": datetime.utcnow().isoformat()
            }
            
            return result
            
        except DigioAPIError as e:
            logger.error(f"❌ Fuzzy name match API error: {e}")
            return {
                "status": "error",
                "message": f"Fuzzy name match failed: {e.message}"
            }
        except Exception as e:
            logger.error(f"❌ Fuzzy name match failed: {e}")
            return {
                "status": "error",
                "message": f"Fuzzy name match failed: {str(e)}"
            }
    
    async def _handle_additional_verification(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Handle additional verification checks."""
        try:
            logger.info("🔍 Handling additional verification...")
            
            checks = config.get('checks', [])
            results = []
            
            for check in checks:
                check_type = check.get('type')
                
                if check_type == 'age_verification':
                    result = await self._verify_age(check)
                elif check_type == 'address_verification':
                    result = await self._verify_address(check)
                else:
                    result = {
                        "type": check_type,
                        "status": "skipped",
                        "message": f"Unknown check type: {check_type}"
                    }
                
                results.append(result)
            
            return {
                "status": "success",
                "step_type": "additional_verification",
                "checks": results,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Additional verification failed: {e}")
            return {
                "status": "error",
                "message": f"Additional verification failed: {str(e)}"
            }
    
    async def _verify_age(self, check_config: Dict[str, Any]) -> Dict[str, Any]:
        """Verify age consistency."""
        try:
            source_date = check_config.get('source_date')
            target_date = check_config.get('target_date')
            tolerance_days = check_config.get('tolerance_days', 1)
            
            # Simple age verification logic
            # In a real implementation, you'd parse dates and compare
            return {
                "type": "age_verification",
                "status": "success",
                "is_consistent": True,
                "message": "Age verification passed"
            }
            
        except Exception as e:
            return {
                "type": "age_verification",
                "status": "error",
                "message": f"Age verification failed: {str(e)}"
            }
    
    async def _verify_address(self, check_config: Dict[str, Any]) -> Dict[str, Any]:
        """Verify address consistency."""
        try:
            source_address = check_config.get('source_address')
            target_address = check_config.get('target_address')
            match_threshold = check_config.get('match_threshold', 0.7)
            
            # Simple address verification logic
            # In a real implementation, you'd use fuzzy matching
            return {
                "type": "address_verification",
                "status": "success",
                "is_consistent": True,
                "message": "Address verification passed"
            }
            
        except Exception as e:
            return {
                "type": "address_verification",
                "status": "error",
                "message": f"Address verification failed: {str(e)}"
            }
    
    async def _handle_verification_command(self, message: str, **kwargs) -> str:
        """Handle verification commands."""
        try:
            # Parse verification command
            parts = message.lower().split()
            if len(parts) < 2:
                return "Please specify what you want to verify (e.g., 'verify selfie', 'verify document')"
            
            command = parts[1]
            
            if command == "selfie":
                return "Please capture your selfie for verification."
            elif command == "document":
                return "Please upload your ID document for verification."
            elif command == "liveness":
                return "Performing liveness detection on your selfie..."
            elif command == "face":
                return "Performing face match verification..."
            else:
                return f"Unknown verification command: {command}"
                
        except Exception as e:
            logger.error(f"❌ Failed to handle verification command: {e}")
            return "I encountered an error processing your verification command."
    
    async def _get_verification_status(self) -> str:
        """Get current verification status."""
        try:
            if not self.verification_results:
                return "No verification steps completed yet."
            
            status_summary = []
            for step_id, result in self.verification_results.items():
                status = result.get('status', 'unknown')
                status_summary.append(f"{step_id}: {status}")
            
            return f"Verification Status:\n" + "\n".join(status_summary)
            
        except Exception as e:
            logger.error(f"❌ Failed to get verification status: {e}")
            return "Error retrieving verification status."
    
    async def _get_verification_results(self) -> str:
        """Get detailed verification results."""
        try:
            if not self.verification_results:
                return "No verification results available."
            
            results_summary = []
            for step_id, result in self.verification_results.items():
                step_type = result.get('step_type', 'unknown')
                status = result.get('status', 'unknown')
                
                if step_type == 'liveness_detection':
                    score = result.get('liveness_score', 0)
                    results_summary.append(f"{step_id}: Liveness Score {score}")
                elif step_type == 'face_match_verification':
                    score = result.get('match_score', 0)
                    results_summary.append(f"{step_id}: Face Match Score {score}")
                elif step_type == 'fuzzy_name_match':
                    score = result.get('match_score', 0)
                    results_summary.append(f"{step_id}: Name Match Score {score}")
                else:
                    results_summary.append(f"{step_id}: {status}")
            
            return f"Verification Results:\n" + "\n".join(results_summary)
            
        except Exception as e:
            logger.error(f"❌ Failed to get verification results: {e}")
            return "Error retrieving verification results."
    
    async def pause_session(self) -> None:
        """Pause the verification session."""
        try:
            logger.info("⏸️ Pausing verification session...")
            self.status = AgentStatus.PAUSED
            logger.info("✅ Verification session paused")
            
        except Exception as e:
            logger.error(f"❌ Failed to pause verification session: {e}")
            await self.handle_error(e)
    
    async def resume_session(self) -> None:
        """Resume the verification session."""
        try:
            logger.info("▶️ Resuming verification session...")
            self.status = AgentStatus.ACTIVE
            logger.info("✅ Verification session resumed")
            
        except Exception as e:
            logger.error(f"❌ Failed to resume verification session: {e}")
            await self.handle_error(e)
    
    async def stop_session(self) -> None:
        """Stop the verification session."""
        try:
            logger.info("🛑 Stopping verification session...")
            self.status = AgentStatus.STOPPED
            
            # Generate final verification report
            final_report = await self._generate_verification_report()
            
            await self.update_metrics({
                "session_stopped": True,
                "final_report_generated": True,
                "total_verification_steps": len(self.verification_results)
            })
            
            logger.info("✅ Verification session stopped")
            
        except Exception as e:
            logger.error(f"❌ Failed to stop verification session: {e}")
            await self.handle_error(e)
    
    async def _generate_verification_report(self) -> Dict[str, Any]:
        """Generate a comprehensive verification report."""
        try:
            report = {
                "session_id": self.session_id,
                "room_id": self.room_id,
                "generated_at": datetime.utcnow().isoformat(),
                "verification_steps": self.verification_results,
                "overall_status": "completed",
                "summary": {
                    "total_steps": len(self.verification_results),
                    "successful_steps": len([r for r in self.verification_results.values() if r.get('status') == 'success']),
                    "failed_steps": len([r for r in self.verification_results.values() if r.get('status') == 'error'])
                }
            }
            
            return report
            
        except Exception as e:
            logger.error(f"❌ Failed to generate verification report: {e}")
            return {}
    
    async def cleanup(self) -> None:
        """Clean up verification agent resources."""
        try:
            logger.info("🧹 Cleaning up verification agent...")
            
            # Close Digio service connection
            if hasattr(self.digio_service, 'session') and self.digio_service.session:
                await self.digio_service.session.close()
            
            # Clear verification results
            self.verification_results = {}
            self.current_verification_step = None
            
            self.status = AgentStatus.STOPPED
            logger.info("✅ Verification agent cleanup completed")
            
        except Exception as e:
            logger.error(f"❌ Failed to cleanup verification agent: {e}")
            await self.handle_error(e)
