"""
Low-Latency WebSocket Wav2Lip Avatar Implementation

This module provides an optimized WebSocket-based avatar with minimal latency
for real-time lip-sync streaming.
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

# Optimized video frame configuration for low latency
VIDEO_FRAME_SIZE = (640, 480)  # Width, Height


class LowLatencyWav2LipVideoTrack(CustomVideoTrack):
    """
    Low-latency custom video track optimized for real-time streaming.
    """
    
    def __init__(self):
        super().__init__()
        self.frame_queue = asyncio.Queue(maxsize=1)  # Single frame buffer for minimal latency
        self.current_frame = None
        self.frame_rate = 30  # 30 FPS for lower latency
        self.frame_duration = 1.0 / self.frame_rate
        self.last_frame_time = 0
        
        logger.info(f"⚡ Low-Latency Wav2Lip Video Track initialized: {self.frame_rate} FPS, max_queue=1")
        
    async def add_frame(self, frame_data: str, frame_type: str = "lip_sync"):
        """
        Add a new video frame to the queue with minimal processing.
        """
        try:
            # Fast base64 decode
            frame_bytes = base64.b64decode(frame_data)
            
            # Fast PIL Image processing
            image = Image.open(io.BytesIO(frame_bytes))
            
            # Quick RGB conversion
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Fast resize with nearest neighbor (fastest method)
            if image.size != VIDEO_FRAME_SIZE:
                image = image.resize(VIDEO_FRAME_SIZE, Image.Resampling.NEAREST)
            
            # Convert to numpy array
            frame_array = np.array(image, dtype=np.uint8)
            
            # Ensure correct shape
            if frame_array.shape != (VIDEO_FRAME_SIZE[1], VIDEO_FRAME_SIZE[0], 3):
                logger.warning(f"⚠️ Frame shape mismatch: {frame_array.shape}")
                return
            
            # Clear queue and add new frame (single frame buffer for minimal latency)
            while not self.frame_queue.empty():
                try:
                    self.frame_queue.get_nowait()
                except asyncio.QueueEmpty:
                    break
            
            # Add to queue (non-blocking)
            try:
                self.frame_queue.put_nowait({
                    'frame': frame_array,
                    'type': frame_type,
                    'timestamp': time.time()
                })
            except asyncio.QueueFull:
                # Queue is full, skip this frame for minimal latency
                pass
            
        except Exception as e:
            logger.error(f"❌ Failed to process frame: {e}")
    
    async def recv(self) -> av.VideoFrame:
        """
        Receive the next video frame with minimal latency.
        """
        current_time = time.time()
        
        # Try to get a new frame from the queue
        try:
            new_frame_data = self.frame_queue.get_nowait()
            self.current_frame = new_frame_data
        except asyncio.QueueEmpty:
            # No new frame available, use current frame or create blank
            if self.current_frame is None:
                self.current_frame = {
                    'frame': np.zeros((VIDEO_FRAME_SIZE[1], VIDEO_FRAME_SIZE[0], 3), dtype=np.uint8),
                    'type': 'blank',
                    'timestamp': current_time
                }
        
        # Minimal frame rate control (reduced for lower latency)
        if current_time - self.last_frame_time < (self.frame_duration * 0.7):  # 30% faster
            pass
        
        try:
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
            
            # Return blank frame as fallback
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


class LowLatencyWav2LipAvatar:
    """
    Low-latency WebSocket Wav2Lip Avatar optimized for real-time performance.
    """

    def __init__(self, wav2lip_websocket_url: str, **kwargs):
        """
        Initialize the low-latency WebSocket Wav2Lip Avatar.
        """
        self.wav2lip_websocket_url = wav2lip_websocket_url
        self.websocket = None
        self.websocket_task = None
        self.is_connected = False
        self.is_streaming = False
        self.has_lip_sync_frames = False  # Track if we have non-idle frames ready
        
        # Create low-latency video track
        self.video_track = LowLatencyWav2LipVideoTrack()
        logger.info(f"⚡ Low-Latency WebSocket Wav2Lip Avatar: Created video track")
        
        # Add audio_track attribute that VideoSDK expects
        self.audio_track = None
        
        # Connection properties
        self.room_id = None
        self.participant_id = None
        self.token = None
        self._connection_initialized = False
        self.wav2lip_available = True

    async def connect(self, room_id: str = None, participant_id: str = None, token: str = None):
        """
        Connect the avatar with minimal latency.
        """
        logger.info(f"⚡ Low-Latency WebSocket Wav2Lip Avatar connecting...")
        
        # Store connection info
        if room_id:
            self.room_id = room_id
        if participant_id:
            self.participant_id = participant_id
        if token:
            self.token = token
        
        # Use default values if not provided
        if not self.room_id:
            self.room_id = "default_room"
        if not self.participant_id:
            self.participant_id = "default_participant"
        if not self.token:
            self.token = "default_token"
        
        logger.info(f"⚡ Low-Latency WebSocket Wav2Lip Avatar connecting to room {self.room_id}")
        
        # Start the Wav2Lip WebSocket connection
        await self._start_wav2lip_websocket()

    async def _start_wav2lip_websocket(self):
        """
        Start the Wav2Lip WebSocket connection with minimal latency.
        """
        try:
            logger.info(f"⚡ Connecting to Wav2Lip WebSocket: {self.wav2lip_websocket_url}")
            
            # Connect to WebSocket with minimal timeout
            self.websocket = await asyncio.wait_for(
                websockets.connect(self.wav2lip_websocket_url),
                timeout=5.0  # 5 second timeout
            )
            self.is_connected = True
            
            logger.info(f"✅ Low-Latency Wav2Lip WebSocket connected for room {self.room_id}")
            
            # Start the WebSocket message handler task
            self.websocket_task = asyncio.create_task(self._websocket_message_handler())
            logger.info("✅ Low-Latency WebSocket message handler task started")
            
        except Exception as e:
            logger.error(f"❌ Failed to connect Low-Latency Wav2Lip WebSocket: {e}")
            self.wav2lip_available = False
            return

    async def _websocket_message_handler(self):
        """
        Handle incoming WebSocket messages with minimal processing.
        """
        try:
            logger.info("⚡ Starting Low-Latency WebSocket message handler...")
            
            while self.is_connected and self.websocket:
                try:
                    # Receive message with minimal timeout
                    message = await asyncio.wait_for(self.websocket.recv(), timeout=1.0)
                    data = json.loads(message)
                    
                    # Process the message immediately
                    await self._process_websocket_message(data)
                    
                except asyncio.TimeoutError:
                    # Timeout is normal, continue
                    continue
                except websockets.exceptions.ConnectionClosed:
                    logger.info("🔌 Low-Latency Wav2Lip WebSocket connection closed")
                    break
                except Exception as e:
                    logger.error(f"❌ Error in Low-Latency WebSocket message handler: {e}")
                    break
                    
        except Exception as e:
            logger.error(f"❌ Low-Latency WebSocket message handler failed: {e}")
        finally:
            logger.info("🏁 Low-Latency WebSocket message handler finished")
            self.is_streaming = False

    async def _process_websocket_message(self, data: Dict[str, Any]):
        """
        Process incoming WebSocket message with optimized frame rate control for minimal latency.
        """
        try:
            frame_data = data.get('frame', '')
            frame_type = data.get('type', 'unknown')
            
            if frame_data:
                if frame_type == 'lip_sync':
                    # Track lip-sync frames for synchronization
                    if not hasattr(self, '_lip_sync_frame_count'):
                        self._lip_sync_frame_count = 0
                        logger.info(f"⚡ LIP-SYNC STARTED")
                    self._lip_sync_frame_count += 1
                    self.is_streaming = True
                    
                    # Set flag to indicate we have non-idle frames ready
                    self.has_lip_sync_frames = True
                    
                    # Add optimized frame rate control for minimal latency
                    await self._add_frame_with_optimized_rate_control(frame_data, frame_type)
                    
                elif frame_type == 'idle':
                    # Minimal logging for idle frames
                    pass
                    
                    # Add idle frames with optimized rate control
                    await self._add_frame_with_optimized_rate_control(frame_data, frame_type)
                    
                else:
                    # Process other frame types with rate control
                    await self._add_frame_with_optimized_rate_control(frame_data, frame_type)
            else:
                logger.warning(f"⚠️ Received message without frame data: {data}")
                
        except Exception as e:
            logger.error(f"❌ Failed to process Low-Latency WebSocket message: {e}")
    
    async def _add_frame_with_optimized_rate_control(self, frame_data: str, frame_type: str):
        """
        Add frame with ultra-low latency for real-time sync.
        """
        try:
            # Process frames immediately for ultra-low latency and real-time sync
            # Only add minimal delay for idle frames to reduce CPU usage
            if frame_type == 'idle':
                await asyncio.sleep(0.05)  # 20 FPS for idle frames only
            
            # Process lip-sync frames immediately for real-time sync
            await self.video_track.add_frame(frame_data, frame_type)
            
        except Exception as e:
            logger.error(f"❌ Failed to add frame: {e}")

    async def disconnect(self):
        """
        Disconnect the avatar with minimal cleanup time.
        """
        logger.info(f"🛑 Low-Latency WebSocket Wav2Lip Avatar disconnecting from room {self.room_id}")
        
        # Stop the WebSocket message handler task quickly
        if self.websocket_task and not self.websocket_task.done():
            self.websocket_task.cancel()
            try:
                await asyncio.wait_for(self.websocket_task, timeout=0.5)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                pass
            self.websocket_task = None
        
        # Close the WebSocket connection quickly
        if self.websocket:
            try:
                if self.is_connected:
                    await asyncio.wait_for(
                        self.websocket.send(json.dumps({"stop": True})),
                        timeout=0.5
                    )
            except Exception:
                pass
            finally:
                await self.websocket.close()
                self.websocket = None
                self.is_connected = False
        
        # Clear the video track queue
        if hasattr(self, 'video_track') and self.video_track:
            self.video_track.clear_queue()
        
        logger.info("✅ Low-Latency WebSocket Wav2Lip Avatar disconnected")

    async def send_audio(self, audio_data: bytes):
        """
        Send audio data to the avatar (not used for Wav2Lip).
        """
        pass

    async def send_text(self, text: str):
        """
        Send text to the avatar with minimal latency.
        """
        # Validate text input
        if not text or not text.strip() or len(text.strip()) < 3:
            return
        
        # Check if Wav2Lip is available
        if not self.wav2lip_available:
            return
        
        # Send text to Wav2Lip WebSocket immediately
        if self.websocket and self.is_connected:
            try:
                message = {"text_data": text.strip()}
                
                # Reset frame tracking for new text
                self.has_lip_sync_frames = False
                
                await asyncio.wait_for(
                    self.websocket.send(json.dumps(message)),
                    timeout=1.0
                )
                
                self.is_streaming = True
                
            except Exception as e:
                logger.error(f"❌ LOW-LATENCY ERROR: {e}")

    def get_video_track(self):
        """
        Get the low-latency custom video track.
        """
        return self.video_track
