#!/usr/bin/env python3
"""
Database models for verification and KYC data.

This module defines SQLAlchemy models for storing verification results,
uploaded files, and session data following the standardized KYC schema.
"""

from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Float, JSON, ForeignKey, BLOB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.mysql import LONGTEXT, TINYINT

Base = declarative_base()


class KYCRequest(Base):
    """Model for storing KYC request information."""
    
    __tablename__ = "kyc_request"
    
    seq_id = Column(Integer, primary_key=True, autoincrement=True)
    id = Column(String(100), nullable=False, index=True)
    client_reference_id = Column(String(100), nullable=True, index=True)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    owner_id = Column(String(100), nullable=True, index=True)
    sub_user_id = Column(String(100), nullable=True, index=True)
    actioner_id = Column(String(100), nullable=True)
    customer_identifier = Column(String(100), nullable=True, index=True)
    customer_name = Column(String(100), nullable=True)
    transaction_id = Column(String(100), nullable=True)
    expire_in_days = Column(Integer, nullable=False)
    status = Column(String(100), nullable=True, index=True)
    template_id = Column(String(100), nullable=True)
    strict_assign = Column(TINYINT(1), nullable=True)
    request_details = Column(String(500), nullable=True)
    processing_done = Column(TINYINT(1), nullable=True, default=0)
    is_internal = Column(TINYINT(1), nullable=False, default=0)
    additional_validations = Column(Text, nullable=True)
    auditor_identifier = Column(String(100), nullable=True, index=True)
    auditor_name = Column(String(100), nullable=True)
    auto_approved = Column(TINYINT, nullable=True)
    post_request_status_invocations = Column(Text, nullable=True)
    expire_on = Column(DateTime, nullable=True)
    soft_deleted = Column(TINYINT(1), nullable=False, default=0)
    auditor_actions = Column(String(2000), nullable=True)
    kyc_request_data = Column(Text, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    initiated_at = Column(DateTime, nullable=True)
    
    # Relationships
    actions = relationship("KYCAction", back_populates="request")


class KYCAction(Base):
    """Model for storing KYC action information."""
    
    __tablename__ = "kyc_action"
    
    seq_id = Column(Integer, primary_key=True, autoincrement=True)
    id = Column(String(100), nullable=False, index=True)
    request_id = Column(String(100), nullable=True, index=True)
    owner_id = Column(String(100), nullable=True, index=True)
    sub_user_id = Column(String(100), nullable=True, index=True)
    actioner_id = Column(String(100), nullable=True)
    description = Column(String(100), nullable=True)
    strict_validation = Column(TINYINT(1), nullable=True)
    file_id = Column(String(100), nullable=True)
    sub_file_id = Column(String(100), nullable=True)
    method = Column(String(100), nullable=True)
    status = Column(String(100), nullable=True)
    title = Column(String(100), nullable=True)
    type = Column(String(100), nullable=True)
    optional = Column(TINYINT(1), nullable=False, default=0)
    action_ref = Column(String(100), nullable=True)
    strict_validation_type = Column(String(100), nullable=True)
    validation_mode = Column(String(50), nullable=True)
    validation_result = Column(BLOB, nullable=True)
    otp = Column(String(100), nullable=True)
    video_length = Column(Integer, nullable=True)
    image_upload_mode = Column(String(50), nullable=True)
    execution_request_id = Column(String(100), nullable=True)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    allow_image_upload = Column(TINYINT(1), nullable=True)
    processing_done = Column(TINYINT(1), nullable=True)
    face_match_obj_type = Column(String(100), nullable=True)
    face_match_result = Column(String(100), nullable=True)
    face_match_result_meta = Column(String(5000), nullable=True)
    face_match_status = Column(String(50), nullable=True)
    obj_analysis_result_id = Column(String(5000), nullable=True)
    obj_analysis_status = Column(String(50), nullable=True)
    allow_ocr_data_update = Column(TINYINT(1), nullable=True)
    id_card_data_id = Column(String(100), nullable=True)
    rules_data = Column(Text, nullable=True)
    config_data = Column(Text, nullable=True)
    latitude = Column(String(50), nullable=True)
    longitude = Column(String(50), nullable=True)
    retry_count = Column(Integer, nullable=True, default=0)
    verification_method = Column(String(50), nullable=True)
    input_data = Column(Text, nullable=True)
    action_data = Column(Text, nullable=True)
    initiated_at = Column(DateTime, nullable=True)
    
    # Relationships
    request = relationship("KYCRequest", back_populates="actions")
    sub_actions = relationship("KYCSubAction", back_populates="action")


class KYCSubAction(Base):
    """Model for storing KYC sub-action information."""
    
    __tablename__ = "kyc_sub_action"
    
    seq_id = Column(Integer, primary_key=True, autoincrement=True)
    id = Column(String(100), nullable=False, index=True)
    action_id = Column(String(100), nullable=True, index=True)
    owner_id = Column(String(100), nullable=True, index=True)
    sub_user_id = Column(String(100), nullable=True, index=True)
    actioner = Column(String(100), nullable=True)
    input_data = Column(Text, nullable=True)
    status = Column(String(100), nullable=False)
    type = Column(String(100), nullable=False)
    title = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    optional = Column(TINYINT(1), nullable=False, default=0)
    perform_enrichment = Column(TINYINT, nullable=True)
    obj_analysis_status = Column(String(50), nullable=True)
    obj_analysis_result_id = Column(String(100), nullable=True)
    strict_validation_type = Column(String(50), nullable=True)
    face_match_obj_type = Column(String(100), nullable=True)
    face_match_result = Column(String(100), nullable=True)
    face_match_result_meta = Column(String(5000), nullable=True)
    face_match_status = Column(String(50), nullable=True)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    doc_file_id = Column(String(100), nullable=True)
    doc_sub_file_id = Column(String(100), nullable=True)
    plugin_meta_data = Column(Text, nullable=True)
    property_rules = Column(Text, nullable=True)
    sub_action_ref = Column(Text, nullable=True)
    sub_action_step = Column(String(100), nullable=False, default='PRE')
    global_variables = Column(Text, nullable=True)
    attribute = Column(BLOB, nullable=True)
    id_card_data_id = Column(String(50), nullable=True)
    validation_result = Column(BLOB, nullable=True)
    
    # Relationships
    action = relationship("KYCAction", back_populates="sub_actions")


class KYCWorkflowTemplate(Base):
    """Model for storing KYC workflow templates."""
    
    __tablename__ = "kyc_workflow_template"
    
    seq_id = Column(Integer, primary_key=True, autoincrement=True)
    id = Column(String(100), nullable=True)
    owner_id = Column(String(100), nullable=True)
    sub_user_id = Column(String(100), nullable=True)
    name = Column(String(100), nullable=False, default='')
    type = Column(String(20), nullable=True)
    is_electronic = Column(TINYINT(1), nullable=False, default=0)
    version = Column(Integer, nullable=False)
    actionable = Column(BLOB, nullable=False)
    workflow_structure = Column(BLOB, nullable=True)
    studio_meta = Column(Text, nullable=True)
    active = Column(TINYINT, nullable=True, default=1)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    migrate_workflow = Column(TINYINT(1), nullable=True, default=0)
    migration_status = Column(String(50), nullable=True)
    description = Column(String(500), nullable=True)
