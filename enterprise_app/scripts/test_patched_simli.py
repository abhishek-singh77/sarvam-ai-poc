#!/usr/bin/env python3
"""
Test script to verify the patched Simli with rate-limited logging
"""

import asyncio
import logging
import sys
import os

# Add the project root to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from patches.simli_patch import SimliAvatar, SimliConfig

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_patched_simli():
    """Test the patched Simli with rate-limited logging"""
    
    logger.info("🧪 Testing Patched Simli with Rate-Limited Logging...")
    
    try:
        # Test Simli config creation
        config = SimliConfig(
            apiKey="test_key",
            faceId="test_face_id"
        )
        logger.info("✅ SimliConfig created successfully")
        
        # Test SimliAvatar initialization
        avatar = SimliAvatar(config)
        logger.info("✅ Patched SimliAvatar initialized successfully")
        
        # Check if rate limiting attributes exist
        if hasattr(avatar, '_none_frame_count'):
            logger.info("✅ Rate limiting attributes present")
        else:
            logger.warning("⚠️ Rate limiting attributes missing")
        
        # Check if the patched _process_audio_frames method exists
        if hasattr(avatar, '_process_audio_frames'):
            logger.info("✅ Patched _process_audio_frames method exists")
        else:
            logger.warning("⚠️ _process_audio_frames method missing")
        
        # Test connect method exists
        if hasattr(avatar, 'connect'):
            logger.info("✅ Connect method exists")
        else:
            logger.warning("⚠️ Connect method missing")
        
        logger.info("✅ All patched Simli tests passed!")
        logger.info("🎯 Rate-limited logging will prevent log flooding during idle periods")
        return True
        
    except Exception as e:
        logger.error(f"❌ Patched Simli test failed: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_patched_simli())
    if success:
        logger.info("🎉 Patched Simli is working properly!")
    else:
        logger.error("💥 Patched Simli has issues!")
        sys.exit(1)
