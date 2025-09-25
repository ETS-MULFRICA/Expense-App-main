# ExpenseTrack - Complete Application Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture & Technology Stack](#architecture--technology-stack)
3. [Project Structure](#project-structure)
4. [Database Schema](#database-schema)
5. [Authentication System](#authentication-system)
6. [Frontend Architecture](#frontend-architecture)
7. [Backend Architecture](#backend-architecture)
8. [API Endpoints](#api-endpoints)
9. [Features & Functionality](#features--functionality)
10. [Development Setup](#development-setup)
11. [Deployment Guide](#deployment-guide)
12. [Environment Configuration](#environment-configuration)
13. [Troubleshooting](#troubleshooting)

---

## Project Overview

ExpenseTrack is a comprehensive personal finance management application designed to help users track expenses, manage income, create budgets, and generate financial reports. The application features a modern web interface with cross-device synchronization through cloud-based data storage.

### Key Features
- **User Authentication**: Secure login/registration with session management
- **Expense Management**: Full CRUD operations for expense tracking
- **Income Tracking**: Complete income management system
- **Budget Planning**: Budget creation with category allocations
- **Financial Reporting**: Visual analytics and data export capabilities
- **Multi-Currency Support**: Customizable currency settings (default: XAF)
- **Admin Dashboard**: Administrative user management
- **Export Functionality**: PDF and CSV export for all financial data
- **Responsive Design**: Mobile-first design with black/white theme

---

## Architecture & Technology Stack

### Frontend Stack
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite (development & production)
- **Routing**: Wouter for client-side navigation
- **State Management**: TanStack Query (React Query) for server state
- **Form Handling**: React Hook Form with Zod validation
- **UI Components**: Custom components built on Radix UI primitives
- **Styling**: Tailwind CSS with professional black/white theme
- **Icons**: Lucide React for UI icons
- **Charts**: Recharts for data visualization
- **Export**: jsPDF for PDF generation, custom CSV utilities

### Backend Stack
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Authentication**: Passport.js with local strategy
- **Session Management**: Express sessions with PostgreSQL store
- **Database**: PostgreSQL with Drizzle ORM
- **Validation**: Zod schemas for API validation
- **File Processing**: XLSX for Excel file analysis
- **Password Security**: Node.js crypto (scrypt) for hashing

### Database & Storage
- **Primary Database**: PostgreSQL (cloud-hosted via Neon)
- **ORM**: Drizzle ORM with TypeScript-first approach
- **Session Store**: PostgreSQL-based using connect-pg-simple
- **Schema Management**: Drizzle migrations for versioning

---

## Project Structure

```
ExpenseTrack/
├── client/                          # Frontend React application
│   ├── src/
│   │   ├── components/             # Reusable UI components
│   │   │   ├── ui/                # Base UI components (shadcn)
│   │   │   ├── layout/            # Layout components
│   │   │   │   ├── main-layout.tsx
│   │   │   │   ├── sidebar.tsx
│   │   │   │   └── mobile-nav.tsx
│   │   │   ├── expenses/          # Expense-related components
│   │   │   │   ├── add-expense-dialog.tsx
│   │   │   │   ├── edit-expense-dialog.tsx
│   │   │   │   └── expense-table.tsx
│   │   │   ├── income/            # Income-related components
│   │   │   │   ├── add-income-dialog.tsx
│   │   │   │   ├── edit-income-dialog.tsx
│   │   │   │   └── income-table.tsx
│   │   │   ├── budgets/           # Budget components
│   │   │   └── common/            # Shared components
│   │   │       └── export-button.tsx
│   │   ├── hooks/                 # Custom React hooks
│   │   │   ├── use-auth.tsx      # Authentication hook
│   │   │   ├── use-toast.tsx     # Toast notifications
│   │   │   └── use-mobile.tsx    # Mobile detection
│   │   ├── lib/                   # Utility libraries
│   │   │   ├── queryClient.ts    # React Query configuration
│   │   │   ├── protected-route.tsx # Route protection
│   │   │   ├── currency-formatter.ts # Currency utilities
│   │   │   ├── export-utils.ts   # Export functionality
│   │   │   ├── models.ts         # Data models
│   │   │   └── utils.ts          # General utilities
│   │   ├── pages/                 # Application pages
│   │   │   ├── home-page.tsx     # Dashboard/Analytics
│   │   │   ├── expenses-page.tsx # Expense management
│   │   │   ├── income-page.tsx   # Income management
│   │   │   ├── budgets-page.tsx  # Budget planning
│   │   │   ├── reports-page.tsx  # Financial reports
│   │   │   ├── settings-page.tsx # User settings
│   │   │   ├── admin-page.tsx    # Admin dashboard
│   │   │   ├── auth-page.tsx     # Login/Registration
│   │   │   └── not-found.tsx     # 404 page
│   │   ├── App.tsx               # Main app component & routing
│   │   ├── main.tsx              # React app entry point
│   │   └── index.css             # Global styles
│   └── index.html                 # HTML template
├── server/                        # Backend Express application
│   ├── index.ts                  # Server entry point
│   ├── routes.ts                 # API route definitions
│   ├── auth.ts                   # Authentication logic
│   ├── storage.ts                # Data access layer
│   └── vite.ts                   # Vite development integration
├── shared/                        # Shared TypeScript definitions
│   └── schema.ts                 # Database schema & validation
├── attached_assets/              # User-uploaded assets
├── Configuration Files:
│   ├── package.json              # Dependencies & scripts
│   ├── tsconfig.json             # TypeScript configuration
│   ├── vite.config.ts            # Vite build configuration
│   ├── tailwind.config.ts        # Tailwind CSS configuration
│   ├── postcss.config.js         # PostCSS configuration
│   ├── drizzle.config.ts         # Database ORM configuration
│   └── theme.json                # UI theme configuration
└── Documentation:
    ├── replit.md                 # Project summary & preferences
    └── DOCUMENTATION.md          # This comprehensive guide
```

---

## Database Schema

The application uses PostgreSQL with Drizzle ORM. Here's the complete schema structure:

### Core Tables

#### Users Table
```typescript
users {
  id: serial PRIMARY KEY
  username: text UNIQUE NOT NULL
  password: text NOT NULL          // Hashed with scrypt
  name: text NOT NULL
  email: text UNIQUE NOT NULL
  currency: text DEFAULT 'XAF'    // User's preferred currency
  role: text DEFAULT 'user'       // 'user' or 'admin'
}
```

#### Expense Categories
```typescript
expense_categories {
  id: serial PRIMARY KEY
  user_id: integer → users.id
  name: text NOT NULL
  description: text
  is_system: boolean DEFAULT false // System vs user-created
  created_at: timestamp DEFAULT NOW()
}
```

#### Expense Subcategories
```typescript
expense_subcategories {
  id: serial PRIMARY KEY
  category_id: integer → expense_categories.id
  user_id: integer → users.id
  name: text NOT NULL
  description: text
  is_system: boolean DEFAULT false
  created_at: timestamp DEFAULT NOW()
}
```

#### Income Categories & Subcategories
```typescript
income_categories {
  id: serial PRIMARY KEY
  user_id: integer → users.id
  name: text NOT NULL
  description: text
  is_system: boolean DEFAULT false
  created_at: timestamp DEFAULT NOW()
}

income_subcategories {
  id: serial PRIMARY KEY
  category_id: integer → income_categories.id
  user_id: integer → users.id
  name: text NOT NULL
  description: text
  is_system: boolean DEFAULT false
  created_at: timestamp DEFAULT NOW()
}
```

#### Expenses Table
```typescript
expenses {
  id: serial PRIMARY KEY
  user_id: integer → users.id
  amount: double precision NOT NULL
  description: text NOT NULL
  date: timestamp NOT NULL
  category_id: integer → expense_categories.id
  subcategory_id: integer → expense_subcategories.id (optional)
  merchant: text                   // Where the expense occurred
  notes: text                      // Additional notes
  created_at: timestamp DEFAULT NOW()
}
```

#### Income Table
```typescript
incomes {
  id: serial PRIMARY KEY
  user_id: integer → users.id
  amount: double precision NOT NULL
  description: text NOT NULL
  date: timestamp NOT NULL
  category_id: integer → income_categories.id
  subcategory_id: integer → income_subcategories.id (optional)
  source: text                     // Income source
  notes: text                      // Additional notes
  created_at: timestamp DEFAULT NOW()
}
```

#### Budgets & Allocations
```typescript
budgets {
  id: serial PRIMARY KEY
  user_id: integer → users.id
  name: text NOT NULL
  period: text DEFAULT 'monthly'   // 'weekly', 'monthly', 'yearly'
  start_date: timestamp NOT NULL
  end_date: timestamp NOT NULL
  amount: double precision NOT NULL
  notes: text
  created_at: timestamp DEFAULT NOW()
}

budget_allocations {
  id: serial PRIMARY KEY
  budget_id: integer → budgets.id
  category_id: integer → expense_categories.id
  subcategory_id: integer → expense_subcategories.id (optional)
  amount: double precision NOT NULL
  created_at: timestamp DEFAULT NOW()
}
```

### Relationships
- One user can have many expenses, incomes, budgets, and categories
- Categories can have many subcategories (hierarchical structure)
- Expenses/Income reference categories and optional subcategories
- Budgets can have multiple category allocations

---

## Authentication System

### Session-Based Authentication
The application uses Passport.js with local strategy for authentication:

#### Password Security
- **Hashing Algorithm**: scrypt (Node.js crypto module)
- **Salt Generation**: 16-byte random salt per password
- **Storage Format**: `${hashedPassword}.${salt}`

#### Session Management
- **Session Store**: PostgreSQL-based using connect-pg-simple
- **Session Secret**: Environment variable `SESSION_SECRET`
- **Session Configuration**:
  ```typescript
  {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: PostgreSQL session store,
    cookie: { secure: false } // Set to true in production with HTTPS
  }
  ```

#### Authentication Flow
1. **Registration**: Hash password → Create user → Auto-login
2. **Login**: Validate credentials → Create session → Return user data
3. **Session Persistence**: Session stored in PostgreSQL
4. **Logout**: Destroy session → Clear client state

#### Route Protection
- **Frontend**: `ProtectedRoute` component checks authentication
- **Backend**: `requireAuth` middleware validates session
- **Admin Routes**: Additional `requireAdmin` middleware

---

## Frontend Architecture

### Component Architecture
The frontend follows a hierarchical component structure:

#### Layout Components
- **MainLayout**: Wrapper with sidebar and mobile navigation
- **Sidebar**: Desktop navigation with user info
- **MobileNav**: Responsive navigation for mobile devices

#### Page Components
Each page is a complete feature module:
- **HomePage**: Dashboard with analytics and quick stats
- **ExpensesPage**: Full expense management interface
- **IncomePage**: Complete income tracking system
- **BudgetsPage**: Budget planning and allocation
- **ReportsPage**: Financial analytics and visualization
- **SettingsPage**: User preferences and configuration
- **AdminPage**: User management (admin only)

#### Feature Components
Modular components for specific functionality:
- **Add/Edit Dialogs**: Form components for data entry
- **Data Tables**: Display and manipulation of records
- **Export Components**: PDF/CSV export functionality

### State Management
- **Server State**: TanStack Query for API data
- **Form State**: React Hook Form for form management
- **UI State**: React useState for local component state
- **Global State**: React Context for authentication

### Routing System
Using Wouter for client-side routing:
```typescript
<Switch>
  <ProtectedRoute path="/" component={HomePage} />
  <ProtectedRoute path="/expenses" component={ExpensesPage} />
  <ProtectedRoute path="/income" component={IncomePage} />
  <ProtectedRoute path="/budgets" component={BudgetsPage} />
  <ProtectedRoute path="/reports" component={ReportsPage} />
  <ProtectedRoute path="/settings" component={SettingsPage} />
  <ProtectedRoute path="/admin" component={AdminPage} />
  <Route path="/auth" component={AuthPage} />
  <Route component={NotFound} />
</Switch>
```

### Data Flow
1. **API Calls**: TanStack Query manages server requests
2. **Caching**: Automatic caching and invalidation
3. **Optimistic Updates**: Immediate UI updates with rollback
4. **Error Handling**: Global error boundaries and toast notifications

---

## Backend Architecture

### Express.js Server Structure
The backend is organized into distinct modules:

#### Server Entry Point (`server/index.ts`)
- Express app initialization
- Middleware setup (CORS, JSON parsing, sessions)
- Route registration
- Error handling middleware
- Port binding and server startup

#### Route Definitions (`server/routes.ts`)
- RESTful API endpoints
- Authentication middleware integration
- Request validation using Zod schemas
- Response formatting

#### Authentication Module (`server/auth.ts`)
- Passport.js configuration
- Password hashing utilities
- Session management
- Authentication endpoints (/api/login, /api/register, /api/logout)

#### Data Access Layer (`server/storage.ts`)
- Database interface definition (IStorage)
- In-memory implementation for development
- PostgreSQL implementation for production
- CRUD operations for all entities

### API Design Patterns
- **RESTful Architecture**: Standard HTTP methods and status codes
- **Middleware Chain**: Authentication → Validation → Business Logic → Response
- **Error Handling**: Consistent error responses with proper HTTP status codes
- **Input Validation**: Zod schema validation for all request bodies

---

## API Endpoints

### Authentication Endpoints
```
POST /api/register        # User registration
POST /api/login          # User login
POST /api/logout         # User logout
GET  /api/user           # Get current user info
```

### User Management (Admin Only)
```
GET    /api/users           # List all users
PUT    /api/users/:id/role  # Update user role
PUT    /api/users/:id/settings # Update user settings
```

### Expense Categories
```
GET    /api/expense-categories        # Get user's expense categories
POST   /api/expense-categories        # Create expense category
PUT    /api/expense-categories/:id    # Update expense category
DELETE /api/expense-categories/:id    # Delete expense category

GET    /api/expense-subcategories/:categoryId # Get subcategories
POST   /api/expense-subcategories              # Create subcategory
PUT    /api/expense-subcategories/:id          # Update subcategory
DELETE /api/expense-subcategories/:id          # Delete subcategory
```

### Income Categories
```
GET    /api/income-categories         # Get user's income categories
POST   /api/income-categories         # Create income category
PUT    /api/income-categories/:id     # Update income category
DELETE /api/income-categories/:id     # Delete income category

GET    /api/income-subcategories/:categoryId  # Get subcategories
POST   /api/income-subcategories               # Create subcategory
PUT    /api/income-subcategories/:id           # Update subcategory
DELETE /api/income-subcategories/:id           # Delete subcategory
```

### Expenses
```
GET    /api/expenses        # Get user's expenses
POST   /api/expenses        # Create expense
PUT    /api/expenses/:id    # Update expense
DELETE /api/expenses/:id    # Delete expense
GET    /api/expenses/all    # Get all expenses (admin only)
```

### Income
```
GET    /api/incomes         # Get user's income records
POST   /api/incomes         # Create income record
PUT    /api/incomes/:id     # Update income record
DELETE /api/incomes/:id     # Delete income record
GET    /api/incomes/all     # Get all income records (admin only)
```

### Budgets
```
GET    /api/budgets               # Get user's budgets
POST   /api/budgets               # Create budget
PUT    /api/budgets/:id           # Update budget
DELETE /api/budgets/:id           # Delete budget

GET    /api/budget-allocations/:budgetId # Get budget allocations
POST   /api/budget-allocations            # Create allocation
PUT    /api/budget-allocations/:id        # Update allocation
DELETE /api/budget-allocations/:id        # Delete allocation
```

### Analytics & Reports
```
GET /api/analytics/monthly-expenses/:year    # Monthly expense totals
GET /api/analytics/category-expenses         # Category expense breakdown
GET /api/analytics/monthly-income/:year      # Monthly income totals
GET /api/analytics/category-income           # Category income breakdown
GET /api/analytics/budget-performance/:id    # Budget vs actual spending
```

### Request/Response Format

#### Standard Request Format
```typescript
// POST/PUT requests
{
  "data": {
    // Request payload validated against Zod schemas
  }
}
```

#### Standard Response Format
```typescript
// Success Response
{
  "success": true,
  "data": {
    // Response data
  }
}

// Error Response
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  }
}
```

---

## Features & Functionality

### 1. Dashboard & Analytics
- **Financial Overview**: Total income, expenses, and balance
- **Visual Charts**: Monthly trends and category breakdowns
- **Quick Stats**: Recent transactions and budget status
- **Responsive Cards**: Mobile-optimized information display

### 2. Expense Management
- **CRUD Operations**: Create, read, update, delete expenses
- **Categorization**: Hierarchical category and subcategory system
- **Filtering**: By date range, category, amount, and description
- **Bulk Operations**: Multiple selection and batch actions
- **Export Options**: PDF and CSV export with formatting

### 3. Income Tracking
- **Income Records**: Complete income management system
- **Source Tracking**: Income source identification
- **Category System**: Parallel to expense categories
- **Reporting**: Income analysis and trends

### 4. Budget Planning
- **Budget Creation**: Set budget periods and amounts
- **Category Allocation**: Distribute budget across categories
- **Performance Tracking**: Compare actual vs planned spending
- **Alerts**: Visual indicators for budget status

### 5. User Management
- **Authentication**: Secure login and registration
- **Profile Settings**: Currency preferences and personal info
- **Role-Based Access**: User and admin permissions
- **Session Management**: Secure session handling

### 6. Export Functionality
- **PDF Export**: Formatted reports with charts and tables
- **CSV Export**: Spreadsheet-compatible data export
- **Custom Ranges**: Export specific date ranges
- **Multiple Formats**: Choose format based on use case

### 7. Responsive Design
- **Mobile-First**: Optimized for mobile devices
- **Progressive Enhancement**: Desktop features when available
- **Touch-Friendly**: Large touch targets and gestures
- **Accessibility**: ARIA labels and keyboard navigation

---

## Development Setup

### Prerequisites
- Node.js 18+ or 20+
- PostgreSQL database (or use in-memory storage for development)
- Git for version control

### Environment Setup

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd ExpenseTrack
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create `.env` file in project root:
   ```bash
   # Database Configuration
   DATABASE_URL="postgresql://username:password@localhost:5432/expensetrack"
   
   # Session Security
   SESSION_SECRET="your-super-secret-session-key-here"
   
   # Environment
   NODE_ENV="development"
   ```

4. **Database Setup** (if using PostgreSQL)
   ```bash
   # Create database
   createdb expensetrack
   
   # Run migrations
   npm run db:migrate
   
   # (Optional) Seed with demo data
   npm run db:seed
   ```

### Development Commands

```bash
# Start development server (both frontend and backend)
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check

# Database operations
npm run db:generate    # Generate migrations
npm run db:migrate     # Run migrations
npm run db:studio     # Open Drizzle Studio

# Code quality
npm run lint          # ESLint
npm run format        # Prettier
```

### Development Workflow
1. **File Watching**: Vite provides hot reload for frontend changes
2. **Server Restart**: tsx automatically restarts server on backend changes
3. **Type Safety**: TypeScript compilation catches errors in development
4. **Database Changes**: Use Drizzle migrations for schema changes

---

## Deployment Guide

### Prerequisites for Deployment
- Node.js 18+ runtime environment
- PostgreSQL database instance
- HTTPS certificate (recommended)
- Domain name (optional but recommended)

### Production Environment Setup

#### 1. Server Preparation
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js (using NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install PostgreSQL (if hosting database locally)
sudo apt install postgresql postgresql-contrib
```

#### 2. Database Setup
```bash
# Create production database
sudo -u postgres createdb expensetrack_prod

# Create database user
sudo -u postgres createuser --interactive expensetrack_user

# Set password and grant permissions
sudo -u postgres psql
ALTER USER expensetrack_user PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE expensetrack_prod TO expensetrack_user;
```

#### 3. Application Deployment

**Option A: Manual Deployment**
```bash
# Clone repository
git clone <repository-url> /var/www/expensetrack
cd /var/www/expensetrack

# Install dependencies
npm ci --only=production

# Build application
npm run build

# Set up environment variables
cp .env.example .env
# Edit .env with production values

# Run database migrations
npm run db:migrate

# Start application with PM2
pm2 start npm --name "expensetrack" -- start
pm2 save
pm2 startup
```

**Option B: Docker Deployment**
```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 5000

# Start application
CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/expensetrack
      - SESSION_SECRET=your-secret-here
      - NODE_ENV=production
    depends_on:
      - db
  
  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=expensetrack
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

#### 4. Reverse Proxy Setup (Nginx)
```nginx
# /etc/nginx/sites-available/expensetrack
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site and restart nginx
sudo ln -s /etc/nginx/sites-available/expensetrack /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 5. SSL Certificate (Let's Encrypt)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

### Cloud Platform Deployment

#### Replit Deployment
1. **Push to Replit**: Import repository or push via Git
2. **Environment Variables**: Set in Replit Secrets
3. **Database**: Connect to Neon PostgreSQL or other cloud database
4. **Deploy**: Use Replit's one-click deployment

#### Heroku Deployment
```bash
# Install Heroku CLI and login
heroku login

# Create application
heroku create expensetrack-app

# Add PostgreSQL addon
heroku addons:create heroku-postgresql:hobby-dev

# Set environment variables
heroku config:set SESSION_SECRET=your-secret-here
heroku config:set NODE_ENV=production

# Deploy
git push heroku main

# Run migrations
heroku run npm run db:migrate
```

#### Vercel Deployment
```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "server/index.ts",
      "use": "@vercel/node"
    },
    {
      "src": "client/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/server/index.ts"
    },
    {
      "src": "/(.*)",
      "dest": "/client/dist/$1"
    }
  ]
}
```

### Production Optimization

#### Performance Optimizations
```bash
# Enable gzip compression
# Add to nginx config
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

# Optimize Node.js for production
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=1024"
```

#### Security Configuration
```typescript
// Production security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
```

#### Monitoring & Logging
```bash
# PM2 monitoring
pm2 monit

# View logs
pm2 logs expensetrack

# Log rotation
pm2 install pm2-logrotate
```

---

## Environment Configuration

### Development Environment
```bash
# .env.development
DATABASE_URL="postgresql://localhost:5432/expensetrack_dev"
SESSION_SECRET="dev-secret-key-change-in-production"
NODE_ENV="development"
VITE_API_URL="http://localhost:5000"
```

### Production Environment
```bash
# .env.production
DATABASE_URL="postgresql://user:pass@host:5432/expensetrack_prod"
SESSION_SECRET="super-secure-random-secret-key"
NODE_ENV="production"
PORT="5000"
TRUST_PROXY="true"
```

### Environment Variables Reference

#### Required Variables
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret key for session encryption (min 32 characters)
- `NODE_ENV`: Environment mode (development/production)

#### Optional Variables
- `PORT`: Server port (default: 5000)
- `TRUST_PROXY`: Enable if behind reverse proxy
- `CORS_ORIGIN`: Allowed CORS origins
- `LOG_LEVEL`: Logging verbosity
- `MAX_FILE_SIZE`: Maximum upload file size

---

## Troubleshooting

### Common Issues & Solutions

#### Database Connection Issues
```
Error: Connection refused
```
**Solution:**
1. Verify PostgreSQL is running: `sudo systemctl status postgresql`
2. Check connection string format
3. Verify firewall settings
4. Test connection: `psql $DATABASE_URL`

#### Session/Authentication Issues
```
Error: Failed to serialize user into session
```
**Solution:**
1. Check SESSION_SECRET is set
2. Verify session store configuration
3. Clear browser cookies
4. Restart server to clear sessions

#### Build/Compilation Errors
```
Error: Module not found
```
**Solution:**
1. Delete node_modules and package-lock.json
2. Run `npm install`
3. Check import paths and case sensitivity
4. Verify TypeScript configuration

#### Memory Issues
```
Error: JavaScript heap out of memory
```
**Solution:**
1. Increase Node.js memory: `NODE_OPTIONS="--max-old-space-size=4096"`
2. Optimize queries to reduce memory usage
3. Implement pagination for large datasets
4. Use streaming for large exports

#### Performance Issues
**Symptoms:** Slow page loads, timeouts
**Solutions:**
1. Add database indexes for frequently queried columns
2. Implement query optimization
3. Enable gzip compression
4. Use CDN for static assets
5. Implement caching strategies

### Debug Mode
Enable detailed logging:
```bash
# Development
DEBUG=express:* npm run dev

# Production
NODE_ENV=production LOG_LEVEL=debug npm start
```

### Health Checks
```bash
# API health check
curl http://localhost:5000/api/health

# Database connection check
npm run db:check
```

---

## Maintenance & Updates

### Regular Maintenance Tasks
1. **Database Backup**: Schedule regular PostgreSQL backups
2. **Security Updates**: Keep dependencies updated
3. **Log Rotation**: Prevent log files from growing too large
4. **Performance Monitoring**: Monitor response times and resource usage
5. **SSL Certificate Renewal**: Automated with Let's Encrypt

### Update Procedures
```bash
# Update dependencies
npm update

# Run security audit
npm audit

# Database migrations
npm run db:migrate

# Build and test
npm run build
npm test
```

This documentation provides a complete reference for understanding, developing, and deploying the ExpenseTrack application. For specific technical questions or implementation details, refer to the source code and inline comments.