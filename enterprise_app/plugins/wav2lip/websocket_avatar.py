"""
WebSocket-based Wav2Lip Avatar Implementation

This module provides a WebSocket-based avatar that connects to the Wav2Lip server
and provides synchronized audio-video streaming for VideoSDK.
"""

import asyncio
import json
import base64
import io
import time
import websockets
from typing import Optional, Dict, Any
from PIL import Image
import av
import numpy as np
from videosdk import CustomVideoTrack
from utils.logging.logger import get_logger

logger = get_logger(__name__)

# Video frame configuration
VIDEO_FRAME_SIZE = (640, 480)  # Width, Height


class WebSocketWav2LipVideoTrack(CustomVideoTrack):
    """
    Custom video track that receives video frames from Wav2Lip WebSocket
    and streams them to VideoSDK with proper frame rate control.
    """
    
    def __init__(self):
        super().__init__()
        self.frame_queue = asyncio.Queue()
        self.current_frame = None
        self.frame_rate = 30  # 30 FPS for lower latency
        self.frame_duration = 1.0 / self.frame_rate
        self.last_frame_time = 0
        self.max_queue_size = 2  # Smaller queue for lower latency
        self.buffer_size = 1  # Minimal buffer for real-time performance
        
        logger.info(f"📺 WebSocket Wav2Lip Video Track initialized: {self.frame_rate} FPS, queue_size={self.max_queue_size}")
        
    async def add_frame(self, frame_data: str, frame_type: str = "lip_sync"):
        """
        Add a new video frame to the queue.
        
        Args:
            frame_data: Base64 encoded video frame data
            frame_type: Type of frame ('lip_sync' or 'idle')
        """
        try:
            # Decode the base64 frame data
            frame_bytes = base64.b64decode(frame_data)
            
            # Convert to PIL Image
            image = Image.open(io.BytesIO(frame_bytes))
            
            # Convert to RGB if needed
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Resize image to standard video dimensions if needed (use faster resampling)
            if image.size != VIDEO_FRAME_SIZE:
                image = image.resize(VIDEO_FRAME_SIZE, Image.Resampling.NEAREST)  # Faster than LANCZOS
            
            # Convert PIL image to numpy array
            frame_array = np.array(image, dtype=np.uint8)
            
            # Ensure the frame has the correct shape and format
            if frame_array.shape != (VIDEO_FRAME_SIZE[1], VIDEO_FRAME_SIZE[0], 3):
                logger.warning(f"⚠️ Frame shape mismatch: {frame_array.shape}, expected ({VIDEO_FRAME_SIZE[1]}, {VIDEO_FRAME_SIZE[0]}, 3)")
                return
            
            # Limit queue size to prevent memory issues
            if self.frame_queue.qsize() >= self.max_queue_size:
                try:
                    # Remove oldest frame
                    self.frame_queue.get_nowait()
                    logger.debug("⚠️ Queue full, removed oldest frame")
                except asyncio.QueueEmpty:
                    pass
            
            # Add to queue
            await self.frame_queue.put({
                'frame': frame_array,
                'type': frame_type,
                'timestamp': time.time()
            })
            
        except Exception as e:
            logger.error(f"❌ Failed to process frame: {e}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
    
    async def recv(self) -> av.VideoFrame:
        """
        Receive the next video frame for streaming.
        """
        current_time = time.time()
        
        # Try to get a new frame from the queue first
        try:
            # Non-blocking get from queue
            new_frame_data = self.frame_queue.get_nowait()
            self.current_frame = new_frame_data
        except asyncio.QueueEmpty:
            # No new frame available, use current frame or create a blank one
            if self.current_frame is None:
                # Create a blank frame if no frame is available
                self.current_frame = {
                    'frame': np.zeros((VIDEO_FRAME_SIZE[1], VIDEO_FRAME_SIZE[0], 3), dtype=np.uint8),
                    'type': 'blank',
                    'timestamp': current_time
                }
        
        # Check if enough time has passed since last frame (reduced for lower latency)
        if current_time - self.last_frame_time < (self.frame_duration * 0.8):  # 20% faster frame rate
            # Not enough time has passed, return the current frame
            pass
        
        try:
            # Ensure frame is in the correct format
            if self.current_frame is None:
                self.current_frame = {
                    'frame': np.zeros((VIDEO_FRAME_SIZE[1], VIDEO_FRAME_SIZE[0], 3), dtype=np.uint8),
                    'type': 'blank',
                    'timestamp': current_time
                }
            
            frame_array = self.current_frame['frame']
            
            # Create AV VideoFrame with RGB format (VP8 can handle RGB24)
            frame = av.VideoFrame.from_ndarray(frame_array, format='rgb24')
            frame.pts = int(current_time * 90000)  # 90kHz timestamp
            from fractions import Fraction
            frame.time_base = Fraction(1, 90000)
            
            self.last_frame_time = current_time
            return frame
            
        except Exception as e:
            logger.error(f"❌ Failed to create AV VideoFrame: {e}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
            
            # Return a blank frame as fallback
            blank_frame = np.zeros((VIDEO_FRAME_SIZE[1], VIDEO_FRAME_SIZE[0], 3), dtype=np.uint8)
            try:
                frame = av.VideoFrame.from_ndarray(blank_frame, format='rgb24')
                frame.pts = int(current_time * 90000)
                from fractions import Fraction
                frame.time_base = Fraction(1, 90000)
                return frame
            except Exception as e2:
                logger.error(f"❌ Failed to create fallback frame: {e2}")
                return None
    
    def clear_queue(self):
        """Clear the frame queue."""
        while not self.frame_queue.empty():
            try:
                self.frame_queue.get_nowait()
            except asyncio.QueueEmpty:
                break
        logger.info("🧹 Frame queue cleared")


class WebSocketWav2LipAvatar:
    """
    WebSocket-based Wav2Lip Avatar that connects to the Wav2Lip WebSocket server
    and provides synchronized audio-video streaming.
    """

    def __init__(self, wav2lip_websocket_url: str, **kwargs):
        """
        Initialize the WebSocket Wav2Lip Avatar.
        
        Args:
            wav2lip_websocket_url: WebSocket URL of the Wav2Lip server
        """
        self.wav2lip_websocket_url = wav2lip_websocket_url
        self.websocket = None
        self.websocket_task = None
        self.is_connected = False
        self.is_streaming = False
        
        # Create custom video track for streaming
        self.video_track = WebSocketWav2LipVideoTrack()
        logger.info(f"📺 WebSocket Wav2Lip Avatar: Created video track: {type(self.video_track)}")
        
        # Add audio_track attribute that VideoSDK expects
        self.audio_track = None  # We don't need audio track for Wav2Lip
        
        # Connection properties (set during connect)
        self.room_id = None
        self.participant_id = None
        self.token = None
        self._connection_initialized = False
        self.wav2lip_available = True  # Flag to track if Wav2Lip server is available

    async def connect(self, room_id: str = None, participant_id: str = None, token: str = None):
        """
        Connect the avatar to the VideoSDK room and Wav2Lip WebSocket.
        This method is called by the VideoSDK pipeline.
        
        Args:
            room_id: VideoSDK room ID (optional, can be set later)
            participant_id: Participant ID (optional, can be set later)
            token: Authentication token (optional, can be set later)
        """
        logger.info(f"🎬 WebSocket Wav2Lip Avatar connecting...")
        
        # Store connection info if provided
        if room_id:
            self.room_id = room_id
        if participant_id:
            self.participant_id = participant_id
        if token:
            self.token = token
        
        # Always try to start the Wav2Lip WebSocket connection
        # Use default values if connection info is not complete
        if not self.room_id:
            self.room_id = "default_room"
        if not self.participant_id:
            self.participant_id = "default_participant"
        if not self.token:
            self.token = "default_token"
        
        logger.info(f"🎬 WebSocket Wav2Lip Avatar connecting to room {self.room_id} with participant {self.participant_id}")
        
        # Start the Wav2Lip WebSocket connection
        await self._start_wav2lip_websocket()

    async def _start_wav2lip_websocket(self):
        """
        Start the Wav2Lip WebSocket connection.
        """
        try:
            logger.info(f"🎬 Connecting to Wav2Lip WebSocket: {self.wav2lip_websocket_url}")
            
            # Connect to WebSocket
            self.websocket = await websockets.connect(self.wav2lip_websocket_url)
            self.is_connected = True
            
            logger.info(f"✅ Wav2Lip WebSocket connected for room {self.room_id}")
            
            # Start the WebSocket message handler task
            self.websocket_task = asyncio.create_task(self._websocket_message_handler())
            logger.info("✅ WebSocket message handler task started")
            
        except Exception as e:
            logger.error(f"❌ Failed to connect Wav2Lip WebSocket: {e}")
            logger.warning("⚠️ Wav2Lip server unavailable - continuing without avatar")
            
            # Set a flag to indicate Wav2Lip is not available
            self.wav2lip_available = False
            
            # Don't raise the exception - let the agent continue without Wav2Lip
            return

    async def _websocket_message_handler(self):
        """
        Handle incoming WebSocket messages from Wav2Lip server.
        """
        try:
            logger.info("🎬 Starting WebSocket message handler...")
            
            while self.is_connected and self.websocket:
                try:
                    # Receive message from WebSocket
                    message = await self.websocket.recv()
                    data = json.loads(message)
                    
                    # Process the message
                    await self._process_websocket_message(data)
                    
                except websockets.exceptions.ConnectionClosed:
                    logger.info("🔌 Wav2Lip WebSocket connection closed")
                    break
                except Exception as e:
                    logger.error(f"❌ Error in WebSocket message handler: {e}")
                    break
                    
        except Exception as e:
            logger.error(f"❌ WebSocket message handler failed: {e}")
        finally:
            logger.info("🏁 WebSocket message handler finished")
            self.is_streaming = False

    async def _process_websocket_message(self, data: Dict[str, Any]):
        """
        Process incoming WebSocket message from Wav2Lip with frame rate control.
        """
        try:
            frame_data = data.get('frame', '')
            frame_type = data.get('type', 'unknown')
            
            if frame_data:
                if frame_type == 'lip_sync':
                    # Only log first lip-sync frame to confirm it's working
                    if not hasattr(self, '_lip_sync_frame_count'):
                        self._lip_sync_frame_count = 0
                        logger.info(f"🎬 LIP-SYNC STARTED")
                    self._lip_sync_frame_count += 1
                    self.is_streaming = True
                    
                    # Add frame rate control to prevent burst frames
                    await self._add_frame_with_rate_control(frame_data, frame_type)
                    
                elif frame_type == 'idle':
                    # Only log idle frames occasionally to avoid spam
                    if not hasattr(self, '_idle_frame_count'):
                        self._idle_frame_count = 0
                    self._idle_frame_count += 1
                    if self._idle_frame_count % 30 == 0:  # Log every 30th idle frame
                        logger.debug(f"😴 Received idle frame #{self._idle_frame_count}")
                    
                    # Add idle frames with rate control
                    await self._add_frame_with_rate_control(frame_data, frame_type)
                    
                else:
                    logger.debug(f"🎬 Received {frame_type} frame: {len(frame_data)} bytes")
                    await self._add_frame_with_rate_control(frame_data, frame_type)
            else:
                logger.warning(f"⚠️ Received message without frame data: {data}")
                
        except Exception as e:
            logger.error(f"❌ Failed to process WebSocket message: {e}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
    
    async def _add_frame_with_rate_control(self, frame_data: str, frame_type: str):
        """
        Add frame with minimal latency for real-time sync.
        """
        try:
            # Process frames immediately for real-time sync with audio
            # Only add minimal delay for idle frames to reduce CPU usage
            if frame_type == 'idle':
                await asyncio.sleep(0.1)  # 10 FPS for idle frames only
            
            # Process lip-sync frames immediately for real-time sync
            await self.video_track.add_frame(frame_data, frame_type)
            
        except Exception as e:
            logger.error(f"❌ Failed to add frame: {e}")

    async def disconnect(self):
        """
        Disconnect the avatar from the VideoSDK room and Wav2Lip WebSocket.
        This method is called by the VideoSDK pipeline.
        """
        logger.info(f"🛑 WebSocket Wav2Lip Avatar disconnecting from room {self.room_id}")
        
        # Stop the WebSocket message handler task
        if self.websocket_task and not self.websocket_task.done():
            self.websocket_task.cancel()
            try:
                await asyncio.wait_for(self.websocket_task, timeout=0.5)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                pass
            self.websocket_task = None
        
        # Close the WebSocket connection
        if self.websocket:
            logger.info("🛑 Closing WebSocket connection...")
            try:
                # Send stop message to Wav2Lip server
                if self.is_connected:
                    await self.websocket.send(json.dumps({"stop": True}))
                    logger.info("✅ Stop message sent to Wav2Lip server")
            except Exception as e:
                logger.warning(f"⚠️ Failed to send stop message: {e}")
            finally:
                await self.websocket.close()
                self.websocket = None
                self.is_connected = False
        
        # Clear the video track queue
        if hasattr(self, 'video_track') and self.video_track:
            logger.info("🛑 Clearing video track queue...")
            self.video_track.clear_queue()
        
        logger.info("✅ WebSocket Wav2Lip Avatar disconnected completely")

    async def send_audio(self, audio_data: bytes):
        """
        Send audio data to the avatar for processing.
        This method is called by the VideoSDK pipeline when TTS audio is generated.
        
        Args:
            audio_data: Audio data in bytes
        """
        # Audio processing is handled by the Wav2Lip server through text input
        # The TTS audio is converted to text and sent via send_text method
        pass

    async def send_text(self, text: str):
        """
        Send text to the avatar for processing.
        This method is called by the VideoSDK pipeline when text is generated.
        
        Args:
            text: Text to be processed
        """
        # Validate text input
        if not text or not text.strip():
            logger.warning("⚠️ Empty or invalid text provided to Wav2Lip avatar")
            return
        
        # Filter out very short text that might not be meaningful
        if len(text.strip()) < 3:
            logger.warning(f"⚠️ Text too short for Wav2Lip processing: '{text}'")
            return
        
        # Check if Wav2Lip is available
        if not self.wav2lip_available:
            logger.warning("⚠️ Wav2Lip server not available, skipping text processing")
            return
        
        # Send text to Wav2Lip WebSocket for processing
        if self.websocket and self.is_connected:
            try:
                # Send text to the Wav2Lip WebSocket
                message = {
                    "text_data": text.strip()
                }
                
                await self.websocket.send(json.dumps(message))
                
                # Set streaming flag to indicate we're expecting lip-sync frames
                self.is_streaming = True
                
            except Exception as e:
                logger.error(f"❌ WEBSOCKET ERROR: {e}")
        else:
            logger.warning("⚠️ WebSocket unavailable")

    def get_video_track(self):
        """
        Get the custom video track for VideoSDK integration.
        
        Returns:
            WebSocketWav2LipVideoTrack: The custom video track instance
        """
        return self.video_track
