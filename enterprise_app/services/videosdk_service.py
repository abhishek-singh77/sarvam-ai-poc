"""
VideoSDK integration service for the enterprise backend.

This service handles VideoSDK room creation, token generation, and participant management.
"""

import time
import jwt
import uuid
import secrets
import httpx
from typing import Dict, Any
from utils.settings import get_settings
from utils.logger import get_logger

logger = get_logger(__name__)


def get_jwt_token(secret: str, payload: dict, expiration_hours: int = 2) -> str:
    """
    Generate a JWT token with a standard header and expiration time.
    """
    expiration_time = int(time.time()) + (expiration_hours * 60 * 60)
    payload["exp"] = expiration_time

    headers = {
        "alg": "HS256",
        "typ": "JWT",
    }

    return jwt.encode(payload, secret, algorithm="HS256", headers=headers)


def generate_room_creation_token(api_key: str, secret: str, custom_room_id: str) -> str:
    """
    Generate the room creation token using API key and secret from settings.
    """
    if not api_key or not secret:
        raise ValueError("Missing VideoSDK credentials in settings.")
    
    # Token expires in 24 hours
    expiration_time = int(time.time()) + (1440 * 60)
    payload = {
        "apikey": api_key,
        "permissions": ["allow_join"],  # Allow direct joining
        "exp": expiration_time
    }

    try:
        # Sign the payload with the secret using HS256 algorithm
        token = jwt.encode(payload, secret, algorithm="HS256")
        logger.info(f"🔑 Generated room creation token for apiKey={api_key}")
        return token
    except Exception as e:
        logger.error(f"Failed to generate VideoSDK token: {e}")
        raise Exception(f"Failed to generate VideoSDK token: {e}")


def generate_unified_token(room_id: str) -> str:
    """
    Generate a unified token that can be used by multiple participants (both clients and agents).
    This follows the VideoSDK documentation for AI agents with enhanced payload.
    Note: No participantId restriction - allows multiple participants to use the same token.
    """
    settings = get_settings()
    api_key = settings.videosdk_api_key
    secret = settings.videosdk_api_secret

    if not api_key or not secret:
        raise ValueError("Missing VideoSDK credentials in settings.")

    # Unified payload for multiple participants (no participantId restriction)
    payload = {
        "apikey": api_key,
        "permissions": ["allow_join"],
        "version": 2,  # OPTIONAL but recommended
        "roomId": room_id,  # OPTIONAL but recommended for AI agents
        # Note: No participantId - allows multiple participants to use this token
    }

    token = get_jwt_token(secret, payload, expiration_hours=2)
    logger.info(f"🔑 Generated unified token for roomId={room_id} (multi-participant, no participantId restriction)")
    return token


async def register_room_with_tokens(auto_close_minutes: int = 60) -> Dict[str, Any]:
    """
    Create/register a room on VideoSDK with a custom generated room ID,
    and return a unified token that can be used by multiple participants.

    Returns:
        {
          "roomId": str,
          "customRoomId": str,
          "unifiedToken": str,  # Multi-participant token (no participantId restriction)
          "agent": { "participantId": str, "token": str },
          "client": { "participantId": str, "token": str }
        }
    """
    settings = get_settings()
    base_url = settings.videosdk_base_url.rstrip("/")
    url = f"{base_url}/v2/rooms"

    api_key = settings.videosdk_api_key
    secret = settings.videosdk_api_secret
    
    if not api_key or not secret:
        raise ValueError("Missing VideoSDK credentials in settings.")
    
    custom_room_id = uuid.uuid4().hex  # Generate UUID for customRoomId
    room_creation_token = generate_room_creation_token(api_key, secret, custom_room_id)

    headers = {
        "Authorization": room_creation_token,
        "Content-Type": "application/json",
    }

    payload = {
        "customRoomId": custom_room_id,
        "autoCloseConfig": {
            "type": "session-end-and-deactivate",
            "duration": auto_close_minutes,
        },
    }
    
    logger.info(f"Registering VideoSDK room | customRoomId={custom_room_id} | autoCloseMinutes={auto_close_minutes}")
    
    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0)) as client:
        resp = await client.post(url, headers=headers, json=payload)

        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError:
            logger.error(
                "VideoSDK register room failed",
                status=resp.status_code,
                body=resp.text
            )
            raise Exception("Unable to register custom meeting id with VideoSDK")

        response_data = resp.json()
        logger.info("VideoSDK room response", extra={"response": response_data})
        room_id = response_data.get("roomId") or response_data.get("id")
        if not room_id:
            raise Exception("Empty roomId found in response while registering room with VideoSDK")

    # Generate participant IDs
    agent_pid = secrets.token_hex(5)
    client_pid = secrets.token_hex(5)

    # Generate unified token that can be used for both client and agent
    unified_token = room_creation_token
    agent_token = room_creation_token
    client_token = room_creation_token

    result = {
        "roomId": room_id,
        "customRoomId": custom_room_id,
        "unifiedToken": unified_token,  # Single token for both client and agent
        "agent": {"participantId": agent_pid, "token": agent_token},
        "client": {"participantId": client_pid, "token": client_token},
    }
    
    logger.info("VideoSDK room registered successfully", extra={"result": result})
    return result
