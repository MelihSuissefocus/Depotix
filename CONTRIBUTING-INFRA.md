# Infrastructure & Deployment Contribution Guidelines

This document outlines strict guardrails for infrastructure, build, configuration, and deployment changes to the Depotix project.

## Guardrails

### 🚫 **NO CHANGES TO:**
- Business logic (models, views, API endpoints)
- UI behavior or user experience
- Data models or database schemas
- Django migrations
- Serializers or API contracts
- Frontend components functionality

### ✅ **ALLOWED CHANGES:**
- Infrastructure configuration
- Build scripts and automation
- Deployment configurations
- Documentation
- Docker configurations
- CI/CD pipelines
- Environment setup scripts

## Development Rules

### Branch Policy
- **Work exclusively on `main` branch**
- **Never push changes** - local development only

### Safety Requirements
- **Idempotent operations**: Multiple executions must not break or duplicate anything
- **Automatic repository scanning**: Detect paths/versions before making changes
- **Backup policy**: Create `<filename>.bak-infra` before modifying existing files
- **Minimal invasive changes**: Only add/complement, never replace core functionality

### Commit Policy
- **Local commits only** after each step
- Commit message format: `<type>(infra): <description>`
- Include diff summary in commit body
- Examples:
  ```
  docs(infra): add infrastructure contribution guidelines
  build(infra): add Docker health checks for PostgreSQL
  config(infra): enhance environment variable handling
  ```

## Current Project Structure

### Technologies Detected
- **Frontend**: Next.js 15.2.4, React 19, TypeScript 5
- **Backend**: Django 5.0.8, DRF 3.15.2, Python 3.11
- **Database**: PostgreSQL 15 (docker), SQLite (dev)
- **Deployment**: Docker, Gunicorn, WhiteNoise

### Key Paths
- Frontend: `/app`, `/components`, `/lib`
- Backend: `/api/depotix_api`, `/api/inventory`
- Config: `/docker-compose.yml`, `/Dockerfile*`
- Scripts: `/scripts`, `/start-all.sh`

## Compliance Verification

Before any change, verify:
1. ✅ Change is infrastructure/config related only
2. ✅ No business logic modifications
3. ✅ Backup created for existing files
4. ✅ Repository scanned for dependencies
5. ✅ Change is idempotent
6. ✅ Local commit prepared

---

**Remember**: These guardrails protect the integrity of the business application while allowing safe infrastructure improvements.
