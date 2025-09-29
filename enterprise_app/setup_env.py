#!/usr/bin/env python3
"""
Environment setup script for the Enterprise AI Video KYC System.
This script helps configure the necessary environment variables.
"""

import os
import sys
from pathlib import Path

def setup_environment():
    """Setup environment variables for the application."""
    
    print("🔧 Enterprise AI Video KYC System - Environment Setup")
    print("=" * 60)
    
    # Check if .env file exists
    env_file = Path(".env")
    if not env_file.exists():
        print("❌ .env file not found. Please run: cp env.example .env")
        return False
    
    print("✅ .env file found")
    
    # Read current .env file
    with open(env_file, 'r') as f:
        content = f.read()
    
    # Check for placeholder values
    placeholders = {
        "VIDEOSDK_API_KEY": "your_videosdk_api_key",
        "VIDEOSDK_API_SECRET": "your_videosdk_secret", 
        "SARVAMAI_API_KEY": "your_sarvamai_api_key",
        "GOOGLE_API_KEY": "your_google_api_key",
        "SIMLI_API_KEY": "your_simli_api_key",
        "SIMLI_FACE_ID": "your_simli_face_id",
        "SIMLI_AVATAR_ID": "your_simli_avatar_id"
    }
    
    print("\n📋 Current Configuration Status:")
    print("-" * 40)
    
    needs_setup = []
    for key, placeholder in placeholders.items():
        if placeholder in content:
            print(f"❌ {key}: Not configured (placeholder value)")
            needs_setup.append(key)
        else:
            print(f"✅ {key}: Configured")
    
    if needs_setup:
        print(f"\n⚠️  {len(needs_setup)} environment variables need to be configured.")
        print("\nTo fix the Simli Avatar issues (following VideoSDK docs):")
        print("1. Get a valid Simli API key from Simli Dashboard")
        print("2. Update SIMLI_API_KEY in your .env file")
        print("3. Set SIMLI_AVATAR_ID for the avatar (following working repo pattern)")
        print("4. Optionally set SIMLI_FACE_ID for a custom face")
        print("5. Reference: https://docs.videosdk.live/ai_agents/plugins/avatar/simli")
        print("\nFor voice-only mode (no avatar):")
        print("1. Leave SIMLI_API_KEY as placeholder")
        print("2. The system will automatically run in voice-only mode")
        
        print(f"\n📝 Edit your .env file and update these variables:")
        for key in needs_setup:
            print(f"   - {key}")
    else:
        print("\n✅ All environment variables are configured!")
    
    print("\n🎯 Simli Avatar Status:")
    if "SIMLI_API_KEY" in needs_setup:
        print("❌ Simli Avatar: Will run in voice-only mode (no avatar)")
        print("   This is expected and will work fine for KYC sessions")
    else:
        print("✅ Simli Avatar: Configured - avatar should be visible")
    
    print("\n🔊 Audio Status:")
    if "SARVAMAI_API_KEY" in needs_setup or "GOOGLE_API_KEY" in needs_setup:
        print("❌ TTS: May have issues - configure at least one TTS provider")
    else:
        print("✅ TTS: Configured - audio should work")
    
    return len(needs_setup) == 0

if __name__ == "__main__":
    try:
        success = setup_environment()
        if success:
            print("\n🎉 Setup complete! You can now run the application.")
        else:
            print("\n⚠️  Please configure the required environment variables.")
            sys.exit(1)
    except Exception as e:
        print(f"\n❌ Setup failed: {e}")
        sys.exit(1)
