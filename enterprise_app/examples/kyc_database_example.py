#!/usr/bin/env python3
"""
Example script showing how to use the KYC database models.

This script demonstrates how to create and manage KYC requests, actions, and sub-actions
using the standardized database schema.
"""

import asyncio
import json
from datetime import datetime, timedelta
from services.database_service import database_service

async def main():
    """Main example function."""
    
    print("🚀 KYC Database Example")
    print("=" * 50)
    
    try:
        # Example 1: Create a KYC Request
        print("\n📋 Creating KYC Request...")
        
        kyc_request_data = {
            "id": "req_001",
            "client_reference_id": "client_123",
            "owner_id": "owner_456",
            "sub_user_id": "user_789",
            "customer_identifier": "customer_001",
            "customer_name": "John Doe",
            "transaction_id": "txn_001",
            "expire_in_days": 30,
            "status": "active",
            "template_id": "kyc_template_v1",
            "request_details": "Standard KYC verification for new customer",
            "is_internal": 0,
            "initiated_at": datetime.utcnow()
        }
        
        kyc_request = await database_service.create_kyc_request(kyc_request_data)
        print(f"✅ Created KYC Request: {kyc_request['id']}")
        
        # Example 2: Create a KYC Action (Selfie Capture)
        print("\n📸 Creating KYC Action (Selfie Capture)...")
        
        kyc_action_data = {
            "id": "action_001",
            "request_id": "req_001",
            "owner_id": "owner_456",
            "sub_user_id": "user_789",
            "title": "Selfie Capture",
            "type": "selfie_capture",
            "description": "Capture customer selfie for verification",
            "status": "pending",
            "method": "camera",
            "allow_image_upload": 1,
            "verification_method": "liveness_detection",
            "created_at": datetime.utcnow()
        }
        
        kyc_action = await database_service.create_kyc_action(kyc_action_data)
        print(f"✅ Created KYC Action: {kyc_action['id']}")
        
        # Example 3: Create KYC Sub-Actions
        print("\n🔍 Creating KYC Sub-Actions...")
        
        # Sub-action 1: Image Upload
        sub_action_1_data = {
            "id": "sub_action_001",
            "action_id": "action_001",
            "owner_id": "owner_456",
            "sub_user_id": "user_789",
            "type": "image_upload",
            "title": "Upload Selfie Image",
            "description": "Customer uploads selfie image",
            "status": "pending",
            "sub_action_step": "PRE",
            "input_data": json.dumps({
                "file_type": "image/jpeg",
                "max_size": "5MB",
                "allowed_formats": ["jpg", "jpeg", "png"]
            })
        }
        
        sub_action_1 = await database_service.create_kyc_sub_action(sub_action_1_data)
        print(f"✅ Created Sub-Action 1: {sub_action_1['id']}")
        
        # Sub-action 2: Liveness Detection
        sub_action_2_data = {
            "id": "sub_action_002",
            "action_id": "action_001",
            "owner_id": "owner_456",
            "sub_user_id": "user_789",
            "type": "liveness_detection",
            "title": "Liveness Detection",
            "description": "Verify that the selfie is from a live person",
            "status": "pending",
            "sub_action_step": "PROCESS",
            "input_data": json.dumps({
                "threshold": 0.8,
                "liveness_type": "passive",
                "return_face_attributes": True
            })
        }
        
        sub_action_2 = await database_service.create_kyc_sub_action(sub_action_2_data)
        print(f"✅ Created Sub-Action 2: {sub_action_2['id']}")
        
        # Sub-action 3: Face Match (if needed)
        sub_action_3_data = {
            "id": "sub_action_003",
            "action_id": "action_001",
            "owner_id": "owner_456",
            "sub_user_id": "user_789",
            "type": "face_match",
            "title": "Face Match Verification",
            "description": "Match selfie with ID document photo",
            "status": "pending",
            "sub_action_step": "PROCESS",
            "optional": 1,  # This is optional
            "input_data": json.dumps({
                "source_image": "selfie_image",
                "target_image": "id_document_photo",
                "threshold": 0.75,
                "extraction_method": "automatic"
            })
        }
        
        sub_action_3 = await database_service.create_kyc_sub_action(sub_action_3_data)
        print(f"✅ Created Sub-Action 3: {sub_action_3['id']}")
        
        # Example 4: Retrieve and display data
        print("\n📊 Retrieving created data...")
        
        # Get KYC Request
        retrieved_request = await database_service.get_kyc_request_by_id("req_001")
        if retrieved_request:
            print(f"📋 KYC Request: {retrieved_request['id']} - Status: {retrieved_request['status']}")
        
        # Get KYC Action
        retrieved_action = await database_service.get_kyc_action_by_id("action_001")
        if retrieved_action:
            print(f"📸 KYC Action: {retrieved_action['id']} - Type: {retrieved_action['type']}")
        
        # Get Sub-Actions
        sub_actions = await database_service.get_kyc_sub_actions_by_action_id("action_001")
        print(f"🔍 Found {len(sub_actions)} sub-actions:")
        for sub_action in sub_actions:
            print(f"   - {sub_action['id']}: {sub_action['title']} ({sub_action['status']})")
        
        # Example 5: Create a Workflow Template
        print("\n📋 Creating KYC Workflow Template...")
        
        workflow_template_data = {
            "id": "kyc_template_v1",
            "owner_id": "owner_456",
            "name": "Standard KYC Verification",
            "type": "kyc",
            "is_electronic": 1,
            "version": 1,
            "actionable": json.dumps({
                "steps": [
                    {
                        "id": "selfie_capture",
                        "type": "selfie_capture",
                        "title": "Selfie Capture",
                        "required": True,
                        "order": 1
                    },
                    {
                        "id": "liveness_detection",
                        "type": "liveness_detection",
                        "title": "Liveness Detection",
                        "required": True,
                        "order": 2
                    },
                    {
                        "id": "face_match",
                        "type": "face_match",
                        "title": "Face Match",
                        "required": False,
                        "order": 3
                    }
                ]
            }).encode(),
            "workflow_structure": json.dumps({
                "name": "Standard KYC",
                "description": "Standard KYC verification workflow",
                "version": "1.0",
                "steps": [
                    {
                        "id": "selfie_capture",
                        "type": "selfie_capture",
                        "title": "Selfie Capture",
                        "description": "Capture customer selfie",
                        "required": True,
                        "order": 1,
                        "sub_actions": [
                            {
                                "id": "image_upload",
                                "type": "image_upload",
                                "title": "Upload Image",
                                "step": "PRE"
                            },
                            {
                                "id": "liveness_check",
                                "type": "liveness_detection",
                                "title": "Liveness Check",
                                "step": "PROCESS"
                            }
                        ]
                    }
                ]
            }).encode(),
            "active": 1,
            "description": "Standard KYC verification workflow for new customers"
        }
        
        workflow_template = await database_service.create_kyc_workflow_template(workflow_template_data)
        print(f"✅ Created Workflow Template: {workflow_template['id']}")
        
        print("\n🎉 Example completed successfully!")
        print("\n📝 Summary:")
        print(f"   - Created 1 KYC Request: {kyc_request['id']}")
        print(f"   - Created 1 KYC Action: {kyc_action['id']}")
        print(f"   - Created 3 KYC Sub-Actions")
        print(f"   - Created 1 Workflow Template: {workflow_template['id']}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Close database connections
        await database_service.close()

if __name__ == "__main__":
    asyncio.run(main())
