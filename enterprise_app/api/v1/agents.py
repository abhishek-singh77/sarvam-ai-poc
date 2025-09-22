"""
Agent management API endpoints.

This module provides endpoints for managing AI agents and their operations.
"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from utils.logging.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)


class AgentStatusResponse(BaseModel):
    """Response model for agent status."""
    agent_id: str
    agent_type: str
    status: str
    session_id: Optional[str] = None
    room_id: Optional[str] = None
    created_at: str
    last_activity: str
    error_count: int
    metrics: Dict[str, Any]


class CreateAgentRequest(BaseModel):
    """Request model for creating an agent."""
    agent_type: str = Field(..., description="Type of agent to create")
    session_id: str = Field(..., description="Session identifier")
    room_id: str = Field(..., description="Room identifier")
    config: Optional[Dict[str, Any]] = Field(default=None, description="Agent configuration")


@router.get("/types")
async def get_agent_types() -> Dict[str, List[str]]:
    """
    Get available agent types.
    
    Returns:
        List of available agent types
    """
    logger.info("Getting agent types")
    
    return {
        "agent_types": [
            "kyc_agent",
            "interview_agent",
            "survey_agent",
            "assessment_agent",
            "support_agent"
        ]
    }


@router.post("/create")
async def create_agent(request: CreateAgentRequest) -> Dict[str, Any]:
    """
    Create a new agent.
    
    Args:
        request: Agent creation request
        
    Returns:
        Created agent information
        
    Raises:
        HTTPException: If agent creation fails
    """
    logger.info("Creating agent", extra={"agent_type": request.agent_type, "session_id": request.session_id})
    
    try:
        # This would integrate with the agent factory
        # For now, return a mock response
        agent_id = f"agent_{hash(request.agent_type + request.session_id)}"
        
        result = {
            "status": "success",
            "agent_id": agent_id,
            "agent_type": request.agent_type,
            "session_id": request.session_id,
            "room_id": request.room_id,
            "message": "Agent created successfully"
        }
        
        logger.info("Agent created successfully", extra={"agent_id": agent_id})
        return result
        
    except Exception as e:
        logger.error("Failed to create agent", extra={"error": str(e)})
        raise HTTPException(status_code=500, detail="Failed to create agent")


@router.get("/{agent_id}/status", response_model=AgentStatusResponse)
async def get_agent_status(agent_id: str) -> AgentStatusResponse:
    """
    Get agent status.
    
    Args:
        agent_id: Agent identifier
        
    Returns:
        Agent status information
        
    Raises:
        HTTPException: If agent not found
    """
    logger.info("Getting agent status", extra={"agent_id": agent_id})
    
    try:
        # This would fetch from the agent service
        # For now, return a mock response
        response = AgentStatusResponse(
            agent_id=agent_id,
            agent_type="kyc_agent",
            status="active",
            session_id="session_123",
            room_id="room_123",
            created_at="2024-01-01T00:00:00Z",
            last_activity="2024-01-01T00:05:00Z",
            error_count=0,
            metrics={
                "messages_processed": 15,
                "average_response_time_ms": 250,
                "uptime_seconds": 300
            }
        )
        
        return response
        
    except Exception as e:
        logger.error("Failed to get agent status", extra={"agent_id": agent_id, "error": str(e)})
        raise HTTPException(status_code=404, detail="Agent not found")


@router.get("/", response_model=List[AgentStatusResponse])
async def list_agents(
    limit: int = 10,
    offset: int = 0,
    status: Optional[str] = None,
    agent_type: Optional[str] = None
) -> List[AgentStatusResponse]:
    """
    List agents with optional filtering.
    
    Args:
        limit: Maximum number of agents to return
        offset: Number of agents to skip
        status: Filter by agent status
        agent_type: Filter by agent type
        
    Returns:
        List of agents
    """
    logger.info("Listing agents", extra={"limit": limit, "offset": offset, "status": status, "agent_type": agent_type})
    
    try:
        # This would fetch from the agent service
        # For now, return a mock response
        agents = [
            AgentStatusResponse(
                agent_id=f"agent_{i}",
                agent_type="kyc_agent",
                status="active",
                session_id=f"session_{i}",
                room_id=f"room_{i}",
                created_at="2024-01-01T00:00:00Z",
                last_activity="2024-01-01T00:05:00Z",
                error_count=0,
                metrics={"messages_processed": i * 10}
            )
            for i in range(1, min(limit + 1, 6))
        ]
        
        return agents
        
    except Exception as e:
        logger.error("Failed to list agents", extra={"error": str(e)})
        raise HTTPException(status_code=500, detail="Failed to list agents")


@router.post("/{agent_id}/pause")
async def pause_agent(agent_id: str) -> Dict[str, Any]:
    """
    Pause an agent.
    
    Args:
        agent_id: Agent identifier
        
    Returns:
        Pause result
        
    Raises:
        HTTPException: If pause fails
    """
    logger.info("Pausing agent", extra={"agent_id": agent_id})
    
    try:
        # This would pause the agent
        result = {
            "status": "success",
            "agent_id": agent_id,
            "message": "Agent paused successfully"
        }
        
        logger.info("Agent paused successfully", extra={"agent_id": agent_id})
        return result
        
    except Exception as e:
        logger.error("Failed to pause agent", extra={"agent_id": agent_id, "error": str(e)})
        raise HTTPException(status_code=500, detail="Failed to pause agent")


@router.post("/{agent_id}/resume")
async def resume_agent(agent_id: str) -> Dict[str, Any]:
    """
    Resume an agent.
    
    Args:
        agent_id: Agent identifier
        
    Returns:
        Resume result
        
    Raises:
        HTTPException: If resume fails
    """
    logger.info("Resuming agent", extra={"agent_id": agent_id})
    
    try:
        # This would resume the agent
        result = {
            "status": "success",
            "agent_id": agent_id,
            "message": "Agent resumed successfully"
        }
        
        logger.info("Agent resumed successfully", extra={"agent_id": agent_id})
        return result
        
    except Exception as e:
        logger.error("Failed to resume agent", extra={"agent_id": agent_id, "error": str(e)})
        raise HTTPException(status_code=500, detail="Failed to resume agent")


@router.delete("/{agent_id}")
async def destroy_agent(agent_id: str) -> Dict[str, Any]:
    """
    Destroy an agent.
    
    Args:
        agent_id: Agent identifier
        
    Returns:
        Destruction result
        
    Raises:
        HTTPException: If destruction fails
    """
    logger.info("Destroying agent", extra={"agent_id": agent_id})
    
    try:
        # This would destroy the agent
        result = {
            "status": "success",
            "agent_id": agent_id,
            "message": "Agent destroyed successfully"
        }
        
        logger.info("Agent destroyed successfully", extra={"agent_id": agent_id})
        return result
        
    except Exception as e:
        logger.error("Failed to destroy agent", extra={"agent_id": agent_id, "error": str(e)})
        raise HTTPException(status_code=500, detail="Failed to destroy agent")


@router.get("/{agent_id}/metrics")
async def get_agent_metrics(agent_id: str) -> Dict[str, Any]:
    """
    Get agent metrics.
    
    Args:
        agent_id: Agent identifier
        
    Returns:
        Agent metrics
        
    Raises:
        HTTPException: If agent not found
    """
    logger.info("Getting agent metrics", extra={"agent_id": agent_id})
    
    try:
        # This would fetch from the agent service
        # For now, return a mock response
        metrics = {
            "agent_id": agent_id,
            "uptime_seconds": 1800,
            "messages_processed": 45,
            "average_response_time_ms": 250,
            "error_rate": 0.02,
            "memory_usage_mb": 128,
            "cpu_usage_percent": 15.5,
            "last_activity": "2024-01-01T00:10:00Z"
        }
        
        return metrics
        
    except Exception as e:
        logger.error("Failed to get agent metrics", extra={"agent_id": agent_id, "error": str(e)})
        raise HTTPException(status_code=404, detail="Agent not found")
