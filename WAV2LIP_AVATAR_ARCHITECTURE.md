# Wav2Lip Avatar Plugin Architecture

## Overview

The Wav2Lip Avatar Plugin is a custom VideoSDK integration that connects an external Wav2Lip FastAPI server to provide real-time lip-sync video for AI agents. This document explains the architecture, components, and how the plugin works.

## Architecture Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   VideoSDK      │    │   Wav2Lip        │    │   External      │
│   Agent         │    │   Avatar Plugin  │    │   Wav2Lip API   │
│                 │    │                  │    │                 │
│ ┌─────────────┐ │    │ ┌──────────────┐ │    │ ┌─────────────┐ │
│ │ Cascading   │ │◄──►│ │ Wav2LipAvatar│ │◄──►│ │ /lip-sync-  │ │
│ │ Pipeline    │ │    │ │              │ │    │ │ stream      │ │
│ └─────────────┘ │    │ └──────────────┘ │    │ └─────────────┘ │
│                 │    │ ┌──────────────┐ │    │ ┌─────────────┐ │
│ ┌─────────────┐ │    │ │Wav2LipCustom │ │    │ │ /lip-sync   │ │
│ │ Room        │ │◄──►│ │VideoTrack    │ │    │ │             │ │
│ └─────────────┘ │    │ └──────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Core Components

### 1. Wav2LipCustomVideoTrack

**Purpose**: Extends VideoSDK's `CustomVideoTrack` to handle video frames from the Wav2Lip API.

**Key Features**:

-   **Frame Queue Management**: Maintains a queue of video frames with size limits
-   **Frame Processing**: Converts base64 frames to AV VideoFrames
-   **Format Conversion**: Handles RGB to BGR conversion for VideoSDK compatibility
-   **Frame Rate Control**: Manages 30 FPS frame timing

**Key Methods**:

```python
async def add_frame(self, frame_data: str):
    """Add a new video frame to the queue from Wav2Lip API"""

async def recv(self) -> av.VideoFrame:
    """Provide frames to VideoSDK for streaming"""

def clear_queue(self):
    """Clear the frame queue during cleanup"""
```

### 2. Wav2LipAvatar

**Purpose**: Main plugin class that implements VideoSDK's avatar interface and manages the connection to the external Wav2Lip API.

**Key Features**:

-   **VideoSDK Integration**: Implements required methods (`connect`, `disconnect`, `send_audio`, `send_text`)
-   **Stream Management**: Handles SSE stream from Wav2Lip API
-   **Frame Processing**: Processes incoming video frames and feeds them to the custom video track
-   **Connection Management**: Manages HTTP sessions and stream lifecycle

**Key Methods**:

```python
async def connect(self, room_id: str = None, participant_id: str = None, token: str = None):
    """Connect to VideoSDK room and start Wav2Lip stream"""

async def disconnect(self):
    """Disconnect from room and cleanup resources"""

async def send_text(self, text: str):
    """Send text to Wav2Lip API for lip-sync generation"""

async def _stream_reader(self):
    """Background task to read video frames from Wav2Lip stream"""
```

## Integration Flow

### 1. Initialization

```python
# In ProperAgentService.__init__()
if self.settings.wav2lip_enabled:
    self.wav2lip_avatar = Wav2LipAvatar(wav2lip_url=self.settings.wav2lip_url)
```

### 2. Pipeline Integration

```python
# Avatar is passed to CascadingPipeline
pipeline = CascadingPipeline(
    stt=stt,
    tts=tts,
    llm=llm,
    vad=vad,
    turn_detector=turn_detector,
    denoise=denoise,
    avatar=avatar  # Wav2Lip avatar
)
```

### 3. Room Integration

```python
# Avatar is passed to RoomOptions
room_options = RoomOptions(
    room_id=room_id,
    auth_token=agent_token,
    name="KYC AI Agent",
    playground=False,
    vision=True,
    avatar=self.wav2lip_avatar  # Wav2Lip avatar
)
```

### 4. Stream Processing Flow

1. **Text Input**: Agent generates text response
2. **Text to Wav2Lip**: `send_text()` sends text to Wav2Lip API
3. **Video Generation**: Wav2Lip API generates lip-sync video frames
4. **Stream Reading**: `_stream_reader()` reads frames from SSE stream
5. **Frame Processing**: Frames are decoded and added to video track queue
6. **VideoSDK Streaming**: `recv()` provides frames to VideoSDK
7. **UI Display**: VideoSDK streams frames to frontend

## External API Integration

### Wav2Lip API Endpoints

1. **`/lip-sync-stream`** (POST)

    - **Purpose**: Start real-time video stream
    - **Input**: `text` (required), `lang` (optional)
    - **Output**: Server-Sent Events (SSE) stream with video frames
    - **Format**: `data: {"frame": "base64_encoded_frame"}`

2. **`/lip-sync`** (POST)

    - **Purpose**: Generate lip-sync for specific text
    - **Input**: `text`, `lang`
    - **Output**: Processed video frames

3. **`/stop-stream`** (POST)
    - **Purpose**: Stop the current stream
    - **Input**: None
    - **Output**: Confirmation

## Configuration

### Environment Variables

```env
WAV2LIP_ENABLED=true
WAV2LIP_URL=http://35.207.229.235:8001
```

### Settings Integration

```python
# In utils/config/settings.py
wav2lip_enabled: bool = Field(default=True, alias="WAV2LIP_ENABLED")
wav2lip_url: str = Field(default="http://35.207.229.235:8001", alias="WAV2LIP_URL")
```

## VideoSDK Interface Compliance

The plugin implements the required VideoSDK avatar interface:

```python
class Wav2LipAvatar:
    async def connect(self, room_id: str = None, participant_id: str = None, token: str = None):
        """Required by VideoSDK pipeline"""

    async def disconnect(self):
        """Required by VideoSDK pipeline"""

    async def send_audio(self, audio_data: bytes):
        """Required by VideoSDK pipeline"""

    async def send_text(self, text: str):
        """Required by VideoSDK pipeline"""

    # VideoSDK expects these attributes
    video_track: CustomVideoTrack
    audio_track: Optional[AudioTrack] = None
```

## Error Handling

### Stream Processing Errors

-   **Chunk Size Issues**: Handled with chunked reading (1KB chunks)
-   **JSON Parsing Errors**: Graceful error handling with logging
-   **Frame Processing Errors**: Fallback to blank frames

### Connection Errors

-   **API Unavailable**: Graceful degradation, agent continues without avatar
-   **Stream Interruption**: Automatic reconnection attempts
-   **Resource Cleanup**: Proper cleanup on disconnect

## Performance Optimizations

### Frame Queue Management

-   **Queue Size Limit**: Maximum 10 frames to prevent memory issues
-   **Frame Dropping**: Oldest frames dropped when queue is full
-   **Frame Rate Control**: 30 FPS timing to match video standards

### Memory Management

-   **Frame Resizing**: All frames resized to 640x480 for consistency
-   **Format Optimization**: RGB to BGR conversion for VideoSDK compatibility
-   **Resource Cleanup**: Proper cleanup of HTTP sessions and tasks

## API Endpoints

### Status Endpoint

```http
GET /api/v1/sessions/wav2lip/status
```

**Response**:

```json
{
    "status": "enabled",
    "wav2lip_url": "http://35.207.229.235:8001",
    "message": "Wav2Lip avatar is enabled and available"
}
```

## Dependencies

### Core Dependencies

-   `videosdk`: VideoSDK framework
-   `aiohttp`: Async HTTP client for API calls
-   `Pillow`: Image processing
-   `numpy`: Array operations
-   `av`: Video frame handling

### External Dependencies

-   External Wav2Lip FastAPI server
-   Network connectivity to Wav2Lip API

## Troubleshooting

### Common Issues

1. **"Chunk too big" Error**

    - **Solution**: Implemented chunked reading with 1KB chunks

2. **"on_video_delta" Error**

    - **Solution**: Proper VideoSDK avatar interface implementation

3. **Video Not Displaying**

    - **Check**: Frame format conversion (RGB to BGR)
    - **Check**: Video track queue status
    - **Check**: Frontend stream handling

4. **Stream Not Stopping**
    - **Solution**: Proper cleanup in `disconnect()` method
    - **Solution**: Session cleanup in `delete_session` API

## Future Enhancements

1. **Audio Integration**: Direct audio streaming to Wav2Lip API
2. **Multiple Avatars**: Support for different avatar types
3. **Quality Control**: Dynamic quality adjustment based on network
4. **Caching**: Frame caching for better performance
5. **Metrics**: Performance monitoring and analytics

## Conclusion

The Wav2Lip Avatar Plugin provides a seamless integration between VideoSDK's agent framework and external lip-sync services. It follows VideoSDK's patterns and interfaces while providing robust error handling and performance optimizations. The plugin architecture is modular and extensible, making it easy to adapt to different avatar services or requirements.
