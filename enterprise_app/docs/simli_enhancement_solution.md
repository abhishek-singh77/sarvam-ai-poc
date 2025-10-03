# Simli Plugin Enhancement Solution

## Problem Description

The original Simli plugin was causing several critical issues:

1. **Log Flooding**: During idle periods, the plugin would continuously log "None audio frame" warnings, flooding the logs and making debugging difficult
2. **System Instability**: The excessive logging would eventually cause the LLM and Simli to fail, requiring server restarts
3. **Missing Methods**: The patched version was missing the `connect()` method required by VideoSDK
4. **Event Loop Issues**: Initialization failures due to event loop not being properly initialized

## Solution Overview

I've created an enhanced Simli plugin that:

1. **Inherits from Original**: Properly inherits from the original `SimliAvatar` class to maintain full compatibility
2. **Rate-Limited Logging**: Implements intelligent logging that prevents log flooding during idle periods
3. **Enhanced Error Handling**: Provides better error handling and graceful degradation
4. **Idle Detection**: Monitors for idle periods and adjusts processing frequency accordingly
5. **Comprehensive Monitoring**: Provides detailed statistics for debugging and monitoring

## Key Components

### 1. RateLimitedLogger Class

```python
class RateLimitedLogger:
    def __init__(self, max_logs_per_minute=5):
        self.max_logs_per_minute = max_logs_per_minute
        self.log_times = deque()

    def should_log(self) -> bool:
        # Only allows a limited number of logs per minute
        # Prevents log flooding during idle periods
```

### 2. Enhanced SimliAvatar Class

```python
class SimliAvatar(OriginalSimliAvatar):
    def __init__(self, config: SimliConfig, simli_url: str = None, is_trinity_avatar: bool = False):
        # Inherits from original SimliAvatar
        super().__init__(config, simli_url, is_trinity_avatar)

        # Enhanced error tracking
        self.consecutive_none_frames = 0
        self.max_consecutive_none_frames = 100
        self.last_audio_frame_time = time.time()
        self.idle_threshold = 30.0
```

### 3. Enhanced Audio Track Wrapper

```python
class EnhancedSimliAudioTrack:
    async def recv(self):
        frame = await self.original_track.recv()

        if frame is None:
            self.consecutive_none_frames += 1

            # Only log if we haven't exceeded the rate limit
            if none_frame_logger.should_log():
                logger.warning(f"Simli: Received None audio frame (consecutive: {self.consecutive_none_frames})")

        return frame
```

## Configuration

The enhanced plugin can be configured through environment variables:

```bash
# Maximum logs per minute for None frame warnings
SIMLI_MAX_LOGS_PER_MINUTE=3

# Maximum consecutive None frames before considering stream idle
SIMLI_MAX_CONSECUTIVE_NONE_FRAMES=100

# Idle threshold in seconds
SIMLI_IDLE_THRESHOLD=30.0

# Enable idle monitoring
SIMLI_ENABLE_IDLE_MONITORING=true
```

## Usage

The enhanced plugin is automatically used when available:

```python
# In proper_agent_service.py
try:
    from patches.simli_patch import SimliAvatar as PatchedSimliAvatar
    from config.simli_config import get_simli_config
    USE_PATCHED_SIMLI = True
    logger.info("🎭 Using patched Simli plugin with enhanced error handling")
except ImportError:
    USE_PATCHED_SIMLI = False
    logger.info("🎭 Using standard Simli plugin")
```

## Benefits

1. **Reduced Log Noise**: Rate-limited logging prevents log flooding during idle periods
2. **Better Stability**: Enhanced error handling prevents system crashes
3. **Improved Performance**: Idle detection reduces CPU usage during quiet periods
4. **Full Compatibility**: Inherits from original class, maintaining all functionality
5. **Enhanced Monitoring**: Provides detailed statistics for debugging

## Testing

A test script is available to verify the enhanced plugin:

```bash
cd enterprise_app
python scripts/test_enhanced_simli.py
```

## Monitoring

The enhanced plugin provides comprehensive statistics:

```python
stats = avatar.get_stats()
# Returns:
# {
#     "consecutive_none_frames": 0,
#     "time_since_last_frame": 0.023,
#     "is_speaking": False,
#     "is_running": True,
#     "is_stopping": False,
#     "avatar_speaking": False,
#     "last_error": None
# }
```

## Fallback Strategy

If the enhanced plugin fails to load, the system automatically falls back to the standard Simli plugin:

```python
if USE_PATCHED_SIMLI:
    simli_avatar = PatchedSimliAvatar(config=simli_config)
else:
    simli_avatar = SimliAvatar(config=simli_config)
```

## Troubleshooting

### Common Issues

1. **Import Errors**: Ensure the patches directory is in the Python path
2. **Configuration Issues**: Check environment variables are set correctly
3. **API Key Issues**: Verify Simli API credentials are valid

### Debug Mode

Enable debug logging to see detailed information:

```python
import logging
logging.getLogger('patches.simli_patch').setLevel(logging.DEBUG)
```

## Future Enhancements

1. **Dynamic Rate Limiting**: Adjust rate limits based on system load
2. **Health Monitoring**: Add health checks and automatic recovery
3. **Performance Metrics**: Track performance metrics and optimization opportunities
4. **Configuration UI**: Add web interface for configuration management

## Conclusion

The enhanced Simli plugin provides a robust solution to the logging and stability issues while maintaining full compatibility with the original VideoSDK integration. The rate-limited logging and idle detection features ensure the system remains stable during idle periods, preventing the log flooding that was causing system failures.
