# Database Setup Guide

This guide will help you set up the database for the KYC verification system.

## Prerequisites

1. **MySQL Database Server** - Make sure MySQL is installed and running
2. **Python Dependencies** - Install required packages:
    ```bash
    pip install pymysql sqlalchemy alembic
    ```

## Database Configuration

### 1. Create Database

First, create a database for the KYC system:

```sql
CREATE DATABASE kyc_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Create Database User (Optional but Recommended)

```sql
CREATE USER 'kyc_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON kyc_db.* TO 'kyc_user'@'localhost';
FLUSH PRIVILEGES;
```

### 3. Update Configuration

Edit `alembic.ini` and update the database URL:

```ini
sqlalchemy.url = mysql+pymysql://kyc_user:your_secure_password@localhost:3306/kyc_db
```

Or if using root user:

```ini
sqlalchemy.url = mysql+pymysql://root:your_password@localhost:3306/kyc_db
```

## Running the Migration

### Option 1: Using the Migration Runner Script

```bash
cd enterprise_app
python run_migration.py
```

### Option 2: Using Alembic Directly

```bash
cd enterprise_app
alembic upgrade head
```

## Database Schema

The migration will create the following tables:

### 1. `kyc_request`

-   Main table for KYC requests
-   Contains request metadata, customer info, and status
-   Key fields: `id`, `client_reference_id`, `owner_id`, `status`

### 2. `kyc_action`

-   Actions within a KYC request
-   Each request can have multiple actions
-   Key fields: `id`, `request_id`, `type`, `status`, `validation_result`

### 3. `kyc_sub_action`

-   Sub-actions within an action
-   Granular steps like selfie capture, liveness check, etc.
-   Key fields: `id`, `action_id`, `type`, `status`, `input_data`

### 4. `kyc_workflow_template`

-   Templates for different KYC workflows
-   Defines the structure and steps for each workflow type
-   Key fields: `id`, `name`, `type`, `actionable`, `workflow_structure`

## Usage in Code

### Environment Variables

Add these to your `.env` file:

```env
# Database Configuration
DATABASE_URL=mysql+aiomysql://kyc_user:your_secure_password@localhost:3306/kyc_db
DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=20

# Storage Configuration
UPLOAD_DIR=uploads
DATA_DIR=data
```

### Using the Models

```python
from models.verification_models import KYCRequest, KYCAction, KYCSubAction, KYCWorkflowTemplate
from services.database_service import db_service

# Create a new KYC request
async with db_service.get_session() as session:
    kyc_request = KYCRequest(
        id="req_123",
        client_reference_id="client_456",
        owner_id="owner_789",
        customer_identifier="customer_001",
        status="active",
        expire_in_days=30
    )
    session.add(kyc_request)
    await session.commit()
```

## Troubleshooting

### Common Issues

1. **Connection Refused**

    - Check if MySQL server is running
    - Verify host and port in connection string

2. **Access Denied**

    - Check username and password
    - Verify user has proper permissions

3. **Database Not Found**

    - Make sure the database exists
    - Check database name in connection string

4. **Migration Fails**
    - Check if tables already exist
    - Verify database permissions
    - Check for syntax errors in migration file

### Checking Migration Status

```bash
cd enterprise_app
alembic current
alembic history
```

### Rolling Back Migration

```bash
cd enterprise_app
alembic downgrade -1  # Go back one revision
alembic downgrade base  # Go back to beginning
```

## Production Considerations

1. **Security**

    - Use strong passwords
    - Limit database user permissions
    - Use SSL connections in production

2. **Performance**

    - Add appropriate indexes
    - Monitor query performance
    - Consider connection pooling

3. **Backup**
    - Set up regular database backups
    - Test restore procedures
    - Keep migration files in version control

## Support

If you encounter issues:

1. Check the logs in `logs/app.log`
2. Verify database connectivity
3. Check Alembic migration status
4. Review the migration file for syntax errors
