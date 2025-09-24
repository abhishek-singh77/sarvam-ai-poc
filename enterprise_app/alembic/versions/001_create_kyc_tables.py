"""Create KYC tables

Revision ID: 001
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create kyc_request table
    op.create_table('kyc_request',
        sa.Column('seq_id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('id', sa.String(length=100), nullable=False),
        sa.Column('client_reference_id', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('owner_id', sa.String(length=100), nullable=True),
        sa.Column('sub_user_id', sa.String(length=100), nullable=True),
        sa.Column('actioner_id', sa.String(length=100), nullable=True),
        sa.Column('customer_identifier', sa.String(length=100), nullable=True),
        sa.Column('customer_name', sa.String(length=100), nullable=True),
        sa.Column('transaction_id', sa.String(length=100), nullable=True),
        sa.Column('expire_in_days', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=100), nullable=True),
        sa.Column('template_id', sa.String(length=100), nullable=True),
        sa.Column('strict_assign', mysql.TINYINT(display_width=1), nullable=True),
        sa.Column('request_details', sa.String(length=500), nullable=True),
        sa.Column('processing_done', mysql.TINYINT(display_width=1), nullable=True),
        sa.Column('is_internal', mysql.TINYINT(display_width=1), nullable=False),
        sa.Column('additional_validations', sa.Text(), nullable=True),
        sa.Column('auditor_identifier', sa.String(length=100), nullable=True),
        sa.Column('auditor_name', sa.String(length=100), nullable=True),
        sa.Column('auto_approved', mysql.TINYINT(), nullable=True),
        sa.Column('post_request_status_invocations', sa.Text(), nullable=True),
        sa.Column('expire_on', sa.DateTime(), nullable=True),
        sa.Column('soft_deleted', mysql.TINYINT(display_width=1), nullable=False),
        sa.Column('auditor_actions', sa.String(length=2000), nullable=True),
        sa.Column('kyc_request_data', sa.Text(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('initiated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('seq_id'),
        sa.Index('kyc_request_owner_idx', 'owner_id', 'sub_user_id'),
        sa.Index('kyc_request_crn_idx', 'client_reference_id'),
        sa.Index('kyc_request_customer_identifier_idx', 'customer_identifier'),
        sa.Index('idx_kyc_request_1', 'status', 'processing_done'),
        sa.Index('idx_auditor_identifier', 'auditor_identifier')
    )

    # Create kyc_action table
    op.create_table('kyc_action',
        sa.Column('seq_id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('id', sa.String(length=100), nullable=False),
        sa.Column('request_id', sa.String(length=100), nullable=True),
        sa.Column('owner_id', sa.String(length=100), nullable=True),
        sa.Column('sub_user_id', sa.String(length=100), nullable=True),
        sa.Column('actioner_id', sa.String(length=100), nullable=True),
        sa.Column('description', sa.String(length=100), nullable=True),
        sa.Column('strict_validation', mysql.TINYINT(display_width=1), nullable=True),
        sa.Column('file_id', sa.String(length=100), nullable=True),
        sa.Column('sub_file_id', sa.String(length=100), nullable=True),
        sa.Column('method', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=100), nullable=True),
        sa.Column('title', sa.String(length=100), nullable=True),
        sa.Column('type', sa.String(length=100), nullable=True),
        sa.Column('optional', mysql.TINYINT(display_width=1), nullable=False),
        sa.Column('action_ref', sa.String(length=100), nullable=True),
        sa.Column('strict_validation_type', sa.String(length=100), nullable=True),
        sa.Column('validation_mode', sa.String(length=50), nullable=True),
        sa.Column('validation_result', sa.BLOB(), nullable=True),
        sa.Column('otp', sa.String(length=100), nullable=True),
        sa.Column('video_length', sa.Integer(), nullable=True),
        sa.Column('image_upload_mode', sa.String(length=50), nullable=True),
        sa.Column('execution_request_id', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('allow_image_upload', mysql.TINYINT(display_width=1), nullable=True),
        sa.Column('processing_done', mysql.TINYINT(display_width=1), nullable=True),
        sa.Column('face_match_obj_type', sa.String(length=100), nullable=True),
        sa.Column('face_match_result', sa.String(length=100), nullable=True),
        sa.Column('face_match_result_meta', sa.String(length=5000), nullable=True),
        sa.Column('face_match_status', sa.String(length=50), nullable=True),
        sa.Column('obj_analysis_result_id', sa.String(length=5000), nullable=True),
        sa.Column('obj_analysis_status', sa.String(length=50), nullable=True),
        sa.Column('allow_ocr_data_update', mysql.TINYINT(display_width=1), nullable=True),
        sa.Column('id_card_data_id', sa.String(length=100), nullable=True),
        sa.Column('rules_data', sa.Text(), nullable=True),
        sa.Column('config_data', sa.Text(), nullable=True),
        sa.Column('latitude', sa.String(length=50), nullable=True),
        sa.Column('longitude', sa.String(length=50), nullable=True),
        sa.Column('retry_count', sa.Integer(), nullable=True),
        sa.Column('verification_method', sa.String(length=50), nullable=True),
        sa.Column('input_data', sa.Text(), nullable=True),
        sa.Column('action_data', sa.Text(), nullable=True),
        sa.Column('initiated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('seq_id'),
        sa.Index('kyc_action_owner_idx', 'owner_id', 'sub_user_id'),
        sa.Index('kyc_action_request_id_idx', 'request_id')
    )

    # Create kyc_sub_action table
    op.create_table('kyc_sub_action',
        sa.Column('seq_id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('id', sa.String(length=100), nullable=False),
        sa.Column('action_id', sa.String(length=100), nullable=True),
        sa.Column('owner_id', sa.String(length=100), nullable=True),
        sa.Column('sub_user_id', sa.String(length=100), nullable=True),
        sa.Column('actioner', sa.String(length=100), nullable=True),
        sa.Column('input_data', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=100), nullable=False),
        sa.Column('type', sa.String(length=100), nullable=False),
        sa.Column('title', sa.String(length=100), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('optional', mysql.TINYINT(display_width=1), nullable=False),
        sa.Column('perform_enrichment', mysql.TINYINT(), nullable=True),
        sa.Column('obj_analysis_status', sa.String(length=50), nullable=True),
        sa.Column('obj_analysis_result_id', sa.String(length=100), nullable=True),
        sa.Column('strict_validation_type', sa.String(length=50), nullable=True),
        sa.Column('face_match_obj_type', sa.String(length=100), nullable=True),
        sa.Column('face_match_result', sa.String(length=100), nullable=True),
        sa.Column('face_match_result_meta', sa.String(length=5000), nullable=True),
        sa.Column('face_match_status', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('doc_file_id', sa.String(length=100), nullable=True),
        sa.Column('doc_sub_file_id', sa.String(length=100), nullable=True),
        sa.Column('plugin_meta_data', sa.Text(), nullable=True),
        sa.Column('property_rules', sa.Text(), nullable=True),
        sa.Column('sub_action_ref', sa.Text(), nullable=True),
        sa.Column('sub_action_step', sa.String(length=100), nullable=False),
        sa.Column('global_variables', sa.Text(), nullable=True),
        sa.Column('attribute', sa.BLOB(), nullable=True),
        sa.Column('id_card_data_id', sa.String(length=50), nullable=True),
        sa.Column('validation_result', sa.BLOB(), nullable=True),
        sa.PrimaryKeyConstraint('seq_id'),
        sa.Index('kyc_sub_action_owner_idx', 'owner_id', 'sub_user_id'),
        sa.Index('kyc_sub_action_action_id_idx', 'action_id')
    )

    # Create kyc_workflow_template table
    op.create_table('kyc_workflow_template',
        sa.Column('seq_id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('id', sa.String(length=100), nullable=True),
        sa.Column('owner_id', sa.String(length=100), nullable=True),
        sa.Column('sub_user_id', sa.String(length=100), nullable=True),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('type', sa.String(length=20), nullable=True),
        sa.Column('is_electronic', mysql.TINYINT(display_width=1), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('actionable', sa.BLOB(), nullable=False),
        sa.Column('workflow_structure', sa.BLOB(), nullable=True),
        sa.Column('studio_meta', sa.Text(), nullable=True),
        sa.Column('active', mysql.TINYINT(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('migrate_workflow', mysql.TINYINT(display_width=1), nullable=True),
        sa.Column('migration_status', sa.String(length=50), nullable=True),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.PrimaryKeyConstraint('seq_id')
    )


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table('kyc_workflow_template')
    op.drop_table('kyc_sub_action')
    op.drop_table('kyc_action')
    op.drop_table('kyc_request')
