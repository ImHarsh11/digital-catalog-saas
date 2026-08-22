# Digital Catalog SaaS

A digital product catalog platform for local clothing/saree shops. Each shop
gets its own catalog, reachable via a QR code or shop-specific URL
(`/shop/:shopSlug`), that customers can browse without creating an account.
Shop owners manage their catalog from an admin dashboard; the SaaS owner
manages all shops from a Super Admin dashboard.

This is **not** a marketplace: no customer accounts, no shopping cart, no
online checkout, no multi-branch inventory. One shop = one account = one
catalog.

> **Status:** Phase 4 (Shop Owner: product & category management, image
> uploads, status changes) complete. See
> [Development Process](#development-process) below.

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
PostgreSQL, JWT auth (python-jose), password hashing (`bcrypt` directly —
not passlib, to avoid its known incompatibility with bcrypt ≥4.1).

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

#### Migrations

```bash
alembic upgrade head                        # apply migrations
alembic revision --autogenerate -m "..."    # create a new migration
```

#### Seed data

Populates a Super Admin, one demo shop on a 14-day trial, a shop-owner
account, 5 categories, and ~30 demo products (safe to re-run — it skips
anything that already exists):

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
# Backend — needs its own database (never run against the dev DB):
#   CREATE DATABASE digital_catalog_test OWNER catalog_user;
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
| `UPLOAD_DIR` | Local disk folder for uploaded product photos (only used when `IMAGE_STORAGE_PROVIDER=local`) |
| `API_BASE_URL` | Base URL the backend is reachable at — used to build absolute image URLs for local storage |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Base URL of the backend API |

## Demo Credentials

Created by `python -m app.database.seed`. **These credentials are for local
development only and must never be used, or left enabled, in production.**

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@example.com` | `Admin123!` |
| Shop Owner (Demo Sarees) | `owner@example.com` | `Owner123!` |

Demo shop catalog: `/shop/demo-sarees`

## Authentication & Authorization

- `POST /api/auth/login` — email + password, returns a JWT bearer token.
- `GET /api/auth/me` — returns the current user, plus shop + trial info for
  shop owners.
- Passwords are hashed with `bcrypt` (never stored or logged in plain text).
- Every protected endpoint resolves the current user by re-fetching from the
  database on each request (not just trusting the token payload), so a
  deactivated account loses access immediately rather than after the token
  expires.
- `require_role(...)` and `get_current_shop_owner` (in
  `app/auth/dependencies.py`) are the reusable dependencies Super Admin and
  Shop Owner endpoints use to enforce SUPER_ADMIN vs SHOP_OWNER access.
- `verify_shop_ownership(user, shop_id)` guards every shop-scoped endpoint so
  a shop owner can never read or modify another shop's data by guessing an
  id — it 404s (not 403) on mismatch, so it doesn't even confirm the
  resource exists. `require_shop_access` (also in `dependencies.py`) wraps
  it as a router-level dependency for every `/api/shops/{shop_id}/...`
  route (categories, products, images, dashboard, profile) — a super admin
  passes for any shop, a shop owner only for their own.

## Super Admin API

All routes below are mounted at `/api/super-admin` and require a SUPER_ADMIN
bearer token (enforced once, at the router level).

- `GET /dashboard` — total/active/trial shops, expired trials, total
  products, products added this week.
- `GET /shops` — list shops with owner name/email and product count.
- `POST /shops` — creates a shop **and** its owner account in one request;
  the shop is started on a 14-day trial (`trial_start_date` = today,
  `trial_end_date` = today + 14 days, `subscription_status` = `TRIAL`).
  Rejects a duplicate slug or duplicate owner email with `409`.
- `GET /shops/{id}` — shop detail: stats, owner, recent activity (last 20).
- `PUT /shops/{id}` — partial update of shop profile fields. The slug is
  intentionally **not** editable here — it's baked into already-printed QR
  codes and shared URLs, so changing it would break them.
- `PATCH /shops/{id}/status` — activate/deactivate a shop's public catalog.
  This only flips `is_active`; it never touches `subscription_status`,
  since trial/billing state is not meant to be hand-edited from the UI.

The Super Admin frontend (`/super-admin`, `/super-admin/shops`,
`/super-admin/shops/:id`) is role-gated by `ProtectedRoute` and covers all of
the above: dashboard stat cards, a shop table with create/activate/deactivate
actions, and a shop detail page with an edit dialog and activity feed.

## Shop Owner API

All routes below are mounted at `/api/shops/{shop_id}/...` and require
either that shop's SHOP_OWNER or any SUPER_ADMIN (enforced by
`require_shop_access` on every route — see Authentication & Authorization
above). `shop_id` always comes from the URL path; it is never trusted from
a request body.

- `GET /dashboard` — product totals (available/sold/out of stock/added this
  week) plus the shop's own trial status, in one request.
- `GET /profile`, `PUT /profile` — the shop's own contact/profile fields.
  Reuses the same `ShopUpdate` schema and `update_shop` service function as
  the Super Admin's shop edit — slug is not editable here either.
- `GET/POST /categories`, `PUT/DELETE /categories/{id}` — category CRUD.
  Category names are unique per shop (not globally). Deleting a category
  that still has products attached is rejected with `409` (the DB's
  `ON DELETE RESTRICT` on `products.category_id` is never bypassed) and a
  message stating exactly how many products need to be moved first.
- `GET/POST /products`, `GET/PUT/DELETE /products/{id}` — product CRUD.
  `GET /products` supports `?category_id=`, `?status=`, and `?search=`
  (matches name or product code). Product codes are optional but, when set,
  must be unique within the shop — not globally, so two different shops can
  both use `"BS1001"`. Every product records `created_by`, surfaced in
  responses as `created_by.role` (`SHOP_OWNER` vs `SUPER_ADMIN`) so the
  paid catalog-management service can eventually be billed per product.
- `PATCH /products/{id}/status` — `AVAILABLE` / `SOLD` / `OUT_OF_STOCK`.
  Each transition logs its own `catalog_activity` action; setting the same
  status again is a no-op (no duplicate activity entry).
- `POST /products/{id}/images` — multipart image upload (JPEG/PNG/WebP,
  5MB max, validated by both content-type and by actually decoding the
  image with Pillow). The first image uploaded becomes the product's
  primary image automatically.
- `DELETE /products/{id}/images/{image_id}` — deletes the image row and the
  underlying file; if it was the primary image, the next remaining image
  (by upload order) is promoted automatically, or primary becomes `null`
  if none remain.
- `PATCH /products/{id}/images/{image_id}/primary` — explicitly choose the
  primary image.

Image storage is abstracted behind `ImageStorage`
(`app/services/storage.py`): `LocalImageStorage` writes to `UPLOAD_DIR` and
is served back out via a `/uploads` static mount, used for local dev and
tests; `CloudinaryImageStorage` is implemented against the same interface
so switching `IMAGE_STORAGE_PROVIDER=cloudinary` in production is a config
change, not a code change. Storage deletes always happen *after* the
database transaction that removes the row has committed, never before.

The Shop Owner frontend (`/admin`, `/admin/products`, `/admin/products/new`,
`/admin/products/:id/edit`, `/admin/categories`, `/admin/settings`) covers
all of the above: a dashboard, a searchable/filterable product grid with
inline mark-sold/available and delete, a deliberately minimal product
form (core fields first, photos right after saving) with drag-free
tap-to-upload, per-photo delete and primary selection with upload progress
bars, category management, and a settings page for the shop's own profile
and catalog link.

## Development Process

This project is being built in phases, per the pilot plan:

1. ✅ Repository, frontend/backend scaffolds, PostgreSQL, env config, health check
2. ✅ Database models, Alembic migrations, seed data, authentication, RBAC
3. ✅ Super Admin: shop creation, shop owner creation, 14-day trial
4. ✅ Shop Owner dashboard: product CRUD, categories, image uploads, status
5. ⬜ Customer catalog: browsing, product details, search, filters, mobile UI
6. ⬜ QR code generation, analytics, activity tracking
7. ⬜ Polish: responsive UI, loading/error states, security hardening, docs

## Deployment

Deployment documentation will be added once the MVP feature set (Phases 1–7)
is complete.
