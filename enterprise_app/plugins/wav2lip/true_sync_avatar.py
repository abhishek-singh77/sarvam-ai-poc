"""
True Synchronized Avatar Implementation

This module provides a true synchronized avatar with both custom audio and video tracks,
using VideoSDK's data channel for perfect audio-video synchronization.
"""

import asyncio
import json
import base64
import io
import time
import websockets
import logging
from typing import Optional, Dict, Any, Tuple
from PIL import Image
import av
import numpy as np
from videosdk import CustomVideoTrack, CustomAudioTrack

logger = logging.getLogger(__name__)

# Constants
DEFAULT_FRAME_RATE = 15  # Reduced frame rate to reduce decoder load
DEFAULT_SAMPLE_RATE = 16000
DEFAULT_QUEUE_SIZE = 30
DEFAULT_BUFFER_SIZE = 10
DEFAULT_SAMPLES_PER_FRAME = 320  # 20ms at 16kHz
VIDEO_FRAME_SIZE = (640, 480)
AUDIO_BYTES_PER_SAMPLE = 2  # 16-bit samples


class TrueSyncVideoTrack(CustomVideoTrack):
    """
    Custom video track that receives synchronized video frames from Wav2Lip
    with precise timing for audio-video synchronization.
    """
    
    def __init__(self, frame_rate: int = DEFAULT_FRAME_RATE):
        super().__init__()
        self.frame_queue = asyncio.Queue()
        self.current_frame: Optional[Dict[str, Any]] = None
        self.frame_rate = frame_rate
        self.frame_duration = 1.0 / self.frame_rate
        self.last_frame_time = 0.0
        self.max_queue_size = DEFAULT_QUEUE_SIZE
        self.frame_buffer: list = []
        self.buffer_size = DEFAULT_BUFFER_SIZE
        self.last_frame_delivery_time = 0.0
        
        # Audio synchronization
        self.audio_timestamp = 0.0
        self.video_timestamp = 0.0
        self.sync_offset = 0.0
        
        logger.info(f"📺 TrueSyncVideoTrack: Initialized with frame rate {self.frame_rate} FPS")
        
    async def add_synchronized_frame(self, frame_data: str, audio_timestamp: Optional[float] = None) -> None:
        """
        Add a video frame with audio synchronization.
        
        Args:
            frame_data: Base64 encoded video frame data
            audio_timestamp: Corresponding audio timestamp for sync
        """
        try:
            current_time = time.time()
            
            # Decode and process frame
            frame_array = self._process_frame_data(frame_data)
            if frame_array is None:
                return
            
            # Create synchronized frame
            sync_frame = {
                'frame': frame_array,
                'video_timestamp': current_time,
                'audio_timestamp': audio_timestamp or current_time,
                'sync_delay': (audio_timestamp or current_time) - current_time
            }
            
            # Store audio timestamp for sync
            if audio_timestamp:
                self.audio_timestamp = audio_timestamp
            
            # Manage queue size
            await self._manage_queue_size()
            
            # Add to queue and buffer
            await self.frame_queue.put(sync_frame)
            self._add_to_buffer(sync_frame)
            
        except Exception as e:
            logger.error(f"❌ Failed to process synchronized frame: {e}")
    
    def _process_frame_data(self, frame_data: str) -> Optional[np.ndarray]:
        """Process base64 frame data into numpy array."""
        try:
            # Decode the base64 frame data
            frame_bytes = base64.b64decode(frame_data)
            
            # Convert to PIL Image
            image = Image.open(io.BytesIO(frame_bytes))
            
            # Convert to RGB if needed
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Convert to numpy array
            frame_array = np.array(image)
            
            # Ensure correct shape and data type
            if len(frame_array.shape) == 3 and frame_array.shape[2] == 3:
                if frame_array.shape[:2] != VIDEO_FRAME_SIZE[::-1]:  # (height, width)
                    # Resize image first, then convert to array for better performance
                    resized_image = image.resize(VIDEO_FRAME_SIZE)
                    frame_array = np.array(resized_image)
                
                # Ensure correct data type for VP8 compatibility
                if frame_array.dtype != np.uint8:
                    frame_array = frame_array.astype(np.uint8)
                
                # Validate frame data
                if frame_array.min() < 0 or frame_array.max() > 255:
                    logger.warning(f"⚠️ Invalid frame data range: {frame_array.min()}-{frame_array.max()}")
                    frame_array = np.clip(frame_array, 0, 255).astype(np.uint8)
                
                logger.debug(f"📺 Processed frame: shape={frame_array.shape}, dtype={frame_array.dtype}, range={frame_array.min()}-{frame_array.max()}")
                return frame_array
            else:
                logger.warning("❌ Cannot process frame, invalid shape")
                return None
                
        except Exception as e:
            logger.error(f"❌ Failed to process frame data: {e}")
            return None
    
    async def _manage_queue_size(self) -> None:
        """Manage queue size to prevent memory issues."""
        current_size = self.frame_queue.qsize()
        if current_size >= self.max_queue_size:
            # Remove multiple old frames to make room for new ones
            frames_to_remove = min(3, current_size - (self.max_queue_size // 2))
            for _ in range(frames_to_remove):
                try:
                    self.frame_queue.get_nowait()
                except asyncio.QueueEmpty:
                    break
            
            # Only log warning if queue is still quite full
            if self.frame_queue.qsize() >= self.max_queue_size * 0.8:
                logger.debug(f"📊 Video queue managed: removed {frames_to_remove} frames, current size: {self.frame_queue.qsize()}")
            else:
                logger.debug(f"📊 Video queue optimized: current size: {self.frame_queue.qsize()}")
    
    def _add_to_buffer(self, sync_frame: Dict[str, Any]) -> None:
        """Add frame to buffer with size management."""
        self.frame_buffer.append(sync_frame)
        if len(self.frame_buffer) > self.buffer_size:
            self.frame_buffer.pop(0)

    async def recv(self) -> av.VideoFrame:
        """
        Receive the next synchronized video frame.
        """
        current_time = time.time()
        
        # Implement frame rate control
        if not self._should_deliver_new_frame(current_time):
            if self.current_frame is not None:
                return self._create_video_frame(self.current_frame['frame'], current_time)
        
        # Try to get a new frame from the queue
        self._update_current_frame(current_time)
        
        # Update last frame time
        self.last_frame_time = current_time
        
        # Create and return the video frame
        return self._create_video_frame(self.current_frame['frame'], current_time)
    
    def _should_deliver_new_frame(self, current_time: float) -> bool:
        """Check if enough time has passed to deliver a new frame."""
        time_since_last_frame = current_time - self.last_frame_delivery_time
        return time_since_last_frame >= self.frame_duration
    
    def _update_current_frame(self, current_time: float) -> None:
        """Update the current frame from queue or create blank frame."""
        try:
            sync_frame = self.frame_queue.get_nowait()
            self.current_frame = sync_frame
            self.last_frame_delivery_time = current_time
            
            # Log sync info
            if sync_frame['sync_delay'] > 0.1:
                logger.warning(f"⚠️ Audio-Video sync delay: {sync_frame['sync_delay']:.3f}s")
            
        except asyncio.QueueEmpty:
            if self.current_frame is None:
                # Create a blank frame if no frame is available
                self.current_frame = {
                    'frame': np.zeros((VIDEO_FRAME_SIZE[1], VIDEO_FRAME_SIZE[0], 3), dtype=np.uint8),
                    'video_timestamp': current_time,
                    'audio_timestamp': current_time,
                    'sync_delay': 0
                }
    
    def _create_video_frame(self, frame_array: np.ndarray, current_time: float) -> av.VideoFrame:
        """
        Create an AV VideoFrame from numpy array.
        """
        try:
            if frame_array is None:
                logger.warning("⚠️ Creating blank frame - no frame data available")
                frame_array = np.zeros((VIDEO_FRAME_SIZE[1], VIDEO_FRAME_SIZE[0], 3), dtype=np.uint8)
            
            # Ensure frame array is contiguous and properly formatted
            if not frame_array.flags.c_contiguous:
                frame_array = np.ascontiguousarray(frame_array)
            
            # Create AV VideoFrame with RGB24 format (VP8 should handle this)
            frame = av.VideoFrame.from_ndarray(frame_array, format='rgb24')
            
            # Ensure frame has proper dimensions and format
            if frame.width != VIDEO_FRAME_SIZE[0] or frame.height != VIDEO_FRAME_SIZE[1]:
                logger.warning(f"⚠️ Frame size mismatch: {frame.width}x{frame.height} vs expected {VIDEO_FRAME_SIZE[0]}x{VIDEO_FRAME_SIZE[1]}")
                # Resize frame to expected dimensions
                frame = frame.reformat(width=VIDEO_FRAME_SIZE[0], height=VIDEO_FRAME_SIZE[1])
            
            frame.pts = int(current_time * 90000)  # 90kHz timestamp
            from fractions import Fraction
            frame.time_base = Fraction(1, 90000)
            
            logger.debug(f"📺 Created video frame: format={frame.format}, size={frame.width}x{frame.height}, pts={frame.pts}")
            return frame
            
        except Exception as e:
            logger.error(f"❌ Failed to create AV VideoFrame: {e}")
            return self._create_fallback_frame(current_time)
    
    def _create_fallback_frame(self, current_time: float) -> av.VideoFrame:
        """Create a fallback blank frame."""
        try:
            blank_frame = np.zeros((VIDEO_FRAME_SIZE[1], VIDEO_FRAME_SIZE[0], 3), dtype=np.uint8)
            frame = av.VideoFrame.from_ndarray(blank_frame, format='rgb24')
            frame.pts = int(current_time * 90000)
            from fractions import Fraction
            frame.time_base = Fraction(1, 90000)
            return frame
        except Exception as e:
            logger.error(f"❌ Failed to create fallback frame: {e}")
            return None

    def clear_queue(self) -> None:
        """Clear the frame queue and buffer."""
        while not self.frame_queue.empty():
            try:
                self.frame_queue.get_nowait()
            except asyncio.QueueEmpty:
                break
        
        self.frame_buffer.clear()
        self.last_frame_delivery_time = 0.0
        self.last_frame_time = 0.0
        self.current_frame = None
        
        logger.info("🧹 True sync video track queue and buffer cleared")


class TrueSyncAudioTrack(CustomAudioTrack):
    """
    Custom audio track that receives TTS audio data via data channel
    for perfect synchronization with video frames.
    """
    
    def __init__(self, sample_rate: int = DEFAULT_SAMPLE_RATE):
        super().__init__()
        self.audio_queue = asyncio.Queue()
        self.current_audio: Optional[Dict[str, Any]] = None
        self.sample_rate = sample_rate
        self.samples_per_frame = DEFAULT_SAMPLES_PER_FRAME
        self.frame_duration = self.samples_per_frame / self.sample_rate
        self.last_audio_time = 0.0
        self.max_queue_size = DEFAULT_QUEUE_SIZE * 2  # Audio needs more buffering
        self.audio_buffer: list = []
        self.buffer_size = DEFAULT_BUFFER_SIZE * 2
        self.last_audio_delivery_time = 0.0
        
        # Audio synchronization
        self.audio_timestamp = 0.0
        self.video_timestamp = 0.0
        
        logger.info(f"🔊 TrueSyncAudioTrack: Initialized with sample rate {self.sample_rate} Hz")
        
    async def add_synchronized_audio(self, audio_data: bytes, timestamp: float) -> None:
        """
        Add synchronized audio data received via data channel.
        
        Args:
            audio_data: Raw audio bytes
            timestamp: Audio timestamp for synchronization
        """
        try:
            # Validate audio data
            if not audio_data or len(audio_data) == 0:
                logger.warning("⚠️ Empty audio data received")
                return
            
            # Create synchronized audio data
            sync_audio = {
                'audio': audio_data,
                'timestamp': timestamp,
                'samples': len(audio_data) // AUDIO_BYTES_PER_SAMPLE
            }
            
            # Store timestamp
            self.audio_timestamp = timestamp
            
            # Manage queue size
            await self._manage_audio_queue_size()
            
            # Add to queue and buffer
            await self.audio_queue.put(sync_audio)
            self._add_audio_to_buffer(sync_audio)
                
        except Exception as e:
            logger.error(f"❌ Failed to process synchronized audio: {e}")
    
    async def _manage_audio_queue_size(self) -> None:
        """Manage audio queue size to prevent memory issues."""
        current_size = self.audio_queue.qsize()
        if current_size >= self.max_queue_size:
            # Remove multiple old audio frames to make room for new ones
            audio_to_remove = min(2, current_size - (self.max_queue_size // 2))
            for _ in range(audio_to_remove):
                try:
                    self.audio_queue.get_nowait()
                except asyncio.QueueEmpty:
                    break
            
            # Only log warning if queue is still quite full
            if self.audio_queue.qsize() >= self.max_queue_size * 0.8:
                logger.debug(f"📊 Audio queue managed: removed {audio_to_remove} frames, current size: {self.audio_queue.qsize()}")
            else:
                logger.debug(f"📊 Audio queue optimized: current size: {self.audio_queue.qsize()}")
    
    def _add_audio_to_buffer(self, sync_audio: Dict[str, Any]) -> None:
        """Add audio to buffer with size management."""
        self.audio_buffer.append(sync_audio)
        if len(self.audio_buffer) > self.buffer_size:
            self.audio_buffer.pop(0)

    async def recv(self) -> av.AudioFrame:
        """
        Receive the next synchronized audio frame.
        """
        current_time = time.time()
        
        # Implement audio frame rate control
        if not self._should_deliver_new_audio(current_time):
            if self.current_audio is not None:
                return self._create_audio_frame(self.current_audio['audio'], current_time)
        
        # Try to get new audio from queue
        self._update_current_audio(current_time)
        
        # Update last audio time
        self.last_audio_time = current_time
        
        # Create and return the audio frame
        return self._create_audio_frame(self.current_audio['audio'], current_time)
    
    def _should_deliver_new_audio(self, current_time: float) -> bool:
        """Check if enough time has passed to deliver new audio."""
        time_since_last_audio = current_time - self.last_audio_delivery_time
        return time_since_last_audio >= self.frame_duration
    
    def _update_current_audio(self, current_time: float) -> None:
        """Update the current audio from queue or create silent audio."""
        try:
            sync_audio = self.audio_queue.get_nowait()
            self.current_audio = sync_audio
            self.last_audio_delivery_time = current_time
        except asyncio.QueueEmpty:
            if self.current_audio is None:
                # Create silent audio if no audio is available
                silent_audio = b'\x00' * (self.samples_per_frame * AUDIO_BYTES_PER_SAMPLE)
                self.current_audio = {
                    'audio': silent_audio,
                    'timestamp': current_time,
                    'samples': self.samples_per_frame
                }
    
    def _create_audio_frame(self, audio_data: bytes, current_time: float) -> av.AudioFrame:
        """
        Create an AV AudioFrame from audio bytes.
        """
        try:
            if not audio_data:
                audio_data = b'\x00' * (self.samples_per_frame * AUDIO_BYTES_PER_SAMPLE)
            
            # Create AV AudioFrame - use proper format for mono audio
            audio_array = np.frombuffer(audio_data, dtype=np.int16)
            # For mono audio, reshape to (1, samples) for proper format
            # The error suggests we need shape[0] = 1, so (1, samples)
            audio_array = audio_array.reshape(1, -1)
            frame = av.AudioFrame.from_ndarray(
                audio_array,
                format='s16',
                layout='mono'
            )
            frame.sample_rate = self.sample_rate
            frame.pts = int(current_time * self.sample_rate)
            from fractions import Fraction
            frame.time_base = Fraction(1, self.sample_rate)
            
            return frame
            
        except Exception as e:
            logger.error(f"❌ Failed to create AV AudioFrame: {e}")
            return self._create_fallback_audio_frame(current_time)
    
    def _create_fallback_audio_frame(self, current_time: float) -> av.AudioFrame:
        """Create a fallback silent audio frame."""
        try:
            silent_data = b'\x00' * (self.samples_per_frame * AUDIO_BYTES_PER_SAMPLE)
            # Use proper format for mono audio
            silent_array = np.frombuffer(silent_data, dtype=np.int16)
            # For mono audio, reshape to (1, samples) for proper format
            silent_array = silent_array.reshape(1, -1)
            frame = av.AudioFrame.from_ndarray(
                silent_array,
                format='s16',
                layout='mono'
            )
            frame.sample_rate = self.sample_rate
            frame.pts = int(current_time * self.sample_rate)
            from fractions import Fraction
            frame.time_base = Fraction(1, self.sample_rate)
            return frame
        except Exception as e:
            logger.error(f"❌ Failed to create fallback audio frame: {e}")
            return None

    def clear_queue(self) -> None:
        """Clear the audio queue and buffer."""
        while not self.audio_queue.empty():
            try:
                self.audio_queue.get_nowait()
            except asyncio.QueueEmpty:
                break
        
        self.audio_buffer.clear()
        self.last_audio_delivery_time = 0.0
        self.last_audio_time = 0.0
        self.current_audio = None
        
        logger.info("🧹 True sync audio track queue and buffer cleared")


class TrueSyncWav2LipAvatar:
    """
    True synchronized avatar that creates a third participant with
    both custom audio and video tracks, using data channel for audio transmission.
    """
    
    def __init__(self, wav2lip_url: str, **kwargs):
        """
        Initialize the true synchronized avatar.
        
        Args:
            wav2lip_url: WebSocket URL of your Wav2Lip server
        """
        # Convert HTTP URL to WebSocket URL if needed
        self.wav2lip_url = self._normalize_websocket_url(wav2lip_url)
        
        # WebSocket connection
        self.websocket: Optional[websockets.WebSocketServerProtocol] = None
        self.websocket_task: Optional[asyncio.Task] = None
        self.is_connected = False
        self.is_streaming = False
        
        # Create synchronized audio and video tracks
        self.video_track = TrueSyncVideoTrack()
        self.audio_track = TrueSyncAudioTrack()
        
        # Data channel for audio transmission
        self.data_channel = None
        self.audio_timestamp = 0.0
        
        # Connection properties
        self.room_id: Optional[str] = None
        self.participant_id: Optional[str] = None
        self.token: Optional[str] = None
        self.wav2lip_available = True
        
        logger.info(f"🎬 TrueSyncWav2LipAvatar: Initialized with WebSocket URL: {self.wav2lip_url}")
    
    def _normalize_websocket_url(self, url: str) -> str:
        """Normalize URL to WebSocket format."""
        if url.startswith("http://"):
            return url.replace("http://", "ws://") + "/ws"
        elif url.startswith("https://"):
            return url.replace("https://", "wss://") + "/ws"
        elif not url.startswith("ws://") and not url.startswith("wss://"):
            return f"ws://{url}/ws"
        else:
            return url

    async def connect(self, room_id: Optional[str] = None, participant_id: Optional[str] = None, token: Optional[str] = None) -> None:
        """
        Connect the true synchronized avatar to the VideoSDK room.
        """
        logger.info("🎬 True Sync Avatar connecting...")
        
        # Store connection info with defaults
        self.room_id = room_id or "default_room"
        self.participant_id = participant_id or "avatar_participant"
        self.token = token or "default_token"
        
        logger.info(f"🎬 True Sync Avatar connecting to room {self.room_id}")
        
        # Start the Wav2Lip WebSocket connection
        await self._start_wav2lip_websocket()

    async def _start_wav2lip_websocket(self) -> None:
        """
        Start the Wav2Lip WebSocket connection.
        """
        try:
            logger.info(f"🎬 Connecting to Wav2Lip WebSocket: {self.wav2lip_url}")
            logger.info(f"🎬 Room ID: {self.room_id}")
            logger.info(f"🎬 Participant ID: {self.participant_id}")
            
            # Connect to WebSocket
            self.websocket = await websockets.connect(self.wav2lip_url)
            self.is_connected = True
            
            logger.info(f"✅ Wav2Lip WebSocket connected for room {self.room_id}")
            logger.info(f"✅ WebSocket state: {self.websocket.state if hasattr(self.websocket, 'state') else 'unknown'}")
            logger.info(f"✅ WebSocket object: {self.websocket}")
            
            # Start the WebSocket message handler task
            self.websocket_task = asyncio.create_task(self._websocket_message_handler())
            logger.info("✅ WebSocket message handler task started")
            
        except Exception as e:
            logger.error(f"❌ Failed to connect Wav2Lip WebSocket: {e}")
            logger.error(f"❌ WebSocket URL: {self.wav2lip_url}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
            logger.warning("⚠️ Wav2Lip server unavailable - continuing without avatar")
            
            self.wav2lip_available = False
            self.is_connected = False

    async def disconnect(self) -> None:
        """
        Disconnect the true synchronized avatar.
        """
        logger.info(f"🛑 True Sync Avatar disconnecting from room {self.room_id}")
        logger.info(f"🛑 WebSocket connected: {self.is_connected}")
        logger.info(f"🛑 WebSocket task running: {self.websocket_task is not None}")
        logger.info(f"🛑 WebSocket object: {self.websocket}")
        logger.info(f"🛑 Wav2Lip available: {self.wav2lip_available}")
        
        # Set a timeout for the entire disconnect process
        try:
            await asyncio.wait_for(self._disconnect_internal(), timeout=5.0)
            logger.info("✅ True Sync Avatar disconnected completely")
        except asyncio.TimeoutError:
            logger.warning("⚠️ Disconnect process timed out, forcing cleanup...")
            await self._force_cleanup()
            logger.info("✅ True Sync Avatar force cleaned up")
        except Exception as e:
            logger.error(f"❌ Error during disconnect: {e}")
            await self._force_cleanup()
            logger.info("✅ True Sync Avatar force cleaned up after error")
    
    async def _disconnect_internal(self) -> None:
        """Internal disconnect logic."""
        try:
            # Stop the WebSocket message handler task
            logger.info("🛑 Stopping WebSocket message handler task...")
            await self._stop_websocket_task()
            logger.info("✅ WebSocket message handler task stopped")
        except Exception as e:
            logger.error(f"❌ Error stopping WebSocket task: {e}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
        
        try:
            # Close the WebSocket connection
            logger.info("🛑 Closing WebSocket connection...")
            await self._close_websocket()
            logger.info("✅ WebSocket connection closed")
        except Exception as e:
            logger.error(f"❌ Error closing WebSocket: {e}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
        
        try:
            # Clear tracks
            logger.info("🛑 Clearing tracks...")
            self._clear_tracks()
            logger.info("✅ Tracks cleared")
        except Exception as e:
            logger.error(f"❌ Error clearing tracks: {e}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
    
    async def _force_cleanup(self) -> None:
        """Force cleanup when normal disconnect fails."""
        logger.warning("🛑 Force cleanup initiated...")
        
        # Force stop WebSocket task
        if self.websocket_task and not self.websocket_task.done():
            logger.warning("🛑 Force cancelling WebSocket task...")
            self.websocket_task.cancel()
            self.websocket_task = None
        
        # Force close WebSocket
        if self.websocket:
            logger.warning("🛑 Force closing WebSocket...")
            try:
                if hasattr(self.websocket, 'transport') and self.websocket.transport:
                    self.websocket.transport.close()
            except Exception as e:
                logger.error(f"❌ Error force closing WebSocket transport: {e}")
            self.websocket = None
        
        # Force clear state
        self.is_connected = False
        self.is_streaming = False
        self.wav2lip_available = False
        
        # Clear tracks
        try:
            self._clear_tracks()
        except Exception as e:
            logger.error(f"❌ Error force clearing tracks: {e}")
        
        logger.warning("🛑 Force cleanup completed")
    
    async def _stop_websocket_task(self) -> None:
        """Stop the WebSocket message handler task."""
        logger.info(f"🛑 _stop_websocket_task called, websocket_task: {self.websocket_task}")
        if self.websocket_task:
            logger.info("🛑 Cancelling WebSocket task...")
            self.websocket_task.cancel()
            try:
                logger.info("🛑 Waiting for WebSocket task to finish...")
                await asyncio.wait_for(self.websocket_task, timeout=1.0)
                logger.info("✅ WebSocket message handler task cancelled")
            except asyncio.CancelledError:
                logger.info("✅ WebSocket message handler task cancelled")
            except asyncio.TimeoutError:
                logger.warning("⚠️ WebSocket message handler task cancellation timed out")
                # Force kill the task if it doesn't respond to cancellation
                try:
                    if not self.websocket_task.done():
                        logger.warning("🛑 Force killing WebSocket task...")
                        self.websocket_task.cancel()
                        # Don't wait for it, just mark it as cancelled
                except Exception as force_kill_error:
                    logger.error(f"❌ Failed to force kill WebSocket task: {force_kill_error}")
            except Exception as e:
                logger.error(f"❌ Error cancelling WebSocket task: {e}")
            finally:
                self.websocket_task = None
                logger.info("🛑 WebSocket task set to None")
        else:
            logger.info("🛑 No WebSocket task to cancel")
    
    async def _close_websocket(self) -> None:
        """Close the WebSocket connection."""
        logger.info(f"🛑 _close_websocket called, websocket: {self.websocket}, is_connected: {self.is_connected}")
        if self.websocket and self.is_connected:
            try:
                # Try to send stop message (server may not handle it, but we try)
                try:
                    stop_message = {"stop": True}
                    logger.info("🛑 Sending stop message to WebSocket...")
                    await asyncio.wait_for(self.websocket.send(json.dumps(stop_message)), timeout=0.5)
                    logger.info("📤 Sent stop message to Wav2Lip server")
                except asyncio.TimeoutError:
                    logger.warning("⚠️ Stop message send timed out")
                except Exception as e:
                    logger.warning(f"⚠️ Failed to send stop message: {e}")
                
                # Close the WebSocket connection with shorter timeout
                logger.info("🛑 Closing WebSocket connection...")
                await asyncio.wait_for(self.websocket.close(), timeout=1.0)
                logger.info("✅ WebSocket connection closed")
            except asyncio.TimeoutError:
                logger.warning("⚠️ WebSocket close timed out, forcing close")
                # Force close if timeout
                try:
                    # Try multiple methods to force close
                    if hasattr(self.websocket, '_close'):
                        self.websocket._close()
                        logger.info("🛑 Force closed WebSocket using _close()")
                    elif hasattr(self.websocket, 'close'):
                        self.websocket.close()
                        logger.info("🛑 Force closed WebSocket using close()")
                    elif hasattr(self.websocket, 'transport') and self.websocket.transport:
                        self.websocket.transport.close()
                        logger.info("🛑 Force closed WebSocket using transport.close()")
                    else:
                        logger.warning("⚠️ No known method to force close WebSocket")
                except Exception as force_close_error:
                    logger.error(f"❌ Failed to force close WebSocket: {force_close_error}")
            except Exception as e:
                logger.warning(f"⚠️ Error closing WebSocket: {e}")
            finally:
                # Always set to None regardless of close success
                self.websocket = None
                self.is_connected = False
                logger.info("🛑 WebSocket object set to None and is_connected set to False")
        else:
            logger.info("🛑 No WebSocket to close or not connected")
    
    def _clear_tracks(self) -> None:
        """Clear video and audio tracks."""
        if self.video_track:
            self.video_track.clear_queue()
        if self.audio_track:
            self.audio_track.clear_queue()

    async def send_text_with_audio_sync(self, text: str, tts_audio: Optional[bytes] = None, audio_timestamp: Optional[float] = None) -> None:
        """
        Send text for lip-sync generation with audio synchronization via data channel.
        
        Args:
            text: Text to be processed
            tts_audio: TTS audio data for synchronization
            audio_timestamp: Timestamp of the TTS audio
        """
        logger.info(f"🎬 True Sync Avatar received text: {text[:100]}{'...' if len(text) > 100 else ''}")
        
        # Validate connection and text
        if not self._validate_connection_and_text(text):
            return
        
        # Store audio timestamp for synchronization
        if audio_timestamp:
            self.audio_timestamp = audio_timestamp
            logger.info(f"🔊 Audio timestamp stored: {audio_timestamp}")
        
        # Use provided TTS audio (routed from main agent) for synchronization
        if tts_audio:
            logger.info(f"🎬 Using provided TTS audio for True Sync avatar: {len(tts_audio)} bytes")
            await self._send_tts_audio_to_track(tts_audio, audio_timestamp)
        else:
            logger.info("🎬 No TTS audio provided, generating TTS for avatar participant...")
            # Generate TTS audio for the avatar participant
            tts_audio = await self._generate_tts_audio(text)
            if tts_audio:
                logger.info(f"✅ TTS audio generated: {len(tts_audio)} bytes")
                await self._send_tts_audio_to_track(tts_audio, audio_timestamp)
            else:
                logger.warning("⚠️ Failed to generate TTS audio, sending silent audio track")
                # Send silent audio to maintain audio track consistency
                await self._send_silent_audio_to_track(audio_timestamp)
        
        # Send text to Wav2Lip WebSocket
        await self._send_text_to_wav2lip(text, audio_timestamp)
    
    def _validate_connection_and_text(self, text: str) -> bool:
        """Validate connection and text input."""
        if not self.wav2lip_available or not self.is_connected:
            logger.warning("⚠️ Wav2Lip server not available or not connected")
            return False
        
        if not text or len(text.strip()) < 3:
            logger.warning("⚠️ Text too short, skipping processing")
            return False
        
        return True
    
    async def _generate_tts_audio(self, text: str) -> Optional[bytes]:
        """Generate TTS audio for the given text."""
        try:
            # Import TTS here to avoid circular imports
            from videosdk.plugins.sarvamai import SarvamAITTS
            from utils.config.settings import get_settings
            
            settings = get_settings()
            
            # Check if API key is available
            if not settings.sarvamai_api_key:
                logger.error("❌ SARVAMAI_API_KEY not set in environment")
                return None
                
            # Create TTS instance with same settings as main agent
            logger.info(f"🎤 TTS Settings: api_key={'***' if settings.sarvamai_api_key else 'None'}, model=bulbul:v2, speaker=anushka, target_language_code=en-IN, pitch={settings.tts_pitch}, pace={settings.tts_pace}, loudness={settings.tts_loudness}")
            logger.info(f"🎤 API Key length: {len(settings.sarvamai_api_key) if settings.sarvamai_api_key else 0} characters")
            
            tts = SarvamAITTS(
                api_key=settings.sarvamai_api_key,
                model="bulbul:v2",
                speaker="anushka",
                target_language_code="en-IN",
                pitch=settings.tts_pitch,
                pace=settings.tts_pace,
                loudness=settings.tts_loudness
            )
            
            logger.info(f"🎤 TTS instance created successfully: {type(tts)}")
            
            # Generate TTS audio
            logger.info(f"🎬 Generating TTS audio for text: {text[:50]}...")
            try:
                # Test TTS service with minimal text first
                test_text = "Hello"
                logger.info(f"🎬 Testing TTS service with minimal text: '{test_text}'")
                
                # Check TTS service attributes
                logger.info(f"🎬 TTS service attributes: {dir(tts)}")
                logger.info(f"🎬 TTS service type: {type(tts)}")
                
                audio_data = await tts.synthesize(test_text)
                logger.info(f"🎬 TTS synthesize returned: {type(audio_data)}, length: {len(audio_data) if audio_data else 'None'}")
                
                if audio_data:
                    logger.info(f"✅ TTS audio generated successfully: {len(audio_data)} bytes")
                    return audio_data
                else:
                    logger.error("❌ TTS service returned None - this indicates a fundamental issue with the TTS service")
                    logger.error("❌ Possible causes: Invalid API key, network issue, or TTS service configuration problem")
                    return None
            except Exception as tts_error:
                logger.error(f"❌ TTS synthesize failed with exception: {tts_error}")
                import traceback
                logger.error(f"❌ TTS synthesize traceback: {traceback.format_exc()}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Failed to generate TTS audio: {e}")
            import traceback
            logger.error(f"❌ TTS Error traceback: {traceback.format_exc()}")
            return None
    
    async def _send_silent_audio_to_track(self, audio_timestamp: Optional[float] = None) -> None:
        """Send silent audio to the audio track to maintain consistency."""
        try:
            if not self.audio_track:
                logger.warning("⚠️ No audio track available for silent audio")
                return
            
            # Create 1 second of silent audio (16kHz, 16-bit, mono)
            duration_seconds = 1.0
            sample_rate = 16000
            samples = int(duration_seconds * sample_rate)
            
            # Create silent audio data
            silent_audio = np.zeros(samples, dtype=np.int16)
            silent_bytes = silent_audio.tobytes()
            
            logger.info(f"🔇 Sending {len(silent_bytes)} bytes of silent audio to track")
            # Use the correct method for TrueSyncAudioTrack
            if hasattr(self.audio_track, 'put_audio'):
                await self.audio_track.put_audio(silent_bytes, audio_timestamp or time.time())
            elif hasattr(self.audio_track, 'send_audio'):
                await self.audio_track.send_audio(silent_bytes, audio_timestamp or time.time())
            else:
                logger.warning("⚠️ TrueSyncAudioTrack doesn't have put_audio or send_audio method")
                # Create audio frame and send it
                audio_frame = self._create_audio_frame(silent_bytes, audio_timestamp or time.time())
                if audio_frame:
                    await self.audio_track.send(audio_frame)
            
        except Exception as e:
            logger.error(f"❌ Failed to send silent audio: {e}")
    
    async def _send_tts_audio_to_track(self, tts_audio: bytes, audio_timestamp: Optional[float]) -> None:
        """Send TTS audio to the audio track."""
        try:
            if self.audio_track:
                await self.audio_track.add_synchronized_audio(tts_audio, audio_timestamp or time.time())
                logger.info("🔊 TTS audio sent to audio track")
            else:
                logger.warning("⚠️ No audio track available to send TTS audio")
        except Exception as e:
            logger.error(f"❌ Failed to send TTS audio to track: {e}")
    
    # Removed _send_tts_audio_via_data_channel - not needed with proper avatar agent approach
    
    async def _send_text_to_wav2lip(self, text: str, audio_timestamp: Optional[float]) -> None:
        """Send text to Wav2Lip WebSocket."""
        if self.websocket and self.is_connected:
            try:
                # Send text_data field as expected by the Wav2Lip server
                # The Wav2Lip server will generate lip-sync frames based on the text
                message = {
                    "text_data": text.strip()
                }
                
                logger.info(f"📝 Sending text to Wav2Lip: {text[:50]}...")
                
                await self.websocket.send(json.dumps(message))
                logger.info("✅ Text sent to Wav2Lip successfully")
                
                self.is_streaming = True
                
            except Exception as e:
                logger.error(f"❌ Failed to send text to Wav2Lip: {e}")
        else:
            logger.warning("⚠️ Wav2Lip WebSocket not available")

    async def _websocket_message_handler(self) -> None:
        """
        Handle incoming messages from the Wav2Lip WebSocket with audio synchronization.
        """
        try:
            logger.info("🎬 Starting true sync WebSocket message handler...")
            logger.info(f"🎬 WebSocket state: {self.websocket.state if hasattr(self.websocket, 'state') else 'unknown'}")
            logger.info(f"🎬 WebSocket connected: {self.is_connected}")
            logger.info(f"🎬 WebSocket object: {self.websocket}")
            
            # Wait a moment for the connection to stabilize
            await asyncio.sleep(1)
            
            # Send a test message to Wav2Lip to generate lip-sync frames
            test_message = {
                "text_data": "Hello! This is a test message to generate lip-sync frames from Wav2Lip WebSocket."
            }
            logger.info("🎬 Sending test message to Wav2Lip to generate lip-sync frames...")
            logger.info(f"🎬 Test message: {test_message}")
            
            if self.websocket and self.is_connected:
                await self.websocket.send(json.dumps(test_message))
                logger.info("✅ Test message sent to Wav2Lip successfully")
            else:
                logger.error("❌ Cannot send test message - WebSocket not connected")
                return
            
            # Use a more cancellation-friendly approach
            while self.is_connected and self.websocket:
                try:
                    # Check for cancellation before each message
                    await asyncio.sleep(0)  # Yield control to allow cancellation
                    
                    # Try to receive a message with a timeout
                    message = await asyncio.wait_for(self.websocket.recv(), timeout=0.1)
                    await self._process_websocket_message(message)
                    
                except asyncio.TimeoutError:
                    # No message received, continue loop (this allows for cancellation)
                    continue
                except asyncio.CancelledError:
                    logger.info("🛑 True sync WebSocket handler cancelled during message receive")
                    raise
                except websockets.exceptions.ConnectionClosed:
                    logger.info("🔌 Wav2Lip WebSocket connection closed during message receive")
                    break
                except Exception as e:
                    logger.error(f"❌ Error receiving WebSocket message: {e}")
                    break
                    
        except asyncio.CancelledError:
            logger.info("🛑 True sync WebSocket handler cancelled")
            raise
        except websockets.exceptions.ConnectionClosed as e:
            logger.info(f"🔌 Wav2Lip WebSocket connection closed: {e}")
        except websockets.exceptions.WebSocketException as e:
            logger.error(f"❌ Wav2Lip WebSocket exception: {e}")
        except Exception as e:
            logger.error(f"❌ True sync WebSocket handler error: {e}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
        finally:
            logger.info("🏁 True sync WebSocket handler finished")
            self.is_streaming = False
    
    async def _process_websocket_message(self, message: str) -> None:
        """Process a single WebSocket message."""
        try:
            data = json.loads(message)
            
            if 'frame' in data:
                await self._handle_frame_message(data)
            elif 'error' in data:
                logger.error(f"❌ Wav2Lip WebSocket error: {data['error']}")
                
        except json.JSONDecodeError as e:
            logger.warning(f"⚠️ Failed to parse JSON: {e}")
        except Exception as e:
            logger.warning(f"⚠️ Error processing message: {e}")
    
    async def _handle_frame_message(self, data: Dict[str, Any]) -> None:
        """Handle frame message from WebSocket."""
        frame_data = data['frame']
        frame_type = data.get('type', 'unknown')
        
        # Use stored audio timestamp for synchronization
        audio_timestamp = self.audio_timestamp
        
        if frame_type == 'lip_sync':
            logger.info(f"🎬 Received lip-sync frame: {len(frame_data)} bytes")
            await self.video_track.add_synchronized_frame(frame_data, audio_timestamp)
        elif frame_type == 'idle':
            logger.info(f"😴 Received idle frame: {len(frame_data)} bytes")
            await self.video_track.add_synchronized_frame(frame_data, audio_timestamp)
        else:
            logger.warning(f"⚠️ Unknown frame type: {frame_type}")

    def get_video_track(self) -> TrueSyncVideoTrack:
        """Get the synchronized video track."""
        return self.video_track

    def get_audio_track(self) -> TrueSyncAudioTrack:
        """Get the synchronized audio track."""
        return self.audio_track

    def set_data_channel(self, data_channel) -> None:
        """Set the data channel for audio transmission."""
        self.data_channel = data_channel
        logger.info("🔗 Data channel set for audio transmission")

    async def stop_stream(self) -> None:
        """Stop the current synchronized stream."""
        if self.websocket and self.is_connected and self.is_streaming:
            try:
                stop_message = {"action": "stop"}
                await self.websocket.send(json.dumps(stop_message))
                logger.info("✅ Stop message sent to Wav2Lip WebSocket")
                self.is_streaming = False
            except Exception as e:
                logger.warning(f"⚠️ Failed to send stop message: {e}")
        else:
            logger.info("ℹ️ No active stream to stop")
