# ExpenseTrack - Personal Finance Management Application

## Overview

ExpenseTrack is a full-stack personal finance management application that helps users track expenses, manage income, create budgets, and generate financial reports. The application is built with a modern tech stack featuring React with TypeScript on the frontend, Express.js on the backend, and PostgreSQL with Drizzle ORM for data persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **UI Components**: Custom component library built on Radix UI primitives
- **Styling**: Tailwind CSS with a professional black/white theme
- **State Management**: TanStack Query (React Query) for server state management
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite for development and building

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Authentication**: Passport.js with local strategy and session-based auth
- **Session Storage**: PostgreSQL-based session store
- **Database**: PostgreSQL with Drizzle ORM
- **Validation**: Zod schemas for API request/response validation
- **File Processing**: XLSX library for Excel file analysis

### Data Storage Solutions
- **Primary Database**: PostgreSQL (configured via Neon)
- **ORM**: Drizzle ORM with TypeScript-first approach
- **Session Store**: PostgreSQL-based session storage using connect-pg-simple
- **Schema Management**: Drizzle migrations for database versioning

## Key Components

### Authentication & Authorization
- Session-based authentication using Passport.js
- Password hashing with Node.js crypto (scrypt)
- Role-based access control (user/admin roles)
- Protected routes with authentication middleware

### Core Business Logic
- **Expense Management**: Full CRUD operations with categorization
- **Income Tracking**: Income records with category support
- **Budget Planning**: Budget creation with category allocations
- **Reporting**: Data visualization using Recharts

### Database Schema
- **Users**: User accounts with preferences (currency, role)
- **Categories & Subcategories**: Hierarchical organization for expenses and income
- **Expenses/Income**: Financial transactions with full metadata
- **Budgets & Allocations**: Budget planning with category-based allocations

### Export Functionality
- CSV and PDF export capabilities for all financial data
- Browser-based file generation using jsPDF and custom CSV utilities

## Data Flow

1. **User Authentication**: Session-based login/logout flow
2. **Data Entry**: Forms validate input using Zod schemas
3. **API Communication**: RESTful APIs with TanStack Query for caching
4. **Database Operations**: Drizzle ORM handles all database interactions
5. **Real-time Updates**: Query invalidation ensures UI consistency

## External Dependencies

### Frontend Dependencies
- **UI Framework**: React, Wouter, TanStack Query
- **UI Components**: Radix UI primitives, Lucide React icons
- **Forms & Validation**: React Hook Form, Zod, @hookform/resolvers
- **Styling**: Tailwind CSS, class-variance-authority
- **Charts**: Recharts for data visualization
- **Export**: jsPDF, jsPDF-autotable for PDF generation

### Backend Dependencies
- **Server**: Express.js, session management
- **Database**: Drizzle ORM, @neondatabase/serverless
- **Authentication**: Passport.js strategies
- **File Processing**: XLSX for Excel analysis
- **Utilities**: date-fns, csv-stringify

### Development Dependencies
- **Build Tools**: Vite, ESBuild, TypeScript
- **Development**: tsx for TypeScript execution
- **Database**: Drizzle Kit for migrations

## Deployment Strategy

### Build Process
1. Frontend builds to `dist/public` using Vite
2. Backend bundles to `dist/index.js` using ESBuild
3. TypeScript compilation with strict type checking

### Environment Configuration
- `DATABASE_URL` for PostgreSQL connection
- `SESSION_SECRET` for session security
- `NODE_ENV` for environment detection

### Production Setup
- Express serves both API routes and static frontend files
- Session storage persists to PostgreSQL
- Database migrations managed through Drizzle Kit

### Key Features
- Responsive design with mobile-first approach
- Progressive enhancement with client-side routing
- Comprehensive error handling and user feedback
- Export functionality for data portability
- Admin dashboard for user management
- Multi-currency support with customizable preferences

The application follows modern full-stack development practices with clear separation of concerns, type safety throughout, and a focus on user experience and data integrity.

## Documentation

Complete technical documentation is available in `DOCUMENTATION.md`, which includes:
- Comprehensive project structure and architecture overview
- Complete database schema with relationships
- API endpoint documentation with request/response formats
- Step-by-step deployment guides for multiple platforms
- Development setup and maintenance procedures
- Troubleshooting guide for common issues

## Recent Changes (January 2025)

### ✓ Core Application Complete
- Full-stack expense tracking application with React frontend and Express backend
- PostgreSQL database with Drizzle ORM for data persistence
- Session-based authentication with role-based access control
- Responsive black/white theme design optimized for all devices

### ✓ Feature Implementation
- Complete expense management with CRUD operations and hierarchical categorization
- Full income tracking system with category support and export functionality
- Budget planning with category allocations and performance tracking
- Dashboard analytics with visual charts and financial overview
- PDF and CSV export functionality for all financial data

### ✓ User Experience
- Mobile-first responsive design with touch-friendly interface
- Progressive navigation with sidebar and mobile drawer
- Form validation with real-time feedback using React Hook Form + Zod
- Toast notifications for user feedback and error handling

### ✓ Administration & Security
- Admin dashboard for user management and system oversight
- Secure password hashing with scrypt algorithm
- PostgreSQL session storage for scalable session management
- Input validation and sanitization across all endpoints

### ✓ Documentation & Deployment
- Comprehensive technical documentation covering all aspects
- Multiple deployment options (Replit, Heroku, Vercel, Docker, Manual)
- Environment configuration guides for development and production
- Troubleshooting guide with common issues and solutions

## Current Status
The application is production-ready with all core features implemented. Demo accounts available:
- Username: `demo` / Password: `password` (regular user)
- Username: `admin` / Password: `password` (admin user)

Default currency set to Cameroon CFA Franc (XAF) as requested.