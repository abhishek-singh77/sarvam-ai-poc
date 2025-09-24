# Database Migration Summary

## Overview

This document summarizes the database migration setup for the KYC verification system, which now follows a standardized schema that matches your existing KYC infrastructure.

## What Was Created

### 1. Database Models (`models/verification_models.py`)

Updated to use the standardized KYC schema with four main tables:

-   **`kyc_request`** - Main table for KYC requests
-   **`kyc_action`** - Actions within a KYC request
-   **`kyc_sub_action`** - Sub-actions within an action
-   **`kyc_workflow_template`** - Templates for different KYC workflows

### 2. Migration Files

-   **`alembic/versions/001_create_kyc_tables.py`** - Manual migration file
-   **`alembic.ini`** - Alembic configuration
-   **`alembic/env.py`** - Alembic environment setup

### 3. Database Service (`services/database_service.py`)

Updated to work with the new KYC models and provide CRUD operations for:

-   KYC Requests
-   KYC Actions
-   KYC Sub-Actions
-   KYC Workflow Templates

### 4. Helper Scripts

-   **`run_migration.py`** - Interactive migration runner
-   **`examples/kyc_database_example.py`** - Usage examples
-   **`DATABASE_SETUP.md`** - Complete setup guide

## Database Schema

### kyc_request Table

```sql
CREATE TABLE `kyc_request` (
  `seq_id` int NOT NULL AUTO_INCREMENT,
  `id` varchar(100) NOT NULL,
  `client_reference_id` varchar(100) DEFAULT NULL,
  `owner_id` varchar(100) DEFAULT NULL,
  `sub_user_id` varchar(100) DEFAULT NULL,
  `customer_identifier` varchar(100) DEFAULT NULL,
  `customer_name` varchar(100) DEFAULT NULL,
  `status` varchar(100) DEFAULT NULL,
  `template_id` varchar(100) DEFAULT NULL,
  `expire_in_days` int NOT NULL,
  -- ... other fields
  PRIMARY KEY (`seq_id`)
);
```

### kyc_action Table

```sql
CREATE TABLE `kyc_action` (
  `seq_id` int NOT NULL AUTO_INCREMENT,
  `id` varchar(100) NOT NULL,
  `request_id` varchar(100) DEFAULT NULL,
  `owner_id` varchar(100) DEFAULT NULL,
  `sub_user_id` varchar(100) DEFAULT NULL,
  `type` varchar(100) DEFAULT NULL,
  `status` varchar(100) DEFAULT NULL,
  `title` varchar(100) DEFAULT NULL,
  `verification_method` varchar(50) DEFAULT NULL,
  `face_match_result` varchar(100) DEFAULT NULL,
  `face_match_status` varchar(50) DEFAULT NULL,
  -- ... other fields
  PRIMARY KEY (`seq_id`)
);
```

### kyc_sub_action Table

```sql
CREATE TABLE `kyc_sub_action` (
  `seq_id` int NOT NULL AUTO_INCREMENT,
  `id` varchar(100) NOT NULL,
  `action_id` varchar(100) DEFAULT NULL,
  `owner_id` varchar(100) DEFAULT NULL,
  `sub_user_id` varchar(100) DEFAULT NULL,
  `type` varchar(100) NOT NULL,
  `status` varchar(100) NOT NULL,
  `title` varchar(100) DEFAULT NULL,
  `input_data` text,
  `sub_action_step` varchar(100) NOT NULL DEFAULT 'PRE',
  -- ... other fields
  PRIMARY KEY (`seq_id`)
);
```

### kyc_workflow_template Table

```sql
CREATE TABLE `kyc_workflow_template` (
  `seq_id` int unsigned NOT NULL AUTO_INCREMENT,
  `id` varchar(100) DEFAULT NULL,
  `owner_id` varchar(100) DEFAULT NULL,
  `name` varchar(100) NOT NULL DEFAULT '',
  `type` varchar(20) DEFAULT NULL,
  `version` int NOT NULL,
  `actionable` blob NOT NULL,
  `workflow_structure` blob,
  `active` tinyint DEFAULT '1',
  -- ... other fields
  PRIMARY KEY (`seq_id`)
);
```

## How to Run the Migration

### Step 1: Set up Database

```sql
CREATE DATABASE kyc_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'kyc_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON kyc_db.* TO 'kyc_user'@'localhost';
FLUSH PRIVILEGES;
```

### Step 2: Update Configuration

Edit `alembic.ini`:

```ini
sqlalchemy.url = mysql+pymysql://kyc_user:your_password@localhost:3306/kyc_db
```

### Step 3: Run Migration

```bash
cd enterprise_app
python run_migration.py
```

Or manually:

```bash
cd enterprise_app
alembic upgrade head
```

## Usage Examples

### Creating a KYC Request

```python
from services.database_service import database_service

kyc_request_data = {
    "id": "req_001",
    "client_reference_id": "client_123",
    "owner_id": "owner_456",
    "customer_identifier": "customer_001",
    "customer_name": "John Doe",
    "status": "active",
    "expire_in_days": 30
}

kyc_request = await database_service.create_kyc_request(kyc_request_data)
```

### Creating a KYC Action

```python
kyc_action_data = {
    "id": "action_001",
    "request_id": "req_001",
    "type": "selfie_capture",
    "title": "Selfie Capture",
    "status": "pending",
    "verification_method": "liveness_detection"
}

kyc_action = await database_service.create_kyc_action(kyc_action_data)
```

### Creating Sub-Actions

```python
sub_action_data = {
    "id": "sub_action_001",
    "action_id": "action_001",
    "type": "liveness_detection",
    "title": "Liveness Detection",
    "status": "pending",
    "sub_action_step": "PROCESS",
    "input_data": json.dumps({
        "threshold": 0.8,
        "liveness_type": "passive"
    })
}

sub_action = await database_service.create_kyc_sub_action(sub_action_data)
```

## Integration with Existing System

The new database schema is designed to work seamlessly with your existing KYC infrastructure:

1. **Room ID Mapping**: The `room_id` from your video SDK can be stored in the `client_reference_id` field
2. **Workflow Templates**: Store your workflow definitions in the `kyc_workflow_template` table
3. **Action Tracking**: Each verification step becomes a `kyc_action` with multiple `kyc_sub_action` entries
4. **Result Storage**: Verification results are stored in the `validation_result` and `face_match_result` fields

## Next Steps

1. **Run the migration** using the provided scripts
2. **Update your API endpoints** to use the new database service
3. **Test the integration** with the example script
4. **Update your frontend** to work with the new data structure

## Files Modified/Created

### New Files:

-   `models/verification_models.py` (updated)
-   `services/database_service.py` (updated)
-   `alembic/versions/001_create_kyc_tables.py`
-   `run_migration.py`
-   `examples/kyc_database_example.py`
-   `DATABASE_SETUP.md`
-   `MIGRATION_SUMMARY.md`

### Updated Files:

-   `alembic.ini`
-   `alembic/env.py`
-   `requirements.txt` (already had required dependencies)

## Support

If you encounter any issues:

1. Check the `DATABASE_SETUP.md` for detailed troubleshooting
2. Review the example script for usage patterns
3. Check the logs in `logs/app.log`
4. Verify database connectivity and permissions

The migration is now ready to run when you have your database configured!
