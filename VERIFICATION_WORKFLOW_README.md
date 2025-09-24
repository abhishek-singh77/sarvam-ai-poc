# Flexible Verification Workflow Implementation

This document describes the implementation of a flexible verification workflow system that supports various verification steps including selfie capture, liveness detection, face matching, fuzzy matching, and ID document verification using Digio APIs.

## Overview

The verification workflow system allows for flexible, configurable verification processes where steps can be defined in any order through a JSON configuration. The system integrates with Digio APIs for various verification operations and provides both backend and frontend components.

## Architecture

### Backend Components

#### 1. Digio Service (`enterprise_app/services/digio_service.py`)

-   **Purpose**: Handles integration with Digio APIs
-   **Features**:
    -   Liveness detection
    -   Face matching between images
    -   Fuzzy text matching
    -   ID document verification
    -   Batch verification processing
    -   Health checks
    -   Mock mode for testing

#### 2. Verification Agent (`enterprise_app/core/agents/verification_agent.py`)

-   **Purpose**: Manages verification workflow steps
-   **Features**:
    -   Handles different verification step types
    -   Processes workflow steps asynchronously
    -   Manages verification results
    -   Provides status updates and error handling

#### 3. Verification Workflow (`enterprise_app/core/workflows/verification_workflow.py`)

-   **Purpose**: Orchestrates the verification process
-   **Features**:
    -   Flexible step execution
    -   Conditional flows
    -   Data mapping and storage
    -   Progress tracking
    -   Error handling and retry logic

#### 4. Verification Factory (`enterprise_app/core/workflows/verification_factory.py`)

-   **Purpose**: Creates and manages verification workflows
-   **Features**:
    -   Workflow template loading
    -   Custom workflow creation
    -   Active workflow management
    -   Cleanup operations

#### 5. API Endpoints (`enterprise_app/api/v1/workflows.py`)

-   **Purpose**: Exposes verification functionality via REST API
-   **Endpoints**:
    -   `POST /verification/liveness` - Liveness detection
    -   `POST /verification/face-match` - Face matching
    -   `POST /verification/fuzzy-match` - Fuzzy text matching
    -   `POST /verification/id-verification` - ID document verification
    -   `POST /verification/batch` - Batch verification
    -   `GET /verification/health` - Health check

### Frontend Components

#### 1. Verification Component (`web/src/app/components/verification/`)

-   **Purpose**: User interface for verification workflow
-   **Features**:
    -   Step-by-step verification process
    -   Camera integration for selfie capture
    -   File upload for ID documents
    -   Real-time progress tracking
    -   Results display
    -   Error handling

#### 2. Enterprise API Service (`web/src/app/services/enterprise-api.service.ts`)

-   **Purpose**: Frontend service for API communication
-   **Features**:
    -   Verification API methods
    -   File upload handling
    -   Error handling
    -   Response processing

## Workflow Configuration

### JSON Schema

The verification workflow is defined using a JSON configuration file:

```json
{
    "name": "Flexible Verification Workflow",
    "description": "A flexible workflow that supports various verification steps",
    "version": "1.0.0",
    "workflow_type": "verification",
    "settings": {
        "timeout_minutes": 30,
        "max_retries": 3,
        "enable_parallel_steps": false,
        "allow_step_reordering": true,
        "require_all_steps": false
    },
    "steps": [
        {
            "id": "introduction",
            "type": "introduction",
            "title": "Welcome to Verification",
            "description": "Welcome to our verification process",
            "status": "pending",
            "order": 1,
            "required": true,
            "instructions": "Welcome the user and explain the verification process"
        },
        {
            "id": "selfie_capture",
            "type": "selfie_capture",
            "title": "Capture Selfie",
            "description": "Please capture a clear selfie for verification purposes",
            "status": "pending",
            "order": 2,
            "required": true,
            "instructions": "Look directly at the camera and ensure good lighting",
            "data": {
                "image_quality": "high",
                "max_attempts": 3,
                "validation_rules": {
                    "min_face_size": 0.1,
                    "max_face_size": 0.8,
                    "required_landmarks": ["eyes", "nose", "mouth"]
                }
            }
        }
        // ... more steps
    ],
    "conditional_flows": {
        "face_match_failed": {
            "condition": "face_match_verification.status == 'failed'",
            "actions": [
                {
                    "type": "retry_step",
                    "step_id": "selfie_capture",
                    "max_retries": 2
                }
            ]
        }
    },
    "data_mapping": {
        "selfie_capture": {
            "output_field": "selfie_image",
            "storage_type": "file",
            "format": "base64"
        }
    }
}
```

### Step Types

1. **introduction** - Welcome and instructions
2. **selfie_capture** - Camera-based selfie capture
3. **liveness_detection** - Liveness verification using Digio API
4. **id_document_upload** - ID document file upload
5. **face_match_verification** - Face matching between selfie and ID photo
6. **id_proof_verification** - ID document authenticity verification
7. **fuzzy_name_match** - Text matching between user input and extracted data
8. **additional_verification** - Custom verification checks
9. **completion** - Workflow completion and results

## API Integration

### Digio API Configuration

Set the following environment variables:

```bash
DIGIO_API_KEY=your_digio_api_key
DIGIO_API_SECRET=your_digio_api_secret
DIGIO_BASE_URL=https://api.digio.in/v1
DIGIO_TIMEOUT=30
```

### API Methods

#### Liveness Detection

```python
async def liveness_detection(self, image_data, **kwargs):
    # Performs liveness detection on an image
    # Returns: liveness_score, is_live, confidence
```

#### Face Matching

```python
async def face_match(self, source_image, target_image, **kwargs):
    # Compares faces between two images
    # Returns: match_score, is_match, confidence
```

#### Fuzzy Matching

```python
async def fuzzy_match(self, source_text, target_text, **kwargs):
    # Performs fuzzy text matching
    # Returns: match_score, is_match, confidence
```

#### ID Verification

```python
async def id_verification(self, document_image, **kwargs):
    # Verifies ID document authenticity and extracts data
    # Returns: is_authentic, confidence, extracted_data
```

## Usage

### Backend Usage

1. **Create a verification workflow**:

```python
from core.workflows.verification_factory import verification_workflow_factory

workflow = verification_workflow_factory.create_workflow(
    workflow_id="verification_001",
    workflow_type="verification"
)
```

2. **Start the workflow**:

```python
await workflow.start_workflow(
    session_id="session_123",
    room_id="room_456"
)
```

3. **Execute steps**:

```python
result = await workflow.execute_step(
    step_id="selfie_capture",
    data={"image": "base64_image_data"}
)
```

### Frontend Usage

1. **Navigate to verification**:

```typescript
this.router.navigate(['/verification'])
```

2. **Start verification step**:

```typescript
await this.startVerificationStep(step)
```

3. **Handle verification results**:

```typescript
const result = await this.apiService.performLivenessDetection(imageFile)
```

## Error Handling

The system includes comprehensive error handling:

-   **API Errors**: Network failures, authentication issues
-   **Validation Errors**: Invalid input data, missing required fields
-   **Workflow Errors**: Step failures, timeout issues
-   **User Errors**: Camera access denied, file upload failures

## Security Considerations

1. **API Keys**: Store Digio API credentials securely
2. **Data Privacy**: Handle personal data according to regulations
3. **File Uploads**: Validate file types and sizes
4. **Image Processing**: Secure handling of biometric data

## Testing

### Mock Mode

The Digio service includes a mock mode for testing:

```python
# Set mock_mode = True in DigioService
# Returns simulated responses for all API calls
```

### Unit Tests

Run tests for individual components:

```bash
# Backend tests
python -m pytest enterprise_app/tests/

# Frontend tests
ng test
```

## Deployment

### Backend Deployment

1. Install dependencies:

```bash
pip install -r enterprise_app/requirements.txt
```

2. Set environment variables:

```bash
export DIGIO_API_KEY=your_key
export DIGIO_API_SECRET=your_secret
```

3. Start the server:

```bash
uvicorn enterprise_app.main:app --host 0.0.0.0 --port 8000
```

### Frontend Deployment

1. Install dependencies:

```bash
cd web && npm install
```

2. Build the application:

```bash
ng build --configuration production
```

3. Serve the built files using a web server

## Monitoring and Logging

The system includes comprehensive logging:

-   **Workflow Progress**: Step completion, timing
-   **API Calls**: Request/response logging
-   **Error Tracking**: Detailed error information
-   **Performance Metrics**: Response times, success rates

## Future Enhancements

1. **Additional Verification Types**: Voice verification, document OCR
2. **Workflow Templates**: Pre-built templates for common use cases
3. **Analytics Dashboard**: Real-time verification metrics
4. **Multi-language Support**: Internationalization
5. **Mobile App**: Native mobile application
6. **Webhook Integration**: Real-time notifications
7. **Audit Trail**: Complete verification history

## Support

For technical support or questions about the verification workflow implementation, please refer to the main project documentation or contact the development team.
