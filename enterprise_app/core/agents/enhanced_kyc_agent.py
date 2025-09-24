#!/usr/bin/env python3
"""
Enhanced KYC Agent for comprehensive identity verification workflows.

This agent provides intelligent guidance through the complete KYC process,
including real-time assistance, parallel processing coordination, and
dynamic workflow adaptation.
"""

import asyncio
import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from enum import Enum

from .base import BaseAgent, AgentConfig, AgentStatus
from ..exceptions import AgentError, WorkflowError
from services.digio_service import digio_service
from services.database_service import database_service
from services.storage_service import storage_service
from utils.logging.logger import get_logger

logger = get_logger(__name__)


class VerificationStatus(Enum):
    """Verification status enumeration."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    MANUAL_REVIEW = "manual_review"


class EnhancedKYCAgent(BaseAgent):
    """
    Enhanced KYC Agent for comprehensive identity verification.
    
    This agent provides:
    - Dynamic workflow guidance
    - Real-time verification processing
    - Parallel operation coordination
    - Intelligent error handling
    - User assistance and support
    """
    
    def __init__(self, config: AgentConfig, **kwargs):
        """Initialize the enhanced KYC agent."""
        super().__init__(config)
        
        # Workflow state
        self.workflow_steps: List[Dict[str, Any]] = []
        self.current_step_index = 0
        self.collected_data: Dict[str, Any] = {}
        self.verification_results: Dict[str, Any] = {}
        self.parallel_tasks: Dict[str, asyncio.Task] = {}
        
        # Session state
        self.session_id: Optional[str] = None
        self.room_id: Optional[str] = None
        self.kyc_request_id: Optional[str] = None
        self.kyc_action_id: Optional[str] = None
        
        # Verification state
        self.verification_status = VerificationStatus.PENDING
        self.compliance_status = "pending"
        self.risk_score = 0.0
        
        # AI guidance state
        self.guidance_context: Dict[str, Any] = {}
        self.user_preferences: Dict[str, Any] = {}
        self.assistance_history: List[Dict[str, Any]] = []
        
    async def initialize(self) -> None:
        """Initialize the enhanced KYC agent."""
        try:
            self.status = AgentStatus.INITIALIZING
            logger.info("🚀 Initializing Enhanced KYC Agent")
            
            # Initialize verification services
            await self._initialize_verification_services()
            
            # Load workflow configuration
            await self._load_workflow_configuration()
            
            # Initialize AI guidance system
            await self._initialize_ai_guidance()
            
            self.status = AgentStatus.IDLE
            logger.info("✅ Enhanced KYC Agent initialized successfully")
            
        except Exception as e:
            self.status = AgentStatus.ERROR
            logger.error(f"❌ Failed to initialize Enhanced KYC Agent: {e}")
            await self.handle_error(e)
    
    async def start_session(self, session_id: str, room_id: str, **kwargs) -> None:
        """Start a new KYC session."""
        try:
            self.status = AgentStatus.ACTIVE
            self.session_id = session_id
            self.room_id = room_id
            
            logger.info(f"🎯 Starting KYC session: {session_id} in room: {room_id}")
            
            # Create KYC request in database
            await self._create_kyc_request(**kwargs)
            
            # Initialize workflow
            await self._initialize_workflow()
            
            # Start AI guidance
            await self._start_ai_guidance()
            
            logger.info(f"✅ KYC session started successfully: {session_id}")
            
        except Exception as e:
            logger.error(f"❌ Failed to start KYC session: {e}")
            await self.handle_error(e)
    
    async def process_message(self, message: str, **kwargs) -> str:
        """Process user message with enhanced AI guidance."""
        try:
            self.last_activity = datetime.utcnow()
            
            # Update guidance context
            self.guidance_context.update({
                "last_message": message,
                "timestamp": datetime.utcnow().isoformat(),
                "user_intent": await self._analyze_user_intent(message)
            })
            
            # Get current workflow step
            current_step = self._get_current_step()
            if not current_step:
                return await self._handle_no_active_step()
            
            # Process based on step type with AI guidance
            response = await self._process_step_with_guidance(current_step, message, **kwargs)
            
            # Log assistance interaction
            await self._log_assistance_interaction(message, response)
            
            return response
            
        except Exception as e:
            logger.error(f"❌ Error processing message: {e}")
            await self.handle_error(e)
            return "I encountered an error processing your message. Let me help you continue with the KYC process."
    
    async def handle_workflow_step(self, step_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle workflow step with enhanced processing."""
        try:
            step_type = step_data.get("type")
            step_id = step_data.get("id")
            
            logger.info(f"🔄 Processing workflow step: {step_id} ({step_type})")
            
            # Create KYC action for this step
            action_id = await self._create_kyc_action(step_data)
            
            # Process step based on type
            if step_type == "selfie_capture":
                result = await self._handle_selfie_capture_step(step_data, action_id)
            elif step_type == "document_upload":
                result = await self._handle_document_upload_step(step_data, action_id)
            elif step_type == "questionnaire":
                result = await self._handle_questionnaire_step(step_data, action_id)
            elif step_type == "verification_processing":
                result = await self._handle_verification_step(step_data, action_id)
            elif step_type == "compliance_check":
                result = await self._handle_compliance_step(step_data, action_id)
            else:
                result = await self._handle_generic_step(step_data, action_id)
            
            # Update workflow progress
            await self._update_workflow_progress(step_id, result)
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Error handling workflow step: {e}")
            await self.handle_error(e)
            return {
                "status": "error",
                "step_id": step_data.get("id"),
                "error": str(e)
            }
    
    async def _create_kyc_request(self, **kwargs) -> None:
        """Create KYC request in database."""
        try:
            request_data = {
                "id": f"kyc_req_{uuid.uuid4().hex[:8]}",
                "client_reference_id": self.room_id,
                "owner_id": kwargs.get("owner_id", "system"),
                "sub_user_id": kwargs.get("sub_user_id", "user"),
                "customer_identifier": kwargs.get("customer_identifier"),
                "customer_name": kwargs.get("customer_name"),
                "status": "active",
                "expire_in_days": 30,
                "template_id": "complete_kyc_workflow",
                "is_internal": 0,
                "initiated_at": datetime.utcnow()
            }
            
            kyc_request = await database_service.create_kyc_request(request_data)
            self.kyc_request_id = kyc_request["id"]
            
            logger.info(f"✅ Created KYC request: {self.kyc_request_id}")
            
        except Exception as e:
            logger.error(f"❌ Failed to create KYC request: {e}")
            raise
    
    async def _create_kyc_action(self, step_data: Dict[str, Any]) -> str:
        """Create KYC action for workflow step."""
        try:
            action_data = {
                "id": f"action_{uuid.uuid4().hex[:8]}",
                "request_id": self.kyc_request_id,
                "owner_id": "system",
                "sub_user_id": "user",
                "title": step_data.get("title", ""),
                "type": step_data.get("type", ""),
                "description": step_data.get("description", ""),
                "status": "pending",
                "method": "ai_guided",
                "verification_method": step_data.get("type", ""),
                "created_at": datetime.utcnow()
            }
            
            kyc_action = await database_service.create_kyc_action(action_data)
            self.kyc_action_id = kyc_action["id"]
            
            return self.kyc_action_id
            
        except Exception as e:
            logger.error(f"❌ Failed to create KYC action: {e}")
            raise
    
    async def _handle_selfie_capture_step(self, step_data: Dict[str, Any], action_id: str) -> Dict[str, Any]:
        """Handle selfie capture step with liveness detection."""
        try:
            logger.info("📸 Processing selfie capture step")
            
            # Create sub-actions for selfie capture
            sub_actions = []
            
            # Camera setup sub-action
            camera_sub_action = await self._create_sub_action(
                action_id, "camera_setup", "Camera Setup", "PRE"
            )
            sub_actions.append(camera_sub_action)
            
            # Selfie guidance sub-action
            guidance_sub_action = await self._create_sub_action(
                action_id, "selfie_guidance", "Selfie Guidance", "PROCESS"
            )
            sub_actions.append(guidance_sub_action)
            
            # Liveness detection sub-action
            liveness_sub_action = await self._create_sub_action(
                action_id, "liveness_detection", "Liveness Detection", "PROCESS"
            )
            sub_actions.append(liveness_sub_action)
            
            return {
                "status": "success",
                "step_id": step_data["id"],
                "action_id": action_id,
                "sub_actions": sub_actions,
                "message": "Selfie capture step initialized. Please follow the guidance to capture your selfie."
            }
            
        except Exception as e:
            logger.error(f"❌ Error in selfie capture step: {e}")
            return {
                "status": "error",
                "step_id": step_data["id"],
                "error": str(e)
            }
    
    async def _handle_document_upload_step(self, step_data: Dict[str, Any], action_id: str) -> Dict[str, Any]:
        """Handle document upload step with OCR processing."""
        try:
            logger.info("📄 Processing document upload step")
            
            # Create sub-actions for document upload
            sub_actions = []
            
            # Document guidance sub-action
            guidance_sub_action = await self._create_sub_action(
                action_id, "document_guidance", "Document Guidance", "PRE"
            )
            sub_actions.append(guidance_sub_action)
            
            # Document upload sub-action
            upload_sub_action = await self._create_sub_action(
                action_id, "document_upload", "Document Upload", "PROCESS"
            )
            sub_actions.append(upload_sub_action)
            
            # OCR extraction sub-action
            ocr_sub_action = await self._create_sub_action(
                action_id, "ocr_extraction", "OCR Data Extraction", "PROCESS"
            )
            sub_actions.append(ocr_sub_action)
            
            return {
                "status": "success",
                "step_id": step_data["id"],
                "action_id": action_id,
                "sub_actions": sub_actions,
                "message": "Document upload step initialized. Please upload your identity document."
            }
            
        except Exception as e:
            logger.error(f"❌ Error in document upload step: {e}")
            return {
                "status": "error",
                "step_id": step_data["id"],
                "error": str(e)
            }
    
    async def _handle_questionnaire_step(self, step_data: Dict[str, Any], action_id: str) -> Dict[str, Any]:
        """Handle questionnaire step with AI guidance."""
        try:
            logger.info("❓ Processing questionnaire step")
            
            # Create sub-actions for questionnaire
            sub_actions = []
            
            # Question guidance sub-action
            guidance_sub_action = await self._create_sub_action(
                action_id, "question_guidance", "Question Guidance", "PRE"
            )
            sub_actions.append(guidance_sub_action)
            
            # Question processing sub-action
            processing_sub_action = await self._create_sub_action(
                action_id, "question_processing", "Question Processing", "PROCESS"
            )
            sub_actions.append(processing_sub_action)
            
            return {
                "status": "success",
                "step_id": step_data["id"],
                "action_id": action_id,
                "sub_actions": sub_actions,
                "questions": step_data.get("questions", []),
                "message": "Questionnaire step initialized. I'll guide you through the questions."
            }
            
        except Exception as e:
            logger.error(f"❌ Error in questionnaire step: {e}")
            return {
                "status": "error",
                "step_id": step_data["id"],
                "error": str(e)
            }
    
    async def _handle_verification_step(self, step_data: Dict[str, Any], action_id: str) -> Dict[str, Any]:
        """Handle verification step with parallel processing."""
        try:
            logger.info("🔍 Processing verification step")
            
            # Create sub-actions for verification
            sub_actions = []
            
            # Face matching sub-action
            face_match_sub_action = await self._create_sub_action(
                action_id, "face_matching", "Face Matching", "PROCESS"
            )
            sub_actions.append(face_match_sub_action)
            
            # Fuzzy matching sub-action
            fuzzy_match_sub_action = await self._create_sub_action(
                action_id, "fuzzy_matching", "Fuzzy Name Matching", "PROCESS"
            )
            sub_actions.append(fuzzy_match_sub_action)
            
            # Start parallel verification tasks
            verification_tasks = await self._start_parallel_verification(step_data, action_id)
            
            return {
                "status": "success",
                "step_id": step_data["id"],
                "action_id": action_id,
                "sub_actions": sub_actions,
                "verification_tasks": verification_tasks,
                "message": "Verification step initialized. Processing verification in parallel."
            }
            
        except Exception as e:
            logger.error(f"❌ Error in verification step: {e}")
            return {
                "status": "error",
                "step_id": step_data["id"],
                "error": str(e)
            }
    
    async def _handle_compliance_step(self, step_data: Dict[str, Any], action_id: str) -> Dict[str, Any]:
        """Handle compliance check step."""
        try:
            logger.info("⚖️ Processing compliance check step")
            
            # Create sub-actions for compliance
            sub_actions = []
            
            # Sanctions check sub-action
            sanctions_sub_action = await self._create_sub_action(
                action_id, "sanctions_check", "Sanctions Check", "PROCESS"
            )
            sub_actions.append(sanctions_sub_action)
            
            # Risk assessment sub-action
            risk_sub_action = await self._create_sub_action(
                action_id, "risk_assessment", "Risk Assessment", "PROCESS"
            )
            sub_actions.append(risk_sub_action)
            
            # Start parallel compliance tasks
            compliance_tasks = await self._start_parallel_compliance(step_data, action_id)
            
            return {
                "status": "success",
                "step_id": step_data["id"],
                "action_id": action_id,
                "sub_actions": sub_actions,
                "compliance_tasks": compliance_tasks,
                "message": "Compliance check step initialized. Processing compliance checks."
            }
            
        except Exception as e:
            logger.error(f"❌ Error in compliance step: {e}")
            return {
                "status": "error",
                "step_id": step_data["id"],
                "error": str(e)
            }
    
    async def _create_sub_action(self, action_id: str, sub_action_type: str, title: str, step: str) -> str:
        """Create KYC sub-action."""
        try:
            sub_action_data = {
                "id": f"sub_action_{uuid.uuid4().hex[:8]}",
                "action_id": action_id,
                "owner_id": "system",
                "sub_user_id": "user",
                "type": sub_action_type,
                "title": title,
                "status": "pending",
                "sub_action_step": step,
                "created_at": datetime.utcnow()
            }
            
            kyc_sub_action = await database_service.create_kyc_sub_action(sub_action_data)
            return kyc_sub_action["id"]
            
        except Exception as e:
            logger.error(f"❌ Failed to create sub-action: {e}")
            raise
    
    async def _start_parallel_verification(self, step_data: Dict[str, Any], action_id: str) -> Dict[str, Any]:
        """Start parallel verification tasks."""
        try:
            verification_config = step_data.get("verification", {})
            tasks = {}
            
            # Face matching task
            if verification_config.get("face_matching", {}).get("enabled", False):
                face_task = asyncio.create_task(
                    self._perform_face_matching(verification_config["face_matching"])
                )
                tasks["face_matching"] = face_task
            
            # Fuzzy matching task
            if verification_config.get("fuzzy_matching", {}).get("enabled", False):
                fuzzy_task = asyncio.create_task(
                    self._perform_fuzzy_matching(verification_config["fuzzy_matching"])
                )
                tasks["fuzzy_matching"] = fuzzy_task
            
            # Store tasks for monitoring
            self.parallel_tasks.update(tasks)
            
            return {
                "task_count": len(tasks),
                "task_ids": list(tasks.keys()),
                "status": "started"
            }
            
        except Exception as e:
            logger.error(f"❌ Error starting parallel verification: {e}")
            return {"status": "error", "error": str(e)}
    
    async def _start_parallel_compliance(self, step_data: Dict[str, Any], action_id: str) -> Dict[str, Any]:
        """Start parallel compliance tasks."""
        try:
            tasks = {}
            
            # Sanctions check task
            sanctions_task = asyncio.create_task(self._perform_sanctions_check())
            tasks["sanctions_check"] = sanctions_task
            
            # Risk assessment task
            risk_task = asyncio.create_task(self._perform_risk_assessment())
            tasks["risk_assessment"] = risk_task
            
            # Store tasks for monitoring
            self.parallel_tasks.update(tasks)
            
            return {
                "task_count": len(tasks),
                "task_ids": list(tasks.keys()),
                "status": "started"
            }
            
        except Exception as e:
            logger.error(f"❌ Error starting parallel compliance: {e}")
            return {"status": "error", "error": str(e)}
    
    async def _perform_face_matching(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Perform face matching between selfie and document photo."""
        try:
            logger.info("🔍 Performing face matching")
            
            # Get selfie and document photo from collected data
            selfie_data = self.collected_data.get("selfie")
            document_photo = self.collected_data.get("document_photo")
            
            if not selfie_data or not document_photo:
                return {
                    "status": "error",
                    "error": "Missing selfie or document photo data"
                }
            
            # Perform face matching using Digio
            async with digio_service as digio:
                result = await digio.face_match(
                    selfie_data,
                    document_photo,
                    match_threshold=config.get("threshold", 0.75),
                    extraction_method=config.get("extraction_method", "automatic"),
                    return_face_attributes=True
                )
            
            # Store result
            self.verification_results["face_matching"] = result
            
            logger.info(f"✅ Face matching completed: {result.get('match_score', 0)}")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Face matching failed: {e}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def _perform_fuzzy_matching(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Perform fuzzy name matching between questionnaire and document data."""
        try:
            logger.info("🔍 Performing fuzzy name matching")
            
            # Get questionnaire and document data
            questionnaire_name = self.collected_data.get("questionnaire", {}).get("full_name", "")
            document_name = self.collected_data.get("document_data", {}).get("name", "")
            
            if not questionnaire_name or not document_name:
                return {
                    "status": "error",
                    "error": "Missing questionnaire or document name data"
                }
            
            # Perform fuzzy matching using Digio
            async with digio_service as digio:
                result = await digio.fuzzy_match(
                    questionnaire_name,
                    document_name,
                    match_threshold=config.get("threshold", 0.8),
                    algorithm=config.get("algorithm", "levenshtein"),
                    return_normalized=True
                )
            
            # Store result
            self.verification_results["fuzzy_matching"] = result
            
            logger.info(f"✅ Fuzzy matching completed: {result.get('match_score', 0)}")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Fuzzy matching failed: {e}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def _perform_sanctions_check(self) -> Dict[str, Any]:
        """Perform sanctions check."""
        try:
            logger.info("⚖️ Performing sanctions check")
            
            # Get customer data
            customer_name = self.collected_data.get("questionnaire", {}).get("full_name", "")
            
            if not customer_name:
                return {
                    "status": "error",
                    "error": "Missing customer name for sanctions check"
                }
            
            # Mock sanctions check (replace with actual implementation)
            sanctions_result = {
                "status": "success",
                "customer_name": customer_name,
                "sanctions_match": False,
                "risk_level": "low",
                "timestamp": datetime.utcnow().isoformat()
            }
            
            # Store result
            self.verification_results["sanctions_check"] = sanctions_result
            
            logger.info("✅ Sanctions check completed")
            
            return sanctions_result
            
        except Exception as e:
            logger.error(f"❌ Sanctions check failed: {e}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def _perform_risk_assessment(self) -> Dict[str, Any]:
        """Perform risk assessment."""
        try:
            logger.info("📊 Performing risk assessment")
            
            # Calculate risk score based on various factors
            risk_factors = []
            risk_score = 0.0
            
            # Check verification results
            face_match_score = self.verification_results.get("face_matching", {}).get("match_score", 0)
            fuzzy_match_score = self.verification_results.get("fuzzy_matching", {}).get("match_score", 0)
            
            if face_match_score < 0.7:
                risk_factors.append("low_face_match_score")
                risk_score += 0.3
            
            if fuzzy_match_score < 0.8:
                risk_factors.append("low_name_match_score")
                risk_score += 0.2
            
            # Check document authenticity
            document_verification = self.verification_results.get("document_verification", {})
            if not document_verification.get("is_authentic", False):
                risk_factors.append("document_authenticity_concerns")
                risk_score += 0.4
            
            # Determine risk level
            if risk_score < 0.3:
                risk_level = "low"
            elif risk_score < 0.6:
                risk_level = "medium"
            else:
                risk_level = "high"
            
            risk_result = {
                "status": "success",
                "risk_score": risk_score,
                "risk_level": risk_level,
                "risk_factors": risk_factors,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            # Store result
            self.verification_results["risk_assessment"] = risk_result
            self.risk_score = risk_score
            
            logger.info(f"✅ Risk assessment completed: {risk_level} ({risk_score})")
            
            return risk_result
            
        except Exception as e:
            logger.error(f"❌ Risk assessment failed: {e}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def _initialize_verification_services(self) -> None:
        """Initialize verification services."""
        try:
            # Test Digio service connectivity
            health_check = await digio_service.health_check()
            if health_check.get("status") == "error":
                logger.warning("⚠️ Digio service not available, using mock mode")
            
            logger.info("✅ Verification services initialized")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize verification services: {e}")
            raise
    
    async def _load_workflow_configuration(self) -> None:
        """Load workflow configuration."""
        try:
            # Load complete KYC workflow
            workflow_path = "workflows/kyc/complete_kyc_workflow.json"
            with open(workflow_path, 'r') as f:
                workflow_config = json.load(f)
            
            self.workflow_steps = workflow_config["workflow_structure"]["steps"]
            
            logger.info(f"✅ Loaded workflow configuration with {len(self.workflow_steps)} steps")
            
        except Exception as e:
            logger.error(f"❌ Failed to load workflow configuration: {e}")
            raise
    
    async def _initialize_ai_guidance(self) -> None:
        """Initialize AI guidance system."""
        try:
            self.guidance_context = {
                "session_start": datetime.utcnow().isoformat(),
                "user_preferences": {},
                "assistance_mode": "active"
            }
            
            logger.info("✅ AI guidance system initialized")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize AI guidance: {e}")
            raise
    
    async def _start_ai_guidance(self) -> None:
        """Start AI guidance for the session."""
        try:
            # Initialize guidance for first step
            if self.workflow_steps:
                first_step = self.workflow_steps[0]
                await self._provide_step_guidance(first_step)
            
            logger.info("✅ AI guidance started")
            
        except Exception as e:
            logger.error(f"❌ Failed to start AI guidance: {e}")
            raise
    
    async def _provide_step_guidance(self, step: Dict[str, Any]) -> None:
        """Provide guidance for a workflow step."""
        try:
            step_type = step.get("type")
            step_title = step.get("title")
            
            guidance_messages = {
                "session_initialization": "Welcome! I'm your KYC assistant. Let me help you complete your identity verification.",
                "introduction": "I'll guide you through each step of the KYC process. Don't worry, I'm here to help!",
                "selfie_capture": "Now let's take a clear selfie. Make sure you're in good lighting and looking directly at the camera.",
                "document_upload": "Please upload a clear photo of your identity document. I'll help you position it correctly.",
                "questionnaire": "I'll ask you a few questions to verify your information. Please answer as accurately as possible.",
                "verification_processing": "I'm now processing your verification. This may take a moment.",
                "compliance_check": "I'm performing final compliance checks to ensure everything is in order.",
                "completion": "Great! Your KYC verification is complete. Thank you for your patience!"
            }
            
            message = guidance_messages.get(step_type, f"Let's proceed with {step_title}.")
            
            # Store guidance in context
            self.guidance_context["current_guidance"] = {
                "step": step_type,
                "message": message,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            logger.info(f"📢 Provided guidance for {step_type}: {message}")
            
        except Exception as e:
            logger.error(f"❌ Failed to provide step guidance: {e}")
    
    async def _analyze_user_intent(self, message: str) -> str:
        """Analyze user intent from message."""
        try:
            # Simple intent analysis (can be enhanced with NLP)
            message_lower = message.lower()
            
            if any(word in message_lower for word in ["help", "assist", "guide"]):
                return "request_help"
            elif any(word in message_lower for word in ["ready", "start", "begin"]):
                return "ready_to_proceed"
            elif any(word in message_lower for word in ["problem", "issue", "error"]):
                return "report_problem"
            elif any(word in message_lower for word in ["question", "ask"]):
                return "ask_question"
            else:
                return "general_response"
                
        except Exception as e:
            logger.error(f"❌ Failed to analyze user intent: {e}")
            return "unknown"
    
    async def _log_assistance_interaction(self, user_message: str, agent_response: str) -> None:
        """Log assistance interaction."""
        try:
            interaction = {
                "timestamp": datetime.utcnow().isoformat(),
                "user_message": user_message,
                "agent_response": agent_response,
                "step": self._get_current_step()["type"] if self._get_current_step() else None,
                "intent": self.guidance_context.get("user_intent", "unknown")
            }
            
            self.assistance_history.append(interaction)
            
            # Keep only last 50 interactions
            if len(self.assistance_history) > 50:
                self.assistance_history = self.assistance_history[-50:]
            
        except Exception as e:
            logger.error(f"❌ Failed to log assistance interaction: {e}")
    
    def _get_current_step(self) -> Optional[Dict[str, Any]]:
        """Get current workflow step."""
        if 0 <= self.current_step_index < len(self.workflow_steps):
            return self.workflow_steps[self.current_step_index]
        return None
    
    async def _handle_no_active_step(self) -> str:
        """Handle case when no active step is available."""
        return "I don't have any active workflow steps. Let me restart the KYC process for you."
    
    async def _process_step_with_guidance(self, step: Dict[str, Any], message: str, **kwargs) -> str:
        """Process step with AI guidance."""
        try:
            step_type = step.get("type")
            user_intent = self.guidance_context.get("user_intent", "unknown")
            
            # Handle based on user intent
            if user_intent == "request_help":
                return await self._provide_help_guidance(step)
            elif user_intent == "ready_to_proceed":
                return await self._proceed_to_next_step(step)
            elif user_intent == "report_problem":
                return await self._handle_problem_report(step, message)
            elif user_intent == "ask_question":
                return await self._answer_question(step, message)
            else:
                return await self._handle_generic_response(step, message)
                
        except Exception as e:
            logger.error(f"❌ Error processing step with guidance: {e}")
            return "I'm here to help you through the KYC process. What would you like to do next?"
    
    async def _provide_help_guidance(self, step: Dict[str, Any]) -> str:
        """Provide help guidance for current step."""
        step_type = step.get("type")
        step_title = step.get("title")
        
        help_messages = {
            "selfie_capture": "For the selfie, make sure you're in good lighting, looking directly at the camera, and your face is clearly visible.",
            "document_upload": "For document upload, ensure the document is flat, well-lit, and all text is clearly readable.",
            "questionnaire": "Please answer all questions accurately based on your official documents.",
            "verification_processing": "I'm processing your verification. This usually takes 30-60 seconds.",
            "compliance_check": "I'm performing final checks. This ensures compliance with regulations."
        }
        
        base_message = help_messages.get(step_type, f"I'm here to help you with {step_title}.")
        return f"{base_message} Is there anything specific you'd like me to explain?"
    
    async def _proceed_to_next_step(self, step: Dict[str, Any]) -> str:
        """Proceed to next step."""
        try:
            # Complete current step
            await self._complete_current_step()
            
            # Move to next step
            self.current_step_index += 1
            
            if self.current_step_index < len(self.workflow_steps):
                next_step = self.workflow_steps[self.current_step_index]
                await self._provide_step_guidance(next_step)
                return f"Great! Let's move on to {next_step['title']}. {self.guidance_context.get('current_guidance', {}).get('message', '')}"
            else:
                return "Congratulations! You've completed all KYC steps. I'm now processing your verification."
                
        except Exception as e:
            logger.error(f"❌ Error proceeding to next step: {e}")
            return "Let me help you continue with the current step."
    
    async def _handle_problem_report(self, step: Dict[str, Any], message: str) -> str:
        """Handle problem report."""
        return "I understand you're having an issue. Let me help you resolve it. Can you tell me more specifically what's not working?"
    
    async def _answer_question(self, step: Dict[str, Any], message: str) -> str:
        """Answer user question."""
        return "That's a great question! Let me help you with that. Could you be more specific about what you'd like to know?"
    
    async def _handle_generic_response(self, step: Dict[str, Any], message: str) -> str:
        """Handle generic response."""
        step_type = step.get("type")
        
        if step_type == "selfie_capture":
            return "I'm ready to help you take your selfie. Please position yourself in front of the camera and let me know when you're ready."
        elif step_type == "document_upload":
            return "I'm ready to help you upload your document. Please have your ID document ready and let me know when you're ready to proceed."
        elif step_type == "questionnaire":
            return "I'm ready to ask you some questions. Please answer them as accurately as possible based on your official documents."
        else:
            return "I'm here to help you through the KYC process. What would you like to do next?"
    
    async def _complete_current_step(self) -> None:
        """Complete current workflow step."""
        try:
            current_step = self._get_current_step()
            if current_step:
                current_step["status"] = "completed"
                current_step["completed_at"] = datetime.utcnow().isoformat()
                
                logger.info(f"✅ Completed step: {current_step['id']}")
                
        except Exception as e:
            logger.error(f"❌ Error completing current step: {e}")
    
    async def _update_workflow_progress(self, step_id: str, result: Dict[str, Any]) -> None:
        """Update workflow progress."""
        try:
            # Update step status
            for step in self.workflow_steps:
                if step["id"] == step_id:
                    step["status"] = result.get("status", "completed")
                    step["result"] = result
                    break
            
            # Calculate overall progress
            completed_steps = sum(1 for step in self.workflow_steps if step.get("status") == "completed")
            total_steps = len(self.workflow_steps)
            progress_percentage = (completed_steps / total_steps) * 100 if total_steps > 0 else 0
            
            logger.info(f"📊 Workflow progress: {completed_steps}/{total_steps} ({progress_percentage:.1f}%)")
            
        except Exception as e:
            logger.error(f"❌ Error updating workflow progress: {e}")
    
    async def _initialize_workflow(self) -> None:
        """Initialize workflow."""
        try:
            # Set first step as active
            if self.workflow_steps:
                self.workflow_steps[0]["status"] = "active"
                self.current_step_index = 0
                
                logger.info(f"✅ Initialized workflow with {len(self.workflow_steps)} steps")
                
        except Exception as e:
            logger.error(f"❌ Error initializing workflow: {e}")
            raise
    
    async def _handle_generic_step(self, step_data: Dict[str, Any], action_id: str) -> Dict[str, Any]:
        """Handle generic workflow step."""
        try:
            logger.info(f"🔄 Processing generic step: {step_data['id']}")
            
            return {
                "status": "success",
                "step_id": step_data["id"],
                "action_id": action_id,
                "message": f"Processed {step_data['title']} successfully."
            }
            
        except Exception as e:
            logger.error(f"❌ Error in generic step: {e}")
            return {
                "status": "error",
                "step_id": step_data["id"],
                "error": str(e)
            }
    
    async def end_session(self) -> None:
        """End KYC session."""
        try:
            self.status = AgentStatus.IDLE
            
            # Cancel any running parallel tasks
            for task_id, task in self.parallel_tasks.items():
                if not task.done():
                    task.cancel()
            
            # Clean up session data
            self.session_id = None
            self.room_id = None
            self.kyc_request_id = None
            self.kyc_action_id = None
            
            logger.info("✅ KYC session ended successfully")
            
        except Exception as e:
            logger.error(f"❌ Error ending KYC session: {e}")
    
    async def get_session_summary(self) -> Dict[str, Any]:
        """Get session summary."""
        try:
            return {
                "session_id": self.session_id,
                "room_id": self.room_id,
                "kyc_request_id": self.kyc_request_id,
                "verification_status": self.verification_status.value,
                "compliance_status": self.compliance_status,
                "risk_score": self.risk_score,
                "workflow_progress": {
                    "current_step": self.current_step_index,
                    "total_steps": len(self.workflow_steps),
                    "completed_steps": sum(1 for step in self.workflow_steps if step.get("status") == "completed")
                },
                "verification_results": self.verification_results,
                "assistance_interactions": len(self.assistance_history)
            }
            
        except Exception as e:
            logger.error(f"❌ Error getting session summary: {e}")
            return {"error": str(e)}
