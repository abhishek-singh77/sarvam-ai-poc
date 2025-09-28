import aiohttp
import asyncio
import json
import base64
import io
import time
import websockets
from typing import Optional
from PIL import Image
import av
import numpy as np
from videosdk import CustomVideoTrack


class Wav2LipCustomVideoTrack(CustomVideoTrack):
    """
    Custom video track that receives video frames from Wav2Lip API
    and streams them to VideoSDK.
    """
    
    def __init__(self):
        super().__init__()
        self.frame_queue = asyncio.Queue()
        self.current_frame = None
        self.frame_rate = 30  # Increased to 30 FPS for better responsiveness
        self.frame_duration = 1.0 / self.frame_rate
        self.last_frame_time = 0
        self.max_queue_size = 3  # Smaller queue size to reduce latency
        self.frame_buffer = []  # Buffer for smoothing frame delivery
        self.buffer_size = 2  # Smaller buffer to reduce latency
        self.last_frame_delivery_time = 0
        print(f"📺 Wav2LipCustomVideoTrack: Initialized with frame rate {self.frame_rate} FPS")
        
    async def add_frame(self, frame_data: str):
        """
        Add a new video frame to the queue.
        
        Args:
            frame_data: Base64 encoded video frame data
        """
        try:
            # Decode the base64 frame data
            frame_bytes = base64.b64decode(frame_data)
            
            # Convert to PIL Image
            image = Image.open(io.BytesIO(frame_bytes))
            
            # Convert to RGB if needed
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Resize image to standard video dimensions if needed
            if image.size != (640, 480):
                image = image.resize((640, 480), Image.Resampling.LANCZOS)
            
            # Convert PIL image to numpy array
            frame_array = np.array(image, dtype=np.uint8)
            
            # Ensure the frame has the correct shape and format
            if frame_array.shape != (480, 640, 3):
                print(f"⚠️ Frame shape mismatch: {frame_array.shape}, expected (480, 640, 3)")
                # Reshape if possible
                if frame_array.size == 480 * 640 * 3:
                    frame_array = frame_array.reshape((480, 640, 3))
                else:
                    print(f"❌ Cannot reshape frame, skipping")
                    return
            
            # Limit queue size to prevent memory issues and frame bursts
            if self.frame_queue.qsize() >= self.max_queue_size:
                try:
                    # Remove oldest frame
                    self.frame_queue.get_nowait()
                    print(f"⚠️ Queue full, removed oldest frame")
                except asyncio.QueueEmpty:
                    pass
            
            # Add to queue with frame smoothing
            await self.frame_queue.put(frame_array)
            
            # Add to buffer for smooth delivery
            self.frame_buffer.append(frame_array)
            if len(self.frame_buffer) > self.buffer_size:
                self.frame_buffer.pop(0)  # Remove oldest frame from buffer
            
        except Exception as e:
            print(f"❌ Failed to process frame: {e}")
            import traceback
            print(f"❌ Traceback: {traceback.format_exc()}")
    
    async def recv(self) -> av.VideoFrame:
        """
        Receive the next video frame for streaming with optimized delivery.
        """
        current_time = time.time()
        
        # Try to get a new frame from the queue first (prioritize new frames)
        try:
            # Non-blocking get from queue
            new_frame = self.frame_queue.get_nowait()
            self.current_frame = new_frame
            self.last_frame_delivery_time = current_time
            return self._create_video_frame(new_frame, current_time)
        except asyncio.QueueEmpty:
            # No new frame available, check if we can return current frame
            if self.current_frame is not None:
                # Only enforce frame rate if we have a current frame
                time_since_last_frame = current_time - self.last_frame_delivery_time
                if time_since_last_frame >= self.frame_duration:
                    return self._create_video_frame(self.current_frame, current_time)
            else:
                # Create a blank frame if no frame is available
                self.current_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        
        # Create and return the video frame
        return self._create_video_frame(self.current_frame, current_time)
    
    def _create_video_frame(self, frame_array: np.ndarray, current_time: float) -> av.VideoFrame:
        """
        Create an AV VideoFrame from numpy array with proper timing.
        """
        try:
            # Ensure frame is in the correct format
            if frame_array is None:
                frame_array = np.zeros((480, 640, 3), dtype=np.uint8)
            
            # Create AV VideoFrame with RGB format (VP8 prefers RGB)
            frame = av.VideoFrame.from_ndarray(frame_array, format='rgb24')
            frame.pts = int(current_time * 90000)  # 90kHz timestamp
            # Use fractions.Fraction instead of av.Rational
            from fractions import Fraction
            frame.time_base = Fraction(1, 90000)
            
            return frame
            
        except Exception as e:
            print(f"❌ Failed to create AV VideoFrame: {e}")
            import traceback
            print(f"❌ Traceback: {traceback.format_exc()}")
            
            # Return a blank frame as fallback
            blank_frame = np.zeros((480, 640, 3), dtype=np.uint8)
            try:
                frame = av.VideoFrame.from_ndarray(blank_frame, format='rgb24')
                frame.pts = int(current_time * 90000)
                from fractions import Fraction
                frame.time_base = Fraction(1, 90000)
                return frame
            except Exception as e2:
                print(f"❌ Failed to create fallback frame: {e2}")
                # Return None to indicate failure
                return None
    
    def clear_queue(self):
        """Clear the frame queue and buffer."""
        while not self.frame_queue.empty():
            try:
                self.frame_queue.get_nowait()
            except asyncio.QueueEmpty:
                break
        
        # Clear the frame buffer
        self.frame_buffer.clear()
        
        # Reset timing
        self.last_frame_delivery_time = 0
        self.last_frame_time = 0
        
        print("🧹 Frame queue and buffer cleared")


class Wav2LipAvatar:
    """
    Custom Avatar plugin that connects VideoSDK's agent framework to your
    Wav2Lip WebSocket server for real-time lip-sync generation.
    """

    def __init__(self, wav2lip_url: str, **kwargs):
        """
        :param wav2lip_url: WebSocket URL of your Wav2Lip server (e.g. ws://localhost:8001/ws)
        """
        # Convert HTTP URL to WebSocket URL if needed
        if wav2lip_url.startswith("http://"):
            self.wav2lip_url = wav2lip_url.replace("http://", "ws://") + "/ws"
        elif wav2lip_url.startswith("https://"):
            self.wav2lip_url = wav2lip_url.replace("https://", "wss://") + "/ws"
        elif not wav2lip_url.startswith("ws://") and not wav2lip_url.startswith("wss://"):
            self.wav2lip_url = f"ws://{wav2lip_url}/ws"
        else:
            self.wav2lip_url = wav2lip_url
        
        self.websocket = None
        self.websocket_task = None
        self.is_connected = False
        self.is_streaming = False
        
        # Create custom video track for streaming
        self.video_track = Wav2LipCustomVideoTrack()
        print(f"📺 Wav2Lip Avatar: Created video track: {type(self.video_track)}")
        
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
        Connect the avatar to the VideoSDK room and Wav2Lip WebSocket server.
        This method is called by the VideoSDK pipeline.
        
        Args:
            room_id: VideoSDK room ID (optional, can be set later)
            participant_id: Participant ID (optional, can be set later)
            token: Authentication token (optional, can be set later)
        """
        print(f"🎬 Wav2Lip Avatar connecting...")
        
        # Store connection info if provided
        if room_id:
            self.room_id = room_id
        if participant_id:
            self.participant_id = participant_id
        if token:
            self.token = token
        
        # Use default values if connection info is not complete
        if not self.room_id:
            self.room_id = "default_room"
        if not self.participant_id:
            self.participant_id = "default_participant"
        if not self.token:
            self.token = "default_token"
        
        print(f"🎬 Wav2Lip Avatar connecting to room {self.room_id} with participant {self.participant_id}")
        
        # Start the Wav2Lip WebSocket connection
        await self._start_wav2lip_websocket()


    async def _start_wav2lip_websocket(self):
        """
        Start the Wav2Lip WebSocket connection.
        """
        try:
            print(f"🎬 Connecting to Wav2Lip WebSocket: {self.wav2lip_url}")
            
            # Connect to WebSocket
            self.websocket = await websockets.connect(self.wav2lip_url)
            self.is_connected = True
            
            print(f"✅ Wav2Lip WebSocket connected for room {self.room_id}")
            
            # Start the WebSocket message handler task
            self.websocket_task = asyncio.create_task(self._websocket_message_handler())
            
        except Exception as e:
            print(f"❌ Failed to connect Wav2Lip WebSocket: {e}")
            print(f"⚠️ Wav2Lip server unavailable - continuing without avatar video")
            print(f"ℹ️ Agent will work normally, but without lip-sync video")
            
            # Set a flag to indicate Wav2Lip is not available
            self.wav2lip_available = False
            self.is_connected = False
            
            # Don't raise the exception - let the agent continue without Wav2Lip
            return

    async def disconnect(self):
        """
        Disconnect the avatar from the VideoSDK room and Wav2Lip WebSocket.
        This method is called by the VideoSDK pipeline.
        """
        print(f"🛑 Wav2Lip Avatar disconnecting from room {self.room_id}")
        
        # Stop the WebSocket message handler task
        if self.websocket_task:
            print("🛑 Cancelling WebSocket message handler task...")
            self.websocket_task.cancel()
            try:
                # Wait for the task to complete with a timeout
                await asyncio.wait_for(self.websocket_task, timeout=2.0)
            except asyncio.CancelledError:
                print("✅ WebSocket message handler task cancelled")
            except asyncio.TimeoutError:
                print("⚠️ WebSocket message handler task cancellation timed out")
            finally:
                self.websocket_task = None
        
        # Close the WebSocket connection
        if self.websocket and self.is_connected:
            print("🛑 Closing WebSocket connection...")
            try:
                # Send a stop message to the server before closing
                try:
                    stop_message = {"stop": True}
                    await self.websocket.send(json.dumps(stop_message))
                    print("📤 Sent stop message to Wav2Lip server")
                except Exception as e:
                    print(f"⚠️ Failed to send stop message: {e}")
                
                # Close the WebSocket connection
                await self.websocket.close()
                print("✅ WebSocket connection closed")
            except Exception as e:
                print(f"⚠️ Error closing WebSocket: {e}")
            finally:
                self.websocket = None
                self.is_connected = False
        
        # Clear the video track queue
        if hasattr(self, 'video_track') and self.video_track:
            print("🛑 Clearing video track queue...")
            self.video_track.clear_queue()
        
        print("✅ Wav2Lip Avatar disconnected completely")

    async def stop_stream(self):
        """
        Stop the current lip-sync stream and return to idle state.
        This method can be called to stop the current processing.
        """
        if self.websocket and self.is_connected and self.is_streaming:
            try:
                print("🛑 Stopping Wav2Lip stream...")
                # Send a stop message to the WebSocket server
                stop_message = {"action": "stop"}
                await self.websocket.send(json.dumps(stop_message))
                print("✅ Stop message sent to Wav2Lip WebSocket")
                self.is_streaming = False
            except Exception as e:
                print(f"⚠️ Failed to send stop message: {e}")
        else:
            print("ℹ️ No active stream to stop")

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
        Send text to the avatar for processing via WebSocket.
        This method is called by the VideoSDK pipeline when text is generated.
        
        Args:
            text: Text to be processed
        """
        print(f"🎬 Wav2Lip Avatar received text: {text[:100]}{'...' if len(text) > 100 else ''}")
        
        # Check if Wav2Lip is available and connected
        if not self.wav2lip_available or not self.is_connected:
            print("⚠️ Wav2Lip server not available or not connected, skipping text processing")
            return
        
        # Skip empty or very short text
        if not text or len(text.strip()) < 3:
            print("⚠️ Text too short, skipping Wav2Lip processing")
            return
        
        # Send text to Wav2Lip WebSocket for processing
        if self.websocket and self.is_connected:
            try:
                # Send text data via WebSocket
                message = {
                    "text_data": text.strip()
                }
                
                print(f"📝 Sending text to Wav2Lip WebSocket: {text[:50]}...")
                
                await self.websocket.send(json.dumps(message))
                print(f"✅ Text sent to Wav2Lip WebSocket successfully")
                
                # Set streaming flag to indicate we're processing
                self.is_streaming = True
                
            except Exception as e:
                print(f"❌ Failed to send text to Wav2Lip WebSocket: {e}")
                import traceback
                print(f"❌ Traceback: {traceback.format_exc()}")
        else:
            print("⚠️ Wav2Lip WebSocket not available, cannot send text")

    async def _websocket_message_handler(self):
        """
        Handle incoming messages from the Wav2Lip WebSocket.
        This runs in the background and processes incoming video frames.
        """
        try:
            print("🎬 Starting Wav2Lip WebSocket message handler...")
            
            # Listen for messages from the WebSocket
            async for message in self.websocket:
                try:
                    # Parse the JSON message
                    data = json.loads(message)
                    
                    # Check if this is a video frame
                    if 'frame' in data:
                        frame_data = data['frame']
                        frame_type = data.get('type', 'unknown')
                        
                        if frame_type == 'lip_sync':
                            print(f"🎬 Received lip-sync frame from Wav2Lip WebSocket")
                            # Add the frame to the video track
                            await self.video_track.add_frame(frame_data)
                        elif frame_type == 'idle':
                            # print(f"😴 Received idle frame from Wav2Lip WebSocket")  # Commented out to reduce log noise
                            # Add the frame to the video track
                            await self.video_track.add_frame(frame_data)
                        
                    elif 'error' in data:
                        error_msg = data['error']
                        print(f"❌ Wav2Lip WebSocket error: {error_msg}")
                        
                    elif 'status' in data:
                        status = data['status']
                        print(f"ℹ️ Wav2Lip WebSocket status: {status}")
                        
                except json.JSONDecodeError as e:
                    print(f"⚠️ Failed to parse JSON from WebSocket: {e}")
                    print(f"⚠️ Raw message: {message}")
                    continue
                except Exception as e:
                    print(f"⚠️ Error processing WebSocket message: {e}")
                    continue
                    
        except asyncio.CancelledError:
            print("🛑 Wav2Lip WebSocket message handler cancelled")
            raise
        except websockets.exceptions.ConnectionClosed:
            print("🔌 Wav2Lip WebSocket connection closed")
        except Exception as e:
            print(f"❌ Wav2Lip WebSocket message handler error: {e}")
            import traceback
            print(f"❌ Traceback: {traceback.format_exc()}")
        finally:
            print("🏁 Wav2Lip WebSocket message handler finished")
            self.is_streaming = False

    async def _send_frame_to_videosdk(self, frame_data: str):
        """
        Send video frame to VideoSDK for display in the user's UI.
        
        Args:
            frame_data: Base64 encoded video frame data
        """
        try:
            # Add the frame to our custom video track
            await self.video_track.add_frame(frame_data)
        except Exception as e:
            print(f"❌ Failed to send frame to VideoSDK: {e}")
            import traceback
            print(f"❌ Traceback: {traceback.format_exc()}")

    def get_video_track(self):
        """
        Get the custom video track for VideoSDK integration.
        
        Returns:
            Wav2LipCustomVideoTrack: The custom video track instance
        """
        return self.video_track

