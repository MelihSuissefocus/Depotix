# Infrastructure Next Steps - Depotix Deployment

**Target**: Hetzner VM + Docker Compose + Caddy + GitHub Actions  
**Status**: Ready for implementation  
**Updated**: September 14, 2025  

## Prerequisites Checklist

### Server Requirements
- [ ] Hetzner Cloud VM (minimum 2GB RAM, 1 vCPU)
- [ ] Ubuntu 22.04 LTS or similar
- [ ] Docker and Docker Compose installed
- [ ] SSH access configured
- [ ] Domain name registered and DNS access

### Local Requirements
- [ ] Git access to this repository
- [ ] SSH key added to GitHub repository secrets
- [ ] Domain SSL certificate email address

## Step-by-Step Deployment Guide

### Phase 1: Server Preparation

#### 1.1 Provision Hetzner VM
```bash
# Via Hetzner Cloud Console or API
# - Choose Ubuntu 22.04 LTS
# - Minimum: CX11 (1 vCPU, 2GB RAM)
# - Add SSH key during creation
# - Note the public IP address
```

#### 1.2 Initial Server Setup
```bash
# SSH into your server
ssh root@YOUR_SERVER_IP

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose-plugin -y

# Create app user
useradd -m -s /bin/bash deploy
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
```

#### 1.3 Setup Application Directory
```bash
# Switch to deploy user
su - deploy

# Create server directory
mkdir -p ~/server
cd ~/server

# Clone only the server configuration (or copy files)
# This will be handled by CI/CD, but for manual setup:
# wget https://raw.githubusercontent.com/YOUR_REPO/main/server/compose.yml
# wget https://raw.githubusercontent.com/YOUR_REPO/main/server/Caddyfile
```

### Phase 2: DNS Configuration

#### 2.1 Domain Setup
```bash
# Configure A Record in your DNS provider
# Type: A
# Name: @ (or subdomain like 'app')
# Value: YOUR_SERVER_IP
# TTL: 300 (5 minutes)

# Verify DNS propagation
dig yourdomain.com
nslookup yourdomain.com
```

#### 2.2 Update Configuration Files
Update the following placeholders in your repository:

**server/Caddyfile**:
```diff
- depotix.example.com {
+ yourdomain.com {
   encode gzip
-  tls you@example.com
+  tls your-email@yourdomain.com
```

**server/.env.example** → **server/.env**:
```bash
TZ=Europe/Zurich
DJANGO_SECRET_KEY=your-generated-secret-key-here
DJANGO_ALLOWED_HOSTS=yourdomain.com
DJANGO_DEBUG=False
DATABASE_URL=postgres://depotix:secure_password@postgres:5432/depotix
CORS_ALLOWED_ORIGINS=https://yourdomain.com
NEXT_PUBLIC_API_BASE_URL=https://yourdomain.com/api
```

### Phase 3: GitHub Actions Setup

#### 3.1 Configure Repository Secrets
In GitHub: Settings → Secrets and variables → Actions

Add the following secrets:
```
HETZNER_HOST=YOUR_SERVER_IP
HETZNER_USER=deploy
HETZNER_SSH_KEY=-----BEGIN OPENSSH PRIVATE KEY-----
[Your private SSH key content]
-----END OPENSSH PRIVATE KEY-----
```

#### 3.2 Test SSH Connection
```bash
# Test from your local machine
ssh deploy@YOUR_SERVER_IP

# Verify Docker access
docker --version
docker compose version
```

### Phase 4: Database Setup

#### 4.1 Add PostgreSQL to compose.yml
```yaml
# Add to server/compose.yml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: depotix
      POSTGRES_USER: depotix
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks: [appnet]
    restart: unless-stopped

volumes:
  postgres_data: {}
  # ... existing volumes
```

#### 4.2 Update Environment Variables
```bash
# Add to server/.env
POSTGRES_PASSWORD=your_secure_db_password
DATABASE_URL=postgres://depotix:your_secure_db_password@postgres:5432/depotix
```

### Phase 5: Security Configuration

#### 5.1 Generate Django Secret Key
```bash
# Generate a secure secret key
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
# Add to DJANGO_SECRET_KEY in .env
```

#### 5.2 Firewall Setup
```bash
# Configure UFW firewall
ufw enable
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw status
```

### Phase 6: Deployment Execution

#### 6.1 Manual First Deployment
```bash
# On the server as deploy user
cd ~/server

# Create the .env file with your values
cp .env.example .env
# Edit .env with your actual values

# Initial deployment
docker compose pull
docker compose up -d --build

# Check logs
docker compose logs -f
```

#### 6.2 Verify Deployment
```bash
# Health check
curl https://yourdomain.com/healthz
# Expected: {"ok": true}

# Frontend check
curl -I https://yourdomain.com
# Expected: HTTP/2 200

# Admin interface
curl -I https://yourdomain.com/admin/
# Expected: HTTP/2 200 or 302
```

#### 6.3 Initial Django Setup
```bash
# Create superuser
docker compose exec api python manage.py createsuperuser

# Load initial data (optional)
docker compose exec api python manage.py loaddata fixtures/seed_phase1_complete.json
```

### Phase 7: CI/CD Activation

#### 7.1 Test Automated Deployment
```bash
# Make a small change to trigger deployment
echo "# Deployment test" >> README.md
git add README.md
git commit -m "test: trigger deployment"
git push origin main

# Monitor GitHub Actions
# Check server logs: docker compose logs -f
```

#### 7.2 Verify Continuous Deployment
- [ ] GitHub Actions workflow completes successfully
- [ ] Application redeploys automatically
- [ ] Health check passes after deployment
- [ ] No downtime during updates

## Post-Deployment Checklist

### Functionality Verification
- [ ] Frontend loads at https://yourdomain.com
- [ ] Login/logout functionality works
- [ ] API endpoints respond correctly
- [ ] Admin interface accessible
- [ ] CRUD operations function properly
- [ ] File uploads work (if applicable)

### Security Verification
- [ ] HTTPS certificates auto-generated by Caddy
- [ ] HTTP redirects to HTTPS
- [ ] Security headers present
- [ ] No sensitive data in logs
- [ ] Database access restricted

### Performance & Monitoring
- [ ] Page load times acceptable
- [ ] API response times under 500ms
- [ ] Docker containers stable
- [ ] Disk space monitoring setup
- [ ] Log rotation configured

## Maintenance Tasks

### Regular Maintenance
```bash
# Update containers (monthly)
docker compose pull && docker compose up -d

# Clean up unused images
docker system prune -f

# Backup database
docker compose exec postgres pg_dump -U depotix depotix > backup_$(date +%Y%m%d).sql

# Monitor logs
docker compose logs --tail=100 api
docker compose logs --tail=100 web
```

### Troubleshooting Commands
```bash
# Check service status
docker compose ps

# Restart specific service
docker compose restart api

# View specific service logs
docker compose logs -f api

# Access container shell
docker compose exec api bash

# Check resource usage
docker stats
```

## Emergency Procedures

### Rollback Deployment
```bash
# Via GitHub: revert commit and push
# Or manually on server:
cd ~/server
git checkout HEAD~1  # or specific commit
docker compose up -d --build
```

### Database Recovery
```bash
# Restore from backup
docker compose exec -T postgres psql -U depotix depotix < backup_YYYYMMDD.sql
```

### Service Recovery
```bash
# Full restart
docker compose down
docker compose up -d --build

# Clear all data (DANGER)
docker compose down -v
docker compose up -d --build
```

## Support & Monitoring

### Log Locations
- **Application**: `docker compose logs api`
- **Web**: `docker compose logs web`
- **Proxy**: `docker compose logs caddy`
- **System**: `/var/log/syslog`

### Health Monitoring
- **Health Endpoint**: `https://yourdomain.com/healthz`
- **Admin Interface**: `https://yourdomain.com/admin/`
- **API Status**: `https://yourdomain.com/api/`

### Performance Monitoring
Consider adding:
- Uptime monitoring (UptimeRobot, Pingdom)
- Error tracking (Sentry)
- Performance monitoring (New Relic, DataDog)
- Log aggregation (ELK stack, Grafana)

---

**Next Action**: Begin with Phase 1 (Server Preparation) and proceed through each phase sequentially. The entire deployment should take 2-4 hours for a first-time setup.
