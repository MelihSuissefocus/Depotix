#!/bin/bash
# Depotix Cleanup Script
# Removes dangling images and unused resources
# Run weekly via cron

set -euo pipefail

echo "=== Depotix Cleanup Script ==="
echo "Date: $(date)"
echo ""

# Navigate to project directory
cd /home/deploy/Depotix/server

# Show disk usage before
echo "=== Disk Usage Before ==="
df -h / | tail -1
echo ""

# Show Docker disk usage before
echo "=== Docker Disk Usage Before ==="
docker system df
echo ""

# Remove dangling images
echo "=== Removing Dangling Images ==="
docker image prune -f

# Remove stopped containers (if any)
echo "=== Removing Stopped Containers ==="
docker container prune -f

# Remove unused networks (if any)
echo "=== Removing Unused Networks ==="
docker network prune -f

# DO NOT auto-prune volumes - requires manual confirmation
echo "=== Skipping Volume Cleanup (manual only) ==="
echo "To manually clean volumes: docker volume prune"
echo ""

# Show disk usage after
echo "=== Disk Usage After ==="
df -h / | tail -1
echo ""

# Show Docker disk usage after
echo "=== Docker Disk Usage After ==="
docker system df
echo ""

# Verify services are still running
echo "=== Verifying Services ==="
docker compose ps
echo ""

# Health check
echo "=== Production Health Check ==="
if curl -fsSL https://depotix.ch/healthz > /dev/null 2>&1; then
    echo "✅ Production is healthy"
else
    echo "❌ Production health check failed!"
    exit 1
fi

echo ""
echo "=== Cleanup Complete ==="
