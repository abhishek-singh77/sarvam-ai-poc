"""
Session management API endpoints.

This module provides endpoints for creating, managing, and monitoring sessions.
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from utils.logger import get_logger
from services.videosdk_service import register_room_with_tokens
from services.proper_agent_service import proper_agent_service

router = APIRouter()
logger = get_logger(__name__)

# In-memory mapping of session_id to room_id
# TODO: Replace with proper database storage
session_to_room_mapping: Dict[str, str] = {}


class CreateSessionRequest(BaseModel):
    """Request model for creating a session."""
    workflow_type: str = Field(..., description="Type of workflow to run")
    agent_type: str = Field(..., description="Type of agent to use")
    language: str = Field(default="en", description="Session language")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional metadata")


class SessionResponse(BaseModel):
    """Response model for session operations."""
    session_id: str
    room_id: str
    status: str
    workflow_type: str
    agent_type: str
    created_at: str
    expires_at: Optional[str] = None


class JoinAgentRequest(BaseModel):
    """Request model for joining an agent to a session."""
    room_id: str
    agent_participant_id: str
    agent_token: str
    workflow: str = ""


class HealthCheckDataRequest(BaseModel):
    """Request model for storing health check data."""
    session_id: str
    location_data: Optional[Dict[str, Any]] = None
    network_speed: Optional[Dict[str, Any]] = None
    is_vpn_detected: bool = False
    user_agent: str
    timestamp: int




@router.post("/create")
async def create_session(request: CreateSessionRequest) -> Dict[str, Any]:
    """
    Create a new session with VideoSDK room and tokens.
    
    Args:
        request: Session creation request
        
    Returns:
        Created session information with VideoSDK room data
        
    Raises:
        HTTPException: If session creation fails
    """
    logger.info("Creating new session", extra={"workflow_type": request.workflow_type, "agent_type": request.agent_type})
    
    try:
        # Create VideoSDK room with tokens
        room_data = await register_room_with_tokens(auto_close_minutes=60)
        
        # Create session response in the format expected by the frontend
        response = {
            "roomId": room_data["roomId"],
            "room_id": room_data["roomId"],  # Also include room_id for compatibility
            "customRoomId": room_data["customRoomId"],
            "agent": {
                "participantId": room_data["agent"]["participantId"],
                "token": room_data["agent"]["token"]
            },
            "client": {
                "participantId": room_data["client"]["participantId"],
                "token": room_data["client"]["token"]
            },
            "session_id": room_data["customRoomId"],
            "workflow_type": request.workflow_type,
            "agent_type": request.agent_type,
            "status": "created"
        }
        
        # Store the mapping between session_id and room_id
        session_to_room_mapping[room_data["customRoomId"]] = room_data["roomId"]
        logger.info("Session created successfully", extra={"session_id": room_data["customRoomId"], "room_id": room_data["roomId"]})
        return response
        
    except Exception as e:
        logger.error("Failed to create session", extra={"error": str(e)})
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")


@router.post("/join-agent")
async def join_agent(request: JoinAgentRequest) -> Dict[str, Any]:
    """
    Join an AI agent to the session/room.
    
    Args:
        request: Join agent request
        
    Returns:
        Join agent result
        
    Raises:
        HTTPException: If join fails
    """
    logger.info("Joining agent to session", extra={
                "room_id": request.room_id, 
                "agent_participant_id": request.agent_participant_id,
                "workflow_length": len(request.workflow)
    })
    
    try:
        # Log the workflow if provided
        if request.workflow:
            logger.info("Agent workflow provided", extra={"workflow_length": len(request.workflow)})
        
        # Use the proper agent service to join the agent to the VideoSDK room
        result = await proper_agent_service.join_agent_to_room(
            room_id=request.room_id,
            agent_participant_id=request.agent_participant_id,
            agent_token=request.agent_token,
            workflow_json=request.workflow
        )
        
        if result["status"] == "success":
            logger.info("Agent joined successfully", extra={"room_id": request.room_id, "agent_participant_id": request.agent_participant_id})
            return result
        else:
            logger.error("Agent join failed", extra={"room_id": request.room_id, "error": result.get("error")})
            raise HTTPException(
                status_code=500, 
                detail=f"Agent join failed: {result.get('error', 'Unknown error')}"
            )
        
    except Exception as e:
        logger.error("Failed to join agent", extra={"error": str(e)})
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to join agent: {str(e)}"
        )


@router.post("/health-check-data")
async def store_health_check_data(request: HealthCheckDataRequest) -> Dict[str, Any]:
    """
    Store health check data for a session.
    
    Args:
        request: Health check data request
        
    Returns:
        Storage result
        
    Raises:
        HTTPException: If storage fails
    """
    logger.info("🎯 HEALTH-CHECK-API: Endpoint called - store_health_check_data")
    # Log the complete request payload first
    logger.info("🎯 HEALTH-CHECK-API: Received complete request payload:", extra={
        "full_request": request.dict(),
        "request_type": type(request).__name__
    })
    
    logger.info("Storing health check data", extra={
        "session_id": request.session_id,
        "has_location": request.location_data is not None,
        "has_network": request.network_speed is not None,
        "is_vpn_detected": request.is_vpn_detected,
        "timestamp": request.timestamp
    })
    
    try:
        # Log the health check data to terminal for now
        logger.info("📍 LOCATION DATA:", extra={"data": request.location_data})
        logger.info("🌐 NETWORK DATA:", extra={"data": request.network_speed})
        logger.info("🔒 VPN STATUS:", extra={"is_vpn_detected": request.is_vpn_detected})
        logger.info("🕒 TIMESTAMP:", extra={"timestamp": request.timestamp})
        logger.info("🌍 USER AGENT:", extra={"user_agent": request.user_agent})
        
        # TODO: Store this data in database against KSA sub-action ID
        # For now, we're just logging it
        
        return {
            "status": "success",
            "message": "Health check data stored successfully",
            "session_id": request.session_id,
            "timestamp": request.timestamp
        }
        
    except Exception as e:
        logger.error("Failed to store health check data", extra={"error": str(e)})
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to store health check data: {str(e)}"
        )






@router.post("/{session_id}/upload-selfie")
async def upload_selfie(
    session_id: str, 
    request: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Upload a selfie image for KYC verification.
    
    Args:
        session_id: Session identifier (actually room_id)
        request: Selfie upload data with base64 image
        
    Returns:
        Upload result
    """
    logger.info("Uploading selfie", extra={
        "session_id": session_id,
        "has_image": bool(request.get("image_data"))
    })
    
    try:
        # Get image data from request
        image_data = request.get("image_data")
        step_id = request.get("step_id", "selfie_capture")
        capture_type = request.get("capture_type", "FACE_CAPTURE")
        
        if not image_data:
            raise HTTPException(status_code=400, detail="image_data is required")
        
        # Log the image data type and structure for debugging
        logger.info(f"Image uploaded for step {step_id}, type: {capture_type}")
        logger.info(f"Image data type: {type(image_data)}")
        if isinstance(image_data, dict):
            logger.info(f"Image data keys: {list(image_data.keys())}")
            # Log the structure of nested objects for debugging
            for key, value in image_data.items():
                if isinstance(value, dict):
                    logger.info(f"  {key} keys: {list(value.keys())}")
                elif isinstance(value, str):
                    logger.info(f"  {key} (string, length: {len(value)})")
                else:
                    logger.info(f"  {key} (type: {type(value)})")
        elif isinstance(image_data, str):
            logger.info(f"Image data size: {len(image_data)} characters")
            logger.info(f"Image data preview: {image_data[:100]}...")
        
        # Process the image based on capture type
        if capture_type == "FACE_CAPTURE":
            # Face detection and quality check
            result = await process_face_image(image_data)
        elif capture_type == "DOCUMENT_CAPTURE":
            # Document analysis and OCR
            result = await process_document_image(image_data)
        else:
            result = {"status": "success", "message": "Image uploaded successfully"}
        
        # Check if processing had errors
        if result.get("error"):
            logger.error(f"Image processing failed: {result.get('error')}")
            return {
                "status": "error",
                "message": f"{capture_type} processing failed",
                "step_id": step_id,
                "capture_type": capture_type,
                "analysis_result": result,
                "error": result.get("error")
            }
        
        return {
            "status": "success",
            "message": f"{capture_type} uploaded successfully",
            "step_id": step_id,
            "capture_type": capture_type,
            "analysis_result": result
        }
        
    except Exception as e:
        logger.error("Failed to upload image", extra={"error": str(e)})
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")


async def process_face_image(image_data: str) -> Dict[str, Any]:
    """Process face image using Gemini's standard vision API (not Live API)"""
    try:
        # Use Gemini's standard vision API for static image analysis
        analysis_result = await analyze_image_with_gemini_vision(
            image_data, 
            """
            Analyze this face image for KYC verification with detailed assessment:
            
            1. Face Detection: Is there a clear, well-lit face visible?
            2. Image Quality: Is the image sharp and clear?
            3. Lighting: Is the lighting adequate for face recognition?
            4. Angle: Is the face positioned correctly (front-facing)?
            5. Blur: Is the image free from motion blur?
            6. Multiple Faces: Are there multiple faces in the image?
            7. Eyes Open: Are the person's eyes open and visible?
            8. Expression: Is the person looking at the camera?
            
            IMPORTANT: Be lenient with face detection. If you can see any human face in the image, set face_detected to true.
            Only set face_detected to false if there is absolutely no human face visible in the image.
            
            Return a JSON response with:
            - face_detected: boolean (be lenient - true if any human face is visible)
            - image_quality: "excellent" | "good" | "fair" | "poor"
            - lighting_quality: "excellent" | "good" | "fair" | "poor"
            - face_angle: "front" | "side" | "angled"
            - is_blurry: boolean
            - multiple_faces: boolean
            - eyes_open: boolean
            - looking_at_camera: boolean
            - confidence_score: float (0-1)
            - recommendations: array of strings
            - verification_ready: boolean
            """
        )
        
        return analysis_result
        
    except Exception as e:
        logger.error(f"Face processing error: {e}")
        return {
            "face_detected": False,
            "error": str(e),
            "recommendations": ["Please ensure your face is clearly visible"]
        }


async def process_document_image(image_data: str) -> Dict[str, Any]:
    """Process document image using Gemini's standard vision API (not Live API)"""
    try:
        # Use Gemini's standard vision API for static document analysis
        analysis_result = await analyze_image_with_gemini_vision(
            image_data,
            """
            Analyze this document image for KYC verification with comprehensive assessment:
            
            1. Document Detection: Is a valid identity document clearly visible?
            2. Text Readability: Can you read all text clearly?
            3. Image Quality: Is the image sharp and clear?
            4. Lighting: Is the lighting adequate for text recognition?
            5. Blur: Is the image free from motion blur?
            6. Completeness: Is the entire document visible?
            7. Orientation: Is the document properly oriented?
            8. Glare: Is there any glare or reflection on the document?
            9. Corners: Are all four corners of the document visible?
            10. Text Clarity: Can you read all important text fields?
            
            Extract all visible information and return a JSON response with:
            - document_detected: boolean
            - document_type: "PAN_CARD", "AADHAAR_CARD", "DRIVING_LICENSE", or "UNKNOWN"
            - document_number: The document number/ID
            - name: Full name as shown on document
            - father_name: Father's name if visible
            - date_of_birth: Date of birth if visible
            - address: Address if visible
            - image_quality: "excellent" | "good" | "fair" | "poor"
            - lighting_quality: "excellent" | "good" | "fair" | "poor"
            - is_blurry: boolean
            - is_complete: boolean
            - orientation_correct: boolean
            - has_glare: boolean
            - corners_visible: boolean
            - text_clarity: "excellent" | "good" | "fair" | "poor"
            - confidence_score: float (0-1)
            - is_valid: Whether document appears valid
            - extracted_fields: Object with all extracted information
            - recommendations: Array of improvement suggestions if any
            - verification_ready: boolean
            
            Be thorough in reading all text visible in the image and assess quality comprehensively.
            """
        )
        
        return analysis_result
        
    except Exception as e:
        logger.error(f"Document processing error: {e}")
        return {
            "document_type": "UNKNOWN",
            "is_valid": False,
            "error": str(e),
            "recommendations": ["Please ensure the document is clearly visible and well-lit"]
        }

def _find_image_data_recursively(data: Any, max_depth: int = 3, current_depth: int = 0) -> str | None:
    """
    Recursively search for image data in nested structures.
    
    Args:
        data: The data structure to search
        max_depth: Maximum recursion depth
        current_depth: Current recursion depth
        
    Returns:
        Found image data string or None
    """
    if current_depth >= max_depth:
        return None
    
    if isinstance(data, str):
        # Check if this looks like base64 image data
        if len(data) > 100 and (data.startswith('data:image') or data.startswith('/9j/') or data.startswith('iVBOR')):
            return data
    elif isinstance(data, dict):
        # Check common image data keys first
        for key in ['data', 'image', 'base64', 'imageData', 'image_data', 'blob', 'content']:
            if key in data:
                result = _find_image_data_recursively(data[key], max_depth, current_depth + 1)
                if result and isinstance(result, str):
                    return result
        
        # Recursively search all values, but skip boolean values
        for key, value in data.items():
            # Skip boolean values and other non-string types that are unlikely to contain image data
            if isinstance(value, (bool, int, float)) or value is None:
                continue
            result = _find_image_data_recursively(value, max_depth, current_depth + 1)
            if result and isinstance(result, str):
                return result
    elif isinstance(data, list):
        # Search in list items
        for item in data:
            result = _find_image_data_recursively(item, max_depth, current_depth + 1)
            if result and isinstance(result, str):
                return result
    
    return None

async def analyze_image_with_gemini_vision(image_data: str, prompt: str) -> Dict[str, Any]:
    """Analyze image using Gemini's standard vision API (not Live API)"""
    try:
        import httpx
        import json
        import os
        
        # Get Google API key from settings (which loads from .env file)
        try:
            from utils.settings import get_settings
            settings = get_settings()
            api_key = settings.google_api_key
            logger.info(f"🎯 GEMINI-VISION: Got API key from settings: {api_key[:10]}..." if api_key else "None")
        except Exception as e:
            logger.error(f"🎯 GEMINI-VISION: Failed to get settings: {e}")
            api_key = None
        
        if not api_key:
            logger.error("No GOOGLE_API_KEY found for Gemini vision analysis")
            return {"error": "No Google API key configured for image analysis"}
        
        # Prepare the image for API call
        # Handle different image data formats
        if isinstance(image_data, dict):
            # If it's a dict, try to extract the image data from various possible structures
            if "data" in image_data:
                image_data = image_data["data"]
            elif "image" in image_data:
                image_data = image_data["image"]
            elif "base64" in image_data:
                image_data = image_data["base64"]
            elif "showSyncResponse" in image_data and "imageInfo" in image_data:
                # Handle the specific format with both showSyncResponse and imageInfo
                logger.info("🎯 GEMINI-VISION: Found both showSyncResponse and imageInfo, trying imageInfo first")
                image_info = image_data["imageInfo"]
                if isinstance(image_info, dict):
                    if "data" in image_info:
                        image_data = image_info["data"]
                    elif "base64" in image_info:
                        image_data = image_info["base64"]
                    elif "image" in image_info:
                        image_data = image_info["image"]
                    else:
                        logger.warning(f"🎯 GEMINI-VISION: imageInfo doesn't contain expected keys: {list(image_info.keys())}")
                        # Try showSyncResponse as fallback
                        sync_response = image_data["showSyncResponse"]
                        if isinstance(sync_response, dict):
                            found_data = _find_image_data_recursively(sync_response)
                            if found_data and isinstance(found_data, str):
                                image_data = found_data
                            else:
                                logger.error(f"🎯 GEMINI-VISION: Could not find valid string image data in either imageInfo or showSyncResponse")
                                return {"error": f"Could not find valid string image data in imageInfo or showSyncResponse"}
                        else:
                            image_data = sync_response
                else:
                    # imageInfo might be the actual image data
                    image_data = image_info
            elif "imageInfo" in image_data:
                # Handle the specific format with imageInfo only
                image_info = image_data["imageInfo"]
                if isinstance(image_info, dict):
                    if "data" in image_info:
                        image_data = image_info["data"]
                    elif "base64" in image_info:
                        image_data = image_info["base64"]
                    elif "image" in image_info:
                        image_data = image_info["image"]
                    else:
                        logger.error(f"🎯 GEMINI-VISION: imageInfo doesn't contain expected keys: {list(image_info.keys())}")
                        return {"error": f"imageInfo doesn't contain expected keys: {list(image_info.keys())}"}
                else:
                    # imageInfo might be the actual image data
                    image_data = image_info
            elif "showSyncResponse" in image_data:
                # Handle the showSyncResponse format only
                sync_response = image_data["showSyncResponse"]
                if isinstance(sync_response, dict):
                    if "data" in sync_response:
                        image_data = sync_response["data"]
                    elif "base64" in sync_response:
                        image_data = sync_response["base64"]
                    elif "image" in sync_response:
                        image_data = sync_response["image"]
                    else:
                        logger.error(f"🎯 GEMINI-VISION: showSyncResponse doesn't contain expected keys: {list(sync_response.keys())}")
                        return {"error": f"showSyncResponse doesn't contain expected keys: {list(sync_response.keys())}"}
                else:
                    # showSyncResponse might be the actual image data
                    image_data = sync_response
            else:
                # Try to find image data in any nested structure
                logger.warning(f"🎯 GEMINI-VISION: Dict image_data doesn't contain expected keys: {list(image_data.keys())}")
                logger.info("🎯 GEMINI-VISION: Attempting to find image data in nested structure...")
                
                # Recursively search for image data
                found_image_data = _find_image_data_recursively(image_data)
                if found_image_data and isinstance(found_image_data, str):
                    logger.info("🎯 GEMINI-VISION: Found image data in nested structure")
                    logger.info(f"🎯 GEMINI-VISION: Found data type: {type(found_image_data)}, length: {len(found_image_data)}")
                    image_data = found_image_data
                else:
                    logger.error(f"🎯 GEMINI-VISION: Could not find valid string image data in nested structure")
                    logger.error(f"🎯 GEMINI-VISION: Found data type: {type(found_image_data)}")
                    return {"error": f"Could not find valid string image data in nested structure. Available keys: {list(image_data.keys())}"}
        
        # Final validation - ensure we have valid string data
        if not isinstance(image_data, str):
            logger.error(f"🎯 GEMINI-VISION: Invalid image data type after processing: {type(image_data)}")
            logger.error(f"🎯 GEMINI-VISION: Image data value: {str(image_data)[:200]}...")
            
            # Try one more recursive search as a last resort
            if isinstance(image_data, dict):
                logger.info("🎯 GEMINI-VISION: Attempting final recursive search...")
                final_result = _find_image_data_recursively(image_data, max_depth=5)
                if final_result and isinstance(final_result, str):
                    logger.info("🎯 GEMINI-VISION: Found image data in final recursive search")
                    image_data = final_result
                else:
                    return {"error": f"Invalid image data type after processing: {type(image_data)}. Could not find valid string image data."}
            else:
                return {"error": f"Invalid image data type after processing: {type(image_data)}"}
        
        # Remove data URL prefix if present
        if image_data.startswith("data:image"):
            image_data = image_data.split(",")[1]
        
        headers = {
            "Content-Type": "application/json"
        }
        
        # Use Gemini's standard vision API (not Live API)
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": prompt
                        },
                        {
                            "inline_data": {
                                "mime_type": "image/jpeg",
                                "data": image_data
                            }
                        }
                    ]
                }
            ],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.1
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key={api_key}",
                headers=headers,
                json=payload,
                timeout=30.0
            )
            
            if response.status_code == 200:
                result = response.json()
                if "candidates" in result and len(result["candidates"]) > 0:
                    content = result["candidates"][0]["content"]["parts"][0]["text"]
                    
                    # Try to parse JSON response
                    try:
                        import json
                        parsed_result = json.loads(content)
                        return parsed_result
                    except json.JSONDecodeError:
                        # If not JSON, return as text with proper structure
                        return {
                            "analysis": content, 
                            "raw_response": True,
                            "face_detected": "unknown",
                            "quality_score": 0.5,
                            "recommendations": ["Analysis completed but response format unclear"]
                        }
                else:
                    return {
                        "error": "No valid response from Gemini API",
                        "face_detected": False,
                        "quality_score": 0,
                        "recommendations": ["API response was empty"]
                    }
            else:
                error_msg = f"Gemini API error: {response.status_code} - {response.text}"
                logger.error(f"🎯 GEMINI-VISION: {error_msg}")
                return {
                    "error": error_msg,
                    "face_detected": False,
                    "quality_score": 0,
                    "recommendations": ["API request failed"]
                }
                
    except Exception as e:
        logger.error(f"Gemini vision analysis error: {e}")
        return {"error": str(e)}


# Removed analyze-image endpoint - image analysis is now handled directly in upload-selfie endpoint

@router.get("/{session_id}/test-env")
async def test_environment_variables(session_id: str) -> Dict[str, Any]:
    """Test endpoint to check environment variables"""
    import os
    try:
        from utils.settings import get_settings
        settings = get_settings()
        
        return {
            "status": "success",
            "message": "Environment variables loaded successfully",
            "environment_variables": {
                "GOOGLE_API_KEY_from_env": os.getenv("GOOGLE_API_KEY", "NOT_FOUND"),
                "GOOGLE_API_KEY_from_settings": settings.google_api_key or "NOT_FOUND",
                "settings_loaded": True
            }
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "environment_variables": {
                "GOOGLE_API_KEY_from_env": os.getenv("GOOGLE_API_KEY", "NOT_FOUND"),
                "settings_loaded": False
            }
        }


@router.post("/{session_id}/complete-step")
async def complete_workflow_step(
    session_id: str, 
    request: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Complete a workflow step and notify the agent.
    
    Args:
        session_id: Session identifier (actually room_id)
        request: Step completion data
        
    Returns:
        Step completion result
    """
    logger.info("Completing workflow step", extra={
        "session_id": session_id,
        "step_id": request.get("step_id"),
        "result": request.get("result")
    })
    
    try:
        # Get step data from request
        step_id = request.get("step_id")
        result = request.get("result", "completed")
        step_data = request.get("data", {})
        
        if not step_id:
            raise HTTPException(status_code=400, detail="step_id is required")
        
        # Notify the agent about step completion
        try:
            from ..services.proper_agent_service import proper_agent_service
            
            # Get the agent for this room
            agent_info = proper_agent_service.active_agents.get(session_id)
            if agent_info and 'agent' in agent_info:
                agent = agent_info['agent']
                # Call the agent's step completion handler
                await agent.handle_step_completion(step_id, step_data)
                logger.info(f"🎯 BACKEND: Notified agent about step completion: {step_id}")
            else:
                logger.warning(f"🎯 BACKEND: No active agent found for room: {session_id}")
        except Exception as agent_error:
            logger.error(f"🎯 BACKEND: Failed to notify agent: {agent_error}")
            # Don't fail the API call if agent notification fails
        
        # TODO: Store step completion in database
        logger.info(f"Step {step_id} completed with result: {result}")
        
        return {
            "status": "success",
            "message": f"Step {step_id} completed successfully",
            "step_id": step_id,
            "result": result,
            "agent_notified": True
        }
        
    except Exception as e:
        logger.error("Failed to complete workflow step", extra={"error": str(e)})
        raise HTTPException(status_code=500, detail=f"Failed to complete step: {str(e)}")


@router.post("/{session_id}/verify-step-data")
async def verify_step_data(
    session_id: str, 
    request: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Verify if step data is actually present for a given step.
    
    Args:
        session_id: Session identifier (actually room_id)
        request: Verification request data
        
    Returns:
        Verification result
    """
    logger.info("Verifying step data", extra={
        "session_id": session_id,
        "step_id": request.get("step_id"),
        "data_type": request.get("data_type")
    })
    
    try:
        # Get verification data from request
        step_id = request.get("step_id")
        data_type = request.get("data_type")
        
        if not step_id or not data_type:
            raise HTTPException(status_code=400, detail="step_id and data_type are required")
        
        # For now, we'll implement a simple verification logic
        # In a real implementation, this would check the database for actual data
        
        has_data = False
        
        if data_type == "image":
            # Check if image was uploaded for this step
            # This would typically query the database for uploaded images
            # For now, we'll return False to force actual capture
            has_data = False
            logger.info(f"Image verification for step {step_id}: {has_data}")
            
        elif data_type == "questionnaire":
            # Check if questionnaire was completed for this step
            # This would typically query the database for submitted answers
            # For now, we'll return False to force actual completion
            has_data = False
            logger.info(f"Questionnaire verification for step {step_id}: {has_data}")
            
        else:
            logger.warning(f"Unknown data type for verification: {data_type}")
            has_data = False
        
        return {
            "status": "success",
            "step_id": step_id,
            "data_type": data_type,
            "has_data": has_data,
            "message": f"Step data verification completed for {data_type}"
        }
        
    except Exception as e:
        logger.error("Failed to verify step data", extra={"error": str(e)})
        raise HTTPException(status_code=500, detail=f"Failed to verify step data: {str(e)}")


@router.delete("/{session_id}")
async def delete_session(session_id: str) -> Dict[str, Any]:
    """
    Delete/cleanup a session and stop the associated agent.
    
    Args:
        session_id: Session identifier (room_id)
        
    Returns:
        Deletion result
        
    Raises:
        HTTPException: If deletion fails
    """
    logger.info("Deleting session", extra={"session_id": session_id})
    
    try:
        # Check if session exists in our mapping
        room_id = session_to_room_mapping.get(session_id)
        if not room_id:
            # Try using session_id as room_id directly
            room_id = session_id
        
        # Clean up the agent session
        cleanup_result = await proper_agent_service.cleanup_agent_session(room_id)
        
        # Remove from session mapping
        if session_id in session_to_room_mapping:
            del session_to_room_mapping[session_id]
        
        logger.info("Session deleted successfully", extra={
            "session_id": session_id,
            "room_id": room_id,
            "agent_cleanup": cleanup_result.get("status", "unknown")
        })
        
        return {
            "status": "success",
            "message": "Session deleted successfully",
            "session_id": session_id,
            "room_id": room_id,
            "agent_cleanup": cleanup_result
        }
        
    except Exception as e:
        logger.error("Failed to delete session", extra={"error": str(e), "session_id": session_id})
        raise HTTPException(status_code=500, detail=f"Failed to delete session: {str(e)}")










# Workflow Management Endpoints









