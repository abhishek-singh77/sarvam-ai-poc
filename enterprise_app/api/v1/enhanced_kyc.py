#!/usr/bin/env python3
"""
Enhanced KYC API endpoints for comprehensive identity verification.

This module provides API endpoints for the complete KYC workflow including
parallel processing, real-time verification, and AI agent guidance.
"""

import asyncio
import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from services.parallel_processing_service import parallel_processing_service, TaskPriority
from services.database_service import database_service
from services.storage_service import storage_service
from services.digio_service import digio_service
from core.agents.enhanced_kyc_agent import EnhancedKYCAgent, VerificationStatus
from core.agents.base import AgentConfig
from utils.logging.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()

# Global agent instance
enhanced_kyc_agent: Optional[EnhancedKYCAgent] = None


# Request/Response Models
class KYCSessionRequest(BaseModel):
    """Request model for starting a KYC session."""
    room_id: str = Field(..., description="Video room ID")
    owner_id: Optional[str] = Field(None, description="Owner ID")
    sub_user_id: Optional[str] = Field(None, description="Sub user ID")
    customer_identifier: Optional[str] = Field(None, description="Customer identifier")
    customer_name: Optional[str] = Field(None, description="Customer name")
    workflow_type: str = Field("complete_kyc", description="Workflow type")


class KYCSessionResponse(BaseModel):
    """Response model for KYC session."""
    session_id: str
    room_id: str
    kyc_request_id: str
    status: str
    message: str
    workflow_steps: List[Dict[str, Any]]


class VerificationRequest(BaseModel):
    """Request model for verification operations."""
    session_id: str
    step_id: str
    data: Dict[str, Any]


class VerificationResponse(BaseModel):
    """Response model for verification operations."""
    status: str
    step_id: str
    result: Dict[str, Any]
    message: str
    timestamp: str


class ParallelTaskRequest(BaseModel):
    """Request model for parallel task submission."""
    session_id: str
    tasks: List[Dict[str, Any]]
    priority: str = "normal"


class ParallelTaskResponse(BaseModel):
    """Response model for parallel task submission."""
    status: str
    task_ids: List[str]
    message: str


# Dependency to get enhanced KYC agent
async def get_enhanced_kyc_agent() -> EnhancedKYCAgent:
    """Get or create enhanced KYC agent instance."""
    global enhanced_kyc_agent
    
    if enhanced_kyc_agent is None:
        config = AgentConfig(
            agent_id="enhanced_kyc_agent",
            agent_type="enhanced_kyc",
            name="Enhanced KYC Agent",
            description="Comprehensive KYC verification agent"
        )
        enhanced_kyc_agent = EnhancedKYCAgent(config)
        await enhanced_kyc_agent.initialize()
    
    return enhanced_kyc_agent


# KYC Session Management
@router.post("/session/start", response_model=KYCSessionResponse)
async def start_kyc_session(
    request: KYCSessionRequest,
    agent: EnhancedKYCAgent = Depends(get_enhanced_kyc_agent)
) -> KYCSessionResponse:
    """
    Start a new enhanced KYC session.
    
    This endpoint initializes a complete KYC workflow with AI agent guidance
    and parallel processing capabilities.
    """
    try:
        logger.info(f"🚀 Starting enhanced KYC session for room: {request.room_id}")
        
        # Generate session ID
        session_id = f"kyc_session_{uuid.uuid4().hex[:8]}"
        
        # Start KYC session with agent
        await agent.start_session(
            session_id=session_id,
            room_id=request.room_id,
            owner_id=request.owner_id,
            sub_user_id=request.sub_user_id,
            customer_identifier=request.customer_identifier,
            customer_name=request.customer_name
        )
        
        # Get workflow steps
        workflow_steps = agent.workflow_steps
        
        logger.info(f"✅ Enhanced KYC session started: {session_id}")
        
        return KYCSessionResponse(
            session_id=session_id,
            room_id=request.room_id,
            kyc_request_id=agent.kyc_request_id or "",
            status="active",
            message="Enhanced KYC session started successfully",
            workflow_steps=workflow_steps
        )
        
    except Exception as e:
        logger.error(f"❌ Failed to start enhanced KYC session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}/status")
async def get_session_status(
    session_id: str,
    agent: EnhancedKYCAgent = Depends(get_enhanced_kyc_agent)
) -> Dict[str, Any]:
    """Get KYC session status and progress."""
    try:
        logger.info(f"📊 Getting session status: {session_id}")
        
        # Get session summary
        summary = await agent.get_session_summary()
        
        return {
            "status": "success",
            "session_id": session_id,
            "summary": summary,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to get session status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/session/{session_id}/end")
async def end_kyc_session(
    session_id: str,
    agent: EnhancedKYCAgent = Depends(get_enhanced_kyc_agent)
) -> Dict[str, Any]:
    """End KYC session and cleanup resources."""
    try:
        logger.info(f"🔚 Ending KYC session: {session_id}")
        
        # End session
        await agent.end_session()
        
        return {
            "status": "success",
            "session_id": session_id,
            "message": "KYC session ended successfully",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to end KYC session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Workflow Step Management
@router.post("/workflow/step/process", response_model=VerificationResponse)
async def process_workflow_step(
    request: VerificationRequest,
    agent: EnhancedKYCAgent = Depends(get_enhanced_kyc_agent)
) -> VerificationResponse:
    """Process a workflow step with enhanced capabilities."""
    try:
        logger.info(f"🔄 Processing workflow step: {request.step_id}")
        
        # Process workflow step
        result = await agent.handle_workflow_step(request.data)
        
        return VerificationResponse(
            status=result.get("status", "success"),
            step_id=request.step_id,
            result=result,
            message=result.get("message", "Step processed successfully"),
            timestamp=datetime.utcnow().isoformat()
        )
        
    except Exception as e:
        logger.error(f"❌ Failed to process workflow step: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Parallel Processing Endpoints
@router.post("/parallel/tasks/submit", response_model=ParallelTaskResponse)
async def submit_parallel_tasks(
    request: ParallelTaskRequest
) -> ParallelTaskResponse:
    """Submit multiple tasks for parallel processing."""
    try:
        logger.info(f"🚀 Submitting {len(request.tasks)} parallel tasks")
        
        # Convert priority string to enum
        priority_map = {
            "low": TaskPriority.LOW,
            "normal": TaskPriority.NORMAL,
            "high": TaskPriority.HIGH,
            "critical": TaskPriority.CRITICAL
        }
        priority = priority_map.get(request.priority, TaskPriority.NORMAL)
        
        # Submit batch tasks
        task_ids = await parallel_processing_service.submit_batch_tasks(
            request.tasks,
            priority
        )
        
        return ParallelTaskResponse(
            status="success",
            task_ids=task_ids,
            message=f"Submitted {len(task_ids)} tasks for parallel processing"
        )
        
    except Exception as e:
        logger.error(f"❌ Failed to submit parallel tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/parallel/tasks/{task_id}/status")
async def get_task_status(task_id: str) -> Dict[str, Any]:
    """Get status of a parallel processing task."""
    try:
        logger.info(f"📊 Getting task status: {task_id}")
        
        status = await parallel_processing_service.get_task_status(task_id)
        
        if not status:
            raise HTTPException(status_code=404, detail="Task not found")
        
        return {
            "status": "success",
            "task_id": task_id,
            "task_status": status,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get task status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/parallel/tasks/status")
async def get_all_tasks_status() -> Dict[str, Any]:
    """Get status of all parallel processing tasks."""
    try:
        logger.info("📊 Getting all tasks status")
        
        status = await parallel_processing_service.get_all_tasks_status()
        
        return {
            "status": "success",
            "tasks_status": status,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to get all tasks status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/parallel/tasks/{task_id}/cancel")
async def cancel_task(task_id: str) -> Dict[str, Any]:
    """Cancel a running parallel processing task."""
    try:
        logger.info(f"❌ Cancelling task: {task_id}")
        
        success = await parallel_processing_service.cancel_task(task_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Task not found or not cancellable")
        
        return {
            "status": "success",
            "task_id": task_id,
            "message": "Task cancelled successfully",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to cancel task: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/parallel/tasks/wait")
async def wait_for_tasks(
    task_ids: List[str],
    timeout: Optional[int] = None
) -> Dict[str, Any]:
    """Wait for multiple tasks to complete."""
    try:
        logger.info(f"⏳ Waiting for {len(task_ids)} tasks to complete")
        
        result = await parallel_processing_service.wait_for_tasks(task_ids, timeout)
        
        return {
            "status": "success",
            "wait_result": result,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to wait for tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Enhanced Verification Endpoints
@router.post("/verification/liveness/enhanced")
async def enhanced_liveness_detection(
    session_id: str = Form(...),
    image: UploadFile = File(...),
    threshold: float = Form(default=0.8),
    real_time: bool = Form(default=True)
) -> Dict[str, Any]:
    """Enhanced liveness detection with parallel processing."""
    try:
        logger.info(f"🔍 Enhanced liveness detection for session: {session_id}")
        
        # Read image data
        image_data = await image.read()
        
        # Submit liveness detection task
        task_id = await parallel_processing_service.submit_task(
            name="Enhanced Liveness Detection",
            task_type="liveness_detection",
            data={
                "image_data": image_data,
                "threshold": threshold,
                "real_time": real_time
            },
            priority=TaskPriority.HIGH,
            timeout=60
        )
        
        # Wait for task completion
        result = await parallel_processing_service.wait_for_tasks([task_id], timeout=60)
        
        if result["status"] == "completed":
            task_result = result["results"].get(task_id)
            if task_result and task_result.get("status") == "success":
                return {
                    "status": "success",
                    "session_id": session_id,
                    "task_id": task_id,
                    "liveness_result": task_result["result"],
                    "message": "Enhanced liveness detection completed successfully",
                    "timestamp": datetime.utcnow().isoformat()
                }
            else:
                return {
                    "status": "error",
                    "session_id": session_id,
                    "task_id": task_id,
                    "error": task_result.get("error", "Liveness detection failed"),
                    "timestamp": datetime.utcnow().isoformat()
                }
        else:
            return {
                "status": "error",
                "session_id": session_id,
                "task_id": task_id,
                "error": "Task timeout or failed",
                "timestamp": datetime.utcnow().isoformat()
            }
        
    except Exception as e:
        logger.error(f"❌ Enhanced liveness detection failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/verification/face-match/enhanced")
async def enhanced_face_matching(
    session_id: str = Form(...),
    source_image: UploadFile = File(...),
    target_image: UploadFile = File(...),
    threshold: float = Form(default=0.75)
) -> Dict[str, Any]:
    """Enhanced face matching with parallel processing."""
    try:
        logger.info(f"🔍 Enhanced face matching for session: {session_id}")
        
        # Read image data
        source_data = await source_image.read()
        target_data = await target_image.read()
        
        # Submit face matching task
        task_id = await parallel_processing_service.submit_task(
            name="Enhanced Face Matching",
            task_type="face_matching",
            data={
                "source_image": source_data,
                "target_image": target_data,
                "threshold": threshold
            },
            priority=TaskPriority.HIGH,
            timeout=60
        )
        
        # Wait for task completion
        result = await parallel_processing_service.wait_for_tasks([task_id], timeout=60)
        
        if result["status"] == "completed":
            task_result = result["results"].get(task_id)
            if task_result and task_result.get("status") == "success":
                return {
                    "status": "success",
                    "session_id": session_id,
                    "task_id": task_id,
                    "face_match_result": task_result["result"],
                    "message": "Enhanced face matching completed successfully",
                    "timestamp": datetime.utcnow().isoformat()
                }
            else:
                return {
                    "status": "error",
                    "session_id": session_id,
                    "task_id": task_id,
                    "error": task_result.get("error", "Face matching failed"),
                    "timestamp": datetime.utcnow().isoformat()
                }
        else:
            return {
                "status": "error",
                "session_id": session_id,
                "task_id": task_id,
                "error": "Task timeout or failed",
                "timestamp": datetime.utcnow().isoformat()
            }
        
    except Exception as e:
        logger.error(f"❌ Enhanced face matching failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/verification/fuzzy-match/enhanced")
async def enhanced_fuzzy_matching(
    session_id: str = Form(...),
    source_text: str = Form(...),
    target_text: str = Form(...),
    threshold: float = Form(default=0.8),
    algorithm: str = Form(default="levenshtein")
) -> Dict[str, Any]:
    """Enhanced fuzzy matching with parallel processing."""
    try:
        logger.info(f"🔍 Enhanced fuzzy matching for session: {session_id}")
        
        # Submit fuzzy matching task
        task_id = await parallel_processing_service.submit_task(
            name="Enhanced Fuzzy Matching",
            task_type="fuzzy_matching",
            data={
                "source_text": source_text,
                "target_text": target_text,
                "threshold": threshold,
                "algorithm": algorithm
            },
            priority=TaskPriority.NORMAL,
            timeout=30
        )
        
        # Wait for task completion
        result = await parallel_processing_service.wait_for_tasks([task_id], timeout=30)
        
        if result["status"] == "completed":
            task_result = result["results"].get(task_id)
            if task_result and task_result.get("status") == "success":
                return {
                    "status": "success",
                    "session_id": session_id,
                    "task_id": task_id,
                    "fuzzy_match_result": task_result["result"],
                    "message": "Enhanced fuzzy matching completed successfully",
                    "timestamp": datetime.utcnow().isoformat()
                }
            else:
                return {
                    "status": "error",
                    "session_id": session_id,
                    "task_id": task_id,
                    "error": task_result.get("error", "Fuzzy matching failed"),
                    "timestamp": datetime.utcnow().isoformat()
                }
        else:
            return {
                "status": "error",
                "session_id": session_id,
                "task_id": task_id,
                "error": "Task timeout or failed",
                "timestamp": datetime.utcnow().isoformat()
            }
        
    except Exception as e:
        logger.error(f"❌ Enhanced fuzzy matching failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/verification/document/enhanced")
async def enhanced_document_verification(
    session_id: str = Form(...),
    document_image: UploadFile = File(...),
    confidence_threshold: float = Form(default=0.8)
) -> Dict[str, Any]:
    """Enhanced document verification with parallel processing."""
    try:
        logger.info(f"📄 Enhanced document verification for session: {session_id}")
        
        # Read image data
        image_data = await document_image.read()
        
        # Submit document verification task
        task_id = await parallel_processing_service.submit_task(
            name="Enhanced Document Verification",
            task_type="document_verification",
            data={
                "document_image": image_data,
                "confidence_threshold": confidence_threshold
            },
            priority=TaskPriority.HIGH,
            timeout=90
        )
        
        # Wait for task completion
        result = await parallel_processing_service.wait_for_tasks([task_id], timeout=90)
        
        if result["status"] == "completed":
            task_result = result["results"].get(task_id)
            if task_result and task_result.get("status") == "success":
                return {
                    "status": "success",
                    "session_id": session_id,
                    "task_id": task_id,
                    "document_verification_result": task_result["result"],
                    "message": "Enhanced document verification completed successfully",
                    "timestamp": datetime.utcnow().isoformat()
                }
            else:
                return {
                    "status": "error",
                    "session_id": session_id,
                    "task_id": task_id,
                    "error": task_result.get("error", "Document verification failed"),
                    "timestamp": datetime.utcnow().isoformat()
                }
        else:
            return {
                "status": "error",
                "session_id": session_id,
                "task_id": task_id,
                "error": "Task timeout or failed",
                "timestamp": datetime.utcnow().isoformat()
            }
        
    except Exception as e:
        logger.error(f"❌ Enhanced document verification failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Comprehensive Verification Endpoint
@router.post("/verification/comprehensive")
async def comprehensive_verification(
    session_id: str = Form(...),
    selfie_image: UploadFile = File(...),
    document_image: UploadFile = File(...),
    questionnaire_data: str = Form(...),
    liveness_threshold: float = Form(default=0.8),
    face_match_threshold: float = Form(default=0.75),
    fuzzy_match_threshold: float = Form(default=0.8)
) -> Dict[str, Any]:
    """Comprehensive verification with parallel processing of all verification steps."""
    try:
        logger.info(f"🔍 Comprehensive verification for session: {session_id}")
        
        # Read image data
        selfie_data = await selfie_image.read()
        document_data = await document_image.read()
        
        # Parse questionnaire data
        questionnaire = json.loads(questionnaire_data)
        
        # Submit all verification tasks in parallel
        tasks = [
            {
                "name": "Liveness Detection",
                "type": "liveness_detection",
                "data": {
                    "image_data": selfie_data,
                    "threshold": liveness_threshold
                },
                "timeout": 60
            },
            {
                "name": "Face Matching",
                "type": "face_matching",
                "data": {
                    "source_image": selfie_data,
                    "target_image": document_data,
                    "threshold": face_match_threshold
                },
                "timeout": 60
            },
            {
                "name": "Document Verification",
                "type": "document_verification",
                "data": {
                    "document_image": document_data,
                    "confidence_threshold": 0.8
                },
                "timeout": 90
            },
            {
                "name": "OCR Extraction",
                "type": "ocr_extraction",
                "data": {
                    "document_image": document_data
                },
                "timeout": 60
            }
        ]
        
        # Submit batch tasks
        task_ids = await parallel_processing_service.submit_batch_tasks(
            tasks,
            TaskPriority.HIGH
        )
        
        # Wait for all tasks to complete
        result = await parallel_processing_service.wait_for_tasks(task_ids, timeout=120)
        
        if result["status"] == "completed":
            # Process results
            verification_results = {}
            for task_id in task_ids:
                task_result = result["results"].get(task_id)
                if task_result and task_result.get("status") == "success":
                    verification_results[task_result["task_type"]] = task_result["result"]
            
            # Perform fuzzy matching if OCR data is available
            ocr_data = verification_results.get("ocr_extraction", {}).get("result", {}).get("ocr_data", {})
            if ocr_data and questionnaire:
                fuzzy_task_id = await parallel_processing_service.submit_task(
                    name="Fuzzy Name Matching",
                    task_type="fuzzy_matching",
                    data={
                        "source_text": questionnaire.get("full_name", ""),
                        "target_text": ocr_data.get("name", ""),
                        "threshold": fuzzy_match_threshold
                    },
                    priority=TaskPriority.NORMAL,
                    timeout=30
                )
                
                fuzzy_result = await parallel_processing_service.wait_for_tasks([fuzzy_task_id], timeout=30)
                if fuzzy_result["status"] == "completed":
                    fuzzy_task_result = fuzzy_result["results"].get(fuzzy_task_id)
                    if fuzzy_task_result and fuzzy_task_result.get("status") == "success":
                        verification_results["fuzzy_matching"] = fuzzy_task_result["result"]
            
            # Perform risk assessment
            risk_task_id = await parallel_processing_service.submit_task(
                name="Risk Assessment",
                task_type="risk_assessment",
                data={},
                priority=TaskPriority.NORMAL,
                timeout=30,
                metadata={"verification_results": verification_results}
            )
            
            risk_result = await parallel_processing_service.wait_for_tasks([risk_task_id], timeout=30)
            if risk_result["status"] == "completed":
                risk_task_result = risk_result["results"].get(risk_task_id)
                if risk_task_result and risk_task_result.get("status") == "success":
                    verification_results["risk_assessment"] = risk_task_result["result"]
            
            return {
                "status": "success",
                "session_id": session_id,
                "task_ids": task_ids,
                "verification_results": verification_results,
                "message": "Comprehensive verification completed successfully",
                "timestamp": datetime.utcnow().isoformat()
            }
        else:
            return {
                "status": "error",
                "session_id": session_id,
                "task_ids": task_ids,
                "error": "Comprehensive verification failed or timed out",
                "timestamp": datetime.utcnow().isoformat()
            }
        
    except Exception as e:
        logger.error(f"❌ Comprehensive verification failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# AI Agent Communication
@router.post("/agent/message")
async def send_agent_message(
    session_id: str,
    message: str,
    agent: EnhancedKYCAgent = Depends(get_enhanced_kyc_agent)
) -> Dict[str, Any]:
    """Send message to AI agent for processing."""
    try:
        logger.info(f"💬 Processing agent message for session: {session_id}")
        
        # Process message with agent
        response = await agent.process_message(message)
        
        return {
            "status": "success",
            "session_id": session_id,
            "user_message": message,
            "agent_response": response,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to process agent message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Health Check
@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """Health check for enhanced KYC service."""
    try:
        # Check parallel processing service
        tasks_status = await parallel_processing_service.get_all_tasks_status()
        
        # Check Digio service
        digio_health = await digio_service.health_check()
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "services": {
                "parallel_processing": {
                    "status": "healthy",
                    "tasks": tasks_status
                },
                "digio_service": digio_health,
                "enhanced_kyc_agent": {
                    "status": "healthy" if enhanced_kyc_agent else "not_initialized"
                }
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }
