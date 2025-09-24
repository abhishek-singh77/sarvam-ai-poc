#!/usr/bin/env python3
"""
Migration runner script for KYC tables.

This script helps you run the database migration when you have your database configured.
"""

import os
import sys
import subprocess
from pathlib import Path

def main():
    """Run the database migration."""
    
    # Get the project root directory
    project_root = Path(__file__).parent
    
    print("🚀 KYC Database Migration Runner")
    print("=" * 50)
    
    # Check if alembic.ini exists
    alembic_ini = project_root / "alembic.ini"
    if not alembic_ini.exists():
        print("❌ alembic.ini not found!")
        return 1
    
    # Check if migration file exists
    migration_file = project_root / "alembic" / "versions" / "001_create_kyc_tables.py"
    if not migration_file.exists():
        print("❌ Migration file not found!")
        return 1
    
    print("✅ Migration files found")
    
    # Instructions for the user
    print("\n📋 Before running the migration:")
    print("1. Update alembic.ini with your database credentials")
    print("2. Make sure your database server is running")
    print("3. Create the database if it doesn't exist")
    print("4. Install required dependencies: pip install pymysql")
    
    print(f"\n📝 Current database URL in alembic.ini:")
    with open(alembic_ini, 'r') as f:
        for line in f:
            if line.strip().startswith('sqlalchemy.url'):
                print(f"   {line.strip()}")
                break
    
    # Ask user if they want to proceed
    response = input("\n❓ Do you want to run the migration now? (y/N): ").strip().lower()
    
    if response not in ['y', 'yes']:
        print("⏸️  Migration cancelled. You can run it later with:")
        print("   cd enterprise_app && alembic upgrade head")
        return 0
    
    try:
        # Change to project directory
        os.chdir(project_root)
        
        # Run the migration
        print("\n🔄 Running migration...")
        result = subprocess.run(['alembic', 'upgrade', 'head'], 
                              capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✅ Migration completed successfully!")
            print("\n📊 Migration output:")
            print(result.stdout)
        else:
            print("❌ Migration failed!")
            print("\n🚨 Error output:")
            print(result.stderr)
            return 1
            
    except FileNotFoundError:
        print("❌ Alembic not found! Please install it:")
        print("   pip install alembic")
        return 1
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return 1
    
    print("\n🎉 Database setup complete!")
    print("You can now start using the KYC system.")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
