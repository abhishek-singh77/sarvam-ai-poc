# Wav2Lip Plugin for VideoSDK Agents

This plugin provides lip-sync capabilities for AI agents by connecting to an external Wav2Lip FastAPI server.

## Features

-   **Real-time Lip-sync**: Connect to external Wav2Lip API for lip-sync processing
-   **Streaming Support**: Support for both text and voice file inputs
-   **Simple Integration**: Easy integration with VideoSDK agents framework
-   **Async Processing**: Non-blocking stream processing

## Installation

### Prerequisites

1. **Python Dependencies**: Install the required packages from `requirements.txt`:

    ```bash
    pip install aiohttp
    ```

2. **Wav2Lip Server**: Ensure the Wav2Lip FastAPI server is running at the configured URL.

## Configuration

The plugin can be configured through environment variables:

```env
# Wav2Lip Plugin Configuration
WAV2LIP_ENABLED=true
WAV2LIP_URL=http://35.207.229.235:8001
```

### Configuration Options

| Option            | Default                      | Description                       |
| ----------------- | ---------------------------- | --------------------------------- |
| `WAV2LIP_ENABLED` | `true`                       | Enable/disable the Wav2Lip plugin |
| `WAV2LIP_URL`     | `http://35.207.229.235:8001` | Base URL of the Wav2Lip server    |

## Usage

### Using with Agent Service

```python
from services.proper_agent_service import proper_agent_service

# Start Wav2Lip stream with text
result = await proper_agent_service.start_wav2lip_stream(
    text="Hello, please tell me your name"
)

# Start Wav2Lip stream with voice file
result = await proper_agent_service.start_wav2lip_stream(
    voice_file="/path/to/audio.wav"
)

# Stop the stream
result = await proper_agent_service.stop_wav2lip_stream()
```

### API Endpoints

The plugin provides REST API endpoints:

#### Start Wav2Lip Stream

```http
POST /api/v1/sessions/wav2lip/start
Content-Type: application/json

{
    "text": "Hello, please tell me your name",
    "voice_file": "/path/to/audio.wav",  // optional
    "lang": "en"  // optional, default: "en"
}
```

#### Stop Wav2Lip Stream

```http
POST /api/v1/sessions/wav2lip/stop
```

#### Get Plugin Status

```http
GET /api/v1/sessions/wav2lip/status
```

## API Reference

### Wav2LipAvatar Class

#### Methods

-   `async start(text=None, voice_file=None, lang="en")`: Start the avatar stream
-   `async stop()`: Stop the avatar stream and clean up
-   `async connect(room_id, participant_id, token)`: Connect to VideoSDK room
-   `async disconnect()`: Disconnect from VideoSDK room
-   `async send_audio(audio_data)`: Send audio data for processing
-   `async send_text(text)`: Send text for processing

#### Properties

-   `wav2lip_url`: Base URL of the Wav2Lip server
-   `session`: HTTP client session
-   `stream_task`: Async task for stream processing

## Troubleshooting

### Common Issues

1. **Connection failed**

    - Check if the Wav2Lip server is running
    - Verify the URL in configuration
    - Check network connectivity

2. **Stream not starting**
    - Ensure either `text` or `voice_file` is provided
    - Check server logs for errors
    - Verify file permissions if using voice file

### Debug Mode

Enable debug logging to troubleshoot issues:

```env
LOG_LEVEL=DEBUG
```

## Limitations

-   Requires external Wav2Lip FastAPI server
-   Depends on server availability and performance
-   Network latency affects stream quality

## References

-   [Wav2Lip: Accurately Lip-syncing Videos In The Wild](https://github.com/Rudrabha/Wav2Lip)
-   [VideoSDK Agents Documentation](https://docs.videosdk.live/)
-   [aiohttp Documentation](https://docs.aiohttp.org/)
