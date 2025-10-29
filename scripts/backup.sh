#!/bin/bash
# Depotix Backup Script
# Creates backups of database and configuration
# Run daily via cron

set -euo pipefail

BACKUP_DIR="/home/deploy/backups"
TIMESTAMP=$(date +%F_%H%M)
RETENTION_DAYS=7

echo "=== Depotix Backup Script ==="
echo "Date: $(date)"
echo ""

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Navigate to project directory
cd /home/deploy/Depotix/server

echo "=== Backing up PostgreSQL Database ==="
docker exec server-postgres-1 pg_dumpall -U depotix | \
    gzip -9 > "$BACKUP_DIR/postgres_${TIMESTAMP}.sql.gz"

if [ -f "$BACKUP_DIR/postgres_${TIMESTAMP}.sql.gz" ]; then
    SIZE=$(ls -lh "$BACKUP_DIR/postgres_${TIMESTAMP}.sql.gz" | awk '{print $5}')
    echo "✅ Database backup created: postgres_${TIMESTAMP}.sql.gz ($SIZE)"
else
    echo "❌ Database backup failed!"
    exit 1
fi

echo ""
echo "=== Backing up Configuration Files ==="
tar -czf "$BACKUP_DIR/config_${TIMESTAMP}.tgz" \
    compose.yml \
    compose.override.yml \
    Caddyfile \
    .env

if [ -f "$BACKUP_DIR/config_${TIMESTAMP}.tgz" ]; then
    SIZE=$(ls -lh "$BACKUP_DIR/config_${TIMESTAMP}.tgz" | awk '{print $5}')
    echo "✅ Config backup created: config_${TIMESTAMP}.tgz ($SIZE)"
else
    echo "❌ Config backup failed!"
    exit 1
fi

echo ""
echo "=== Removing Old Backups (older than $RETENTION_DAYS days) ==="
find "$BACKUP_DIR" -name "postgres_*.sql.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "config_*.tgz" -mtime +$RETENTION_DAYS -delete

echo ""
echo "=== Current Backups ==="
ls -lh "$BACKUP_DIR" | tail -10

echo ""
echo "=== Backup Complete ==="
echo "Location: $BACKUP_DIR"
echo "Database: postgres_${TIMESTAMP}.sql.gz"
echo "Config: config_${TIMESTAMP}.tgz"
