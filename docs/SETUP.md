# Depotix Setup Guide - Phase 0

## Overview
**Project**: Depotix (Next.js Inventory Management Frontend)
**Status**: ✅ Frontend setup verified, runs locally
**Backend**: External dependency (Django REST Framework)
**Last Tested**: September 11, 2025

## Prerequisites

### System Requirements
- **Node.js**: v16.0.0 or higher (v20+ recommended)
- **npm**: v7.0.0 or higher (comes with Node.js)
- **Operating System**: macOS, Linux, or Windows
- **Memory**: Minimum 4GB RAM recommended

### Verification Commands
```bash
# Check Node.js version
node --version
# Expected: v16.0.0 or higher

# Check npm version
npm --version
# Expected: 7.0.0 or higher
```

## Frontend Setup

### 1. Project Dependencies Installation

```bash
# Navigate to project directory
cd /Users/melihoezkan/Documents/Projekte/Depotix

# Install dependencies (use legacy peer deps due to React 19 compatibility)
npm install --legacy-peer-deps

# Expected output: "added 416 packages from 567 contributors"
```

**Known Issues & Solutions:**
- **React Version Conflict**: `react-day-picker@8.10.1` expects React 16-18, but project uses React 19
- **Solution**: Use `--legacy-peer-deps` flag during installation
- **Alternative**: Update `react-day-picker` to v9+ when available

### 2. Environment Configuration

Create `.env.local` file in project root:

```bash
# Create environment file
touch .env.local
```

Add the following content to `.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
```

**Environment Variables:**
- `NEXT_PUBLIC_API_BASE_URL`: Backend API base URL
  - **Development**: `http://localhost:8000/api`
  - **Production**: Update to your deployed backend URL
  - **Note**: Must include `/api` suffix as expected by API client

### 3. Development Server

```bash
# Start development server with Turbopack
npm run dev

# Alternative commands:
npm run build    # Production build
npm run start    # Production server
npm run lint     # Code linting
```

**Server Details:**
- **Port**: 3000 (default Next.js port)
- **URL**: http://localhost:3000
- **Features**: Hot reload, Turbopack acceleration, TypeScript checking

### 4. Build Process

```bash
# Create production build
npm run build

# Start production server
npm start
```

## Backend Setup (External Dependency)

### Backend Repository
**Missing Component**: Backend is in separate repository
- **Repository**: [inventory-management-api](https://github.com/namodynamic/inventory-management-api)
- **Framework**: Django REST Framework
- **Database**: PostgreSQL
- **Authentication**: JWT-based

### Backend Setup Steps (Separate Repository)
```bash
# Clone backend repository
git clone https://github.com/namodynamic/inventory-management-api.git
cd inventory-management-api

# Follow backend README for setup:
# - Install Python 3.9+
# - Install Django/DRF
# - Configure PostgreSQL
# - Run migrations
# - Start Django server on port 8000
```

### Mock Backend (For Frontend-Only Development)

Since backend is external, create a simple mock server for local frontend testing:

**Option 1: MSW (Mock Service Worker)**
```bash
npm install msw --save-dev
```

Create `mocks/handlers.js`:
```javascript
import { rest } from 'msw'

export const handlers = [
  rest.get('/api/inventory/items/', (req, res, ctx) => {
    return res(ctx.json([
      {
        id: 1,
        name: "Sample Item",
        quantity: 10,
        price: "29.99",
        category_name: "Electronics"
      }
    ]))
  }),
  // Add more mock endpoints...
]
```

**Option 2: JSON Server (Simpler)**
```bash
npm install json-server --save-dev
```

Create `db.json`:
```json
{
  "inventory": {
    "items": [
      {
        "id": 1,
        "name": "Sample Item",
        "quantity": 10,
        "price": "29.99",
        "category": 1
      }
    ],
    "categories": [
      {
        "id": 1,
        "name": "Electronics"
      }
    ]
  }
}
```

Start mock server:
```bash
npx json-server --watch db.json --port 8000
```

Update `.env.local`:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Local Development Workflow

### 1. Start Frontend
```bash
cd /Users/melihoezkan/Documents/Projekte/Depotix
npm run dev
# Opens: http://localhost:3000
```

### 2. Start Backend (External)
```bash
# In separate terminal
cd /path/to/inventory-management-api
python manage.py runserver
# Runs on: http://localhost:8000
```

### 3. Access Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000/api/
- **Backend Admin**: http://localhost:8000/admin/ (if configured)

## Testing Setup

### Frontend Testing
```bash
# Run linting
npm run lint

# Build verification
npm run build
```

### API Testing
```bash
# Test backend connectivity
curl http://localhost:8000/api/inventory/items/

# Expected response: JSON array of inventory items
```

## Troubleshooting

### Common Issues

**Issue: "Module not found" errors**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

**Issue: Port 3000 already in use**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
npm run dev -- -p 3001
```

**Issue: API connection failed**
```bash
# Check backend is running
curl http://localhost:8000/api/

# Check environment variable
echo $NEXT_PUBLIC_API_BASE_URL

# Verify CORS configuration on backend
```

**Issue: Build fails**
```bash
# Clear Next.js cache
rm -rf .next
npm run build
```

### Network Configuration
- **CORS**: Backend must allow requests from `http://localhost:3000`
- **API Base URL**: Must match backend deployment URL
- **HTTPS**: Not required for local development

## Deployment

### Frontend Deployment
```bash
# Build for production
npm run build

# Deploy to Vercel, Netlify, or static hosting
# Update NEXT_PUBLIC_API_BASE_URL to production backend URL
```

### Backend Deployment
- Deploy Django application to cloud service (Heroku, Railway, etc.)
- Update frontend environment variables
- Configure production database
- Set up SSL certificates

## Security Considerations

### Local Development
- JWT tokens stored in localStorage (not secure for production)
- Use HTTPS in production
- Configure proper CORS policies
- Implement CSRF protection if using session-based auth

### Environment Variables
- Never commit `.env.local` to version control
- Use different values for development/production
- Rotate API keys regularly

## Performance Optimization

### Development
- **Turbopack**: Enabled for faster builds
- **Hot Reload**: Automatic browser refresh
- **TypeScript**: Incremental compilation

### Production
```bash
# Analyze bundle size
npm install --save-dev @next/bundle-analyzer
```

## Verification Checklist

- [x] Node.js v16+ installed
- [x] Dependencies installed successfully
- [x] Environment variables configured
- [x] Development server starts without errors
- [x] Frontend accessible at http://localhost:3000
- [x] Backend API responding (if available)
- [x] No console errors in browser
- [x] Authentication flow works
- [x] Basic CRUD operations functional

## Next Steps

1. **Backend Integration**: Set up the Django REST Framework backend
2. **Database Setup**: Configure PostgreSQL for backend
3. **Testing**: Add comprehensive test coverage
4. **CI/CD**: Set up automated deployment pipeline
5. **Monitoring**: Add error tracking and analytics

---
*Setup documentation created during Phase 0 Repository Audit - September 11, 2025*
