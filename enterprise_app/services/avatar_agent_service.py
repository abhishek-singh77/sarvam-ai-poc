#!/usr/bin/env python3
"""
Avatar Agent Service - Creates a separate AI agent participant for the avatar
Based on VideoSDK AI Agent documentation: https://docs.videosdk.live/python/guide/ai-integrations/ai-agent
"""

import asyncio
import time
import logging
from typing import Dict, Any, Optional
from utils.config.settings import get_settings
from utils.logging.logger import get_logger
from plugins.wav2lip.true_sync_avatar import TrueSyncWav2LipAvatar, TrueSyncVideoTrack, TrueSyncAudioTrack

logger = get_logger(__name__)

class AvatarAgentService:
    """
    Service to create and manage a separate AI agent participant for the avatar.
    This agent joins the meeting with custom audio and video tracks.
    """
    
    def __init__(self):
        self.settings = get_settings()
        self.avatar_agents: Dict[str, Any] = {}  # room_id -> avatar agent instance
        logger.info("🎬 AvatarAgentService initialized")
    
    async def create_avatar_agent(self, room_id: str, meeting_id: str, token: str) -> bool:
        """
        Create a separate AI agent participant for the avatar.
        
        Args:
            room_id: VideoSDK room ID
            meeting_id: Meeting ID
            token: Authentication token
            
        Returns:
            True if successful, False otherwise
        """
        try:
            logger.info(f"🎬 Creating avatar agent for room {room_id}")
            
            # Create custom audio and video tracks
            video_track = TrueSyncVideoTrack()
            audio_track = TrueSyncAudioTrack()
            
            # Create avatar instance
            avatar = TrueSyncWav2LipAvatar(wav2lip_url=self.settings.wav2lip_url)
            
            # Set both tracks
            avatar.video_track = video_track
            avatar.audio_track = audio_track
            
            # Connect to Wav2Lip WebSocket
            await avatar.connect(
                room_id=room_id,
                participant_id="avatar_agent",
                token=token
            )
            
            # Create the AI agent using VideoSDK pattern
            from videosdk import MeetingConfig, VideoSDK
            
            # Configure the avatar agent with both audio and video tracks
            meeting_config = MeetingConfig(
                name="Avatar Agent",
                meeting_id=meeting_id,
                token=token,
                mic_enabled=True,  # Enable audio for Avatar Agent
                webcam_enabled=True,
                custom_microphone_audio_track=audio_track,
                custom_webcam_video_track=video_track
            )
            
            # Initialize the avatar agent
            avatar_agent = VideoSDK.init_meeting(**meeting_config)
            
            # Store the avatar agent
            self.avatar_agents[room_id] = {
                'agent': avatar_agent,
                'avatar': avatar,
                'video_track': video_track,
                'audio_track': audio_track
            }
            
            # Join the meeting with timeout to prevent hanging
            try:
                logger.info(f"🎬 Joining avatar agent to room {room_id}...")
                await asyncio.wait_for(avatar_agent.async_join(), timeout=10.0)
                logger.info(f"✅ Avatar agent created and joined for room {room_id}")
                return True
            except asyncio.TimeoutError:
                logger.warning(f"⚠️ Avatar agent join timed out for room {room_id}, but continuing...")
                # Continue anyway - the avatar might still work
                return True
            except Exception as join_error:
                logger.error(f"❌ Failed to join avatar agent to room {room_id}: {join_error}")
                # Continue anyway - the avatar might still work
                return True
            
        except Exception as e:
            logger.error(f"❌ Failed to create avatar agent for room {room_id}: {e}")
            return False
    
    async def send_text_to_avatar_agent(self, room_id: str, text: str, tts_audio: bytes = None) -> bool:
        """
        Send text to the avatar agent for processing.
        
        Args:
            room_id: VideoSDK room ID
            text: Text to process
            tts_audio: Optional TTS audio data from main agent
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if room_id not in self.avatar_agents:
                logger.warning(f"⚠️ No avatar agent found for room {room_id}")
                return False
            
            avatar_data = self.avatar_agents[room_id]
            avatar = avatar_data['avatar']
            
            # Generate TTS audio for the Avatar Agent
            tts_audio = await self._generate_tts_for_avatar(text)
            if tts_audio:
                logger.info(f"🎬 Generated TTS audio for Avatar Agent: {len(tts_audio)} bytes")
                # Send text with TTS audio to avatar for synchronized lip-sync
                await avatar.send_text_with_audio_sync(text, tts_audio, time.time())
            else:
                logger.warning("⚠️ Failed to generate TTS audio, sending text only")
                # Send text to avatar for lip-sync only (no audio)
                await avatar.send_text_with_audio_sync(text, None, time.time())
            
            logger.info(f"🎬 Text sent to avatar agent for room {room_id}: '{text[:50]}...'")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to send text to avatar agent for room {room_id}: {e}")
            return False
    
    async def _generate_tts_for_avatar(self, text: str) -> Optional[bytes]:
        """
        Generate TTS audio for the avatar agent.
        
        Args:
            text: Text to convert to speech
            
        Returns:
            TTS audio bytes or None if failed
        """
        try:
            from videosdk.plugins.sarvamai import SarvamAITTS
            
            # Check if API key is available
            if not self.settings.sarvamai_api_key:
                logger.error("❌ SARVAMAI_API_KEY not set in environment")
                return None
            
            logger.info(f"🎤 Generating TTS for Avatar Agent: {text[:50]}...")
            logger.info(f"🎤 TTS Settings: api_key={'***' if self.settings.sarvamai_api_key else 'None'}, model=bulbul:v2, speaker=anushka, target_language_code=en-IN, pitch={self.settings.tts_pitch}, pace={self.settings.tts_pace}, loudness={self.settings.tts_loudness}")
            
            # Create TTS instance with same settings as main agent
            tts = SarvamAITTS(
                api_key=self.settings.sarvamai_api_key,
                model="bulbul:v2",
                speaker="anushka",
                target_language_code="en-IN",
                pitch=self.settings.tts_pitch,
                pace=self.settings.tts_pace,
                loudness=self.settings.tts_loudness
            )
            
            # Generate TTS audio
            try:
                audio_data = await tts.synthesize(text)
                logger.info(f"🎤 TTS synthesize returned: {type(audio_data)}, length: {len(audio_data) if audio_data else 'None'}")
                
                if audio_data:
                    logger.info(f"✅ Generated TTS audio for Avatar Agent: {len(audio_data)} bytes")
                    return audio_data
                else:
                    logger.warning("⚠️ TTS generation returned empty data")
                    return None
            except Exception as tts_error:
                logger.error(f"❌ TTS synthesize failed: {tts_error}")
                import traceback
                logger.error(f"❌ TTS synthesize traceback: {traceback.format_exc()}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Failed to generate TTS audio for Avatar Agent: {e}")
            import traceback
            logger.error(f"❌ TTS Error traceback: {traceback.format_exc()}")
            return None
    
    async def remove_avatar_agent(self, room_id: str) -> bool:
        """
        Remove the avatar agent from the meeting.
        
        Args:
            room_id: VideoSDK room ID
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if room_id not in self.avatar_agents:
                logger.warning(f"⚠️ No avatar agent found for room {room_id}")
                return True  # Already removed
            
            avatar_data = self.avatar_agents.pop(room_id)
            
            # Disconnect avatar
            await avatar_data['avatar'].disconnect()
            
            # Leave the meeting
            await avatar_data['agent'].async_leave()
            
            logger.info(f"✅ Avatar agent removed for room {room_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to remove avatar agent for room {room_id}: {e}")
            return False

# Global instance
avatar_agent_service = AvatarAgentService()
