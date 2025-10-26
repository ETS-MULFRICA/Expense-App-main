# Expense App

A full‑stack personal finance manager (expenses, income, budgets, analytics) built with React + Vite on the client and Express + PostgreSQL on the server. Sessions are persisted in PostgreSQL (production), schema managed by SQL + migrations, and the app can run locally or be deployed to serverless.

## What's inside

- Client: React 18 + TypeScript, Tailwind CSS, Radix UI, TanStack Query
- Server: Node.js + Express, Passport local auth, express-session
- Database: PostgreSQL (pg), SQL schema + migrations, optional Drizzle Kit
- Storage layer: `pg` queries via a single Pool
- Dev UX: Vite HMR integrated into the Express server

Key entry points
- Server: `api/index.ts`
- Router: `api/routes.ts`
- DB pool and migrations: `api/db.ts`, `database/schema.sql`, `database/migrations/*`
- Client app: `client/src/*` (served by Vite in dev, static in prod)

## Project structure

```
/ (repo root)
  api/                Express server, routes, auth, DB access
  client/             React client (Vite)
  database/           Base schema + SQL migrations
  scripts/            DB utilities (e.g., migrate)
  shared/             Shared TS types and Zod schemas
  dist/               Build output (created on build)
```

## How the Postgres connection works

The server reads database configuration from environment variables and creates a single `pg.Pool` in `api/db.ts`:
- Preferred: `DATABASE_URL` (postgresql://user:pass@host:port/db)
- Or discrete vars: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- Optional: `DB_SSL=true` to enable SSL (sets `ssl: { rejectUnauthorized: false }`)

Sessions
- In development, an in-memory session store is used
- In production, sessions are stored in Postgres via `connect-pg-simple` using the same pool

Migrations and seed
- `npm run db:migrate` runs `scripts/migrate.ts`, which applies `database/schema.sql` then runs all `database/migrations/*.sql` in order
- On first run, an admin user is created automatically if missing: username `admin`, password `password` (change this immediately)

## Setting up Postgres with pgAdmin

Use pgAdmin to create and configure your database:
1) Start your local PostgreSQL server
2) Open pgAdmin and connect to your server
3) Create a database (e.g., `expense_app`)
4) Create a role/user (e.g., `expense_user`) and set a password
5) Grant privileges on the new database to that user (Connect/Usage, create if desired)
6) Compose the connection string from pgAdmin properties:
   - `postgresql://<user>:<password>@<host>:<port>/<database>`
   - Local defaults are often `postgresql://expense_user:YOUR_PASSWORD@localhost:5432/expense_app`
7) Put that URL in your `.env` as `DATABASE_URL`

Tip: If your host requires SSL, also set `DB_SSL=true` in `.env`.

## Environment variables

Create a `.env` file in the repo root (same folder as `package.json`). Example:

```
# Database
DATABASE_URL=postgresql://expense_user:YOUR_PASSWORD@localhost:5432/expense_app
# or use DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME instead of DATABASE_URL
DB_SSL=false

# Sessions
SESSION_SECRET=change-this-to-a-long-random-string
NODE_ENV=development

# Optional email providers (admin features)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
RESEND_API_KEY=
SENDGRID_API_KEY=

# Optional backup/restore tools
PG_DUMP_PATH=pg_dump
PSQL_PATH=psql

# Optional Supabase (not required for Postgres mode)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

## Install and run locally (Windows PowerShell)

Prerequisites
- Node.js 18+ (Node 20 recommended)
- PostgreSQL 14+ (local) or a hosted Postgres instance
- pgAdmin (optional, for database GUI)

Steps
1) Clone the repository
```
git clone https://github.com/ETS-MULFRICA/Expense-App-main.git
cd Expense-App-main
```

2) Install dependencies
```
npm install
```

3) Create `.env` as shown above (ensure `DATABASE_URL` is valid)

4) Initialize the database
```
npm run db:migrate
```
This applies `database/schema.sql`, runs the migrations in `database/migrations`, and ensures a default admin user exists.

5) Start the dev server
```
npm run dev
```
- The Express server starts and wires Vite middleware for the client
- You'll see a log like “serving on port 5001”
- Open http://localhost:5001

6) Login
- Default admin (if none existed): `admin` / `password`
- Or register a new user at the Auth page

Notes
- `npm run dev:both` will run the API and a standalone Vite dev server in parallel if you prefer separate processes

## Production build and start

1) Build the client and bundle the server
```
npm run build
```
2) Start in production mode
```
$env:NODE_ENV="production"; npm start
```
- The server will serve prebuilt static files from `dist/public`

## Deployment notes

- Vercel: see `vercel.json` (build expects `dist/index.js`)
- Railway/Render/VMs: provide `DATABASE_URL` and `SESSION_SECRET`; run `npm run db:migrate` before `npm start`
- Reverse proxy (nginx) or platform router should forward all paths to the server; the server serves both API and SPA

## Database model (high level)

Core tables
- users (role, status, timestamps)
- expense_categories, expense_subcategories
- income_categories, income_subcategories
- expenses, incomes (optionally hidden via moderation)
- budgets, budget_allocations
- roles, permissions, role_permissions, user_roles
- activity_log, login_attempts

The app seeds minimal defaults where helpful (e.g., admin user, some system categories, role bindings). See `database/schema.sql` and `database/migrations/*` for details.

## Email (optional, admin features)

Configure any of:
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- Resend: `RESEND_API_KEY`
- SendGrid: `SENDGRID_API_KEY`

Then visit the admin email verification endpoint from the UI to check connectivity.

## Backups and restore (optional)

Admin endpoints use `pg_dump` and `psql` if available on PATH (or via `PG_DUMP_PATH` / `PSQL_PATH`).
- Backups are written under `backups/`
- Restores are protected and disabled in production unless explicitly enabled; read the route code before using in production

## Troubleshooting

- Cannot connect to DB: verify `DATABASE_URL`, server is running, and credentials/privileges in pgAdmin
- SSL errors to hosted Postgres: set `DB_SSL=true`
- Dev port: the server listens on port 5001 by default; browse http://localhost:5001
- Admin login missing: after `npm run db:migrate`, admin is auto-seeded if not already present
- Windows envs: use a `.env` file rather than inline env exports

## How to run on another machine (summary)

- Install Node and Postgres
- Use pgAdmin to create DB + user, then copy the connection string
- Clone this repo, `npm install`
- Create `.env` with your `DATABASE_URL` and `SESSION_SECRET`
- `npm run db:migrate`
- `npm run dev` and open http://localhost:5001

---

For deeper internals and a complete API surface, see `DOCUMENTATION.md`.
