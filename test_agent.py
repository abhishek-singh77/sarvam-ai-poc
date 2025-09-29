#!/usr/bin/env python3
"""
Test script to verify the KYC agent is working properly.
This script will create a session and join an agent to test functionality.
"""

import requests
import json
import time
import sys

def test_agent_functionality():
    """Test the agent functionality by creating a session and joining an agent."""
    
    base_url = "http://localhost:8000"
    
    print("🧪 Testing KYC Agent Functionality")
    print("=" * 50)
    
    # Test 1: Health Check
    print("1. Testing server health...")
    try:
        response = requests.get(f"{base_url}/health", timeout=10)
        if response.status_code == 200:
            health_data = response.json()
            print(f"   ✅ Server is healthy: {health_data['overall_status']}")
        else:
            print(f"   ❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Health check failed: {e}")
        return False
    
    # Test 2: Create Session
    print("2. Creating KYC session...")
    try:
        session_data = {
            "workflow_type": "kyc",
            "agent_type": "kyc_agent"
        }
        response = requests.post(f"{base_url}/api/v1/sessions/create", json=session_data, timeout=10)
        if response.status_code == 200:
            session_info = response.json()
            room_id = session_info["room_id"]
            agent_token = session_info["agent"]["token"]
            agent_participant_id = session_info["agent"]["participantId"]
            print(f"   ✅ Session created: {room_id}")
            print(f"   ✅ Agent participant ID: {agent_participant_id}")
        else:
            print(f"   ❌ Session creation failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"   ❌ Session creation failed: {e}")
        return False
    
    # Test 3: Join Agent
    print("3. Joining agent to session...")
    try:
        agent_data = {
            "room_id": room_id,
            "agent_participant_id": agent_participant_id,
            "agent_token": agent_token
        }
        response = requests.post(f"{base_url}/api/v1/sessions/join-agent", json=agent_data, timeout=30)
        if response.status_code == 200:
            agent_info = response.json()
            print(f"   ✅ Agent joined successfully: {agent_info['status']}")
        else:
            print(f"   ❌ Agent join failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"   ❌ Agent join failed: {e}")
        return False
    
    # Test 4: Check Agent Status
    print("4. Checking agent status...")
    try:
        time.sleep(2)  # Give agent time to initialize
        response = requests.get(f"{base_url}/api/v1/sessions/{room_id}/agent-status", timeout=10)
        if response.status_code == 200:
            status_info = response.json()
            print(f"   ✅ Agent status: {status_info}")
        else:
            print(f"   ⚠️  Agent status check failed: {response.status_code}")
    except Exception as e:
        print(f"   ⚠️  Agent status check failed: {e}")
    
    print("\n🎉 Agent Test Complete!")
    print(f"📋 Session Details:")
    print(f"   Room ID: {room_id}")
    print(f"   Agent Participant ID: {agent_participant_id}")
    print(f"   Frontend URL: http://localhost:4200")
    print(f"   Meeting ID: {room_id}")
    
    print(f"\n🎯 Next Steps:")
    print(f"   1. Open the frontend at http://localhost:4200")
    print(f"   2. Join the meeting with ID: {room_id}")
    print(f"   3. You should be able to hear the agent speaking")
    print(f"   4. The agent will be in voice-only mode (no avatar)")
    
    return True

if __name__ == "__main__":
    try:
        success = test_agent_functionality()
        if success:
            print("\n✅ All tests passed! The agent should be working.")
        else:
            print("\n❌ Some tests failed. Check the server logs for details.")
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n🛑 Test interrupted by user.")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        sys.exit(1)
