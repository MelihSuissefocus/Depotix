# Repository Audit Topology - Depotix Phase 0

## Overview
**Project**: Depotix (formerly inventory-management-ui)
**Framework**: Next.js 15.2.4 with App Router
**Language**: TypeScript
**Backend**: Django REST Framework (external, not in this repository)
**Status**: Frontend-only repository, production-ready for local development with mock backend

## Technology Stack

### Frontend Framework & Runtime
- **Next.js**: 15.2.4 (React framework with App Router)
- **React**: 19.0.0
- **TypeScript**: 5.0
- **Node.js**: Minimum v16 required (v20 recommended)

### UI & Styling
- **Tailwind CSS**: 4.0 (utility-first CSS framework)
- **Shadcn UI**: Custom component library based on Radix UI primitives
- **Radix UI**: Multiple components (@radix-ui/* packages)
- **Lucide React**: Icon library (v0.487.0)
- **Next Themes**: Dark/light theme support
- **React Hot Toast**: Notification system
- **React CountUp**: Number animation library
- **Date-fns**: Date manipulation (v3.6.0)

### Charts & Data Visualization
- **Recharts**: 2.15.2 (React charting library)
- **React Day Picker**: 8.10.1 (Date picker component)

### Build & Development Tools
- **Turbopack**: Enabled via `--turbopack` flag
- **ESLint**: v9 with Next.js config
- **TypeScript Compiler**: For type checking

### API Communication
- **Fetch API**: Native browser fetch with custom wrapper
- **JWT Authentication**: Bearer token-based auth
- **Environment Variables**: NEXT_PUBLIC_API_BASE_URL for backend URL

## Application Architecture

### Project Structure
```
/
├── app/                          # Next.js App Router pages
│   ├── categories/              # Category management pages
│   ├── inventory/               # Inventory item management
│   │   └── [id]/               # Dynamic route for item details
│   ├── item-suppliers/         # Item-supplier relationship management
│   ├── suppliers/              # Supplier management
│   ├── logs/                   # Inventory logs/activity
│   ├── login/                  # Authentication
│   ├── register/               # User registration
│   ├── reports/                # Reporting functionality
│   ├── settings/               # User settings/profile
│   ├── page.tsx                # Dashboard/home page
│   ├── layout.tsx              # Root layout
│   └── clientLayout.tsx        # Client-side layout wrapper
├── components/                  # Reusable UI components
│   ├── ui/                     # Shadcn UI primitives
│   └── ...                     # Feature-specific components
├── lib/                        # Utility libraries
│   ├── api.ts                  # API client functions
│   ├── auth.tsx                # Authentication context/provider
│   └── utils.ts                # Helper functions
├── types.d.ts                  # TypeScript type definitions
└── docs/                       # Documentation (Phase 0)
```

### Routing Structure (App Router)
- **/** - Dashboard with metrics, charts, and recent activity
- **/inventory** - Inventory items list and management
- **/inventory/[id]** - Individual item details and editing
- **/categories** - Category management
- **/suppliers** - Supplier management
- **/item-suppliers** - Link items to suppliers
- **/logs** - Inventory activity logs
- **/reports** - Reporting and analytics
- **/settings** - User profile and settings
- **/login** - User authentication
- **/register** - User registration

### Component Architecture
- **Layout System**: Client-side layout with conditional rendering for auth pages
- **Authentication**: AuthGuard component protecting routes, AuthProvider context
- **State Management**: React hooks + local component state (no Redux/SWR detected)
- **Theme System**: Next-themes for dark/light mode
- **Toast Notifications**: React-hot-toast for user feedback

## API Integration

### Backend Dependency
**Missing Component**: Backend is external Django REST Framework application
- Repository: [inventory-management-api](https://github.com/namodynamic/inventory-management-api)
- API Base URL: Configured via `NEXT_PUBLIC_API_BASE_URL` environment variable
- Default: `http://localhost:8000/api`

### Expected API Endpoints
Based on lib/api.ts analysis:

#### Authentication (`/token/`)
- `POST /token/` - JWT token obtain
- `POST /token/refresh/` - JWT token refresh

#### Users (`/inventory/users/`)
- `GET /inventory/users/me/` - Current user profile
- `POST /inventory/users/` - User registration
- `PATCH /inventory/users/me/` - Update profile/change password
- `POST /inventory/users/logout/` - User logout

#### Inventory Items (`/inventory/items/`)
- `GET /inventory/items/` - List items (with filtering/search)
- `GET /inventory/items/{id}/` - Get single item
- `POST /inventory/items/` - Create item
- `PUT /inventory/items/{id}/` - Update item
- `DELETE /inventory/items/{id}/` - Delete item
- `POST /inventory/items/{id}/adjust_quantity/` - Adjust stock quantity
- `GET /inventory/items/{id}/level/` - Get stock level
- `GET /inventory/items/level/` - Get all stock levels

#### Categories (`/inventory/categories/`)
- `GET /inventory/categories/` - List categories (with search)
- `GET /inventory/categories/{id}/` - Get single category
- `POST /inventory/categories/` - Create category
- `PUT /inventory/categories/{id}/` - Update category
- `DELETE /inventory/categories/{id}/` - Delete category

#### Suppliers (`/inventory/suppliers/`)
- `GET /inventory/suppliers/` - List suppliers (with search/filtering)
- `GET /inventory/suppliers/{id}/` - Get single supplier
- `POST /inventory/suppliers/` - Create supplier
- `PUT /inventory/suppliers/{id}/` - Update supplier
- `DELETE /inventory/suppliers/{id}/` - Delete supplier

#### Item-Suppliers (`/inventory/item-suppliers/`)
- `GET /inventory/item-suppliers/` - List item-supplier relationships
- `GET /inventory/item-suppliers/{id}/` - Get single relationship
- `POST /inventory/item-suppliers/` - Create relationship
- `PUT /inventory/item-suppliers/{id}/` - Update relationship
- `DELETE /inventory/item-suppliers/{id}/` - Delete relationship

#### Logs (`/inventory/logs/`)
- `GET /inventory/logs/` - List inventory logs (with filtering)
- `GET /inventory/logs/{id}/` - Get single log
- `GET /inventory/logs/{item_id}/item/` - Get logs for specific item
- `GET /inventory/logs/recent_changes/` - Get recent changes summary
- `GET /inventory/logs/recent_changes/?group_by={day|item|user}` - Grouped summaries

## Data Models

### Core Entities
Based on types.d.ts:

- **InventoryItem**: Core inventory entity with stock tracking
- **Category**: Item categorization
- **Supplier**: Vendor information
- **InventoryLog**: Stock movement tracking
- **InventoryItemSupplier**: Item-vendor relationships
- **User**: Authentication and user management

### Key Relationships
- Items belong to Categories (optional)
- Items can have multiple Suppliers via InventoryItemSupplier
- All stock changes are logged via InventoryLog
- Users own Items and Suppliers (role-based access)

## Environment Configuration

### Required Environment Variables
- `NEXT_PUBLIC_API_BASE_URL`: Backend API base URL
  - Default: `http://localhost:8000/api`
  - Production: External Django API endpoint

### Build Configuration
- **next.config.ts**: Next.js configuration
- **tailwind.config.js**: Tailwind CSS configuration
- **components.json**: Shadcn UI configuration
- **tsconfig.json**: TypeScript configuration
- **eslint.config.mjs**: ESLint configuration

## Development Setup Requirements

### Prerequisites
- Node.js v16+ (v20 recommended)
- npm or yarn package manager
- Backend API running (Django REST Framework)

### Package Manager Scripts
```json
{
  "dev": "next dev --turbopack",
  "build": "next build",
  "start": "next start",
  "lint": "next lint"
}
```

### Development Features
- **Hot Reload**: Enabled via Next.js dev server
- **Turbopack**: Faster builds in development
- **TypeScript**: Strict type checking
- **ESLint**: Code quality enforcement
- **Responsive Design**: Mobile-first approach

## Security Considerations

### Authentication Flow
- JWT-based authentication with refresh tokens
- Tokens stored in localStorage
- Automatic token refresh on 401 responses
- Protected routes via AuthGuard component

### API Security
- Bearer token authentication
- HTTPS recommended for production
- CORS configuration required on backend
- CSRF protection needed (if backend uses session auth)

## Missing Components (Backend)

Since the backend is not in this repository, the following components are required for full functionality:

1. **Django REST Framework Application**
2. **PostgreSQL Database**
3. **JWT Authentication Setup**
4. **API Documentation** (Swagger/OpenAPI)
5. **CORS Configuration**
6. **Database Migrations**
7. **Environment Configuration**

## Recommendations

### For Local Development
1. Set up the backend repository alongside this frontend
2. Configure `NEXT_PUBLIC_API_BASE_URL` to point to local backend
3. Ensure CORS is properly configured on backend
4. Use consistent environment variables across both repositories

### For Production Deployment
1. Deploy backend API to cloud service (Railway, Heroku, etc.)
2. Update `NEXT_PUBLIC_API_BASE_URL` to production API URL
3. Ensure HTTPS is enabled on both frontend and backend
4. Configure proper CORS origins
5. Set up monitoring and logging

### Architecture Improvements
1. Consider adding a global state management solution (Zustand, Redux)
2. Implement proper error boundaries
3. Add comprehensive test coverage
4. Consider adding API caching layer (SWR, React Query)
5. Implement proper loading states and skeleton components

---
*Document created during Phase 0 Repository Audit - September 11, 2025*
