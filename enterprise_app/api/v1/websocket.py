#!/usr/bin/env python3
"""
WebSocket endpoints for real-time communication with frontend
"""

import json
import asyncio
from typing import Dict, Any, List
from fastapi import WebSocket, WebSocketDisconnect, APIRouter
from utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()

class ConnectionManager:
    """Manages WebSocket connections"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.room_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, room_id: str = None):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        self.active_connections.append(websocket)
        
        if room_id:
            if room_id not in self.room_connections:
                self.room_connections[room_id] = []
            self.room_connections[room_id].append(websocket)
        
        logger.info(f"🔌 WEBSOCKET: Client connected. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket, room_id: str = None):
        """Remove a WebSocket connection"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        
        if room_id and room_id in self.room_connections:
            if websocket in self.room_connections[room_id]:
                self.room_connections[room_id].remove(websocket)
                if not self.room_connections[room_id]:
                    del self.room_connections[room_id]
        
        logger.info(f"🔌 WEBSOCKET: Client disconnected. Total connections: {len(self.active_connections)}")
    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        """Send message to a specific WebSocket connection"""
        try:
            await websocket.send_text(message)
        except Exception as e:
            logger.error(f"🔌 WEBSOCKET: Failed to send personal message: {e}")
    
    async def send_room_message(self, message: str, room_id: str):
        """Send message to all connections in a room"""
        if room_id in self.room_connections:
            for connection in self.room_connections[room_id]:
                try:
                    await connection.send_text(message)
                except Exception as e:
                    logger.error(f"🔌 WEBSOCKET: Failed to send room message: {e}")
    
    async def broadcast(self, message: str):
        """Broadcast message to all active connections"""
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"🔌 WEBSOCKET: Failed to broadcast message: {e}")

# Global connection manager
manager = ConnectionManager()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint"""
    await manager.connect(websocket)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            logger.info(f"🔌 WEBSOCKET: Received message: {message.get('type', 'unknown')}")
            
            # Handle different message types
            await handle_websocket_message(websocket, message)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"🔌 WEBSOCKET: Error in websocket endpoint: {e}")
        manager.disconnect(websocket)

@router.websocket("/ws/{room_id}")
async def websocket_room_endpoint(websocket: WebSocket, room_id: str):
    """WebSocket endpoint for specific room"""
    await manager.connect(websocket, room_id)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            logger.info(f"🔌 WEBSOCKET: Received room message for {room_id}: {message.get('type', 'unknown')}")
            
            # Handle different message types
            await handle_websocket_message(websocket, message, room_id)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)
    except Exception as e:
        logger.error(f"🔌 WEBSOCKET: Error in room websocket endpoint: {e}")
        manager.disconnect(websocket, room_id)

async def handle_websocket_message(websocket: WebSocket, message: Dict[str, Any], room_id: str = None):
    """Handle incoming WebSocket messages"""
    message_type = message.get('type')
    data = message.get('data', {})
    
    try:
        if message_type == 'step_completion':
            await handle_step_completion(websocket, data, room_id)
        elif message_type == 'step_error':
            await handle_step_error(websocket, data, room_id)
        elif message_type == 'artifact_submission':
            await handle_artifact_submission(websocket, data, room_id)
        elif message_type == 'questionnaire_answers':
            await handle_questionnaire_answers(websocket, data, room_id)
        elif message_type == 'ping':
            await handle_ping(websocket)
        else:
            logger.warning(f"🔌 WEBSOCKET: Unknown message type: {message_type}")
            
    except Exception as e:
        logger.error(f"🔌 WEBSOCKET: Error handling message {message_type}: {e}")
        await send_error_response(websocket, f"Error processing {message_type}: {str(e)}")

async def handle_step_completion(websocket: WebSocket, data: Dict[str, Any], room_id: str = None):
    """Handle step completion message"""
    step_id = data.get('stepId')
    step_data = data.get('data', {})
    
    logger.info(f"🔌 WEBSOCKET: Step completion - {step_id}")
    
    # Here you would typically:
    # 1. Update step status in database
    # 2. Trigger next step if applicable
    # 3. Send confirmation back to client
    
    response = {
        "type": "step_update",
        "data": {
            "stepId": step_id,
            "status": "completed",
            "data": step_data,
            "timestamp": asyncio.get_event_loop().time()
        }
    }
    
    await manager.send_personal_message(json.dumps(response), websocket)
    
    # Broadcast to room if applicable
    if room_id:
        await manager.send_room_message(json.dumps(response), room_id)

async def handle_step_error(websocket: WebSocket, data: Dict[str, Any], room_id: str = None):
    """Handle step error message"""
    step_id = data.get('stepId')
    error = data.get('error')
    
    logger.error(f"🔌 WEBSOCKET: Step error - {step_id}: {error}")
    
    response = {
        "type": "step_update",
        "data": {
            "stepId": step_id,
            "status": "failed",
            "error": error,
            "timestamp": asyncio.get_event_loop().time()
        }
    }
    
    await manager.send_personal_message(json.dumps(response), websocket)

async def handle_artifact_submission(websocket: WebSocket, data: Dict[str, Any], room_id: str = None):
    """Handle artifact submission message"""
    artifact_type = data.get('type')
    artifact_data = data.get('data', {})
    
    logger.info(f"🔌 WEBSOCKET: Artifact submission - {artifact_type}")
    
    # Here you would typically:
    # 1. Process the artifact (image, document, etc.)
    # 2. Run validations
    # 3. Store results
    
    response = {
        "type": "validation_result",
        "data": {
            "artifactType": artifact_type,
            "status": "success",
            "result": {
                "valid": True,
                "confidence": 0.95,
                "metadata": artifact_data
            },
            "timestamp": asyncio.get_event_loop().time()
        }
    }
    
    await manager.send_personal_message(json.dumps(response), websocket)

async def handle_questionnaire_answers(websocket: WebSocket, data: Dict[str, Any], room_id: str = None):
    """Handle questionnaire answers message"""
    answers = data.get('answers', {})
    
    logger.info(f"🔌 WEBSOCKET: Questionnaire answers received")
    
    # Here you would typically:
    # 1. Validate answers
    # 2. Store in database
    # 3. Trigger next workflow step
    
    response = {
        "type": "questionnaire_result",
        "data": {
            "status": "success",
            "answers": answers,
            "timestamp": asyncio.get_event_loop().time()
        }
    }
    
    await manager.send_personal_message(json.dumps(response), websocket)

async def handle_ping(websocket: WebSocket):
    """Handle ping message"""
    response = {
        "type": "pong",
        "data": {
            "timestamp": asyncio.get_event_loop().time()
        }
    }
    
    await manager.send_personal_message(json.dumps(response), websocket)

async def send_error_response(websocket: WebSocket, error_message: str):
    """Send error response to client"""
    response = {
        "type": "error",
        "data": {
            "message": error_message,
            "timestamp": asyncio.get_event_loop().time()
        }
    }
    
    await manager.send_personal_message(json.dumps(response), websocket)

# Utility functions for sending messages from other parts of the application
async def send_step_update(room_id: str, step_id: str, status: str, data: Dict[str, Any] = None):
    """Send step update to room"""
    message = {
        "type": "step_update",
        "data": {
            "stepId": step_id,
            "status": status,
            "data": data or {},
            "timestamp": asyncio.get_event_loop().time()
        }
    }
    
    await manager.send_room_message(json.dumps(message), room_id)

async def send_agent_message(room_id: str, message_type: str, content: str, metadata: Dict[str, Any] = None):
    """Send agent message to room"""
    message = {
        "type": "agent_message",
        "data": {
            "type": message_type,
            "content": content,
            "metadata": metadata or {},
            "timestamp": asyncio.get_event_loop().time()
        }
    }
    
    await manager.send_room_message(json.dumps(message), room_id)
