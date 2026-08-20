# Digital Catalog SaaS

A digital product catalog platform for local clothing/saree shops. Each shop
gets its own catalog, reachable via a QR code or shop-specific URL
(`/shop/:shopSlug`), that customers can browse without creating an account.
Shop owners manage their catalog from an admin dashboard; the SaaS owner
manages all shops from a Super Admin dashboard.

This is **not** a marketplace: no customer accounts, no shopping cart, no
online checkout, no multi-branch inventory. One shop = one account = one
catalog.

> **Status:** Phase 1 (project scaffold) complete. See [Development
> Process](#development-process) below.

## Architecture

```text
digital-catalog-saas/
├── frontend/   React + Vite + TypeScript + Tailwind CSS (single SPA,
│               role-based routing for customer / shop-owner / super-admin)
├── backend/    FastAPI + SQLAlchemy + Alembic (REST API)
├── docker-compose.yml   Local PostgreSQL for development
└── README.md
```

Three user roles share one backend and one frontend app:

- **Customer** — no login, browses `/shop/:shopSlug`
- **Shop owner** — logs in, manages their own catalog at `/admin/*`
- **Super admin** — logs in, manages all shops at `/super-admin/*`

## Tech Stack

**Frontend:** React, Vite, TypeScript, Tailwind CSS v4, React Router,
TanStack Query, Lucide React icons, Axios.

**Backend:** Python, FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic,
PostgreSQL, JWT auth (python-jose), password hashing (passlib/bcrypt).

**Image storage:** abstracted behind a storage provider interface
(`IMAGE_STORAGE_PROVIDER`) so it can point at local disk during development
and Cloudinary in production, without touching application code.

## Local Setup

### Prerequisites

- Node.js 20+
- Python 3.11+
- PostgreSQL 16 (or use the provided `docker-compose.yml`)

### 1. Database

Using Docker:

```bash
docker compose up -d postgres
```

Or, against a local PostgreSQL install, create the database/role manually:

```sql
CREATE ROLE catalog_user LOGIN PASSWORD 'catalog_pass';
CREATE DATABASE digital_catalog OWNER catalog_user;
```

### 2. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # adjust values as needed
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`, with interactive docs
at `http://localhost:8000/docs`, and a health check at
`http://localhost:8000/api/health`.

#### Migrations (added in Phase 2)

```bash
alembic upgrade head                        # apply migrations
alembic revision --autogenerate -m "..."    # create a new migration
```

#### Seed data (added in Phase 2)

```bash
python -m app.database.seed
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env      # adjust VITE_API_URL if needed
npm run dev
```

The app will be available at `http://localhost:5173`.

### 4. Tests

```bash
# Backend
cd backend && source venv/bin/activate && pytest

# Frontend
cd frontend && npm run lint && npm run build
```

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret used to sign JWTs — must be changed in production |
| `JWT_ALGORITHM` | JWT signing algorithm (default `HS256`) |
| `JWT_EXPIRE_MINUTES` | Token lifetime in minutes |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins |
| `IMAGE_STORAGE_PROVIDER` | `local` or `cloudinary` |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Required when using Cloudinary |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Base URL of the backend API |

## Demo Credentials

Demo/seed accounts are created in Phase 2 and documented here once added.
**These credentials are for local development only and must never be used
in production.**

## Development Process

This project is being built in phases, per the pilot plan:

1. ✅ Repository, frontend/backend scaffolds, PostgreSQL, env config, health check
2. ⬜ Database models, Alembic migrations, seed data, authentication, RBAC
3. ⬜ Super Admin: shop creation, shop owner creation, 14-day trial
4. ⬜ Shop Owner dashboard: product CRUD, categories, image uploads, status
5. ⬜ Customer catalog: browsing, product details, search, filters, mobile UI
6. ⬜ QR code generation, analytics, activity tracking
7. ⬜ Polish: responsive UI, loading/error states, security hardening, docs

## Deployment

Deployment documentation will be added once the MVP feature set (Phases 1–7)
is complete.
