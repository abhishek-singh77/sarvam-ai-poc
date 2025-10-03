# Simli Error Handling Configuration

## Problem

The Simli plugin logs "Received None audio frame, continuing..." warnings continuously during idle periods, flooding the logs and eventually causing the LLM and Simli to fail, requiring server restarts.

## Solution

Enhanced Simli plugin with rate-limited logging and idle detection.

## Environment Variables

Add these to your `.env` file:

```bash
# Simli Plugin Configuration
# Enhanced error handling settings to prevent log flooding

# Rate limiting for None frame warnings (logs per minute)
SIMLI_MAX_LOGS_PER_MINUTE=3

# Maximum consecutive None frames before considering stream idle
SIMLI_MAX_CONSECUTIVE_NONE_FRAMES=100

# Idle threshold in seconds (time without audio frames)
SIMLI_IDLE_THRESHOLD=30.0

# Enable idle monitoring to reduce processing during idle periods
SIMLI_ENABLE_IDLE_MONITORING=true

# Simli API Configuration
SIMLI_API_KEY=your_simli_api_key_here
SIMLI_AVATAR_ID=your_simli_avatar_id_here
```

## Features

### 1. Rate-Limited Logging

-   Limits None frame warnings to 3 per minute
-   Provides summary logs every 5 minutes if rate limit is exceeded
-   Prevents log flooding during idle periods

### 2. Idle Detection

-   Monitors consecutive None frames
-   Reduces processing frequency during idle periods
-   Adjusts sleep intervals based on activity level

### 3. Graceful Degradation

-   Continues operation even with audio stream issues
-   Provides fallback to standard Simli if patched version fails
-   Maintains system stability during extended idle periods

### 4. Enhanced Monitoring

-   Tracks consecutive None frames
-   Monitors time since last audio frame
-   Provides statistics for debugging

## Usage

The patched Simli plugin is automatically used when available. If the patch fails to load, the system falls back to the standard Simli plugin.

## Monitoring

You can monitor the Simli avatar status using the `get_stats()` method:

```python
stats = simli_avatar.get_stats()
print(f"Consecutive None frames: {stats['consecutive_none_frames']}")
print(f"Time since last frame: {stats['time_since_last_frame']}")
print(f"Is speaking: {stats['is_speaking']}")
```

## Benefits

1. **Reduced Log Noise**: Rate-limited logging prevents log flooding
2. **Better Performance**: Idle detection reduces unnecessary processing
3. **Improved Stability**: Graceful error handling prevents system failures
4. **Easier Debugging**: Clear statistics and monitoring capabilities
5. **No Server Restarts**: System continues operating during idle periods
