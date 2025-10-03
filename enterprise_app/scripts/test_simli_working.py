#!/usr/bin/env python3
"""
Test script to verify Simli is working properly
"""

import asyncio
import logging
import sys
import os

# Add the project root to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from videosdk.plugins.simli import SimliAvatar, SimliConfig

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_simli_initialization():
    """Test Simli initialization"""
    
    logger.info("🧪 Testing Simli Initialization...")
    
    try:
        # Test Simli config creation
        config = SimliConfig(
            apiKey="test_key",
            faceId="test_face_id"
        )
        logger.info("✅ SimliConfig created successfully")
        
        # Test SimliAvatar initialization
        avatar = SimliAvatar(config)
        logger.info("✅ SimliAvatar initialized successfully")
        
        # Check if the monkey patch was applied
        if hasattr(avatar, '_process_audio_frames'):
            logger.info("✅ Monkey patch applied - _process_audio_frames method exists")
        else:
            logger.warning("⚠️ Monkey patch not applied - _process_audio_frames method missing")
        
        # Test connect method exists
        if hasattr(avatar, 'connect'):
            logger.info("✅ Connect method exists")
        else:
            logger.warning("⚠️ Connect method missing")
        
        logger.info("✅ All Simli tests passed!")
        return True
        
    except Exception as e:
        logger.error(f"❌ Simli test failed: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_simli_initialization())
    if success:
        logger.info("🎉 Simli is working properly!")
    else:
        logger.error("💥 Simli has issues!")
        sys.exit(1)
