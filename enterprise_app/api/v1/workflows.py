"""
Workflow management API endpoints.

This module provides endpoints for managing workflows and workflow execution.
"""

from typing import Dict, Any, List, Optional, Union
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field

from utils.logging.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)


class WorkflowStepRequest(BaseModel):
    """Request model for workflow step operations."""
    step_id: str = Field(..., description="Step identifier")
    data: Optional[Dict[str, Any]] = Field(default=None, description="Step data")


class WorkflowProgressResponse(BaseModel):
    """Response model for workflow progress."""
    session_id: str
    workflow_type: str
    current_step: int
    total_steps: int
    progress_percentage: float
    status: str
    steps: List[Dict[str, Any]]


class VerificationRequest(BaseModel):
    """Request model for verification operations."""
    source_image: Optional[str] = Field(default=None, description="Base64 encoded source image")
    target_image: Optional[str] = Field(default=None, description="Base64 encoded target image")
    source_text: Optional[str] = Field(default=None, description="Source text for fuzzy matching")
    target_text: Optional[str] = Field(default=None, description="Target text for fuzzy matching")
    threshold: Optional[float] = Field(default=0.75, description="Matching threshold")
    verification_type: str = Field(..., description="Type of verification to perform")


class VerificationResponse(BaseModel):
    """Response model for verification operations."""
    status: str
    verification_type: str
    result: Dict[str, Any]
    confidence: Optional[float] = None
    is_match: Optional[bool] = None
    message: str


@router.get("/types")
async def get_workflow_types() -> Dict[str, List[str]]:
    """
    Get available workflow types.
    
    Returns:
        List of available workflow types
    """
    logger.info("Getting workflow types")
    
    return {
        "workflow_types": [
            "kyc",
            "interview", 
            "survey",
            "assessment",
            "onboarding",
            "verification"
        ]
    }


@router.get("/{workflow_type}/template")
async def get_workflow_template(workflow_type: str) -> Dict[str, Any]:
    """
    Get workflow template for a specific type.
    
    Args:
        workflow_type: Type of workflow
        
    Returns:
        Workflow template
        
    Raises:
        HTTPException: If workflow type not found
    """
    logger.info("Getting workflow template", extra={"workflow_type": workflow_type})
    
    # Mock workflow templates
    templates = {
        "kyc": {
            "id": "kyc_template",
            "name": "KYC Verification",
            "description": "Know Your Customer verification workflow",
            "steps": [
                {
                    "id": "introduction",
                    "type": "introduction",
                    "title": "Welcome",
                    "description": "Introduction to KYC process"
                },
                {
                    "id": "selfie_capture",
                    "type": "selfie_capture", 
                    "title": "Take Selfie",
                    "description": "Capture selfie for liveness verification"
                },
                {
                    "id": "document_upload",
                    "type": "document_upload",
                    "title": "Upload Documents",
                    "description": "Upload identity documents"
                },
                {
                    "id": "verification",
                    "type": "verification",
                    "title": "Verification",
                    "description": "Complete verification process"
                }
            ]
        },
        "interview": {
            "id": "interview_template",
            "name": "Interview Session",
            "description": "Job interview workflow",
            "steps": [
                {
                    "id": "introduction",
                    "type": "introduction",
                    "title": "Welcome",
                    "description": "Introduction to interview"
                },
                {
                    "id": "questions",
                    "type": "question_sequence",
                    "title": "Interview Questions",
                    "description": "Answer interview questions"
                },
                {
                    "id": "assessment",
                    "type": "assessment",
                    "title": "Assessment",
                    "description": "Complete skills assessment"
                }
            ]
        },
        "verification": {
            "id": "verification_template",
            "name": "Flexible Verification Workflow",
            "description": "A flexible workflow that supports various verification steps including selfie capture, liveness detection, face matching, fuzzy matching, and ID verification",
            "steps": [
                {
                    "id": "introduction",
                    "type": "introduction",
                    "title": "Welcome to Verification",
                    "description": "Welcome to our verification process. We'll guide you through the necessary steps."
                },
                {
                    "id": "selfie_capture",
                    "type": "selfie_capture",
                    "title": "Capture Selfie",
                    "description": "Please capture a clear selfie for verification purposes."
                },
                {
                    "id": "liveness_detection",
                    "type": "liveness_detection",
                    "title": "Liveness Check",
                    "description": "We'll verify that you're a real person by performing a liveness check."
                },
                {
                    "id": "id_document_upload",
                    "type": "id_document_upload",
                    "title": "Upload ID Document",
                    "description": "Please upload a clear photo of your government-issued ID document."
                },
                {
                    "id": "face_match_verification",
                    "type": "face_match_verification",
                    "title": "Face Match Verification",
                    "description": "We'll compare your selfie with the photo on your ID document."
                },
                {
                    "id": "id_proof_verification",
                    "type": "id_proof_verification",
                    "title": "ID Document Verification",
                    "description": "We'll verify the authenticity of your ID document."
                },
                {
                    "id": "fuzzy_name_match",
                    "type": "fuzzy_name_match",
                    "title": "Name Verification",
                    "description": "We'll verify that the name you provided matches the name on your ID document."
                },
                {
                    "id": "completion",
                    "type": "completion",
                    "title": "Verification Complete",
                    "description": "Your verification has been completed successfully."
                }
            ]
        }
    }
    
    if workflow_type not in templates:
        raise HTTPException(status_code=404, detail=f"Workflow type '{workflow_type}' not found")
    
    return templates[workflow_type]


@router.get("/{session_id}/progress", response_model=WorkflowProgressResponse)
async def get_workflow_progress(session_id: str) -> WorkflowProgressResponse:
    """
    Get workflow progress for a session.
    
    Args:
        session_id: Session identifier
        
    Returns:
        Workflow progress information
        
    Raises:
        HTTPException: If session not found
    """
    logger.info("Getting workflow progress", extra={"session_id": session_id})
    
    try:
        # This would fetch from the workflow service
        # For now, return a mock response
        response = WorkflowProgressResponse(
            session_id=session_id,
            workflow_type="kyc",
            current_step=2,
            total_steps=4,
            progress_percentage=50.0,
            status="in_progress",
            steps=[
                {"id": "introduction", "status": "completed"},
                {"id": "selfie_capture", "status": "in_progress"},
                {"id": "document_upload", "status": "pending"},
                {"id": "verification", "status": "pending"}
            ]
        )
        
        return response
        
    except Exception as e:
        logger.error("Failed to get workflow progress", extra={"session_id": session_id, "error": str(e)})
        raise HTTPException(status_code=500, detail="Failed to get workflow progress")


@router.post("/{session_id}/steps/{step_id}/start")
async def start_workflow_step(session_id: str, step_id: str) -> Dict[str, Any]:
    """
    Start a workflow step.
    
    Args:
        session_id: Session identifier
        step_id: Step identifier
        
    Returns:
        Step start result
        
    Raises:
        HTTPException: If step start fails
    """
    logger.info("Starting workflow step", extra={"session_id": session_id, "step_id": step_id})
    
    try:
        # This would start the step in the workflow service
        result = {
            "status": "success",
            "session_id": session_id,
            "step_id": step_id,
            "message": "Step started successfully"
        }
        
        logger.info("Workflow step started successfully", extra={"session_id": session_id, "step_id": step_id})
        return result
        
    except Exception as e:
        logger.error("Failed to start workflow step", extra={"session_id": session_id, "step_id": step_id, "error": str(e)})
        raise HTTPException(status_code=500, detail="Failed to start workflow step")


@router.post("/{session_id}/steps/{step_id}/complete")
async def complete_workflow_step(
    session_id: str, 
    step_id: str, 
    request: WorkflowStepRequest
) -> Dict[str, Any]:
    """
    Complete a workflow step.
    
    Args:
        session_id: Session identifier
        step_id: Step identifier
        request: Step completion data
        
    Returns:
        Step completion result
        
    Raises:
        HTTPException: If step completion fails
    """
    logger.info("Completing workflow step", extra={"session_id": session_id, "step_id": step_id})
    
    try:
        # This would complete the step in the workflow service
        result = {
            "status": "success",
            "session_id": session_id,
            "step_id": step_id,
            "message": "Step completed successfully",
            "data": request.data
        }
        
        logger.info("Workflow step completed successfully", extra={"session_id": session_id, "step_id": step_id})
        return result
        
    except Exception as e:
        logger.error("Failed to complete workflow step", extra={"session_id": session_id, "step_id": step_id, "error": str(e)})
        raise HTTPException(status_code=500, detail="Failed to complete workflow step")


@router.post("/{session_id}/pause")
async def pause_workflow(session_id: str) -> Dict[str, Any]:
    """
    Pause a workflow.
    
    Args:
        session_id: Session identifier
        
    Returns:
        Pause result
        
    Raises:
        HTTPException: If pause fails
    """
    logger.info("Pausing workflow", extra={"session_id": session_id})
    
    try:
        # This would pause the workflow
        result = {
            "status": "success",
            "session_id": session_id,
            "message": "Workflow paused successfully"
        }
        
        logger.info("Workflow paused successfully", extra={"session_id": session_id})
        return result
        
    except Exception as e:
        logger.error("Failed to pause workflow", extra={"session_id": session_id, "error": str(e)})
        raise HTTPException(status_code=500, detail="Failed to pause workflow")


@router.post("/{session_id}/resume")
async def resume_workflow(session_id: str) -> Dict[str, Any]:
    """
    Resume a workflow.
    
    Args:
        session_id: Session identifier
        
    Returns:
        Resume result
        
    Raises:
        HTTPException: If resume fails
    """
    logger.info("Resuming workflow", extra={"session_id": session_id})
    
    try:
        # This would resume the workflow
        result = {
            "status": "success",
            "session_id": session_id,
            "message": "Workflow resumed successfully"
        }
        
        logger.info("Workflow resumed successfully", extra={"session_id": session_id})
        return result
        
    except Exception as e:
        logger.error("Failed to resume workflow", extra={"session_id": session_id, "error": str(e)})
        raise HTTPException(status_code=500, detail="Failed to resume workflow")


# Verification-specific endpoints
@router.post("/verification/liveness", response_model=VerificationResponse)
async def perform_liveness_detection(
    image: UploadFile = File(...),
    threshold: float = Form(default=0.8)
) -> VerificationResponse:
    """
    Perform liveness detection on an uploaded image.
    
    Args:
        image: Image file to analyze
        threshold: Liveness detection threshold
        
    Returns:
        Liveness detection result
        
    Raises:
        HTTPException: If liveness detection fails
    """
    logger.info("Performing liveness detection")
    
    try:
        # Read image data
        image_data = await image.read()
        
        # Import Digio service
        from services.digio_service import digio_service
        
        # Perform liveness detection using official Digio API
        async with digio_service as digio:
            result = await digio.liveness_detection(
                image_data,
                threshold=threshold,
                liveness_type='passive',
                return_face_attributes=True
            )
        
        return VerificationResponse(
            status="success",
            verification_type="liveness_detection",
            result=result,
            confidence=result.get('liveness_score', 0),
            is_match=result.get('is_live', False),
            message="Liveness detection completed successfully"
        )
        
    except Exception as e:
        logger.error(f"Liveness detection failed: {e}")
        raise HTTPException(status_code=500, detail=f"Liveness detection failed: {str(e)}")


@router.post("/verification/face-match", response_model=VerificationResponse)
async def perform_face_match(
    source_image: UploadFile = File(...),
    target_image: UploadFile = File(...),
    threshold: float = Form(default=0.75)
) -> VerificationResponse:
    """
    Perform face matching between two uploaded images.
    
    Args:
        source_image: Source image (selfie)
        target_image: Target image (ID document photo)
        threshold: Face match threshold
        
    Returns:
        Face match result
        
    Raises:
        HTTPException: If face match fails
    """
    logger.info("Performing face match")
    
    try:
        # Read image data
        source_data = await source_image.read()
        target_data = await target_image.read()
        
        # Import Digio service
        from services.digio_service import digio_service
        
        # Perform face matching
        async with digio_service as digio:
            result = await digio.face_match(
                source_data,
                target_data,
                match_threshold=threshold,
                extraction_method='automatic',
                return_face_attributes=True
            )
        
        return VerificationResponse(
            status="success",
            verification_type="face_match",
            result=result,
            confidence=result.get('match_score', 0),
            is_match=result.get('is_match', False),
            message="Face match completed successfully"
        )
        
    except Exception as e:
        logger.error(f"Face match failed: {e}")
        raise HTTPException(status_code=500, detail=f"Face match failed: {str(e)}")


@router.post("/verification/fuzzy-match", response_model=VerificationResponse)
async def perform_fuzzy_match(request: VerificationRequest) -> VerificationResponse:
    """
    Perform fuzzy matching between two text strings.
    
    Args:
        request: Verification request with source and target text
        
    Returns:
        Fuzzy match result
        
    Raises:
        HTTPException: If fuzzy match fails
    """
    logger.info("Performing fuzzy match")
    
    try:
        if not request.source_text or not request.target_text:
            raise HTTPException(status_code=400, detail="Source and target text are required")
        
        # Import Digio service
        from services.digio_service import digio_service
        
        # Perform fuzzy matching
        async with digio_service as digio:
            result = await digio.fuzzy_match(
                request.source_text,
                request.target_text,
                match_threshold=request.threshold,
                algorithm='levenshtein',
                return_normalized=True
            )
        
        return VerificationResponse(
            status="success",
            verification_type="fuzzy_match",
            result=result,
            confidence=result.get('match_score', 0),
            is_match=result.get('is_match', False),
            message="Fuzzy match completed successfully"
        )
        
    except Exception as e:
        logger.error(f"Fuzzy match failed: {e}")
        raise HTTPException(status_code=500, detail=f"Fuzzy match failed: {str(e)}")


@router.post("/verification/id-verification", response_model=VerificationResponse)
async def perform_id_verification(
    document_image: UploadFile = File(...),
    confidence_threshold: float = Form(default=0.8)
) -> VerificationResponse:
    """
    Perform ID document verification and data extraction.
    
    Args:
        document_image: ID document image
        confidence_threshold: Confidence threshold for verification
        
    Returns:
        ID verification result
        
    Raises:
        HTTPException: If ID verification fails
    """
    logger.info("Performing ID verification")
    
    try:
        # Read image data
        image_data = await document_image.read()
        
        # Import Digio service
        from services.digio_service import digio_service
        
        # Perform ID verification
        async with digio_service as digio:
            result = await digio.id_verification(
                image_data,
                confidence_threshold=confidence_threshold,
                document_type='auto_detect',
                return_confidence_scores=True
            )
        
        return VerificationResponse(
            status="success",
            verification_type="id_verification",
            result=result,
            confidence=result.get('confidence', 0),
            is_match=result.get('is_authentic', False),
            message="ID verification completed successfully"
        )
        
    except Exception as e:
        logger.error(f"ID verification failed: {e}")
        raise HTTPException(status_code=500, detail=f"ID verification failed: {str(e)}")


@router.post("/verification/batch")
async def perform_batch_verification(
    verification_tasks: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Perform batch verification for multiple tasks.
    
    Args:
        verification_tasks: List of verification tasks
        
    Returns:
        Batch verification results
        
    Raises:
        HTTPException: If batch verification fails
    """
    logger.info(f"Performing batch verification for {len(verification_tasks)} tasks")
    
    try:
        # Import Digio service
        from services.digio_service import digio_service
        
        # Perform batch verification
        async with digio_service as digio:
            result = await digio.batch_verification(verification_tasks)
        
        return {
            "status": "success",
            "message": "Batch verification completed successfully",
            "results": result
        }
        
    except Exception as e:
        logger.error(f"Batch verification failed: {e}")
        raise HTTPException(status_code=500, detail=f"Batch verification failed: {str(e)}")


@router.get("/verification/health")
async def check_verification_health() -> Dict[str, Any]:
    """
    Check the health of verification services.
    
    Returns:
        Health check result
    """
    logger.info("Checking verification service health")
    
    try:
        # Import Digio service
        from services.digio_service import digio_service
        
        # Perform health check
        async with digio_service as digio:
            result = await digio.health_check()
        
        return {
            "status": "success",
            "message": "Verification service health check completed",
            "health": result
        }
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "error",
            "message": f"Health check failed: {str(e)}",
            "health": {"status": "unhealthy"}
        }
