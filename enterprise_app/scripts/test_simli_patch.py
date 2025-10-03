#!/usr/bin/env python3
"""
Test script for the patched Simli plugin
"""

import asyncio
import logging
import sys
import os

# Add the project root to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from patches.simli_patch import SimliAvatar, SimliConfig
from config.simli_config import get_simli_config

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_simli_patch():
    """Test the patched Simli plugin"""
    
    try:
        logger.info("🧪 Testing patched Simli plugin...")
        
        # Get configuration
        config = get_simli_config()
        logger.info(f"✅ Configuration loaded: {config.faceId}")
        
        # Create patched Simli avatar
        avatar = SimliAvatar(config)
        logger.info("✅ Patched Simli avatar created")
        
        # Test statistics
        stats = avatar.get_stats()
        logger.info(f"📊 Initial stats: {stats}")
        
        # Test start/stop cycle
        logger.info("🚀 Starting avatar...")
        await avatar.start()
        
        # Wait a bit to simulate usage
        logger.info("⏳ Simulating usage for 5 seconds...")
        await asyncio.sleep(5)
        
        # Check stats during usage
        stats = avatar.get_stats()
        logger.info(f"📊 Stats during usage: {stats}")
        
        # Stop the avatar
        logger.info("🛑 Stopping avatar...")
        await avatar.stop()
        
        logger.info("✅ Test completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_simli_patch())
