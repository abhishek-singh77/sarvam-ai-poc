# Simli Avatar Integration Guide

This document explains how the Simli Avatar plugin has been integrated into the VideoSDK cascading pipeline for the Enterprise AI Video KYC System.

## Overview

The Simli Avatar plugin provides real-time, lip-synced AI avatars that can be integrated into VideoSDK agent sessions. This integration allows the KYC voice agent to have a visual representation during conversations, enhancing the user experience.

## Integration Details

### 1. Dependencies Added

The following dependency has been added to `requirements.txt`:

```
videosdk-plugins-simli
```

### 2. Configuration

#### Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Simli Avatar Configuration
SIMLI_API_KEY=your_simli_api_key
SIMLI_FACE_ID=your_simli_face_id  # Optional
SIMLI_MAX_SESSION_LENGTH=1800     # Optional: defaults to 1800 seconds (30 minutes)
SIMLI_MAX_IDLE_TIME=300           # Optional: defaults to 300 seconds (5 minutes)
```

#### Settings Configuration

The following configuration has been added to `utils/config/settings.py`:

```python
# Simli Avatar Configuration
simli_api_key: Optional[str] = Field(default=None, alias="SIMLI_API_KEY")
simli_face_id: Optional[str] = Field(default=None, alias="SIMLI_FACE_ID")
simli_max_session_length: int = Field(default=1800, alias="SIMLI_MAX_SESSION_LENGTH")
simli_max_idle_time: int = Field(default=300, alias="SIMLI_MAX_IDLE_TIME")
```

### 3. Pipeline Integration

The Simli Avatar has been integrated into the cascading pipeline in `services/proper_agent_service.py`:

```python
# Initialize Simli Avatar if API key is provided
avatar = None
if self.settings.simli_api_key:
    try:
        simli_config = SimliConfig(
            apiKey=self.settings.simli_api_key,
            faceId=self.settings.simli_face_id,
            maxSessionLength=self.settings.simli_max_session_length,
            maxIdleTime=self.settings.simli_max_idle_time
        )
        avatar = SimliAvatar(config=simli_config)
        logger.info("✅ Simli Avatar initialized successfully")
    except Exception as e:
        logger.warning(f"⚠️ Failed to initialize Simli Avatar: {e}")
        logger.info("🎯 Continuing without avatar - voice-only mode")
else:
    logger.info("🎯 No Simli API key provided - running in voice-only mode")

# Create the cascading pipeline with all components
pipeline = CascadingPipeline(
    stt=stt,
    tts=tts,
    llm=llm,
    vad=vad,
    turn_detector=turn_detector,
    denoise=denoise,
    avatar=avatar  # Add avatar to pipeline if available
)
```

## Features

### 1. Graceful Fallback

The integration includes graceful fallback behavior:

-   If no Simli API key is provided, the system runs in voice-only mode
-   If avatar initialization fails, the system continues without the avatar
-   All functionality remains intact regardless of avatar availability

### 2. Configuration Flexibility

-   **Optional Face ID**: You can specify a custom face ID or use the default
-   **Session Management**: Configurable session length and idle timeout
-   **Environment-based**: All configuration is handled through environment variables

### 3. Error Handling

The integration includes comprehensive error handling:

-   Catches initialization errors and logs warnings
-   Continues operation even if avatar fails to initialize
-   Provides clear logging for debugging

## Usage

### 1. Setup

1. Install the new dependency:

    ```bash
    pip install videosdk-plugins-simli
    ```

2. Set your Simli API key in the environment:

    ```bash
    export SIMLI_API_KEY="your_simli_api_key"
    ```

3. Optionally set a custom face ID:
    ```bash
    export SIMLI_FACE_ID="your_face_id"
    ```

### 2. Running the Application

The avatar will automatically be included in the pipeline when:

-   A valid Simli API key is provided
-   The avatar initializes successfully

If no API key is provided or initialization fails, the system will run in voice-only mode with appropriate logging.

## Benefits

1. **Enhanced User Experience**: Visual representation of the AI agent
2. **Real-time Lip Sync**: Avatar mouth movements sync with generated speech
3. **Professional Appearance**: More engaging and professional KYC sessions
4. **Flexible Integration**: Works with existing pipeline components
5. **Graceful Degradation**: Falls back to voice-only mode if needed

## Troubleshooting

### Common Issues

1. **Avatar not appearing**:

    - Check if `SIMLI_API_KEY` is set correctly
    - Verify the API key is valid and has sufficient credits
    - Check logs for initialization errors

2. **422 Unprocessable Entity Error**:

    - **Invalid API Key**: The API key format is incorrect or expired
    - **Insufficient Credits**: Your Simli account has run out of credits
    - **Network Issues**: Connection problems to Simli servers
    - **API Key Permissions**: The API key doesn't have the required permissions

3. **Audio Track Errors**:

    - **"Audio track or loop not initialized"**: This is normal when avatar fails to connect
    - **Solution**: The system automatically falls back to voice-only mode
    - **Check**: Verify avatar initialization in logs

4. **Avatar initialization fails**:

    - Ensure the Simli plugin is properly installed
    - Check network connectivity
    - Verify API key permissions

5. **Performance issues**:
    - Adjust `SIMLI_MAX_SESSION_LENGTH` and `SIMLI_MAX_IDLE_TIME`
    - Monitor system resources during avatar sessions

### Logs to Monitor

Look for these log messages:

-   `✅ Simli Avatar initialized successfully` - Avatar is working
-   `🎯 No Simli API key provided - running in voice-only mode` - No API key
-   `⚠️ Failed to initialize Simli Avatar` - Initialization failed

## Future Enhancements

Potential future improvements:

1. Multiple avatar options based on user preferences
2. Dynamic avatar switching during sessions
3. Avatar customization through the UI
4. Performance monitoring and optimization
5. Integration with other avatar providers

## Support

For issues related to:

-   **Simli API**: Contact Simli support
-   **VideoSDK Integration**: Check VideoSDK documentation
-   **Application Issues**: Check application logs and this documentation
