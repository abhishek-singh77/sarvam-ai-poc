import aiohttp
import asyncio
import json
import base64
import io
import time
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
        self.frame_rate = 30  # 30 FPS
        self.frame_duration = 1.0 / self.frame_rate
        self.last_frame_time = 0
        self.max_queue_size = 10  # Limit queue size to prevent memory issues
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
            
            # Limit queue size to prevent memory issues
            if self.frame_queue.qsize() >= self.max_queue_size:
                try:
                    # Remove oldest frame
                    self.frame_queue.get_nowait()
                    print(f"⚠️ Queue full, removed oldest frame")
                except asyncio.QueueEmpty:
                    pass
            
            # Add to queue
            await self.frame_queue.put(frame_array)
            
        except Exception as e:
            print(f"❌ Failed to process frame: {e}")
            import traceback
            print(f"❌ Traceback: {traceback.format_exc()}")
    
    async def recv(self) -> av.VideoFrame:
        """
        Receive the next video frame for streaming.
        """
        current_time = time.time()
        
        # Try to get a new frame from the queue first
        try:
            # Non-blocking get from queue
            new_frame = self.frame_queue.get_nowait()
            self.current_frame = new_frame
        except asyncio.QueueEmpty:
            # No new frame available, use current frame or create a blank one
            if self.current_frame is None:
                # Create a blank frame if no frame is available
                self.current_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        
        # Check if enough time has passed since last frame
        if current_time - self.last_frame_time < self.frame_duration:
            # Not enough time has passed, return the current frame
            pass
        
        try:
            # Ensure frame is in the correct format
            if self.current_frame is None:
                self.current_frame = np.zeros((480, 640, 3), dtype=np.uint8)
            
            # Convert RGB to BGR for better compatibility
            frame_bgr = np.flip(self.current_frame, axis=2)  # RGB to BGR
            
            # Create AV VideoFrame with RGB format (VP8 prefers RGB)
            frame = av.VideoFrame.from_ndarray(self.current_frame, format='rgb24')
            frame.pts = int(current_time * 90000)  # 90kHz timestamp
            # Use fractions.Fraction instead of av.Rational
            from fractions import Fraction
            frame.time_base = Fraction(1, 90000)
            
            self.last_frame_time = current_time
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
        """Clear the frame queue."""
        while not self.frame_queue.empty():
            try:
                self.frame_queue.get_nowait()
            except asyncio.QueueEmpty:
                break
        print("🧹 Frame queue cleared")


class Wav2LipAvatar:
    """
    Custom Avatar plugin that connects VideoSDK's agent framework to your
    Wav2Lip FastAPI server (`/lip-sync-stream` endpoint).
    """

    def __init__(self, wav2lip_url: str, **kwargs):
        """
        :param wav2lip_url: Base URL of your FastAPI server (e.g. http://localhost:8001)
        """
        self.wav2lip_url = wav2lip_url.rstrip("/")
        self.session = None
        self.stream_task = None
        self.stream_response = None
        
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
        Connect the avatar to the VideoSDK room.
        This method is called by the VideoSDK pipeline.
        
        Args:
            room_id: VideoSDK room ID (optional, can be set later)
            participant_id: Participant ID (optional, can be set later)
            token: Authentication token (optional, can be set later)
        """
        print(f"Wav2Lip Avatar connecting...")
        
        # Store connection info if provided
        if room_id:
            self.room_id = room_id
        if participant_id:
            self.participant_id = participant_id
        if token:
            self.token = token
        
        # Initialize HTTP session if not already done
        if self.session is None:
            self.session = aiohttp.ClientSession()
        
        # Always try to start the Wav2Lip stream connection
        # Use default values if connection info is not complete
        if not self.room_id:
            self.room_id = "default_room"
        if not self.participant_id:
            self.participant_id = "default_participant"
        if not self.token:
            self.token = "default_token"
        
        print(f"Wav2Lip Avatar connecting to room {self.room_id} with participant {self.participant_id}")
        
        # Start the Wav2Lip stream connection
        await self._start_wav2lip_stream()


    async def _start_wav2lip_stream(self):
        """
        Start the Wav2Lip stream connection.
        """
        try:
            url = f"{self.wav2lip_url}/lip-sync-stream"
            print(f"🎬 Connecting to Wav2Lip stream: {url}")
            
            form_data = aiohttp.FormData()
            form_data.add_field("lang", "en")
            # Provide default text input to initialize the stream
            form_data.add_field("text", "Hello, I am your AI assistant. I'm ready to help you.")
            
            # Start the stream connection
            self.stream_response = await self.session.post(url, data=form_data)
            
            if self.stream_response.status != 200:
                error = await self.stream_response.text()
                raise RuntimeError(f"Wav2Lip server error: {self.stream_response.status} {error}")
            
            print(f"✅ Wav2Lip stream connected for room {self.room_id}")
            print(f"🎬 Stream response status: {self.stream_response.status}")
            print(f"🎬 Stream response headers: {dict(self.stream_response.headers)}")
            
            # Start the stream reader task
            self.stream_task = asyncio.create_task(self._stream_reader())
            
        except Exception as e:
            print(f"❌ Failed to connect Wav2Lip stream: {e}")
            print(f"⚠️ Wav2Lip server unavailable - continuing without avatar video")
            print(f"ℹ️ Agent will work normally, but without lip-sync video")
            
            # Set a flag to indicate Wav2Lip is not available
            self.wav2lip_available = False
            
            # Don't raise the exception - let the agent continue without Wav2Lip
            return

    async def disconnect(self):
        """
        Disconnect the avatar from the VideoSDK room.
        This method is called by the VideoSDK pipeline.
        """
        print(f"🛑 Wav2Lip Avatar disconnecting from room {self.room_id}")
        
        # Stop the stream reader task
        if self.stream_task:
            print("🛑 Cancelling stream reader task...")
            self.stream_task.cancel()
            try:
                await self.stream_task
            except asyncio.CancelledError:
                print("✅ Stream reader task cancelled")
            self.stream_task = None
        
        # Close the stream response
        if hasattr(self, 'stream_response') and self.stream_response:
            print("🛑 Closing stream response...")
            self.stream_response.close()
            self.stream_response = None
        
        # Clear the video track queue
        if hasattr(self, 'video_track') and self.video_track:
            print("🛑 Clearing video track queue...")
            self.video_track.clear_queue()
        
        # Signal Wav2Lip server to stop streaming (only if available)
        if self.session and self.wav2lip_available:
            try:
                print(f"🛑 Sending stop-stream request to {self.wav2lip_url}/stop-stream")
                await self.session.post(f"{self.wav2lip_url}/stop-stream")
                print("✅ Stop-stream request sent successfully")
            except Exception as e:
                print(f"⚠️ Failed to send stop-stream request: {e}")
            finally:
                print("🛑 Closing HTTP session...")
                await self.session.close()
                self.session = None
        elif self.session:
            # Just close the session if Wav2Lip was not available
            print("🛑 Closing HTTP session...")
            await self.session.close()
            self.session = None
        
        print("✅ Wav2Lip Avatar disconnected completely")

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
        print(f"Wav2Lip Avatar received text: {text}")
        
        # Check if Wav2Lip is available
        if not self.wav2lip_available:
            print("⚠️ Wav2Lip server not available, skipping text processing")
            return
        
        # Send text to Wav2Lip API for processing
        if self.session:
            try:
                # Send text to the Wav2Lip API using the /lip-sync endpoint
                url = f"{self.wav2lip_url}/lip-sync"
                form_data = aiohttp.FormData()
                form_data.add_field("text", text)
                form_data.add_field("lang", "en")
                
                print(f"📝 Sending text to Wav2Lip for processing: {text[:50]}...")
                
                async with self.session.post(url, data=form_data) as response:
                    if response.status == 200:
                        print(f"✅ Text sent to Wav2Lip successfully")
                        # The Wav2Lip API will process the text and generate lip-sync video
                        # The video frames will be available through the stream
                    else:
                        error = await response.text()
                        print(f"❌ Wav2Lip API error: {response.status} {error}")
                
            except Exception as e:
                print(f"❌ Failed to send text to Wav2Lip: {e}")
        else:
            print("⚠️ Wav2Lip session not available, cannot send text")

    async def _stream_reader(self):
        """
        Read video frames from the Wav2Lip stream and send them to VideoSDK.
        This runs in the background and processes incoming video frames.
        """
        try:
            print("🎬 Wav2Lip stream reader started")
            buffer = ""
            frame_count = 0
            
            # Read the stream in chunks to avoid "Chunk too big" errors
            async for chunk in self.stream_response.content.iter_chunked(1024):  # 1KB chunks
                try:
                    # Decode the chunk and add to buffer
                    chunk_str = chunk.decode('utf-8', errors='ignore')
                    buffer += chunk_str
                    
                    # Process complete lines
                    while '\n' in buffer:
                        line, buffer = buffer.split('\n', 1)
                        line = line.strip()
                        
                        if line.startswith("data:"):
                            try:
                                # Extract JSON data after "data:"
                                json_data = line[5:].strip()
                                if json_data:
                                    payload = json.loads(json_data)
                                    
                                    if "error" in payload:
                                        print(f"❌ Wav2Lip error: {payload['error']}")
                                        continue

                                    if "meta" in payload:
                                        # Video meta info (fps, width, height)
                                        print(f"📊 Wav2Lip meta: {payload['meta']}")
                                        
                                    elif "frame" in payload:
                                        # Base64 encoded video frame
                                        frame_data = payload["frame"]
                                        frame_count += 1
                                        print(f"🎬 Wav2Lip frame #{frame_count} received: {len(frame_data)} bytes")
                                        
                                        # Send frame to VideoSDK
                                        await self._send_frame_to_videosdk(frame_data)
                                        
                            except json.JSONDecodeError as e:
                                print(f"❌ Wav2Lip JSON parsing error: {e}")
                                print(f"❌ Problematic data: {line[:100]}...")
                            except Exception as e:
                                print(f"❌ Wav2Lip frame processing error: {e}")
                        
                except Exception as e:
                    print(f"❌ Wav2Lip chunk processing error: {e}")
                    continue
                        
        except Exception as e:
            print(f"❌ Wav2Lip stream reader error: {e}")
            print(f"❌ Stream reader stopping due to error")

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

