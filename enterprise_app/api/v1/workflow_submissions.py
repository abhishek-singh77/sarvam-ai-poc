"""
Workflow submission endpoints for handling KYC artifacts and validations.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import base64
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflow-submissions", tags=["workflow-submissions"])

class ArtifactSubmission(BaseModel):
    stepRef: str
    artifactType: str  # 'selfie' or 'document'
    imageData: str  # base64 encoded image
    metadata: Optional[Dict[str, Any]] = None

class ValidationSubmission(BaseModel):
    stepRef: str
    validationType: str  # 'face_match' or 'central_db'
    sourceArtifactId: str
    targetArtifactId: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class QuestionnaireSubmission(BaseModel):
    stepRef: str
    answers: Dict[str, str]
    metadata: Optional[Dict[str, Any]] = None

class StepCompletion(BaseModel):
    step_id: str
    data: Dict[str, Any]

@router.post("/selfie")
async def submit_selfie(submission: ArtifactSubmission) -> Dict[str, Any]:
    """
    Submit a selfie artifact for KYC verification.
    """
    try:
        logger.info(f"Submitting selfie for step: {submission.stepRef}")
        
        # Decode base64 image
        image_data = base64.b64decode(submission.imageData.split(',')[1] if ',' in submission.imageData else submission.imageData)
        
        # Here you would typically:
        # 1. Save the image to storage
        # 2. Run face detection/quality checks
        # 3. Store metadata in database
        
        # For now, simulate processing
        artifact_id = f"selfie_{submission.stepRef}_{hash(submission.imageData) % 10000}"
        
        result = {
            "status": "success",
            "artifactId": artifact_id,
            "stepRef": submission.stepRef,
            "artifactType": submission.artifactType,
            "quality": {
                "score": 0.95,
                "blur": False,
                "lighting": "good",
                "face_detected": True
            },
            "metadata": submission.metadata
        }
        
        logger.info(f"Selfie submitted successfully: {artifact_id}")
        return result
        
    except Exception as e:
        logger.error(f"Failed to submit selfie: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to submit selfie: {str(e)}")

@router.post("/document")
async def submit_document(submission: ArtifactSubmission) -> Dict[str, Any]:
    """
    Submit a document artifact for KYC verification.
    """
    try:
        logger.info(f"Submitting document for step: {submission.stepRef}")
        
        # Decode base64 image
        image_data = base64.b64decode(submission.imageData.split(',')[1] if ',' in submission.imageData else submission.imageData)
        
        # Here you would typically:
        # 1. Save the image to storage
        # 2. Run OCR to extract text
        # 3. Validate document type (PAN, Aadhaar, etc.)
        # 4. Store metadata in database
        
        # For now, simulate processing
        artifact_id = f"document_{submission.stepRef}_{hash(submission.imageData) % 10000}"
        
        # Simulate OCR results
        ocr_data = {
            "document_type": submission.metadata.get("documentType", "unknown"),
            "text_extracted": True,
            "confidence": 0.92,
            "fields": {
                "name": "John Doe",
                "number": "ABCDE1234F" if submission.metadata.get("documentType") == "pan" else "1234 5678 9012",
                "dob": "01/01/1990"
            }
        }
        
        result = {
            "status": "success",
            "artifactId": artifact_id,
            "stepRef": submission.stepRef,
            "artifactType": submission.artifactType,
            "ocr": ocr_data,
            "quality": {
                "score": 0.88,
                "blur": False,
                "lighting": "good",
                "document_detected": True,
                "corners_detected": True
            },
            "metadata": submission.metadata
        }
        
        logger.info(f"Document submitted successfully: {artifact_id}")
        return result
        
    except Exception as e:
        logger.error(f"Failed to submit document: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to submit document: {str(e)}")

@router.post("/face-match")
async def submit_face_match(validation: ValidationSubmission) -> Dict[str, Any]:
    """
    Submit a face match validation request.
    """
    try:
        logger.info(f"Submitting face match validation for step: {validation.stepRef}")
        
        # Here you would typically:
        # 1. Retrieve source and target images
        # 2. Run face matching algorithm
        # 3. Return confidence score
        
        # For now, simulate face matching
        match_score = 0.87  # Simulated confidence score
        
        result = {
            "status": "success",
            "stepRef": validation.stepRef,
            "validationType": validation.validationType,
            "passed": match_score >= 0.8,
            "score": match_score,
            "details": {
                "algorithm": "face_recognition_v1",
                "threshold": 0.8,
                "source_artifact": validation.sourceArtifactId,
                "target_artifact": validation.targetArtifactId
            }
        }
        
        logger.info(f"Face match validation completed: {result['passed']}")
        return result
        
    except Exception as e:
        logger.error(f"Failed to perform face match: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to perform face match: {str(e)}")

@router.post("/central-db")
async def submit_central_db_check(validation: ValidationSubmission) -> Dict[str, Any]:
    """
    Submit a central database check validation request.
    """
    try:
        logger.info(f"Submitting central DB check for step: {validation.stepRef}")
        
        # Here you would typically:
        # 1. Extract data from document OCR
        # 2. Query central database (PAN/Aadhaar verification)
        # 3. Return verification results
        
        # For now, simulate database check
        db_check_passed = True  # Simulated result
        
        result = {
            "status": "success",
            "stepRef": validation.stepRef,
            "validationType": validation.validationType,
            "passed": db_check_passed,
            "details": {
                "database": "central_kyc_db",
                "query_type": "document_verification",
                "artifact_id": validation.sourceArtifactId,
                "response_time_ms": 150
            }
        }
        
        logger.info(f"Central DB check completed: {result['passed']}")
        return result
        
    except Exception as e:
        logger.error(f"Failed to perform central DB check: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to perform central DB check: {str(e)}")

@router.post("/questionnaire")
async def submit_questionnaire(submission: QuestionnaireSubmission) -> Dict[str, Any]:
    """
    Submit questionnaire answers and notify agent for comparison with document data.
    """
    try:
        logger.info(f"Submitting questionnaire for step: {submission.stepRef}")
        logger.info(f"Questionnaire answers: {submission.answers}")
        
        # Extract room_id from metadata if available
        room_id = submission.metadata.get("room_id") if submission.metadata else None
        
        # Notify the agent about questionnaire responses for comparison
        if room_id:
            try:
                from ..services.proper_agent_service import proper_agent_service
                
                # VideoSDK with vision=True will handle questionnaire comparison automatically
                # The agent will receive vision data and can compare answers with document data in real-time
                logger.info(f"🎯 BACKEND: Questionnaire answers received - VideoSDK will handle comparison with vision data")
                    
            except Exception as agent_error:
                logger.error(f"🎯 BACKEND: Failed to process questionnaire with agent: {agent_error}")
                # Don't fail the API call if agent processing fails
        
        # Here you would typically:
        # 1. Validate answers
        # 2. Store in database
        # 3. Run any business logic checks
        
        # For now, simulate processing
        result = {
            "status": "success",
            "stepRef": submission.stepRef,
            "answers": submission.answers,
            "validation": {
                "all_required_answered": True,
                "answers_valid": True,
                "timestamp": submission.metadata.get("timestamp") if submission.metadata else None
            },
            "metadata": submission.metadata
        }
        
        logger.info(f"Questionnaire submitted successfully for step: {submission.stepRef}")
        return result
        
    except Exception as e:
        logger.error(f"Failed to submit questionnaire: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to submit questionnaire: {str(e)}")

@router.post("/steps/{session_id}/{step_id}/complete")
async def complete_workflow_step(
    session_id: str,
    step_id: str,
    completion: StepCompletion
) -> Dict[str, Any]:
    """
    Complete a workflow step.
    """
    try:
        logger.info(f"Completing workflow step: {step_id} for session: {session_id}")
        
        # Here you would typically:
        # 1. Update step status in database
        # 2. Trigger next step if applicable
        # 3. Update session state
        
        result = {
            "status": "success",
            "session_id": session_id,
            "step_id": step_id,
            "completed_at": "2024-01-01T00:00:00Z",
            "data": completion.data,
            "next_step": None  # Would be populated based on workflow logic
        }
        
        logger.info(f"Workflow step completed successfully: {step_id}")
        return result
        
    except Exception as e:
        logger.error(f"Failed to complete workflow step: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to complete workflow step: {str(e)}")

@router.get("/health")
async def health_check() -> Dict[str, str]:
    """
    Health check endpoint for workflow submissions.
    """
    return {"status": "healthy", "service": "workflow-submissions"}
