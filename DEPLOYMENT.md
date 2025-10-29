# Depotix Deployment Documentation

**Last Updated:** 2025-10-16
**Production URL:** https://depotix.ch

---

## Architecture Overview

```
Internet (HTTPS :443)
    ↓
[Caddy Reverse Proxy]
    ↓
    ├─→ [Web - Next.js Frontend] :3000 (internal)
    ├─→ [API - Django Backend] :8000 (internal)
    └─→ [PostgreSQL 16] :5432 (internal)
```

### Services

| Service | Container | Image | Port (Internal) | Status |
|---------|-----------|-------|-----------------|--------|
| Reverse Proxy | server-caddy-1 | caddy:2 | 80, 443 (external) | Production |
| Frontend | server-web-1 | server-web:latest | 3000 (internal) | Production |
| Backend | server-api-1 | server-api:latest | 8000 (internal) | Production |
| Database | server-postgres-1 | postgres:16 | 5432 (internal) | Production |

---

## Deployment Commands

### Start All Services
```bash
cd /home/deploy/Depotix/server
docker compose up -d
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f web
```

### Restart Services
```bash
# All services
docker compose restart

# Specific service
docker compose restart api
```

### Stop All Services
```bash
docker compose down
```

### Build & Deploy New Version
```bash
cd /home/deploy/Depotix/server

# Build new images
docker compose build web api

# Deploy with zero-downtime
docker compose up -d --no-deps --build web api

# Restart Caddy to refresh connections
docker compose restart caddy
```

---

## Health Checks

### Production Health Check
```bash
curl -fsSL https://depotix.ch/healthz
# Expected: {"ok": true}
```

### Individual Service Checks
```bash
# Web (Next.js)
docker exec server-web-1 wget -qO- http://web:3000/ | head -20

# API (Django)
docker exec server-api-1 curl -H "Host: depotix.ch" http://localhost:8000/healthz

# PostgreSQL
docker exec server-postgres-1 pg_isready -U depotix -d depotix
```

### Port Security Audit
```bash
# Should only show ports 80 and 443
ss -tulpen | grep LISTEN | grep -E ':(80|443)$'

# Verify no unexpected ports
ss -tulpen | grep LISTEN | grep -vE ':(80|443|22)$' | grep -vE '^127\.'
```

---

## Backup & Restore

### Database Backup
```bash
# Create backup
docker exec server-postgres-1 pg_dumpall -U depotix | gzip -9 > /home/deploy/backup_$(date +%F_%H%M).sql.gz

# Restore from backup
gunzip -c /home/deploy/backup_YYYY-MM-DD_HHMM.sql.gz | \
  docker exec -i server-postgres-1 psql -U depotix postgres
```

### Configuration Backup
```bash
cd /home/deploy/Depotix/server
tar -czf /home/deploy/config_backup_$(date +%F_%H%M).tgz \
  compose.yml compose.override.yml Caddyfile .env
```

---

## Security Hardening

### Exposed Ports
- ✅ **Port 80:** HTTP (auto-redirects to HTTPS)
- ✅ **Port 443:** HTTPS (Caddy)
- ❌ **Port 3000:** NOT exposed (web internal)
- ❌ **Port 5432:** NOT exposed (postgres internal)
- ❌ **Port 8000:** NOT exposed (api internal)

### SSL/TLS
- Automatic SSL certificates via Let's Encrypt (Caddy)
- Certificates stored in `server_caddy_data` volume
- Auto-renewal enabled

### Network Isolation
All services run on isolated bridge network `server_appnet`:
- Only Caddy exposes external ports
- Inter-service communication via service names
- Database not accessible from outside

---

## Troubleshooting

### Service Won't Start
```bash
# Check logs
docker compose logs <service-name>

# Check health status
docker compose ps

# Restart service
docker compose restart <service-name>
```

### Database Connection Issues
```bash
# Check if database is accepting connections
docker exec server-postgres-1 pg_isready -U depotix -d depotix

# Check active connections
docker exec server-postgres-1 psql -U depotix -d depotix -c \
  "SELECT count(*) FROM pg_stat_activity WHERE datname='depotix';"
```

### SSL Certificate Issues
```bash
# Check Caddy logs
docker logs server-caddy-1 | grep -i certificate

# Force certificate renewal
docker exec server-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

### High Memory Usage
```bash
# Check current usage
docker stats --no-stream

# Resource limits are defined in compose.yml:
# - web: 1GB max
# - api: 1GB max
# - postgres: 512MB max
# - caddy: 256MB max
```

---

## Rollback Procedure

### Emergency Rollback
```bash
cd /home/deploy/Depotix/server

# 1. Restore previous compose.yml
cp compose.yml.backup.YYYY-MM-DD_HHMM compose.yml

# 2. Restart stack
docker compose down
docker compose up -d

# 3. Verify
curl -fsSL https://depotix.ch/healthz
```

### Database Rollback
```bash
# Restore from backup (CAUTION: This overwrites current data!)
gunzip -c /home/deploy/pg16_all_YYYY-MM-DD_HHMM.sql.gz | \
  docker exec -i server-postgres-1 psql -U depotix postgres
```

---

## Monitoring

### Key Metrics to Monitor
- **Health endpoint:** https://depotix.ch/healthz
- **Container health:** `docker compose ps`
- **Resource usage:** `docker stats`
- **Disk space:** `df -h /`
- **Logs:** `docker compose logs -f --tail=100`

### Expected Behavior
- All containers should show "(healthy)" status
- Response times < 500ms for health endpoint
- Memory usage should stay below limits
- No error logs under normal operation

---

## Environment Variables

Environment variables are stored in `/home/deploy/Depotix/server/.env`

**Required variables:**
- `DJANGO_SECRET_KEY`
- `DJANGO_ALLOWED_HOSTS`
- `DATABASE_URL`
- `POSTGRES_PASSWORD`
- `NEXT_PUBLIC_API_BASE_URL`
- `CORS_ALLOWED_ORIGINS`

**Security:** Never commit `.env` to version control!

---

## Contact & Support

- **Production URL:** https://depotix.ch
- **Server Location:** /home/deploy/Depotix/server
- **Logs Location:** `docker compose logs`
- **Backups Location:** /home/deploy/

---

## Change Log

### 2025-10-16: Infrastructure Consolidation
- ✅ Consolidated all services into single Docker Compose stack
- ✅ Removed legacy postgres:15 database (depotix-db-1)
- ✅ Closed external port 5432 (database)
- ✅ Closed external port 8000 (API)
- ✅ Added health checks for all services
- ✅ Added resource limits (CPU/Memory)
- ✅ Achieved 100% network isolation (only Caddy exposed)
- ✅ Zero-downtime Blue/Green deployment
- ✅ Freed 1.26 GB disk space (dangling images)

**Security Score:** 100% - Only reverse proxy externally accessible
