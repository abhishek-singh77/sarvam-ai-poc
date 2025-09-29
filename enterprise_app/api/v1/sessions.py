"""
Session management API endpoints.

This module provides endpoints for creating, managing, and monitoring sessions.
"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from utils.logging.logger import get_logger
from core.exceptions import SessionError
from services.videosdk_service import register_room_with_tokens
from services.proper_agent_service import proper_agent_service
from services.conversation_logger import conversation_logger
from services.workflow_service import workflow_service

router = APIRouter()
logger = get_logger(__name__)


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
        
        # Stop the agent for this session (session_id is used as room_id)
        agent_stop_result = await proper_agent_service.stop_agent(session_id)
        
        if agent_stop_result["status"] == "success":
            logger.info("Agent stopped successfully", extra={"session_id": session_id})
        else:
            logger.warning("Agent stop failed or no agent found", extra={
                "session_id": session_id, 
                "agent_error": agent_stop_result.get("error", "Unknown error")
            })
        
        # Clean up workflow data if needed
        from services.workflow_service import workflow_service
        workflow_service.clear_session_data(session_id)
        
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


@router.post("/{session_id}/pause")
async def pause_session(session_id: str) -> Dict[str, Any]:
    """
    Pause a session.
    
    Args:
        session_id: Session identifier
        
    Returns:
        Pause result
        
    Raises:
        HTTPException: If pause fails
    """
    logger.info("Pausing session", extra={"session_id": session_id})
    
    try:
        # This would pause the session
        result = {
            "status": "success",
            "session_id": session_id,
            "message": "Session paused successfully"
        }
        
        logger.info("Session paused successfully", extra={"session_id": session_id})
        return result
        
    except Exception as e:
        logger.error("Failed to pause session", extra={"session_id": session_id, "error": str(e)})
        raise HTTPException(status_code=500, detail="Failed to pause session")


@router.post("/{session_id}/resume")
async def resume_session(session_id: str) -> Dict[str, Any]:
    """
    Resume a session.
    
    Args:
        session_id: Session identifier
        
    Returns:
        Resume result
        
    Raises:
        HTTPException: If resume fails
    """
    logger.info("Resuming session", extra={"session_id": session_id})
    
    try:
        # This would resume the session
        result = {
            "status": "success",
            "session_id": session_id,
            "message": "Session resumed successfully"
        }
        
        logger.info("Session resumed successfully", extra={"session_id": session_id})
        return result
        
    except Exception as e:
        logger.error("Failed to resume session", extra={"session_id": session_id, "error": str(e)})
        raise HTTPException(status_code=500, detail="Failed to resume session")


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


# Workflow Management Endpoints

@router.post("/workflow/load")
async def load_workflow_controller(request: WorkflowProgressRequest) -> Dict[str, Any]:
    """
    Load a workflow for a room.
    """
    logger.info("🚀 API REQUEST: POST /api/v1/sessions/workflow/load")
    
    try:
        result = workflow_service.load_workflow(request.room_id, "kyc")
        
        if result["status"] == "success":
            logger.info(f"✅ API SUCCESS: Workflow loaded for room {request.room_id}")
        else:
            logger.error(f"❌ API ERROR: Failed to load workflow for room {request.room_id}")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ API ERROR: Failed to load workflow for room {request.room_id}: {e}")
        return {
            "status": "error",
            "room_id": request.room_id,
            "error": str(e)
        }


@router.get("/workflow/progress/{room_id}")
async def get_workflow_progress_controller(room_id: str) -> Dict[str, Any]:
    """
    Get workflow progress for a room.
    """
    logger.info(f"🚀 API REQUEST: GET /api/v1/sessions/workflow/progress/{room_id}")
    
    try:
        result = workflow_service.get_workflow_progress(room_id)
        
        if result["status"] == "success":
            logger.info(f"✅ API SUCCESS: Retrieved workflow progress for room {room_id}")
        else:
            logger.error(f"❌ API ERROR: Failed to get workflow progress for room {room_id}")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ API ERROR: Failed to get workflow progress for room {room_id}: {e}")
        return {
            "status": "error",
            "room_id": room_id,
            "error": str(e)
        }


@router.post("/workflow/start-step")
async def start_workflow_step_controller(request: WorkflowStepRequest) -> Dict[str, Any]:
    """
    Start a workflow step.
    """
    logger.info("🚀 API REQUEST: POST /api/v1/sessions/workflow/start-step")
    
    try:
        result = workflow_service.start_workflow_step(request.room_id, request.step_id, request.data)
        
        if result["status"] == "success":
            logger.info(f"✅ API SUCCESS: Started step {request.step_id} for room {request.room_id}")
        else:
            logger.error(f"❌ API ERROR: Failed to start step {request.step_id} for room {request.room_id}")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ API ERROR: Failed to start workflow step for room {request.room_id}: {e}")
        return {
            "status": "error",
            "room_id": request.room_id,
            "error": str(e)
        }


@router.post("/workflow/complete-step")
async def complete_workflow_step_controller(request: WorkflowStepRequest) -> Dict[str, Any]:
    """
    Complete a workflow step.
    """
    logger.info("🚀 API REQUEST: POST /api/v1/sessions/workflow/complete-step")
    
    try:
        result = workflow_service.complete_workflow_step(request.room_id, request.step_id, request.data)
        
        if result["status"] == "success":
            logger.info(f"✅ API SUCCESS: Completed step {request.step_id} for room {request.room_id}")
        else:
            logger.error(f"❌ API ERROR: Failed to complete step {request.step_id} for room {request.room_id}")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ API ERROR: Failed to complete workflow step for room {request.room_id}: {e}")
        return {
            "status": "error",
            "room_id": request.room_id,
            "error": str(e)
        }


# Conversation Management Endpoints

@router.get("/conversation/history/{room_id}")
async def get_conversation_history_controller(room_id: str, limit: int = 50) -> Dict[str, Any]:
    """
    Get conversation history for a room.
    """
    logger.info(f"🚀 API REQUEST: GET /api/v1/sessions/conversation/history/{room_id}")
    
    try:
        history = conversation_logger.get_conversation_history(room_id, limit)
        stats = conversation_logger.get_conversation_stats(room_id)
        
        logger.info(f"✅ API SUCCESS: Retrieved conversation history for room {room_id}")
        
        return {
            "status": "success",
            "room_id": room_id,
            "history": history,
            "stats": stats,
            "limit": limit
        }
        
    except Exception as e:
        logger.error(f"❌ API ERROR: Failed to get conversation history for room {room_id}: {e}")
        return {
            "status": "error",
            "room_id": room_id,
            "error": str(e)
        }


@router.get("/conversation/latest/{room_id}")
async def get_latest_conversation_controller(room_id: str) -> Dict[str, Any]:
    """
    Get the latest conversation entry for a room.
    """
    logger.info(f"🚀 API REQUEST: GET /api/v1/sessions/conversation/latest/{room_id}")
    
    try:
        latest = conversation_logger.get_latest_conversation(room_id)
        
        if latest:
            logger.info(f"✅ API SUCCESS: Retrieved latest conversation for room {room_id}")
            return {
                "status": "success",
                "room_id": room_id,
                "latest": latest
            }
        else:
            logger.info(f"ℹ️ API INFO: No conversation found for room {room_id}")
            return {
                "status": "success",
                "room_id": room_id,
                "latest": None,
                "message": "No conversation found"
            }
        
    except Exception as e:
        logger.error(f"❌ API ERROR: Failed to get latest conversation for room {room_id}: {e}")
        return {
            "status": "error",
            "room_id": room_id,
            "error": str(e)
        }


@router.delete("/conversation/clear/{room_id}")
async def clear_conversation_controller(room_id: str) -> Dict[str, Any]:
    """
    Clear conversation history for a room.
    """
    logger.info(f"🚀 API REQUEST: DELETE /api/v1/sessions/conversation/clear/{room_id}")
    
    try:
        success = conversation_logger.clear_conversation(room_id)
        
        if success:
            logger.info(f"✅ API SUCCESS: Cleared conversation history for room {room_id}")
            return {
                "status": "success",
                "room_id": room_id,
                "message": "Conversation history cleared"
            }
        else:
            logger.info(f"ℹ️ API INFO: No conversation to clear for room {room_id}")
            return {
                "status": "success",
                "room_id": room_id,
                "message": "No conversation history found"
            }
        
    except Exception as e:
        logger.error(f"❌ API ERROR: Failed to clear conversation for room {room_id}: {e}")
        return {
            "status": "error",
            "room_id": room_id,
            "error": str(e)
        }
