# Depotix Server - Quick Reference

## Quick Start

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Check status
docker compose ps

# Stop all services
docker compose down
```

## Service URLs

- **Production:** https://depotix.ch
- **Health Check:** https://depotix.ch/healthz
- **API:** https://depotix.ch/api/

## Common Commands

### Deploy New Version
```bash
docker compose build web api
docker compose up -d --no-deps --build web api
docker compose restart caddy
```

### View Service Logs
```bash
docker compose logs -f web    # Frontend
docker compose logs -f api    # Backend
docker compose logs -f postgres
docker compose logs -f caddy
```

### Restart Single Service
```bash
docker compose restart api
docker compose restart web
```

### Database Backup
```bash
docker exec server-postgres-1 pg_dumpall -U depotix | \
  gzip -9 > ~/backup_$(date +%F).sql.gz
```

## Health Checks

```bash
# Production health
curl -fsSL https://depotix.ch/healthz

# Container health
docker compose ps

# Resource usage
docker stats --no-stream
```

## Service Architecture

```
Caddy (:80, :443) → Web (:3000) → API (:8000) → PostgreSQL (:5432)
```

**Only Caddy is externally accessible!**

## Files

- `compose.yml` - Main configuration
- `compose.override.yml` - Override for API build context
- `.env` - Environment variables (DO NOT COMMIT!)
- `Caddyfile` - Reverse proxy configuration

## Troubleshooting

**Service won't start:**
```bash
docker compose logs <service>
docker compose restart <service>
```

**Database issues:**
```bash
docker exec server-postgres-1 pg_isready -U depotix -d depotix
```

**Full restart:**
```bash
docker compose down
docker compose up -d
```

## Security

- ✅ Only ports 80 & 443 exposed
- ✅ All services on isolated network
- ✅ Automatic SSL via Let's Encrypt
- ✅ Database not externally accessible
- ✅ API only accessible via HTTPS proxy

## Support

See `../DEPLOYMENT.md` for detailed documentation.
