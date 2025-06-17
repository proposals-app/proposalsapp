#!/bin/bash
# Post-initialization script for PostgreSQL
# This script is run after the PostgreSQL cluster is initialized

set -e

# Create the proposalsapp database if it doesn't exist
echo "Creating proposalsapp database if it doesn't exist..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    SELECT 'CREATE DATABASE proposalsapp OWNER proposalsapp'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'proposalsapp')\\gexec
EOSQL

echo "Database initialization complete."