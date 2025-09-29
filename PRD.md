# Depotix System Architecture & Deployment Documentation

## System Overview
Depotix is an inventory management system running at `depotix.ch` with a complete containerized setup using Docker and Caddy as reverse proxy.

## Repository Structure
- **Main Repository**: `/home/deploy/Depotix` (Git repository)
- **Production Deployment**: Same repository, containers built from this codebase
- **Domain**: depotix.ch (HTTPS with automatic TLS via Caddy)

## Architecture Components

### 1. Frontend (Next.js)
- **Technology**: Next.js 15.2.4 with TypeScript, Tailwind CSS
- **Source Code**: `/home/deploy/Depotix/app/` directory
- **Build File**: `Dockerfile.frontend`
- **Container Name**: `server-web` (image) → `web` (running container)
- **Port**: 3000 (internal)
- **Key Files**:
  - `app/customers/page.tsx` - Customer management interface
  - `types.d.ts` - TypeScript definitions
  - `package.json` - Dependencies and build scripts

### 2. Backend (Django)
- **Technology**: Django with Python
- **Container**: `server-api-1`
- **Port**: 8000 (internal)
- **Database Models**: Located in `api/inventory/models.py`

### 3. Database
- **Technology**: PostgreSQL 16
- **Container**: `server-postgres-1`
- **Port**: 5432 (internal)

### 4. Reverse Proxy (Caddy)
- **Container**: `server-caddy-1`
- **Config File**: `/home/deploy/Depotix/server/Caddyfile`
- **Ports**: 80, 443 (public)
- **SSL**: Automatic Let's Encrypt certificates

## Docker Setup

### Networks
- **Network Name**: `server_appnet`
- **All containers must be in this network to communicate**

### Container Dependencies
```
depotix.ch (Caddy) → web:3000 (Frontend)
                  → api:8000 (Backend for /api*, /admin*, /static*, /media*, /healthz)
```

### Build Process
1. **Frontend Build**:
   ```bash
   docker build -f Dockerfile.frontend -t server-web .
   ```

2. **Container Replacement**:
   ```bash
   docker stop web && docker rm web
   docker run -d --name web --network server_appnet server-web
   ```

### Cache Management
- **Critical**: Always use `--no-cache` for production builds
- **Clean cache**: `docker system prune -af` if needed
- **Build artifacts**: Remove `.next/` and `node_modules/` locally before major rebuilds

## Development Workflow

### Making Frontend Changes
1. **Edit source files** in `/home/deploy/Depotix/app/`
2. **Commit changes** to Git
3. **Build new image**: `docker build -f Dockerfile.frontend -t server-web .`
4. **Replace container**:
   ```bash
   docker stop web && docker rm web
   docker run -d --name web --network server_appnet server-web
   ```
5. **Verify**: Check `https://depotix.ch` is accessible

### Making Backend Changes
1. **Edit source files** in `/home/deploy/Depotix/api/`
2. **Commit changes** to Git
3. **Rebuild backend container** (similar process)

## Troubleshooting

### Common Issues

#### 1. HTTP 502 Error
- **Cause**: No web container running or wrong network
- **Solution**: Check container status and restart web container

#### 2. Changes Not Visible
- **Cause**: Old container still running or browser cache
- **Solution**:
  - Verify new container is running with updated code
  - Hard refresh browser (`Ctrl+F5`)
  - Check container logs: `docker logs web`

#### 3. Container Can't Start
- **Cause**: Build failed or port conflicts
- **Solution**:
  - Check build logs for errors
  - Ensure no conflicting containers
  - Verify network exists: `docker network ls`

### Verification Commands
```bash
# Check all containers
docker ps

# Check specific container logs
docker logs web --tail 20

# Test website
curl -I https://depotix.ch

# Verify container network
docker inspect web | grep -A5 "Networks"

# Check if changes are in build
docker exec web grep -r "search_term" .next/
```

## File Locations & Important Paths

### Configuration Files
- **Caddy Config**: `/home/deploy/Depotix/server/Caddyfile`
- **Frontend Dockerfile**: `/home/deploy/Depotix/Dockerfile.frontend`
- **Environment**: `/home/deploy/Depotix/.env`

### Source Code
- **Customer Interface**: `/home/deploy/Depotix/app/customers/page.tsx`
- **Type Definitions**: `/home/deploy/Depotix/types.d.ts`
- **Backend Models**: `/home/deploy/Depotix/api/inventory/models.py`

### Docker Compose
- **File Location**: `/home/deploy/Depotix/docker-compose.yml` (development)
- **Production**: Manual container management (not docker-compose)

## Security & Production Notes

### SSL/TLS
- **Provider**: Let's Encrypt (automatic via Caddy)
- **Renewal**: Automatic
- **Config**: Handled in Caddyfile

### Environment Variables
- Check `.env` file for database credentials and other secrets
- Never commit secrets to Git

### Backup Considerations
- Database: PostgreSQL container with persistent volumes
- Code: Git repository (ensure all changes are committed)
- Container images: Can be rebuilt from source

## Performance Notes

### Build Times
- **Frontend Build**: ~2-3 minutes (includes npm install + Next.js build)
- **Full Rebuild**: Add 30 seconds for container operations
- **Cache Benefits**: Significant speedup when dependencies unchanged

### Monitoring
- **Health Check**: `curl https://depotix.ch`
- **Container Status**: `docker ps`
- **Logs**: `docker logs [container-name]`

## Lessons Learned

### Critical Points
1. **Always verify which containers are actually serving the domain**
2. **Old containers may continue running even after new builds**
3. **Container naming is crucial** - Caddy looks for specific container names
4. **Network isolation** - All containers must be in the same Docker network
5. **Build cache can be persistent** - use `--no-cache` for critical updates

### Best Practices
1. **Commit before building** - Ensure all changes are in Git
2. **Verify build contents** - Check that changes appear in built files
3. **Test immediately** - Verify website functionality after deployment
4. **Monitor logs** - Watch container logs during deployment
5. **Document changes** - Keep this PRD updated with new insights

---

*Last Updated: 2025-09-22*
*System Status: Production Ready*