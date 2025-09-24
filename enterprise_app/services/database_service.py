#!/usr/bin/env python3
"""
Database service for handling KYC database operations.

This service provides functionality for database operations including
CRUD operations for KYC requests, actions, and sub-actions.
"""

import json
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError

from models.verification_models import (
    Base, KYCRequest, KYCAction, KYCSubAction, KYCWorkflowTemplate
)
from utils.logging.logger import get_logger
from utils.config.settings import settings

logger = get_logger(__name__)


class DatabaseService:
    """Service for handling KYC database operations."""
    
    def __init__(self):
        """Initialize the database service."""
        self.database_url = settings.database_url
        self.engine = None
        self.async_session = None
        self._initialize_database()
    
    def _initialize_database(self):
        """Initialize database connection and create tables."""
        try:
            # Create async engine
            self.engine = create_async_engine(
                self.database_url,
                pool_size=settings.database_pool_size,
                max_overflow=settings.database_max_overflow,
                echo=False  # Set to True for SQL debugging
            )
            
            # Create async session factory
            self.async_session = sessionmaker(
                self.engine, 
                class_=AsyncSession, 
                expire_on_commit=False
            )
            
            logger.info("✅ Database service initialized successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize database service: {e}")
            raise
    
    async def create_tables(self):
        """Create all database tables."""
        try:
            async with self.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("✅ Database tables created successfully")
        except Exception as e:
            logger.error(f"❌ Failed to create database tables: {e}")
            raise
    
    async def get_session(self) -> AsyncSession:
        """Get a database session."""
        return self.async_session()
    
    # KYC Request Operations
    async def create_kyc_request(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new KYC request."""
        try:
            async with self.get_session() as session:
                # Check if request already exists
                existing_request = await session.execute(
                    text("SELECT seq_id FROM kyc_request WHERE id = :id"),
                    {"id": request_data["id"]}
                )
                if existing_request.fetchone():
                    logger.warning(f"KYC request with id {request_data['id']} already exists")
                    return await self.get_kyc_request_by_id(request_data["id"])
                
                # Create new KYC request
                new_request = KYCRequest(
                    id=request_data["id"],
                    client_reference_id=request_data.get("client_reference_id"),
                    owner_id=request_data.get("owner_id"),
                    sub_user_id=request_data.get("sub_user_id"),
                    actioner_id=request_data.get("actioner_id"),
                    customer_identifier=request_data.get("customer_identifier"),
                    customer_name=request_data.get("customer_name"),
                    transaction_id=request_data.get("transaction_id"),
                    expire_in_days=request_data.get("expire_in_days", 30),
                    status=request_data.get("status", "active"),
                    template_id=request_data.get("template_id"),
                    strict_assign=request_data.get("strict_assign"),
                    request_details=request_data.get("request_details"),
                    processing_done=request_data.get("processing_done", 0),
                    is_internal=request_data.get("is_internal", 0),
                    additional_validations=request_data.get("additional_validations"),
                    auditor_identifier=request_data.get("auditor_identifier"),
                    auditor_name=request_data.get("auditor_name"),
                    auto_approved=request_data.get("auto_approved"),
                    post_request_status_invocations=request_data.get("post_request_status_invocations"),
                    expire_on=request_data.get("expire_on"),
                    soft_deleted=request_data.get("soft_deleted", 0),
                    auditor_actions=request_data.get("auditor_actions"),
                    kyc_request_data=request_data.get("kyc_request_data"),
                    completed_at=request_data.get("completed_at"),
                    initiated_at=request_data.get("initiated_at")
                )
                
                session.add(new_request)
                await session.commit()
                await session.refresh(new_request)
                
                logger.info(f"✅ Created new KYC request: {new_request.id}")
                
                return {
                    "seq_id": new_request.seq_id,
                    "id": new_request.id,
                    "client_reference_id": new_request.client_reference_id,
                    "owner_id": new_request.owner_id,
                    "sub_user_id": new_request.sub_user_id,
                    "status": new_request.status,
                    "created_at": new_request.created_at.isoformat() if new_request.created_at else None,
                    "updated_at": new_request.updated_at.isoformat()
                }
                
        except Exception as e:
            logger.error(f"❌ Failed to create KYC request: {e}")
            raise
    
    async def get_kyc_request_by_id(self, request_id: str) -> Optional[Dict[str, Any]]:
        """Get KYC request by ID."""
        try:
            async with self.get_session() as session:
                result = await session.execute(
                    text("SELECT * FROM kyc_request WHERE id = :id"),
                    {"id": request_id}
                )
                row = result.fetchone()
                
                if row:
                    return {
                        "seq_id": row.seq_id,
                        "id": row.id,
                        "client_reference_id": row.client_reference_id,
                        "owner_id": row.owner_id,
                        "sub_user_id": row.sub_user_id,
                        "actioner_id": row.actioner_id,
                        "customer_identifier": row.customer_identifier,
                        "customer_name": row.customer_name,
                        "transaction_id": row.transaction_id,
                        "expire_in_days": row.expire_in_days,
                        "status": row.status,
                        "template_id": row.template_id,
                        "strict_assign": row.strict_assign,
                        "request_details": row.request_details,
                        "processing_done": row.processing_done,
                        "is_internal": row.is_internal,
                        "additional_validations": row.additional_validations,
                        "auditor_identifier": row.auditor_identifier,
                        "auditor_name": row.auditor_name,
                        "auto_approved": row.auto_approved,
                        "post_request_status_invocations": row.post_request_status_invocations,
                        "expire_on": row.expire_on.isoformat() if row.expire_on else None,
                        "soft_deleted": row.soft_deleted,
                        "auditor_actions": row.auditor_actions,
                        "kyc_request_data": row.kyc_request_data,
                        "completed_at": row.completed_at.isoformat() if row.completed_at else None,
                        "initiated_at": row.initiated_at.isoformat() if row.initiated_at else None,
                        "created_at": row.created_at.isoformat() if row.created_at else None,
                        "updated_at": row.updated_at.isoformat()
                    }
                return None
                
        except Exception as e:
            logger.error(f"❌ Failed to get KYC request: {e}")
            return None
    
    # KYC Action Operations
    async def create_kyc_action(self, action_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new KYC action."""
        try:
            async with self.get_session() as session:
                # Check if action already exists
                existing_action = await session.execute(
                    text("SELECT seq_id FROM kyc_action WHERE id = :id"),
                    {"id": action_data["id"]}
                )
                if existing_action.fetchone():
                    logger.warning(f"KYC action with id {action_data['id']} already exists")
                    return await self.get_kyc_action_by_id(action_data["id"])
                
                # Create new KYC action
                new_action = KYCAction(
                    id=action_data["id"],
                    request_id=action_data.get("request_id"),
                    owner_id=action_data.get("owner_id"),
                    sub_user_id=action_data.get("sub_user_id"),
                    actioner_id=action_data.get("actioner_id"),
                    description=action_data.get("description"),
                    strict_validation=action_data.get("strict_validation"),
                    file_id=action_data.get("file_id"),
                    sub_file_id=action_data.get("sub_file_id"),
                    method=action_data.get("method"),
                    status=action_data.get("status", "pending"),
                    title=action_data.get("title"),
                    type=action_data.get("type"),
                    optional=action_data.get("optional", 0),
                    action_ref=action_data.get("action_ref"),
                    strict_validation_type=action_data.get("strict_validation_type"),
                    validation_mode=action_data.get("validation_mode"),
                    validation_result=action_data.get("validation_result"),
                    otp=action_data.get("otp"),
                    video_length=action_data.get("video_length"),
                    image_upload_mode=action_data.get("image_upload_mode"),
                    execution_request_id=action_data.get("execution_request_id"),
                    allow_image_upload=action_data.get("allow_image_upload"),
                    processing_done=action_data.get("processing_done"),
                    face_match_obj_type=action_data.get("face_match_obj_type"),
                    face_match_result=action_data.get("face_match_result"),
                    face_match_result_meta=action_data.get("face_match_result_meta"),
                    face_match_status=action_data.get("face_match_status"),
                    obj_analysis_result_id=action_data.get("obj_analysis_result_id"),
                    obj_analysis_status=action_data.get("obj_analysis_status"),
                    allow_ocr_data_update=action_data.get("allow_ocr_data_update"),
                    id_card_data_id=action_data.get("id_card_data_id"),
                    rules_data=action_data.get("rules_data"),
                    config_data=action_data.get("config_data"),
                    latitude=action_data.get("latitude"),
                    longitude=action_data.get("longitude"),
                    retry_count=action_data.get("retry_count", 0),
                    verification_method=action_data.get("verification_method"),
                    input_data=action_data.get("input_data"),
                    action_data=action_data.get("action_data"),
                    initiated_at=action_data.get("initiated_at")
                )
                
                session.add(new_action)
                await session.commit()
                await session.refresh(new_action)
                
                logger.info(f"✅ Created new KYC action: {new_action.id}")
                
                return {
                    "seq_id": new_action.seq_id,
                    "id": new_action.id,
                    "request_id": new_action.request_id,
                    "owner_id": new_action.owner_id,
                    "sub_user_id": new_action.sub_user_id,
                    "status": new_action.status,
                    "type": new_action.type,
                    "title": new_action.title,
                    "created_at": new_action.created_at.isoformat() if new_action.created_at else None,
                    "updated_at": new_action.updated_at.isoformat()
                }
                
        except Exception as e:
            logger.error(f"❌ Failed to create KYC action: {e}")
            raise
    
    async def get_kyc_action_by_id(self, action_id: str) -> Optional[Dict[str, Any]]:
        """Get KYC action by ID."""
        try:
            async with self.get_session() as session:
                result = await session.execute(
                    text("SELECT * FROM kyc_action WHERE id = :id"),
                    {"id": action_id}
                )
                row = result.fetchone()
                
                if row:
                    return {
                        "seq_id": row.seq_id,
                        "id": row.id,
                        "request_id": row.request_id,
                        "owner_id": row.owner_id,
                        "sub_user_id": row.sub_user_id,
                        "actioner_id": row.actioner_id,
                        "description": row.description,
                        "strict_validation": row.strict_validation,
                        "file_id": row.file_id,
                        "sub_file_id": row.sub_file_id,
                        "method": row.method,
                        "status": row.status,
                        "title": row.title,
                        "type": row.type,
                        "optional": row.optional,
                        "action_ref": row.action_ref,
                        "strict_validation_type": row.strict_validation_type,
                        "validation_mode": row.validation_mode,
                        "validation_result": row.validation_result,
                        "otp": row.otp,
                        "video_length": row.video_length,
                        "image_upload_mode": row.image_upload_mode,
                        "execution_request_id": row.execution_request_id,
                        "allow_image_upload": row.allow_image_upload,
                        "processing_done": row.processing_done,
                        "face_match_obj_type": row.face_match_obj_type,
                        "face_match_result": row.face_match_result,
                        "face_match_result_meta": row.face_match_result_meta,
                        "face_match_status": row.face_match_status,
                        "obj_analysis_result_id": row.obj_analysis_result_id,
                        "obj_analysis_status": row.obj_analysis_status,
                        "allow_ocr_data_update": row.allow_ocr_data_update,
                        "id_card_data_id": row.id_card_data_id,
                        "rules_data": row.rules_data,
                        "config_data": row.config_data,
                        "latitude": row.latitude,
                        "longitude": row.longitude,
                        "retry_count": row.retry_count,
                        "verification_method": row.verification_method,
                        "input_data": row.input_data,
                        "action_data": row.action_data,
                        "initiated_at": row.initiated_at.isoformat() if row.initiated_at else None,
                        "created_at": row.created_at.isoformat() if row.created_at else None,
                        "updated_at": row.updated_at.isoformat(),
                        "completed_at": row.completed_at.isoformat() if row.completed_at else None
                    }
                return None
                
        except Exception as e:
            logger.error(f"❌ Failed to get KYC action: {e}")
            return None
    
    # KYC Sub-Action Operations
    async def create_kyc_sub_action(self, sub_action_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new KYC sub-action."""
        try:
            async with self.get_session() as session:
                # Check if sub-action already exists
                existing_sub_action = await session.execute(
                    text("SELECT seq_id FROM kyc_sub_action WHERE id = :id"),
                    {"id": sub_action_data["id"]}
                )
                if existing_sub_action.fetchone():
                    logger.warning(f"KYC sub-action with id {sub_action_data['id']} already exists")
                    return await self.get_kyc_sub_action_by_id(sub_action_data["id"])
                
                # Create new KYC sub-action
                new_sub_action = KYCSubAction(
                    id=sub_action_data["id"],
                    action_id=sub_action_data.get("action_id"),
                    owner_id=sub_action_data.get("owner_id"),
                    sub_user_id=sub_action_data.get("sub_user_id"),
                    actioner=sub_action_data.get("actioner"),
                    input_data=sub_action_data.get("input_data"),
                    status=sub_action_data.get("status", "pending"),
                    type=sub_action_data.get("type"),
                    title=sub_action_data.get("title"),
                    description=sub_action_data.get("description"),
                    optional=sub_action_data.get("optional", 0),
                    perform_enrichment=sub_action_data.get("perform_enrichment"),
                    obj_analysis_status=sub_action_data.get("obj_analysis_status"),
                    obj_analysis_result_id=sub_action_data.get("obj_analysis_result_id"),
                    strict_validation_type=sub_action_data.get("strict_validation_type"),
                    face_match_obj_type=sub_action_data.get("face_match_obj_type"),
                    face_match_result=sub_action_data.get("face_match_result"),
                    face_match_result_meta=sub_action_data.get("face_match_result_meta"),
                    face_match_status=sub_action_data.get("face_match_status"),
                    doc_file_id=sub_action_data.get("doc_file_id"),
                    doc_sub_file_id=sub_action_data.get("doc_sub_file_id"),
                    plugin_meta_data=sub_action_data.get("plugin_meta_data"),
                    property_rules=sub_action_data.get("property_rules"),
                    sub_action_ref=sub_action_data.get("sub_action_ref"),
                    sub_action_step=sub_action_data.get("sub_action_step", "PRE"),
                    global_variables=sub_action_data.get("global_variables"),
                    attribute=sub_action_data.get("attribute"),
                    id_card_data_id=sub_action_data.get("id_card_data_id"),
                    validation_result=sub_action_data.get("validation_result")
                )
                
                session.add(new_sub_action)
                await session.commit()
                await session.refresh(new_sub_action)
                
                logger.info(f"✅ Created new KYC sub-action: {new_sub_action.id}")
                
                return {
                    "seq_id": new_sub_action.seq_id,
                    "id": new_sub_action.id,
                    "action_id": new_sub_action.action_id,
                    "owner_id": new_sub_action.owner_id,
                    "sub_user_id": new_sub_action.sub_user_id,
                    "status": new_sub_action.status,
                    "type": new_sub_action.type,
                    "title": new_sub_action.title,
                    "created_at": new_sub_action.created_at.isoformat() if new_sub_action.created_at else None,
                    "updated_at": new_sub_action.updated_at.isoformat()
                }
                
        except Exception as e:
            logger.error(f"❌ Failed to create KYC sub-action: {e}")
            raise
    
    async def get_kyc_sub_action_by_id(self, sub_action_id: str) -> Optional[Dict[str, Any]]:
        """Get KYC sub-action by ID."""
        try:
            async with self.get_session() as session:
                result = await session.execute(
                    text("SELECT * FROM kyc_sub_action WHERE id = :id"),
                    {"id": sub_action_id}
                )
                row = result.fetchone()
                
                if row:
                    return {
                        "seq_id": row.seq_id,
                        "id": row.id,
                        "action_id": row.action_id,
                        "owner_id": row.owner_id,
                        "sub_user_id": row.sub_user_id,
                        "actioner": row.actioner,
                        "input_data": row.input_data,
                        "status": row.status,
                        "type": row.type,
                        "title": row.title,
                        "description": row.description,
                        "optional": row.optional,
                        "perform_enrichment": row.perform_enrichment,
                        "obj_analysis_status": row.obj_analysis_status,
                        "obj_analysis_result_id": row.obj_analysis_result_id,
                        "strict_validation_type": row.strict_validation_type,
                        "face_match_obj_type": row.face_match_obj_type,
                        "face_match_result": row.face_match_result,
                        "face_match_result_meta": row.face_match_result_meta,
                        "face_match_status": row.face_match_status,
                        "doc_file_id": row.doc_file_id,
                        "doc_sub_file_id": row.doc_sub_file_id,
                        "plugin_meta_data": row.plugin_meta_data,
                        "property_rules": row.property_rules,
                        "sub_action_ref": row.sub_action_ref,
                        "sub_action_step": row.sub_action_step,
                        "global_variables": row.global_variables,
                        "attribute": row.attribute,
                        "id_card_data_id": row.id_card_data_id,
                        "validation_result": row.validation_result,
                        "created_at": row.created_at.isoformat() if row.created_at else None,
                        "updated_at": row.updated_at.isoformat()
                    }
                return None
                
        except Exception as e:
            logger.error(f"❌ Failed to get KYC sub-action: {e}")
            return None
    
    async def get_kyc_sub_actions_by_action_id(self, action_id: str) -> List[Dict[str, Any]]:
        """Get all sub-actions for a given action ID."""
        try:
            async with self.get_session() as session:
                result = await session.execute(
                    text("SELECT * FROM kyc_sub_action WHERE action_id = :action_id ORDER BY created_at"),
                    {"action_id": action_id}
                )
                
                sub_actions = []
                for row in result.fetchall():
                    sub_actions.append({
                        "seq_id": row.seq_id,
                        "id": row.id,
                        "action_id": row.action_id,
                        "owner_id": row.owner_id,
                        "sub_user_id": row.sub_user_id,
                        "actioner": row.actioner,
                        "input_data": row.input_data,
                        "status": row.status,
                        "type": row.type,
                        "title": row.title,
                        "description": row.description,
                        "optional": row.optional,
                        "perform_enrichment": row.perform_enrichment,
                        "obj_analysis_status": row.obj_analysis_status,
                        "obj_analysis_result_id": row.obj_analysis_result_id,
                        "strict_validation_type": row.strict_validation_type,
                        "face_match_obj_type": row.face_match_obj_type,
                        "face_match_result": row.face_match_result,
                        "face_match_result_meta": row.face_match_result_meta,
                        "face_match_status": row.face_match_status,
                        "doc_file_id": row.doc_file_id,
                        "doc_sub_file_id": row.doc_sub_file_id,
                        "plugin_meta_data": row.plugin_meta_data,
                        "property_rules": row.property_rules,
                        "sub_action_ref": row.sub_action_ref,
                        "sub_action_step": row.sub_action_step,
                        "global_variables": row.global_variables,
                        "attribute": row.attribute,
                        "id_card_data_id": row.id_card_data_id,
                        "validation_result": row.validation_result,
                        "created_at": row.created_at.isoformat() if row.created_at else None,
                        "updated_at": row.updated_at.isoformat()
                    })
                
                return sub_actions
                
        except Exception as e:
            logger.error(f"❌ Failed to get KYC sub-actions: {e}")
            return []
    
    # KYC Workflow Template Operations
    async def create_kyc_workflow_template(self, template_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new KYC workflow template."""
        try:
            async with self.get_session() as session:
                # Check if template already exists
                existing_template = await session.execute(
                    text("SELECT seq_id FROM kyc_workflow_template WHERE id = :id"),
                    {"id": template_data["id"]}
                )
                if existing_template.fetchone():
                    logger.warning(f"KYC workflow template with id {template_data['id']} already exists")
                    return await self.get_kyc_workflow_template_by_id(template_data["id"])
                
                # Create new KYC workflow template
                new_template = KYCWorkflowTemplate(
                    id=template_data["id"],
                    owner_id=template_data.get("owner_id"),
                    sub_user_id=template_data.get("sub_user_id"),
                    name=template_data.get("name", ""),
                    type=template_data.get("type"),
                    is_electronic=template_data.get("is_electronic", 0),
                    version=template_data.get("version", 1),
                    actionable=template_data.get("actionable", b""),
                    workflow_structure=template_data.get("workflow_structure"),
                    studio_meta=template_data.get("studio_meta"),
                    active=template_data.get("active", 1),
                    migrate_workflow=template_data.get("migrate_workflow", 0),
                    migration_status=template_data.get("migration_status"),
                    description=template_data.get("description")
                )
                
                session.add(new_template)
                await session.commit()
                await session.refresh(new_template)
                
                logger.info(f"✅ Created new KYC workflow template: {new_template.id}")
                
                return {
                    "seq_id": new_template.seq_id,
                    "id": new_template.id,
                    "owner_id": new_template.owner_id,
                    "sub_user_id": new_template.sub_user_id,
                    "name": new_template.name,
                    "type": new_template.type,
                    "is_electronic": new_template.is_electronic,
                    "version": new_template.version,
                    "active": new_template.active,
                    "created_at": new_template.created_at.isoformat(),
                    "updated_at": new_template.updated_at.isoformat()
                }
                
        except Exception as e:
            logger.error(f"❌ Failed to create KYC workflow template: {e}")
            raise
    
    async def get_kyc_workflow_template_by_id(self, template_id: str) -> Optional[Dict[str, Any]]:
        """Get KYC workflow template by ID."""
        try:
            async with self.get_session() as session:
                result = await session.execute(
                    text("SELECT * FROM kyc_workflow_template WHERE id = :id"),
                    {"id": template_id}
                )
                row = result.fetchone()
                
                if row:
                    return {
                        "seq_id": row.seq_id,
                        "id": row.id,
                        "owner_id": row.owner_id,
                        "sub_user_id": row.sub_user_id,
                        "name": row.name,
                        "type": row.type,
                        "is_electronic": row.is_electronic,
                        "version": row.version,
                        "actionable": row.actionable,
                        "workflow_structure": row.workflow_structure,
                        "studio_meta": row.studio_meta,
                        "active": row.active,
                        "migrate_workflow": row.migrate_workflow,
                        "migration_status": row.migration_status,
                        "description": row.description,
                        "created_at": row.created_at.isoformat(),
                        "updated_at": row.updated_at.isoformat()
                    }
                return None
                
        except Exception as e:
            logger.error(f"❌ Failed to get KYC workflow template: {e}")
            return None
    
    async def close(self):
        """Close database connections."""
        if self.engine:
            await self.engine.dispose()
            logger.info("✅ Database connections closed")


# Global instance
database_service = DatabaseService()