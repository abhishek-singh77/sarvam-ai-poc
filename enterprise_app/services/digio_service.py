#!/usr/bin/env python3
"""
Digio API Service for identity verification operations.

This service provides integration with Digio's APIs for various verification
operations including face matching, liveness detection, fuzzy matching,
and ID document verification.
"""

import asyncio
import base64
import json
import os
from typing import Dict, Any, Optional, List, Union
import aiohttp
import logging
from datetime import datetime

from utils.logging.logger import get_logger

logger = get_logger(__name__)


class DigioAPIError(Exception):
    """Custom exception for Digio API errors."""
    
    def __init__(self, message: str, status_code: Optional[int] = None, response_data: Optional[Dict] = None):
        self.message = message
        self.status_code = status_code
        self.response_data = response_data
        super().__init__(self.message)


class DigioService:
    """Service for interacting with Digio APIs."""
    
    def __init__(self):
        """Initialize the Digio service."""
        self.api_key = os.getenv('DIGIO_API_KEY')
        self.api_secret = os.getenv('DIGIO_API_SECRET')
        # Base URL for Digio API (version and client path are part of individual endpoints)
        self.base_url = os.getenv('DIGIO_BASE_URL', 'https://ext.digio.in:444')
        self.timeout = int(os.getenv('DIGIO_TIMEOUT', '30'))
        
        if not self.api_key or not self.api_secret:
            logger.warning("⚠️ Digio API credentials not found. Service will use mock responses.")
            self.mock_mode = True
        else:
            self.mock_mode = False
            
        self.session: Optional[aiohttp.ClientSession] = None
        
    async def __aenter__(self):
        """Async context manager entry."""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=self.timeout),
            headers={
                'Authorization': f'Bearer {self.api_key}' if self.api_key else '',
                'Content-Type': 'application/json',
                'User-Agent': 'SarvamAI-VideoSDK/1.0'
            }
        )
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.session:
            await self.session.close()
    
    def _get_headers(self) -> Dict[str, str]:
        """Get request headers according to Digio API documentation."""
        return {
            'Authorization': f'Bearer {self.api_key}' if self.api_key else '',
            'Content-Type': 'application/json',
            'X-API-Key': self.api_key if self.api_key else '',
            'X-API-Secret': self.api_secret if self.api_secret else '',
            'User-Agent': 'SarvamAI-VideoSDK/1.0'
        }
    
    async def _make_request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict[str, Any]:
        """Make HTTP request to Digio API."""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        if self.mock_mode:
            return await self._mock_response(endpoint, data)
        
        try:
            async with aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=self.timeout),
                headers=self._get_headers()
            ) as session:
                async with session.request(method, url, json=data) as response:
                    response_data = await response.json()
                    
                    if response.status >= 400:
                        raise DigioAPIError(
                            message=f"API request failed: {response_data.get('message', 'Unknown error')}",
                            status_code=response.status,
                            response_data=response_data
                        )
                    
                    return response_data
                    
        except aiohttp.ClientError as e:
            logger.error(f"❌ Network error calling Digio API: {e}")
            raise DigioAPIError(f"Network error: {str(e)}")
        except json.JSONDecodeError as e:
            logger.error(f"❌ JSON decode error: {e}")
            raise DigioAPIError(f"Invalid JSON response: {str(e)}")
    
    async def _mock_response(self, endpoint: str, data: Optional[Dict] = None) -> Dict[str, Any]:
        """Generate mock response for testing according to Digio API format."""
        logger.info(f"🔧 Using mock response for endpoint: {endpoint}")
        
        if 'liveness' in endpoint:
            return {
                "status": "success",
                "liveness_score": 0.95,
                "is_live": True,
                "confidence": "high",
                "face_attributes": {
                    "age_range": "25-35",
                    "gender": "male",
                    "emotion": "neutral"
                },
                "timestamp": datetime.utcnow().isoformat()
            }
        elif 'facematch' in endpoint:
            return {
                "status": "success",
                "match_score": 0.87,
                "is_match": True,
                "confidence": "high",
                "similarity_threshold": 0.75,
                "face_attributes": {
                    "source_age_range": "25-35",
                    "target_age_range": "25-35",
                    "source_gender": "male",
                    "target_gender": "male"
                },
                "timestamp": datetime.utcnow().isoformat()
            }
        elif 'fuzzymatch' in endpoint:
            return {
                "status": "success",
                "match_score": 0.92,
                "is_match": True,
                "confidence": "high",
                "normalized_source": data.get('source_text', '').lower() if data else '',
                "normalized_target": data.get('target_text', '').lower() if data else '',
                "algorithm_used": "levenshtein",
                "timestamp": datetime.utcnow().isoformat()
            }
        elif 'idverification' in endpoint:
            return {
                "status": "success",
                "is_authentic": True,
                "confidence": 0.89,
                "extracted_data": {
                    "name": "John Doe",
                    "document_number": "ABCD1234EFGH",
                    "date_of_birth": "1990-01-01",
                    "address": "123 Main St, City, State",
                    "document_type": "PAN Card",
                    "issuing_authority": "Income Tax Department",
                    "validity_period": "Lifetime"
                },
                "security_features": {
                    "watermark_detected": True,
                    "hologram_detected": True,
                    "microprint_detected": True,
                    "security_thread_detected": True
                },
                "document_type": "PAN Card",
                "timestamp": datetime.utcnow().isoformat()
            }
        else:
            return {
                "status": "success",
                "message": "Mock response",
                "timestamp": datetime.utcnow().isoformat()
            }
    
    def _encode_image(self, image_path: str) -> str:
        """Encode image file to base64."""
        try:
            with open(image_path, 'rb') as image_file:
                encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
                return encoded_string
        except Exception as e:
            logger.error(f"❌ Failed to encode image {image_path}: {e}")
            raise DigioAPIError(f"Failed to encode image: {str(e)}")
    
    async def liveness_detection(self, image_data: Union[str, bytes], **kwargs) -> Dict[str, Any]:
        """
        Perform liveness detection on an image according to Digio API documentation.
        
        Args:
            image_data: Base64 encoded image or image bytes
            **kwargs: Additional parameters (threshold, liveness_type, etc.)
            
        Returns:
            Liveness detection result with official Digio API response format
        """
        try:
            # Handle different image input types
            if isinstance(image_data, str):
                if os.path.isfile(image_data):
                    # File path provided
                    image_base64 = self._encode_image(image_data)
                else:
                    # Base64 string provided - remove data URL prefix if present
                    if image_data.startswith('data:image/'):
                        image_base64 = image_data.split(',')[1]
                    else:
                        image_base64 = image_data
            else:
                # Bytes provided
                image_base64 = base64.b64encode(image_data).decode('utf-8')
            
            # Request payload according to Digio API documentation
            request_data = {
                "image": image_base64,
                "threshold": kwargs.get('threshold', 0.8),
                "liveness_type": kwargs.get('liveness_type', 'passive'),
                "actions": kwargs.get('actions', []),
                "return_image": kwargs.get('return_image', False),
                "return_face_attributes": kwargs.get('return_face_attributes', True)
            }
            
            logger.info("🔍 Performing liveness detection using Digio API...")
            response = await self._make_request('POST', '/v1/client/kyc/liveness', request_data)
            
            # Transform response to match expected format
            result = {
                "status": "success" if response.get('status') == 'success' else "error",
                "liveness_score": response.get('liveness_score', 0.0),
                "is_live": response.get('is_live', False),
                "confidence": response.get('confidence', 'unknown'),
                "timestamp": response.get('timestamp', datetime.utcnow().isoformat()),
                "raw_response": response  # Include raw response for debugging
            }
            
            logger.info(f"✅ Liveness detection completed. Score: {result['liveness_score']}, Live: {result['is_live']}")
            return result
            
        except Exception as e:
            logger.error(f"❌ Liveness detection failed: {e}")
            raise DigioAPIError(f"Liveness detection failed: {str(e)}")
    
    async def face_match(self, source_image: Union[str, bytes], target_image: Union[str, bytes], **kwargs) -> Dict[str, Any]:
        """
        Perform face matching between two images according to Digio API documentation.
        
        Args:
            source_image: Source image (selfie)
            target_image: Target image (ID document photo)
            **kwargs: Additional parameters (match_threshold, extraction_method, etc.)
            
        Returns:
            Face match result with official Digio API response format
        """
        try:
            # Encode source image
            if isinstance(source_image, str) and os.path.isfile(source_image):
                source_base64 = self._encode_image(source_image)
            elif isinstance(source_image, str):
                # Remove data URL prefix if present
                if source_image.startswith('data:image/'):
                    source_base64 = source_image.split(',')[1]
                else:
                    source_base64 = source_image
            else:
                source_base64 = base64.b64encode(source_image).decode('utf-8')
            
            # Encode target image
            if isinstance(target_image, str) and os.path.isfile(target_image):
                target_base64 = self._encode_image(target_image)
            elif isinstance(target_image, str):
                # Remove data URL prefix if present
                if target_image.startswith('data:image/'):
                    target_base64 = target_image.split(',')[1]
                else:
                    target_base64 = target_image
            else:
                target_base64 = base64.b64encode(target_image).decode('utf-8')
            
            # Request payload according to Digio API documentation
            request_data = {
                "source_image": source_base64,
                "target_image": target_base64,
                "match_threshold": kwargs.get('match_threshold', 0.75),
                "extraction_method": kwargs.get('extraction_method', 'automatic'),
                "fallback_methods": kwargs.get('fallback_methods', []),
                "return_face_attributes": kwargs.get('return_face_attributes', True),
                "return_face_landmarks": kwargs.get('return_face_landmarks', False)
            }
            
            logger.info("🔍 Performing face match using Digio API...")
            response = await self._make_request('POST', '/v1/client/kyc/facematch', request_data)
            
            # Transform response to match expected format
            result = {
                "status": "success" if response.get('status') == 'success' else "error",
                "match_score": response.get('match_score', 0.0),
                "is_match": response.get('is_match', False),
                "confidence": response.get('confidence', 'unknown'),
                "similarity_threshold": response.get('similarity_threshold', kwargs.get('match_threshold', 0.75)),
                "timestamp": response.get('timestamp', datetime.utcnow().isoformat()),
                "raw_response": response  # Include raw response for debugging
            }
            
            logger.info(f"✅ Face match completed. Score: {result['match_score']}, Match: {result['is_match']}")
            return result
            
        except Exception as e:
            logger.error(f"❌ Face match failed: {e}")
            raise DigioAPIError(f"Face match failed: {str(e)}")
    
    async def fuzzy_match(self, source_text: str, target_text: str, **kwargs) -> Dict[str, Any]:
        """
        Perform fuzzy matching between two text strings according to Digio API documentation.
        
        Args:
            source_text: Source text (user provided)
            target_text: Target text (extracted from document)
            **kwargs: Additional parameters (match_threshold, normalization_rules, etc.)
            
        Returns:
            Fuzzy match result with official Digio API response format
        """
        try:
            # Request payload according to Digio API documentation
            request_data = {
                "source_text": source_text,
                "target_text": target_text,
                "match_threshold": kwargs.get('match_threshold', 0.85),
                "normalization_rules": kwargs.get('normalization_rules', {
                    "remove_special_chars": True,
                    "case_insensitive": True,
                    "handle_abbreviations": True,
                    "remove_extra_spaces": True,
                    "handle_unicode": True
                }),
                "algorithm": kwargs.get('algorithm', 'levenshtein'),
                "return_normalized": kwargs.get('return_normalized', True)
            }
            
            logger.info("🔍 Performing fuzzy match using Digio API...")
            response = await self._make_request('POST', '/v1/client/kyc/fuzzymatch', request_data)
            
            # Transform response to match expected format
            result = {
                "status": "success" if response.get('status') == 'success' else "error",
                "match_score": response.get('match_score', 0.0),
                "is_match": response.get('is_match', False),
                "confidence": response.get('confidence', 'unknown'),
                "normalized_source": response.get('normalized_source', source_text),
                "normalized_target": response.get('normalized_target', target_text),
                "timestamp": response.get('timestamp', datetime.utcnow().isoformat()),
                "raw_response": response  # Include raw response for debugging
            }
            
            logger.info(f"✅ Fuzzy match completed. Score: {result['match_score']}, Match: {result['is_match']}")
            return result
            
        except Exception as e:
            logger.error(f"❌ Fuzzy match failed: {e}")
            raise DigioAPIError(f"Fuzzy match failed: {str(e)}")
    
    async def id_verification(self, document_image: Union[str, bytes], **kwargs) -> Dict[str, Any]:
        """
        Perform ID document verification and data extraction according to Digio API documentation.
        
        Args:
            document_image: ID document image
            **kwargs: Additional parameters (verification_types, extract_fields, etc.)
            
        Returns:
            ID verification result with official Digio API response format
        """
        try:
            # Encode image
            if isinstance(document_image, str) and os.path.isfile(document_image):
                image_base64 = self._encode_image(document_image)
            elif isinstance(document_image, str):
                # Remove data URL prefix if present
                if document_image.startswith('data:image/'):
                    image_base64 = document_image.split(',')[1]
                else:
                    image_base64 = document_image
            else:
                image_base64 = base64.b64encode(document_image).decode('utf-8')
            
            # Request payload according to Digio API documentation
            request_data = {
                "document_image": image_base64,
                "verification_types": kwargs.get('verification_types', [
                    "document_authenticity",
                    "data_extraction",
                    "security_features",
                    "ocr_verification"
                ]),
                "extract_fields": kwargs.get('extract_fields', [
                    "name",
                    "document_number",
                    "date_of_birth",
                    "address",
                    "photo",
                    "issuing_authority",
                    "validity_period"
                ]),
                "confidence_threshold": kwargs.get('confidence_threshold', 0.8),
                "document_type": kwargs.get('document_type', 'auto_detect'),
                "return_confidence_scores": kwargs.get('return_confidence_scores', True)
            }
            
            logger.info("🔍 Performing ID verification using Digio API...")
            response = await self._make_request('POST', '/v1/client/kyc/idverification', request_data)
            
            # Transform response to match expected format
            result = {
                "status": "success" if response.get('status') == 'success' else "error",
                "is_authentic": response.get('is_authentic', False),
                "confidence": response.get('confidence', 0.0),
                "extracted_data": response.get('extracted_data', {}),
                "security_features": response.get('security_features', {}),
                "document_type": response.get('document_type', 'unknown'),
                "timestamp": response.get('timestamp', datetime.utcnow().isoformat()),
                "raw_response": response  # Include raw response for debugging
            }
            
            logger.info(f"✅ ID verification completed. Authentic: {result['is_authentic']}, Confidence: {result['confidence']}")
            return result
            
        except Exception as e:
            logger.error(f"❌ ID verification failed: {e}")
            raise DigioAPIError(f"ID verification failed: {str(e)}")
    
    async def batch_verification(self, verification_tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Perform batch verification for multiple tasks.
        
        Args:
            verification_tasks: List of verification tasks
            
        Returns:
            Batch verification results
        """
        try:
            request_data = {
                "tasks": verification_tasks,
                "parallel_processing": True,
                "timeout_per_task": 30
            }
            
            logger.info(f"🔍 Performing batch verification for {len(verification_tasks)} tasks...")
            response = await self._make_request('POST', '/batch/verify', request_data)
            
            logger.info("✅ Batch verification completed")
            return response
            
        except Exception as e:
            logger.error(f"❌ Batch verification failed: {e}")
            raise DigioAPIError(f"Batch verification failed: {str(e)}")
    
    async def get_verification_status(self, verification_id: str) -> Dict[str, Any]:
        """
        Get the status of a verification request.
        
        Args:
            verification_id: Verification request ID
            
        Returns:
            Verification status
        """
        try:
            logger.info(f"🔍 Getting verification status for ID: {verification_id}")
            response = await self._make_request('GET', f'/verification/status/{verification_id}')
            
            return response
            
        except Exception as e:
            logger.error(f"❌ Failed to get verification status: {e}")
            raise DigioAPIError(f"Failed to get verification status: {str(e)}")
    
    async def health_check(self) -> Dict[str, Any]:
        """
        Check the health of the Digio API service.
        
        Returns:
            Health check result
        """
        try:
            response = await self._make_request('GET', '/health')
            return response
        except Exception as e:
            logger.error(f"❌ Digio API health check failed: {e}")
            return {
                "status": "error",
                "message": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }


# Global instance
digio_service = DigioService()