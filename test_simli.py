#!/usr/bin/env python3
"""
Test script to verify Simli API credentials and avatar ID
"""

import os
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/Users/abhisheksingh/dev/frontend/pocs/sarvam-ai-videsdk/enterprise_app/.env')

def test_simli_credentials():
    """Test Simli API credentials and avatar ID"""
    
    simli_api_key = os.getenv("SIMLI_API_KEY")
    simli_avatar_id = os.getenv("SIMLI_AVATAR_ID")
    
    print("🧪 Testing Simli Credentials")
    print("=" * 50)
    
    print(f"📋 API Key: {simli_api_key[:10]}..." if simli_api_key else "❌ No API Key")
    print(f"📋 Avatar ID: {simli_avatar_id}" if simli_avatar_id else "❌ No Avatar ID")
    
    if not simli_api_key or not simli_avatar_id:
        print("❌ Missing credentials")
        return False
    
    # Test Simli API endpoint
    url = "https://api.simli.ai/startAudioToVideoSession"
    headers = {
        "Authorization": f"Bearer {simli_api_key}",
        "Content-Type": "application/json"
    }
    
    # Test payload
    payload = {
        "faceId": simli_avatar_id,
        "audioConfig": {
            "sampleRate": 16000,
            "channels": 1
        }
    }
    
    print(f"\n🔍 Testing Simli API endpoint: {url}")
    print(f"📤 Payload: {payload}")
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        print(f"📥 Response Status: {response.status_code}")
        print(f"📥 Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            print("✅ Simli API credentials are valid!")
            return True
        elif response.status_code == 422:
            print("❌ 422 Error - Invalid request parameters")
            print(f"📥 Response Body: {response.text}")
            return False
        elif response.status_code == 401:
            print("❌ 401 Error - Invalid API key")
            return False
        else:
            print(f"❌ Unexpected error: {response.status_code}")
            print(f"📥 Response Body: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return False

if __name__ == "__main__":
    test_simli_credentials()
