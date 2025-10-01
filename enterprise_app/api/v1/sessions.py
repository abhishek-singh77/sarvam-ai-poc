"""
Session management API endpoints.

This module provides endpoints for creating, managing, and monitoring sessions.
"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from utils.logger import get_logger
from core.exceptions import SessionError
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


class SelfieSubmissionRequest(BaseModel):
    """Request model for selfie submission."""
    room_id: str
    selfie_data: str  # Base64 encoded image data


class WorkflowProgressRequest(BaseModel):
    """Request model for workflow progress."""
    room_id: str = Field(..., description="Room ID")


class WorkflowStepRequest(BaseModel):
    """Request model for workflow step operations."""
    room_id: str = Field(..., description="Room ID")
    step_id: str = Field(..., description="Step ID")
    data: Optional[Any] = Field(default=None, description="Step data")


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


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str) -> SessionResponse:
    """
    Get session information.
    
    Args:
        session_id: Session identifier
        
    Returns:
        Session information
        
    Raises:
        HTTPException: If session not found
    """
    logger.info("Getting session", extra={"session_id": session_id})
    
    try:
        # This would fetch from the session service
        # For now, return a mock response
        response = SessionResponse(
            session_id=session_id,
            room_id=f"room_{session_id}",
            status="active",
            workflow_type="kyc",
            agent_type="kyc_agent",
            created_at="2024-01-01T00:00:00Z"
        )
        
        return response
        
    except Exception as e:
        logger.error("Failed to get session", extra={"session_id": session_id, "error": str(e)})
        raise HTTPException(status_code=404, detail="Session not found")


@router.get("/", response_model=List[SessionResponse])
async def list_sessions(
    limit: int = 10,
    offset: int = 0,
    status: Optional[str] = None
) -> List[SessionResponse]:
    """
    List sessions with optional filtering.
    
    Args:
        limit: Maximum number of sessions to return
        offset: Number of sessions to skip
        status: Filter by session status
        
    Returns:
        List of sessions
    """
    logger.info("Listing sessions", extra={"limit": limit, "offset": offset, "status": status})
    
    try:
        # This would fetch from the session service
        # For now, return a mock response
        sessions = [
            SessionResponse(
                session_id=f"session_{i}",
                room_id=f"room_{i}",
                status="active",
                workflow_type="kyc",
                agent_type="kyc_agent",
                created_at="2024-01-01T00:00:00Z"
            )
            for i in range(1, min(limit + 1, 6))
        ]
        
        return sessions
        
    except Exception as e:
        logger.error("Failed to list sessions", extra={"error": str(e)})
        raise HTTPException(status_code=500, detail="Failed to list sessions")


@router.delete("/{session_id}")
async def delete_session(session_id: str) -> Dict[str, Any]:
    """
    Delete a session and stop the associated agent.
    
    Args:
        session_id: Session identifier
        
    Returns:
        Deletion result
        
    Raises:
        HTTPException: If deletion fails
    """
    logger.info("Deleting session", extra={"session_id": session_id})
    
    try:
        # Import the agent service to stop the agent
        from services.proper_agent_service import proper_agent_service
        
        # Frontend now passes room_id directly, so use it directly
        # session_id parameter is actually the room_id from frontend
        room_id = session_id  # Frontend passes room_id as the path parameter
        
        logger.info(f"Stopping agent for room_id: {room_id}")
        agent_stop_result = await proper_agent_service.stop_agent(room_id)
        
        if agent_stop_result["status"] == "success":
            logger.info("Agent stopped successfully", extra={"session_id": session_id})
        else:
            logger.warning("Agent stop failed or no agent found", extra={
                "session_id": session_id, 
                "agent_error": agent_stop_result.get("error", "Unknown error")
            })
        
        # Clean up the session-to-room mapping (if it exists)
        if session_id in session_to_room_mapping:
            del session_to_room_mapping[session_id]
            logger.info(f"Cleaned up session mapping for: {session_id}")
        
        # Clean up workflow data if needed
        # workflow_service.clear_session_data(session_id)  # Removed unused service
        
        result = {
            "status": "success",
            "session_id": session_id,
            "message": "Session deleted successfully",
            "agent_stopped": agent_stop_result["status"] == "success"
        }
        
        logger.info("Session deleted successfully", extra={"session_id": session_id})
        return result
        
    except Exception as e:
        logger.error("Failed to delete session", extra={"session_id": session_id, "error": str(e)})
        raise HTTPException(status_code=500, detail="Failed to delete session")




@router.post("/selfie/submit")
async def submit_selfie(request: SelfieSubmissionRequest) -> Dict[str, Any]:
    """
    Submit selfie data for processing.
    
    Args:
        request: Selfie submission request
        
    Returns:
        Selfie submission result
        
    Raises:
        HTTPException: If submission fails
    """
    logger.info("Submitting selfie", extra={
                "room_id": request.room_id, 
                "selfie_data_length": len(request.selfie_data)
    })
    
    try:
        # Log the base64 data as requested (like the old backend)
        logger.info(f"📸 SELFIE DATA: Base64 length: {len(request.selfie_data)} characters")
        logger.info(f"📸 SELFIE DATA: First 100 chars: {request.selfie_data[:100]}...")
        
        # Log the full base64 data (be careful with large data in production)
        logger.info("Selfie base64 data received", extra={
                   "room_id": request.room_id,
                   "selfie_data": request.selfie_data,
                   "data_length": len(request.selfie_data)
        })
        
        # Return success response like the old backend
        result = {
            "status": "success",
            "room_id": request.room_id,
            "message": "Selfie submitted successfully",
            "data_length": len(request.selfie_data)
        }
        
        logger.info("Selfie submitted successfully", extra={"room_id": request.room_id})
        return result
        
    except Exception as e:
        logger.error("Failed to submit selfie", extra={"room_id": request.room_id, "error": str(e)})
        return {
            "status": "error",
            "room_id": request.room_id,
            "error": str(e)
        }


@router.post("/force-cleanup-all")
async def force_cleanup_all_agents():
    """Force cleanup all active agents and Simli sessions"""
    try:
        logger.info("🧹 Force cleanup all agents requested")
        result = await proper_agent_service.force_cleanup_all_agents()
        return result
    except Exception as e:
        logger.error(f"❌ Failed to force cleanup all agents: {e}")
        return {
            "status": "error",
            "error": str(e)
        }


# Workflow Management Endpoints









