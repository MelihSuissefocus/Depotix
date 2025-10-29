#!/bin/bash
# Depotix Health Check Script
# Monitors production health and alerts on issues
# Run every 5 minutes via cron

set -euo pipefail

ALERT_EMAIL="${ALERT_EMAIL:-}" # Set via environment or cron
LOG_FILE="/home/deploy/logs/health-check.log"

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to send alert (placeholder - configure as needed)
alert() {
    log "ALERT: $1"
    # Add email/Slack notification here if needed
    # Example: echo "$1" | mail -s "Depotix Alert" "$ALERT_EMAIL"
}

log "=== Starting Health Check ==="

# Check 1: Production endpoint
if curl -fsSL https://depotix.ch/healthz > /dev/null 2>&1; then
    log "✅ Production endpoint healthy"
else
    alert "❌ Production endpoint failed!"
    exit 1
fi

# Check 2: Container health
UNHEALTHY=$(docker compose -f /home/deploy/Depotix/server/compose.yml ps --format json | \
    grep -v '"Health":"healthy"' | grep -v '"Health":""' | wc -l)

if [ "$UNHEALTHY" -eq 0 ]; then
    log "✅ All containers healthy"
else
    alert "❌ $UNHEALTHY unhealthy container(s) detected!"
    docker compose -f /home/deploy/Depotix/server/compose.yml ps | tee -a "$LOG_FILE"
fi

# Check 3: Disk space
DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    log "✅ Disk usage: ${DISK_USAGE}%"
else
    alert "⚠️  High disk usage: ${DISK_USAGE}%"
fi

# Check 4: Memory usage
MEM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
if [ "$MEM_USAGE" -lt 90 ]; then
    log "✅ Memory usage: ${MEM_USAGE}%"
else
    alert "⚠️  High memory usage: ${MEM_USAGE}%"
fi

# Check 5: Expected ports only
UNEXPECTED_PORTS=$(ss -tulpen | grep LISTEN | grep -vE ':(80|443|22)$' | grep -vE '^127\.' | grep ':' | wc -l)
if [ "$UNEXPECTED_PORTS" -eq 0 ]; then
    log "✅ No unexpected exposed ports"
else
    alert "❌ Unexpected ports detected: $UNEXPECTED_PORTS"
    ss -tulpen | grep LISTEN | tee -a "$LOG_FILE"
fi

log "=== Health Check Complete ==="
echo ""
