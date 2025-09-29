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

### 2. Backend (Django API)
- **Technology**: Django 5.0.8 with Django REST Framework
- **Source Code**: `/home/deploy/Depotix/api/` directory
- **Build File**: `/home/deploy/Depotix/api/Dockerfile`
- **Container Image**: `server-api`
- **Container Name**: `api` (running container)
- **Port**: 8000 (internal)
- **Database**: PostgreSQL (via DATABASE_URL environment variable)
- **Key Files**:
  - `api/inventory/models.py` - Database models (Customer, Invoice, etc.)
  - `api/inventory/views.py` - API endpoints and business logic
  - `api/inventory/serializers.py` - API data serialization
  - `api/inventory/templates/pdf/` - PDF invoice templates
  - `api/depotix_api/settings.py` - Django configuration

### 3. Database
- **Technology**: PostgreSQL 16
- **Container**: `server-postgres-1`
- **Port**: 5432 (internal)
- **Database Name**: `depotix`
- **Username**: `depotix`
- **Password**: `4Y__dBU85RFg1EnsPPJCjFSY-8D0zQv4UY9qDUcHYY0` (from container env)
- **Network**: `server_appnet`

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

#### Frontend Build
1. **Build Image**:
   ```bash
   docker build -f Dockerfile.frontend -t server-web .
   ```

2. **Replace Container**:
   ```bash
   docker stop web && docker rm web
   docker run -d --name web --network server_appnet server-web
   ```

#### Backend Build
1. **Build API Image**:
   ```bash
   docker build -t server-api /home/deploy/Depotix/api/
   ```

2. **Replace API Container**:
   ```bash
   docker stop api && docker rm api
   docker run -d --name api --network server_appnet -p 8000:8000 \
     -e DJANGO_SETTINGS_MODULE=depotix_api.settings \
     -e DATABASE_URL="postgres://depotix:4Y__dBU85RFg1EnsPPJCjFSY-8D0zQv4UY9qDUcHYY0@server-postgres-1:5432/depotix" \
     server-api
   ```

#### ⚠️ CRITICAL DEPLOYMENT ERRORS TO AVOID ⚠️

**WRONG DEPLOYMENT PATTERN** (what Claude often does incorrectly):
```bash
# ❌ WRONG - Uses docker-compose (development only)
docker-compose up -d

# ❌ WRONG - Wrong network name
docker run --network depotix_default ...

# ❌ WRONG - Missing DATABASE_URL
docker run -e DB_HOST=db -e DB_PASSWORD=defaultpass ...

# ❌ WRONG - Wrong database password
docker run -e DATABASE_URL="postgres://depotix:defaultpass@..."
```

**CORRECT DEPLOYMENT PATTERN** (production):
```bash
# ✅ CORRECT - Manual container with correct network
docker stop api && docker rm api
docker run -d --name api --network server_appnet -p 8000:8000 \
  -e DJANGO_SETTINGS_MODULE=depotix_api.settings \
  -e DATABASE_URL="postgres://depotix:4Y__dBU85RFg1EnsPPJCjFSY-8D0zQv4UY9qDUcHYY0@server-postgres-1:5432/depotix" \
  server-api
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
3. **Build API image**: `docker build -t server-api /home/deploy/Depotix/api/`
4. **Replace container**:
   ```bash
   docker stop api && docker rm api
   docker run -d --name api --network server_appnet -p 8000:8000 \
     -e DJANGO_SETTINGS_MODULE=depotix_api.settings \
     -e DATABASE_URL="postgres://depotix:4Y__dBU85RFg1EnsPPJCjFSY-8D0zQv4UY9qDUcHYY0@server-postgres-1:5432/depotix" \
     server-api
   ```
5. **Verify**: Check API endpoints and logs: `docker logs api`

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
- **Invoice PDF Templates**: `/home/deploy/Depotix/api/inventory/templates/pdf/`
- **API Views**: `/home/deploy/Depotix/api/inventory/views.py`
- **Swiss Currency Formatting**: `/home/deploy/Depotix/api/inventory/templatetags/invoice_extras.py`

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

## Critical Deployment Mistakes & Solutions

### ⚠️ Most Common Claude Deployment Error ⚠️

**THE MISTAKE**: Claude repeatedly tries to use docker-compose or wrong environment variables, ignoring production setup.

**WHY IT HAPPENS**: Claude confuses development vs production patterns and doesn't read the existing container configuration.

**THE SOLUTION**: Always check existing containers first, then use the EXACT production pattern below:

```bash
# 1. ALWAYS check what's currently running first
docker ps

# 2. Build the new image
docker build -t server-api /home/deploy/Depotix/api/

# 3. Replace container with EXACT production config
docker stop api && docker rm api
docker run -d --name api --network server_appnet -p 8000:8000 \
  -e DJANGO_SETTINGS_MODULE=depotix_api.settings \
  -e DATABASE_URL="postgres://depotix:4Y__dBU85RFg1EnsPPJCjFSY-8D0zQv4UY9qDUcHYY0@server-postgres-1:5432/depotix" \
  server-api
```

### Database Connection Issues

**PROBLEM**: API connects to SQLite instead of PostgreSQL
**CAUSE**: Missing or incorrect DATABASE_URL environment variable
**SOLUTION**: Always use the complete DATABASE_URL with correct password

### Invoice System & PDF Generation

**KEY FEATURES IMPLEMENTED**:
- Swiss QR bill generation with QR code on page 2
- Swiss currency formatting (7'688,60 format)
- Swiss date formatting (05. Sept. 2025 format)
- Real customer data in PDF templates
- Invoice deletion functionality (DELETE /api/inventory/invoices/{id}/)
- All invoices visible (including archived)

**TEMPLATE LOCATIONS**:
- Main template: `api/inventory/templates/pdf/invoice.html`
- Styles: `api/inventory/templates/pdf/_styles.css`
- Swiss filters: `api/inventory/templatetags/invoice_extras.py`

### Customer Number Validation

**IMPLEMENTED**: 4-digit customer numbers starting from 1000
**VALIDATION**: Custom validator in `api/inventory/models.py`
**UNIQUENESS**: Enforced per user in serializer

## Lessons Learned

### Critical Points
1. **NEVER use docker-compose in production** - This system uses manual container management
2. **Always verify which containers are actually running** - `docker ps` before any changes
3. **Use the EXACT database password from container env** - Not `defaultpass`
4. **Network name is `server_appnet`** - Not `depotix_default` or any other name
5. **Container naming is crucial** - `api` container name, `server-api` image name
6. **DATABASE_URL is required** - Settings.py falls back to SQLite without it

### Best Practices
1. **Read existing container config first** - `docker inspect [container]` to see environment
2. **Commit before building** - Ensure all changes are in Git
3. **Verify database connection** - Check logs show PostgreSQL, not SQLite
4. **Test API endpoints** - Verify CRUD operations work after deployment
5. **Update this PRD** - Document new features and deployment patterns

---

*Last Updated: 2025-09-29*
*System Status: Production Ready*
*Recent Updates: Added invoice deletion, Swiss PDF templates, deployment error documentation*