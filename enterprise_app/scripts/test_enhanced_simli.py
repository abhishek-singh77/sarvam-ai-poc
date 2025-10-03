#!/usr/bin/env python3
"""
Test script for the enhanced Simli plugin
"""

import asyncio
import logging
import sys
import os

# Add the project root to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from patches.simli_patch import SimliAvatar, RateLimitedLogger
from videosdk.plugins.simli import SimliConfig

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_enhanced_simli():
    """Test the enhanced Simli plugin"""
    
    logger.info("🧪 Testing Enhanced Simli Plugin...")
    
    # Test rate limiter
    logger.info("📊 Testing Rate Limiter...")
    rate_limiter = RateLimitedLogger(max_logs_per_minute=5)
    
    for i in range(10):
        if rate_limiter.should_log():
            logger.info(f"Rate limiter test {i}: Should log")
        else:
            logger.info(f"Rate limiter test {i}: Rate limited")
        await asyncio.sleep(0.1)
    
    # Test Simli config (without actual API key)
    logger.info("🎭 Testing Simli Config...")
    try:
        config = SimliConfig(
            apiKey="test_key",
            faceId="test_face_id"
        )
        logger.info("✅ SimliConfig created successfully")
        
        # Test enhanced Simli avatar initialization
        logger.info("🎭 Testing Enhanced Simli Avatar initialization...")
        avatar = SimliAvatar(config)
        logger.info("✅ Enhanced SimliAvatar initialized successfully")
        
        # Test stats
        stats = avatar.get_stats()
        logger.info(f"📊 Avatar stats: {stats}")
        
        logger.info("✅ All tests passed!")
        
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = asyncio.run(test_enhanced_simli())
    if success:
        logger.info("🎉 Enhanced Simli plugin test completed successfully!")
    else:
        logger.error("💥 Enhanced Simli plugin test failed!")
        sys.exit(1)
