#!/usr/bin/env python3
"""
Parallel Processing Service for KYC verification operations.

This service manages parallel execution of verification tasks to improve
performance and user experience during KYC workflows.
"""

import asyncio
import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Callable, Union
from enum import Enum
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor

from utils.logging.logger import get_logger
from services.digio_service import digio_service
from services.storage_service import storage_service

logger = get_logger(__name__)


class TaskStatus(Enum):
    """Task status enumeration."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskPriority(Enum):
    """Task priority enumeration."""
    LOW = 1
    NORMAL = 2
    HIGH = 3
    CRITICAL = 4


@dataclass
class ProcessingTask:
    """Processing task data structure."""
    id: str
    name: str
    task_type: str
    priority: TaskPriority
    status: TaskStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3
    timeout: int = 30
    metadata: Optional[Dict[str, Any]] = None


class ParallelProcessingService:
    """
    Service for managing parallel processing of KYC verification tasks.
    
    This service provides:
    - Task queue management
    - Parallel execution coordination
    - Progress monitoring
    - Error handling and retry logic
    - Performance optimization
    """
    
    def __init__(self, max_workers: int = 5):
        """Initialize the parallel processing service."""
        self.max_workers = max_workers
        self.task_queue: Dict[str, ProcessingTask] = {}
        self.running_tasks: Dict[str, asyncio.Task] = {}
        self.completed_tasks: Dict[str, ProcessingTask] = {}
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        
        # Task type handlers
        self.task_handlers: Dict[str, Callable] = {
            "liveness_detection": self._handle_liveness_detection,
            "face_matching": self._handle_face_matching,
            "fuzzy_matching": self._handle_fuzzy_matching,
            "document_verification": self._handle_document_verification,
            "ocr_extraction": self._handle_ocr_extraction,
            "sanctions_check": self._handle_sanctions_check,
            "risk_assessment": self._handle_risk_assessment,
            "data_validation": self._handle_data_validation
        }
        
        logger.info(f"✅ Parallel Processing Service initialized with {max_workers} workers")
    
    async def submit_task(
        self,
        name: str,
        task_type: str,
        data: Dict[str, Any],
        priority: TaskPriority = TaskPriority.NORMAL,
        timeout: int = 30,
        max_retries: int = 3,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Submit a task for parallel processing.
        
        Args:
            name: Task name
            task_type: Type of task to execute
            data: Task data
            priority: Task priority
            timeout: Task timeout in seconds
            max_retries: Maximum retry attempts
            metadata: Additional task metadata
            
        Returns:
            Task ID
        """
        try:
            task_id = f"task_{uuid.uuid4().hex[:8]}"
            
            task = ProcessingTask(
                id=task_id,
                name=name,
                task_type=task_type,
                priority=priority,
                status=TaskStatus.PENDING,
                created_at=datetime.utcnow(),
                timeout=timeout,
                max_retries=max_retries,
                metadata=metadata or {}
            )
            
            self.task_queue[task_id] = task
            
            # Start task execution
            await self._execute_task(task, data)
            
            logger.info(f"✅ Submitted task: {name} ({task_id})")
            return task_id
            
        except Exception as e:
            logger.error(f"❌ Failed to submit task: {e}")
            raise
    
    async def submit_batch_tasks(
        self,
        tasks: List[Dict[str, Any]],
        priority: TaskPriority = TaskPriority.NORMAL
    ) -> List[str]:
        """
        Submit multiple tasks for parallel processing.
        
        Args:
            tasks: List of task definitions
            priority: Task priority
            
        Returns:
            List of task IDs
        """
        try:
            task_ids = []
            
            for task_def in tasks:
                task_id = await self.submit_task(
                    name=task_def["name"],
                    task_type=task_def["type"],
                    data=task_def["data"],
                    priority=priority,
                    timeout=task_def.get("timeout", 30),
                    max_retries=task_def.get("max_retries", 3),
                    metadata=task_def.get("metadata")
                )
                task_ids.append(task_id)
            
            logger.info(f"✅ Submitted batch of {len(tasks)} tasks")
            return task_ids
            
        except Exception as e:
            logger.error(f"❌ Failed to submit batch tasks: {e}")
            raise
    
    async def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get task status."""
        try:
            task = self.task_queue.get(task_id) or self.completed_tasks.get(task_id)
            if not task:
                return None
            
            return {
                "id": task.id,
                "name": task.name,
                "type": task.task_type,
                "status": task.status.value,
                "priority": task.priority.value,
                "created_at": task.created_at.isoformat(),
                "started_at": task.started_at.isoformat() if task.started_at else None,
                "completed_at": task.completed_at.isoformat() if task.completed_at else None,
                "retry_count": task.retry_count,
                "result": task.result,
                "error": task.error
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get task status: {e}")
            return None
    
    async def get_all_tasks_status(self) -> Dict[str, Any]:
        """Get status of all tasks."""
        try:
            return {
                "pending": len([t for t in self.task_queue.values() if t.status == TaskStatus.PENDING]),
                "running": len([t for t in self.task_queue.values() if t.status == TaskStatus.RUNNING]),
                "completed": len(self.completed_tasks),
                "failed": len([t for t in self.task_queue.values() if t.status == TaskStatus.FAILED]),
                "total": len(self.task_queue) + len(self.completed_tasks)
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get all tasks status: {e}")
            return {}
    
    async def cancel_task(self, task_id: str) -> bool:
        """Cancel a running task."""
        try:
            task = self.task_queue.get(task_id)
            if not task:
                return False
            
            if task.status == TaskStatus.RUNNING:
                running_task = self.running_tasks.get(task_id)
                if running_task and not running_task.done():
                    running_task.cancel()
                
                task.status = TaskStatus.CANCELLED
                task.completed_at = datetime.utcnow()
                
                # Move to completed tasks
                self.completed_tasks[task_id] = task
                del self.task_queue[task_id]
                
                logger.info(f"✅ Cancelled task: {task_id}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"❌ Failed to cancel task: {e}")
            return False
    
    async def wait_for_tasks(self, task_ids: List[str], timeout: Optional[int] = None) -> Dict[str, Any]:
        """Wait for multiple tasks to complete."""
        try:
            tasks = []
            for task_id in task_ids:
                if task_id in self.running_tasks:
                    tasks.append(self.running_tasks[task_id])
            
            if not tasks:
                return {"status": "no_tasks", "results": {}}
            
            # Wait for all tasks to complete
            results = await asyncio.wait_for(
                asyncio.gather(*tasks, return_exceptions=True),
                timeout=timeout
            )
            
            # Collect results
            task_results = {}
            for i, task_id in enumerate(task_ids):
                if i < len(results):
                    task_results[task_id] = results[i]
            
            return {
                "status": "completed",
                "results": task_results
            }
            
        except asyncio.TimeoutError:
            return {
                "status": "timeout",
                "results": {}
            }
        except Exception as e:
            logger.error(f"❌ Failed to wait for tasks: {e}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def _execute_task(self, task: ProcessingTask, data: Dict[str, Any]) -> None:
        """Execute a processing task."""
        try:
            task.status = TaskStatus.RUNNING
            task.started_at = datetime.utcnow()
            
            # Get task handler
            handler = self.task_handlers.get(task.task_type)
            if not handler:
                raise ValueError(f"No handler found for task type: {task.task_type}")
            
            # Execute task with timeout
            task_coroutine = asyncio.wait_for(
                handler(data, task.metadata),
                timeout=task.timeout
            )
            
            # Store running task
            self.running_tasks[task.id] = asyncio.create_task(task_coroutine)
            
            # Wait for completion
            try:
                result = await self.running_tasks[task.id]
                task.status = TaskStatus.COMPLETED
                task.result = result
                task.completed_at = datetime.utcnow()
                
                logger.info(f"✅ Task completed: {task.name} ({task.id})")
                
            except asyncio.TimeoutError:
                task.status = TaskStatus.FAILED
                task.error = f"Task timeout after {task.timeout} seconds"
                task.completed_at = datetime.utcnow()
                
                logger.warning(f"⏰ Task timeout: {task.name} ({task.id})")
                
            except Exception as e:
                task.status = TaskStatus.FAILED
                task.error = str(e)
                task.completed_at = datetime.utcnow()
                
                logger.error(f"❌ Task failed: {task.name} ({task.id}) - {e}")
                
                # Retry logic
                if task.retry_count < task.max_retries:
                    task.retry_count += 1
                    task.status = TaskStatus.PENDING
                    task.started_at = None
                    task.completed_at = None
                    task.error = None
                    
                    # Retry after delay
                    await asyncio.sleep(2 ** task.retry_count)  # Exponential backoff
                    await self._execute_task(task, data)
                    return
            
            finally:
                # Clean up running task
                if task.id in self.running_tasks:
                    del self.running_tasks[task.id]
                
                # Move to completed tasks
                self.completed_tasks[task.id] = task
                if task.id in self.task_queue:
                    del self.task_queue[task.id]
            
        except Exception as e:
            logger.error(f"❌ Error executing task: {e}")
            task.status = TaskStatus.FAILED
            task.error = str(e)
            task.completed_at = datetime.utcnow()
    
    async def _handle_liveness_detection(self, data: Dict[str, Any], metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Handle liveness detection task."""
        try:
            logger.info("🔍 Processing liveness detection task")
            
            image_data = data.get("image_data")
            threshold = data.get("threshold", 0.8)
            
            if not image_data:
                raise ValueError("Missing image data for liveness detection")
            
            # Perform liveness detection using Digio
            async with digio_service as digio:
                result = await digio.liveness_detection(
                    image_data,
                    threshold=threshold,
                    liveness_type='passive',
                    return_face_attributes=True
                )
            
            return {
                "status": "success",
                "task_type": "liveness_detection",
                "result": result,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Liveness detection failed: {e}")
            return {
                "status": "error",
                "task_type": "liveness_detection",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def _handle_face_matching(self, data: Dict[str, Any], metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Handle face matching task."""
        try:
            logger.info("🔍 Processing face matching task")
            
            source_image = data.get("source_image")
            target_image = data.get("target_image")
            threshold = data.get("threshold", 0.75)
            
            if not source_image or not target_image:
                raise ValueError("Missing source or target image for face matching")
            
            # Perform face matching using Digio
            async with digio_service as digio:
                result = await digio.face_match(
                    source_image,
                    target_image,
                    match_threshold=threshold,
                    extraction_method='automatic',
                    return_face_attributes=True
                )
            
            return {
                "status": "success",
                "task_type": "face_matching",
                "result": result,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Face matching failed: {e}")
            return {
                "status": "error",
                "task_type": "face_matching",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def _handle_fuzzy_matching(self, data: Dict[str, Any], metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Handle fuzzy matching task."""
        try:
            logger.info("🔍 Processing fuzzy matching task")
            
            source_text = data.get("source_text")
            target_text = data.get("target_text")
            threshold = data.get("threshold", 0.8)
            algorithm = data.get("algorithm", "levenshtein")
            
            if not source_text or not target_text:
                raise ValueError("Missing source or target text for fuzzy matching")
            
            # Perform fuzzy matching using Digio
            async with digio_service as digio:
                result = await digio.fuzzy_match(
                    source_text,
                    target_text,
                    match_threshold=threshold,
                    algorithm=algorithm,
                    return_normalized=True
                )
            
            return {
                "status": "success",
                "task_type": "fuzzy_matching",
                "result": result,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Fuzzy matching failed: {e}")
            return {
                "status": "error",
                "task_type": "fuzzy_matching",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def _handle_document_verification(self, data: Dict[str, Any], metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Handle document verification task."""
        try:
            logger.info("📄 Processing document verification task")
            
            document_image = data.get("document_image")
            confidence_threshold = data.get("confidence_threshold", 0.8)
            
            if not document_image:
                raise ValueError("Missing document image for verification")
            
            # Perform document verification using Digio
            async with digio_service as digio:
                result = await digio.id_verification(
                    document_image,
                    confidence_threshold=confidence_threshold,
                    document_type='auto_detect',
                    return_confidence_scores=True
                )
            
            return {
                "status": "success",
                "task_type": "document_verification",
                "result": result,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Document verification failed: {e}")
            return {
                "status": "error",
                "task_type": "document_verification",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def _handle_ocr_extraction(self, data: Dict[str, Any], metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Handle OCR extraction task."""
        try:
            logger.info("📝 Processing OCR extraction task")
            
            document_image = data.get("document_image")
            
            if not document_image:
                raise ValueError("Missing document image for OCR extraction")
            
            # Perform OCR extraction using Digio
            async with digio_service as digio:
                result = await digio.id_verification(
                    document_image,
                    document_type='auto_detect',
                    return_confidence_scores=True
                )
            
            # Extract OCR data from result
            ocr_data = result.get("extracted_data", {})
            
            return {
                "status": "success",
                "task_type": "ocr_extraction",
                "result": {
                    "ocr_data": ocr_data,
                    "confidence_scores": result.get("confidence_scores", {}),
                    "document_type": result.get("document_type", "unknown")
                },
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ OCR extraction failed: {e}")
            return {
                "status": "error",
                "task_type": "ocr_extraction",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def _handle_sanctions_check(self, data: Dict[str, Any], metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Handle sanctions check task."""
        try:
            logger.info("⚖️ Processing sanctions check task")
            
            customer_name = data.get("customer_name")
            customer_id = data.get("customer_id")
            
            if not customer_name:
                raise ValueError("Missing customer name for sanctions check")
            
            # Mock sanctions check (replace with actual implementation)
            sanctions_result = {
                "customer_name": customer_name,
                "customer_id": customer_id,
                "sanctions_match": False,
                "risk_level": "low",
                "check_timestamp": datetime.utcnow().isoformat(),
                "data_sources": ["OFAC", "UN", "EU", "UK"]
            }
            
            return {
                "status": "success",
                "task_type": "sanctions_check",
                "result": sanctions_result,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Sanctions check failed: {e}")
            return {
                "status": "error",
                "task_type": "sanctions_check",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def _handle_risk_assessment(self, data: Dict[str, Any], metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Handle risk assessment task."""
        try:
            logger.info("📊 Processing risk assessment task")
            
            # Get verification results from metadata
            verification_results = metadata.get("verification_results", {})
            
            # Calculate risk score based on various factors
            risk_factors = []
            risk_score = 0.0
            
            # Check face matching score
            face_match_score = verification_results.get("face_matching", {}).get("match_score", 0)
            if face_match_score < 0.7:
                risk_factors.append("low_face_match_score")
                risk_score += 0.3
            
            # Check fuzzy matching score
            fuzzy_match_score = verification_results.get("fuzzy_matching", {}).get("match_score", 0)
            if fuzzy_match_score < 0.8:
                risk_factors.append("low_name_match_score")
                risk_score += 0.2
            
            # Check document authenticity
            document_verification = verification_results.get("document_verification", {})
            if not document_verification.get("is_authentic", False):
                risk_factors.append("document_authenticity_concerns")
                risk_score += 0.4
            
            # Check sanctions
            sanctions_check = verification_results.get("sanctions_check", {})
            if sanctions_check.get("sanctions_match", False):
                risk_factors.append("sanctions_match")
                risk_score += 0.8
            
            # Determine risk level
            if risk_score < 0.3:
                risk_level = "low"
            elif risk_score < 0.6:
                risk_level = "medium"
            else:
                risk_level = "high"
            
            risk_result = {
                "risk_score": risk_score,
                "risk_level": risk_level,
                "risk_factors": risk_factors,
                "assessment_timestamp": datetime.utcnow().isoformat(),
                "recommendation": self._get_risk_recommendation(risk_level)
            }
            
            return {
                "status": "success",
                "task_type": "risk_assessment",
                "result": risk_result,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Risk assessment failed: {e}")
            return {
                "status": "error",
                "task_type": "risk_assessment",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def _handle_data_validation(self, data: Dict[str, Any], metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Handle data validation task."""
        try:
            logger.info("✅ Processing data validation task")
            
            # Get data to validate
            questionnaire_data = data.get("questionnaire_data", {})
            document_data = data.get("document_data", {})
            
            validation_results = {}
            validation_errors = []
            
            # Validate name matching
            questionnaire_name = questionnaire_data.get("full_name", "").lower().strip()
            document_name = document_data.get("name", "").lower().strip()
            
            if questionnaire_name and document_name:
                name_similarity = self._calculate_name_similarity(questionnaire_name, document_name)
                validation_results["name_match"] = {
                    "similarity": name_similarity,
                    "valid": name_similarity > 0.8
                }
                
                if name_similarity <= 0.8:
                    validation_errors.append("Name mismatch between questionnaire and document")
            
            # Validate date of birth
            questionnaire_dob = questionnaire_data.get("date_of_birth")
            document_dob = document_data.get("date_of_birth")
            
            if questionnaire_dob and document_dob:
                dob_match = questionnaire_dob == document_dob
                validation_results["dob_match"] = {
                    "match": dob_match,
                    "valid": dob_match
                }
                
                if not dob_match:
                    validation_errors.append("Date of birth mismatch between questionnaire and document")
            
            # Validate address
            questionnaire_address = questionnaire_data.get("address", "").lower().strip()
            document_address = document_data.get("address", "").lower().strip()
            
            if questionnaire_address and document_address:
                address_similarity = self._calculate_address_similarity(questionnaire_address, document_address)
                validation_results["address_match"] = {
                    "similarity": address_similarity,
                    "valid": address_similarity > 0.7
                }
                
                if address_similarity <= 0.7:
                    validation_errors.append("Address mismatch between questionnaire and document")
            
            validation_result = {
                "validation_results": validation_results,
                "validation_errors": validation_errors,
                "overall_valid": len(validation_errors) == 0,
                "validation_timestamp": datetime.utcnow().isoformat()
            }
            
            return {
                "status": "success",
                "task_type": "data_validation",
                "result": validation_result,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Data validation failed: {e}")
            return {
                "status": "error",
                "task_type": "data_validation",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    def _get_risk_recommendation(self, risk_level: str) -> str:
        """Get risk recommendation based on risk level."""
        recommendations = {
            "low": "Proceed with standard KYC process",
            "medium": "Additional verification required",
            "high": "Manual review and enhanced due diligence required"
        }
        return recommendations.get(risk_level, "Manual review required")
    
    def _calculate_name_similarity(self, name1: str, name2: str) -> float:
        """Calculate similarity between two names."""
        try:
            # Simple similarity calculation (can be enhanced with more sophisticated algorithms)
            words1 = set(name1.split())
            words2 = set(name2.split())
            
            if not words1 or not words2:
                return 0.0
            
            intersection = words1.intersection(words2)
            union = words1.union(words2)
            
            return len(intersection) / len(union) if union else 0.0
            
        except Exception:
            return 0.0
    
    def _calculate_address_similarity(self, address1: str, address2: str) -> float:
        """Calculate similarity between two addresses."""
        try:
            # Simple similarity calculation for addresses
            words1 = set(address1.split())
            words2 = set(address2.split())
            
            if not words1 or not words2:
                return 0.0
            
            intersection = words1.intersection(words2)
            union = words1.union(words2)
            
            return len(intersection) / len(union) if union else 0.0
            
        except Exception:
            return 0.0
    
    async def cleanup(self) -> None:
        """Clean up the parallel processing service."""
        try:
            # Cancel all running tasks
            for task_id, task in self.running_tasks.items():
                if not task.done():
                    task.cancel()
            
            # Shutdown executor
            self.executor.shutdown(wait=True)
            
            logger.info("✅ Parallel Processing Service cleaned up")
            
        except Exception as e:
            logger.error(f"❌ Error cleaning up parallel processing service: {e}")


# Global instance
parallel_processing_service = ParallelProcessingService()
