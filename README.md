# Digital Catalog SaaS

A digital product catalog platform for local clothing/saree shops. Each shop
gets its own catalog, reachable via a QR code or shop-specific URL
(`/shop/:shopSlug`), that customers can browse without creating an account.
Shop owners manage their catalog from an admin dashboard; the SaaS owner
manages all shops from a Super Admin dashboard.

This is **not** a marketplace: no customer accounts, no shopping cart, no
online checkout, no multi-branch inventory. One shop = one account = one
catalog.

> **Status:** Phase 7 (production readiness, security hardening, deployment
> configuration) complete — all 7 phases done. See
> [Development Process](#development-process) and [Deployment](#deployment)
> below.

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
| `IMAGE_STORAGE_PROVIDER` | `local`, `cloudinary`, or `supabase` |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Required when using Cloudinary |
| `SUPABASE_URL` | Supabase project URL (required when `IMAGE_STORAGE_PROVIDER=supabase`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (required when `IMAGE_STORAGE_PROVIDER=supabase`) |
| `SUPABASE_STORAGE_BUCKET` | Supabase Storage bucket name (default `product-images`) |
| `ENVIRONMENT` | `development` (default) or `production` — controls rate limiting and API docs visibility |
| `UPLOAD_DIR` | Local disk folder for uploaded product photos (only used when `IMAGE_STORAGE_PROVIDER=local`) |
| `API_BASE_URL` | Base URL the backend is reachable at — used to build absolute image URLs for local storage |
| `CATALOG_BASE_URL` | Base URL of the customer-facing catalog frontend (not this API) — used to build the `/shop/{slug}` URL a Super Admin's QR code encodes |

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
- `GET /shops/{id}/qr-code` — a PNG QR code encoding
  `{CATALOG_BASE_URL}/shop/{slug}`, for printing when onboarding a new shop.
  Generated fresh on every request from the shop's current slug (not
  persisted anywhere), so it's always correct even if the slug later
  changes. Super Admin only — shop owners don't get self-serve QR
  generation in this phase.

The Super Admin frontend (`/super-admin`, `/super-admin/shops`,
`/super-admin/shops/:id`) is role-gated by `ProtectedRoute` and covers all of
the above: dashboard stat cards, a shop table with create/activate/deactivate
actions, and a shop detail page with an edit dialog, activity feed, and a
"QR Code" button that opens a modal with a scannable preview and a download
link.

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
- `GET /analytics` — pilot analytics for the shop's own catalog: shop-view,
  product-view, and search counts (all-time and last-7-days), plus top-5
  lists for most-viewed products, most-searched terms (grouped
  case-insensitively), and category interest. Deliberately simple stat
  cards + top-N lists, matching the existing dashboard's style — no time
  series, no new charting dependency. Built entirely from `customer_events`
  rows the public catalog already records (see Public Catalog API below);
  a product or category that's since been deleted simply drops out of the
  relevant top-N list (`ON DELETE SET NULL` keeps the historical event, but
  it can no longer be resolved to a name/image).

Image storage is abstracted behind `ImageStorage`
(`app/services/storage.py`): `LocalImageStorage` writes to `UPLOAD_DIR` and
is served back out via a `/uploads` static mount, used for local dev and
tests; `CloudinaryImageStorage` is implemented against the same interface
so switching `IMAGE_STORAGE_PROVIDER=cloudinary` in production is a config
change, not a code change. Storage deletes always happen *after* the
database transaction that removes the row has committed, never before.

The Shop Owner frontend (`/admin`, `/admin/products`, `/admin/products/new`,
`/admin/products/:id/edit`, `/admin/categories`, `/admin/analytics`,
`/admin/settings`) covers all of the above: a dashboard, a
searchable/filterable product grid with inline mark-sold/available and
delete, a deliberately minimal product form (core fields first, photos
right after saving) with drag-free tap-to-upload, per-photo delete and
primary selection with upload progress bars, category management, an
analytics page with stat cards and most-viewed/most-searched/category-
interest lists, and a settings page for the shop's own profile and catalog
link.

## Public Catalog API

All routes below are mounted at `/api/public/shops/{shop_slug}` and require
**no authentication at all** -- these are the only endpoints in the app a
customer (no account, no login) ever calls. Every route resolves the shop
by slug first; a slug that matches nothing returns `404`, and a slug that
matches an inactive/suspended shop returns `403` with a generic "This
catalog is currently unavailable." message -- neither response reveals
*why* (subscription/trial state never appears in a public response).
Product detail is looked up by `(shop_id, product_id)` together, using the
shop already resolved from the URL slug, so a product belonging to a
different shop 404s exactly like a nonexistent one.

- `GET /{shop_slug}` -- shop profile (name, logo, description, contact
  info -- no trial/subscription/internal fields) plus its active
  categories. Records a `SHOP_VIEW` customer event.
- `GET /{shop_slug}/products` -- paginated product list. Supports
  `?category_id=`, `?availability=available|unavailable` (`unavailable`
  groups SOLD and OUT_OF_STOCK together, since the customer-facing filter
  is "can I buy this or not", not the shop owner's 3-way status),
  `?search=` (matches name or product code), `?sort=newest|price_asc|
  price_desc`, and `?page=`/`?page_size=` (default 24, max 60). Records a
  `SEARCH` and/or `CATEGORY_VIEW` event when those params are present.
- `GET /{shop_slug}/products/{product_id}` -- full product detail
  (description, all images). Records a `PRODUCT_VIEW` event.

Every response is built from its own `app/schemas/public.py` models, kept
deliberately separate from the shop-owner schemas -- `created_by`,
`catalog_activity`, internal timestamps, and trial/subscription fields
physically cannot appear in a public response because those schemas have
no field for them, rather than being hidden ad hoc at the API layer.

Anonymous analytics (`customer_events`): every public request carries an
`X-Anon-Session-Id` header -- a random, non-personal id the frontend
generates once per browser tab (`sessionStorage`, with an in-memory
fallback) and sends on every request, purely so events can be grouped
without identifying anyone. No customer accounts exist to tie events to.
A `SEARCH` event also stores the raw `search_query` text and a
`CATEGORY_VIEW` event stores which `category_id` was browsed (both added
in Phase 6) so the Shop Owner analytics endpoint above can surface top
search terms and category interest.

The customer catalog frontend (`/shop/:shopSlug`,
`/shop/:shopSlug/product/:productId`) is a separate, mobile-first
experience from the admin dashboards -- no login, no nav chrome, no
admin-style tables. The catalog page shows the shop's branding, a sticky
search bar, horizontally-scrolling category chips, an availability
toggle, a sort dropdown, and an infinite-scroll ("Load more") product
grid; the product page shows a tap-through image gallery, price,
description, and a Share button (Web Share API where supported, falling
back to copy-to-clipboard). Every product image goes through a shared
`ProductImage` component that shows a loading skeleton and falls back to
a neutral placeholder icon on a missing or broken URL, so a bad photo
never breaks a card's layout.

## Development Process

This project is being built in phases, per the pilot plan:

1. ✅ Repository, frontend/backend scaffolds, PostgreSQL, env config, health check
2. ✅ Database models, Alembic migrations, seed data, authentication, RBAC
3. ✅ Super Admin: shop creation, shop owner creation, 14-day trial
4. ✅ Shop Owner dashboard: product CRUD, categories, image uploads, status
5. ✅ Customer catalog: browsing, product details, search, filters, mobile UI
6. ✅ Super Admin QR code generation, Shop Owner pilot analytics dashboard
7. ✅ Production readiness, security hardening, deployment configuration

## Deployment

### Production Architecture

```text
┌──────────────┐     ┌──────────────────┐     ┌───────────────────┐
│   Vercel     │────▶│    Railway       │────▶│    Supabase       │
│  (Frontend)  │     │   (Backend)      │     │  (PostgreSQL +    │
│  React SPA   │     │   FastAPI API    │     │   Storage)        │
└──────────────┘     └──────────────────┘     └───────────────────┘
```

### Prerequisites

- [Supabase](https://supabase.com) project (free tier works for pilot)
- [Railway](https://railway.com) account
- [Vercel](https://vercel.com) account
- GitHub repository pushed with all phases

### 1. Supabase Setup

1. Create a new Supabase project.
2. Note the **Project URL** (`https://xxxx.supabase.co`) and the
   **service_role key** (Settings → API → Service role secret).
3. Get the **database connection string** from Settings → Database →
   Connection string (URI). Use the "Transaction pooler" string with port
   `6543` and prepend `postgresql+psycopg2://` as the scheme.
4. Create a **Storage bucket** named `product-images`, set it to **public**
   (so product images are served without auth).
5. Apply Alembic migrations from any machine with access:
   ```bash
   DATABASE_URL="postgresql+psycopg2://..." alembic upgrade head
   ```
6. Create the production Super Admin account:
   ```bash
   DATABASE_URL="postgresql+psycopg2://..." \
     ADMIN_EMAIL=your-real-admin@example.com \
     ADMIN_PASSWORD=a-strong-password \
     python -m app.database.create_admin
   ```

### 2. Railway (Backend)

1. Create a new Railway project, add a service from your GitHub repo.
2. Set the **Root Directory** to `backend`.
3. Add these environment variables in Railway:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Supabase connection string (see above) |
   | `JWT_SECRET` | A long random string (`openssl rand -hex 64`) |
   | `CORS_ORIGINS` | Your Vercel domain, e.g. `https://your-app.vercel.app` |
   | `IMAGE_STORAGE_PROVIDER` | `supabase` |
   | `SUPABASE_URL` | `https://xxxx.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | Service role key from Supabase |
   | `SUPABASE_STORAGE_BUCKET` | `product-images` |
   | `API_BASE_URL` | Your Railway domain, e.g. `https://your-backend.up.railway.app` |
   | `CATALOG_BASE_URL` | Your Vercel domain, e.g. `https://your-app.vercel.app` |
   | `ENVIRONMENT` | `production` |

4. Railway auto-detects the Procfile or `railway.json`; the start command
   is `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
5. Generate a domain in Railway (Settings → Networking → Generate Domain).
6. Verify: `https://your-backend.up.railway.app/api/health` should return
   `{"status": "ok", ...}`.

### 3. Vercel (Frontend)

1. Import the GitHub repo in Vercel.
2. Set the **Root Directory** to `frontend`.
3. Add the environment variable:

   | Variable | Value |
   |---|---|
   | `VITE_API_URL` | Your Railway backend URL, e.g. `https://your-backend.up.railway.app` |

4. Deploy. The `vercel.json` handles SPA routing (all paths → `index.html`).
5. Verify: visit `https://your-app.vercel.app` and log in with the
   production admin credentials you created in step 1.6.

### Post-Deploy Checklist

- [ ] Health check: `GET /api/health` returns 200
- [ ] Login works with production admin credentials (not dev credentials)
- [ ] Super Admin dashboard loads at `/super-admin`
- [ ] Create a shop, create a shop-owner account
- [ ] Shop owner logs in, adds products with images
- [ ] Images are stored in Supabase Storage bucket
- [ ] Customer catalog at `/shop/{slug}` loads correctly
- [ ] QR code generates and scans correctly on a real device
- [ ] CORS: browser console shows no cross-origin errors
- [ ] API docs are NOT accessible at `/docs` in production
- [ ] Rate limiting: rapid requests to public endpoints return 429
