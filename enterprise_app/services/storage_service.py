#!/usr/bin/env python3
"""
Storage Service for handling file uploads and data persistence.

This service provides functionality for saving uploaded files, form data,
and verification results to persistent storage.
"""

import os
import json
import base64
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List
from pathlib import Path
import aiofiles
import logging

from utils.logging.logger import get_logger

logger = get_logger(__name__)


class StorageService:
    """Service for handling file storage and data persistence."""
    
    def __init__(self):
        """Initialize the storage service."""
        # Base directories for file storage
        self.base_upload_dir = os.getenv('UPLOAD_DIR', 'uploads')
        self.base_data_dir = os.getenv('DATA_DIR', 'data')
        
        # Create directories if they don't exist
        self._ensure_directories()
        
    def _ensure_directories(self):
        """Ensure required directories exist."""
        directories = [
            self.base_upload_dir,
            self.base_data_dir,
            os.path.join(self.base_upload_dir, 'selfies'),
            os.path.join(self.base_upload_dir, 'documents'),
            os.path.join(self.base_data_dir, 'sessions'),
            os.path.join(self.base_data_dir, 'verification_results')
        ]
        
        for directory in directories:
            Path(directory).mkdir(parents=True, exist_ok=True)
            logger.info(f"📁 Ensured directory exists: {directory}")
    
    async def save_selfie(self, room_id: str, selfie_data: str, liveness_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Save selfie image and liveness detection results.
        
        Args:
            room_id: Room/session identifier
            selfie_data: Base64 encoded selfie image
            liveness_result: Liveness detection results
            
        Returns:
            File save result with file paths and metadata
        """
        try:
            # Generate unique filename
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            filename = f"selfie_{room_id}_{timestamp}_{uuid.uuid4().hex[:8]}.jpg"
            file_path = os.path.join(self.base_upload_dir, 'selfies', filename)
            
            # Decode and save image
            if selfie_data.startswith('data:image/'):
                # Remove data URL prefix
                image_data = base64.b64decode(selfie_data.split(',')[1])
            else:
                # Assume it's already base64 encoded
                image_data = base64.b64decode(selfie_data)
            
            # Save image file
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(image_data)
            
            # Save metadata
            metadata = {
                "room_id": room_id,
                "filename": filename,
                "file_path": file_path,
                "file_size": len(image_data),
                "upload_timestamp": datetime.utcnow().isoformat(),
                "liveness_detection": liveness_result,
                "file_type": "selfie"
            }
            
            # Save metadata to JSON file
            metadata_filename = f"selfie_metadata_{room_id}_{timestamp}.json"
            metadata_path = os.path.join(self.base_data_dir, 'verification_results', metadata_filename)
            
            async with aiofiles.open(metadata_path, 'w') as f:
                await f.write(json.dumps(metadata, indent=2))
            
            logger.info(f"✅ Selfie saved successfully: {filename}")
            
            return {
                "status": "success",
                "file_path": file_path,
                "metadata_path": metadata_path,
                "filename": filename,
                "file_size": len(image_data),
                "metadata": metadata
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to save selfie: {e}")
            raise Exception(f"Failed to save selfie: {str(e)}")
    
    async def save_document(self, room_id: str, document_data: str, document_type: str = "id_document") -> Dict[str, Any]:
        """
        Save uploaded document.
        
        Args:
            room_id: Room/session identifier
            document_data: Base64 encoded document data
            document_type: Type of document (id_document, etc.)
            
        Returns:
            File save result with file paths and metadata
        """
        try:
            # Generate unique filename
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            filename = f"document_{room_id}_{timestamp}_{uuid.uuid4().hex[:8]}.jpg"
            file_path = os.path.join(self.base_upload_dir, 'documents', filename)
            
            # Decode and save document
            if document_data.startswith('data:image/'):
                # Remove data URL prefix
                doc_data = base64.b64decode(document_data.split(',')[1])
            else:
                # Assume it's already base64 encoded
                doc_data = base64.b64decode(document_data)
            
            # Save document file
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(doc_data)
            
            # Save metadata
            metadata = {
                "room_id": room_id,
                "filename": filename,
                "file_path": file_path,
                "file_size": len(doc_data),
                "upload_timestamp": datetime.utcnow().isoformat(),
                "document_type": document_type,
                "file_type": "document"
            }
            
            # Save metadata to JSON file
            metadata_filename = f"document_metadata_{room_id}_{timestamp}.json"
            metadata_path = os.path.join(self.base_data_dir, 'verification_results', metadata_filename)
            
            async with aiofiles.open(metadata_path, 'w') as f:
                await f.write(json.dumps(metadata, indent=2))
            
            logger.info(f"✅ Document saved successfully: {filename}")
            
            return {
                "status": "success",
                "file_path": file_path,
                "metadata_path": metadata_path,
                "filename": filename,
                "file_size": len(doc_data),
                "metadata": metadata
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to save document: {e}")
            raise Exception(f"Failed to save document: {str(e)}")
    
    async def save_session_data(self, room_id: str, session_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Save session data and workflow progress.
        
        Args:
            room_id: Room/session identifier
            session_data: Session data including workflow steps, answers, etc.
            
        Returns:
            Save result
        """
        try:
            # Generate filename
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            filename = f"session_{room_id}_{timestamp}.json"
            file_path = os.path.join(self.base_data_dir, 'sessions', filename)
            
            # Add metadata
            session_data_with_metadata = {
                "room_id": room_id,
                "session_timestamp": datetime.utcnow().isoformat(),
                "data": session_data
            }
            
            # Save session data
            async with aiofiles.open(file_path, 'w') as f:
                await f.write(json.dumps(session_data_with_metadata, indent=2))
            
            logger.info(f"✅ Session data saved successfully: {filename}")
            
            return {
                "status": "success",
                "file_path": file_path,
                "filename": filename,
                "data": session_data_with_metadata
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to save session data: {e}")
            raise Exception(f"Failed to save session data: {str(e)}")
    
    async def save_verification_result(self, room_id: str, verification_type: str, result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Save verification results (liveness, face match, etc.).
        
        Args:
            room_id: Room/session identifier
            verification_type: Type of verification (liveness, face_match, etc.)
            result: Verification result data
            
        Returns:
            Save result
        """
        try:
            # Generate filename
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            filename = f"verification_{verification_type}_{room_id}_{timestamp}.json"
            file_path = os.path.join(self.base_data_dir, 'verification_results', filename)
            
            # Add metadata
            verification_data = {
                "room_id": room_id,
                "verification_type": verification_type,
                "timestamp": datetime.utcnow().isoformat(),
                "result": result
            }
            
            # Save verification result
            async with aiofiles.open(file_path, 'w') as f:
                await f.write(json.dumps(verification_data, indent=2))
            
            logger.info(f"✅ Verification result saved successfully: {filename}")
            
            return {
                "status": "success",
                "file_path": file_path,
                "filename": filename,
                "data": verification_data
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to save verification result: {e}")
            raise Exception(f"Failed to save verification result: {str(e)}")
    
    async def get_session_data(self, room_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve session data for a room.
        
        Args:
            room_id: Room/session identifier
            
        Returns:
            Session data if found, None otherwise
        """
        try:
            sessions_dir = os.path.join(self.base_data_dir, 'sessions')
            
            # Look for session files for this room
            for filename in os.listdir(sessions_dir):
                if filename.startswith(f"session_{room_id}_"):
                    file_path = os.path.join(sessions_dir, filename)
                    
                    async with aiofiles.open(file_path, 'r') as f:
                        content = await f.read()
                        return json.loads(content)
            
            return None
            
        except Exception as e:
            logger.error(f"❌ Failed to retrieve session data: {e}")
            return None
    
    async def get_verification_results(self, room_id: str) -> List[Dict[str, Any]]:
        """
        Retrieve all verification results for a room.
        
        Args:
            room_id: Room/session identifier
            
        Returns:
            List of verification results
        """
        try:
            results = []
            results_dir = os.path.join(self.base_data_dir, 'verification_results')
            
            # Look for verification result files for this room
            for filename in os.listdir(results_dir):
                if room_id in filename and filename.endswith('.json'):
                    file_path = os.path.join(results_dir, filename)
                    
                    async with aiofiles.open(file_path, 'r') as f:
                        content = await f.read()
                        results.append(json.loads(content))
            
            return results
            
        except Exception as e:
            logger.error(f"❌ Failed to retrieve verification results: {e}")
            return []
    
    async def cleanup_old_files(self, days_old: int = 30) -> Dict[str, Any]:
        """
        Clean up old files to manage storage space.
        
        Args:
            days_old: Number of days after which files should be deleted
            
        Returns:
            Cleanup result
        """
        try:
            from datetime import timedelta
            
            cutoff_date = datetime.utcnow() - timedelta(days=days_old)
            deleted_files = []
            
            # Clean up uploads
            for root, dirs, files in os.walk(self.base_upload_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    file_time = datetime.fromtimestamp(os.path.getmtime(file_path))
                    
                    if file_time < cutoff_date:
                        os.remove(file_path)
                        deleted_files.append(file_path)
            
            # Clean up data files
            for root, dirs, files in os.walk(self.base_data_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    file_time = datetime.fromtimestamp(os.path.getmtime(file_path))
                    
                    if file_time < cutoff_date:
                        os.remove(file_path)
                        deleted_files.append(file_path)
            
            logger.info(f"✅ Cleaned up {len(deleted_files)} old files")
            
            return {
                "status": "success",
                "deleted_files": len(deleted_files),
                "files": deleted_files
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to cleanup old files: {e}")
            return {
                "status": "error",
                "error": str(e)
            }


# Global instance
storage_service = StorageService()
