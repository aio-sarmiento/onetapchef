# OneTapChef — Product Gameplan

> **Purpose of this document:** Define the full architecture, data model, tech stack, and build strategy for OneTapChef before a single line of code is written. This is the single source of truth for all product decisions.

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [User Types & Roles](#2-user-types--roles)
3. [Feature List — MVP vs Post-MVP](#3-feature-list--mvp-vs-post-mvp)
4. [Data Models](#4-data-models)
5. [Recommended Tech Stack](#5-recommended-tech-stack)
6. [Page / Screen Map](#6-page--screen-map)
7. [Matching Logic](#7-matching-logic--how-live-stock-maps-to-recipes)
8. [Basket Aggregation Logic](#8-basket-aggregation-logic)
9. [Auth & Role Separation Strategy](#9-auth--role-separation-strategy)
10. [API Route Outline](#10-api-route-outline)
11. [Real-Time Strategy](#11-real-time-strategy)
12. [Open Questions & Decisions](#12-open-questions--decisions-before-building)

---

## 1. Product Vision

OneTapChef is a two-sided marketplace that reduces food waste by connecting university students with local grocery vendors whose stock is approaching expiry. The core loop:

1. A vendor lists near-expiring ingredients at reduced or zero cost.
2. Students browse recipes that are dynamically filtered to only show what can be made *right now* with live vendor stock.
3. Students build a basket of multiple recipes, scale portions, and send a single aggregated ingredient request to the relevant vendor(s).
4. Vendors confirm fulfilment and the student collects or receives the ingredients.

The product sits at the intersection of food-waste reduction, student budget constraint, and community commerce.

---

## 2. User Types & Roles

| Role | Description |
|---|---|
| **Student** | Browses recipes constrained by live stock, builds baskets, places requests, submits recipes, comments, shares. |
| **Vendor** | Posts available near-expiring stock, sees incoming ingredient requests from students, confirms or adjusts fulfilment. |
| **Admin** | (Internal) Verifies vendor accounts, moderates student-submitted recipes, manages the master ingredient catalog. |

---

## 3. Feature List — MVP vs Post-MVP

### MVP (Version 1.0 — Launch-Ready)

**Student-side**
- [ ] Register and log in with email + role selection
- [ ] Browse recipe feed filtered by *currently available* ingredients in live vendor stock
- [ ] Search and filter recipes by category, cuisine, prep time, and dietary tag
- [ ] View recipe detail: full ingredient list with per-ingredient availability indicator (in stock / low / unavailable), instructions, prep/cook time
- [ ] Portion scaling on recipe detail — adjust servings and see quantities recalculate
- [ ] Add recipe to basket (with chosen portion size)
- [ ] Basket view: aggregated ingredient list across all selected recipes, grouped by vendor, with running cost estimate
- [ ] Send a single basket request to vendor(s) — one order per vendor
- [ ] Order history (track status: pending → confirmed → ready → completed)
- [ ] Submit a new recipe (title, ingredients from master catalog, steps, image, tags)
- [ ] Student profile (dietary preferences, saved recipes)

**Vendor-side**
- [ ] Register and log in (vendor account flagged for admin verification)
- [ ] Stock dashboard: current listings, low-stock alerts, expiry countdown
- [ ] Add a new stock listing: ingredient (from master catalog), quantity, unit, price per unit, expiry date
- [ ] Edit or remove a listing
- [ ] Incoming requests feed: see each student's aggregated ingredient list, portion count, and contact
- [ ] Confirm or adjust a fulfilment (confirm exact quantities available, flag what cannot be fulfilled)
- [ ] Order history

**Shared / Platform**
- [ ] Master ingredient catalog (admin-managed, vendor/student selects from it)
- [ ] Recipe availability score computed server-side on every recipe
- [ ] Real-time stock updates: when vendor edits/removes a listing, affected recipe availability scores update live
- [ ] Role-based routing (students cannot access vendor pages and vice versa)
- [ ] Basic email notifications: order confirmed, request received

### Post-MVP (Version 1.x and beyond)

**Student-side**
- [ ] Comments and threaded discussion on recipes
- [ ] Recipe ratings and saves/"bookmarks"
- [ ] Social sharing (link, image card for Instagram/WhatsApp)
- [ ] Activity feed: recently posted recipes, new vendor stock alerts
- [ ] Push notifications (browser): new stock from followed vendors, basket request updates
- [ ] Recommended recipes based on dietary preferences and past orders
- [ ] "What can I make?" mode — input only the ingredients available in the student's area and get matching recipes
- [ ] University email verification for student badge

**Vendor-side**
- [ ] Bulk stock upload via CSV
- [ ] Auto-expiry: listings automatically move to "expiring soon" badge 24h before expiry date
- [ ] Vendor analytics: which ingredients get requested most, average fulfilment time
- [ ] Vendor profile page with ratings from students
- [ ] Option to list items as *free* (zero cost, donation mode)

**Platform**
- [ ] In-app payment processing (Stripe) — MVP is request-only, no payment
- [ ] Geolocation filtering: show vendors within X km of student's campus
- [ ] Multi-language support (ES, EN)
- [ ] Admin recipe moderation queue
- [ ] Ingredient synonym/alias resolution (e.g. "courgette" = "zucchini")
- [ ] Recipe collections / meal plans
- [ ] API for potential mobile app in future

---

## 4. Data Models

The following is a logical schema. Exact column types are implementation-level decisions, but the structure and relationships are defined here.

---

### `users`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `email` | string unique | |
| `hashed_password` | string | |
| `role` | enum: `student`, `vendor`, `admin` | |
| `display_name` | string | |
| `avatar_url` | string nullable | |
| `is_verified` | boolean | False until email confirmation |
| `created_at` | timestamp | |

---

### `student_profiles`

One-to-one with `users` where `role = student`.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | |
| `university` | string nullable | |
| `dietary_tags` | string[] | e.g. `["vegan", "gluten-free"]` |
| `university_email_verified` | boolean | Post-MVP |

---

### `vendor_profiles`

One-to-one with `users` where `role = vendor`.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | |
| `business_name` | string | |
| `description` | string nullable | |
| `address` | string | |
| `city` | string | |
| `latitude` | decimal nullable | Post-MVP geolocation |
| `longitude` | decimal nullable | Post-MVP geolocation |
| `is_admin_verified` | boolean | Vendor cannot go live until true |
| `contact_phone` | string nullable | |
| `avg_rating` | decimal nullable | Post-MVP, computed |

---

### `ingredients` (master catalog)

Managed by admins. Vendors and recipe authors select from this catalog — they do not create freeform ingredient names. This is the critical normalisation point that makes the matching logic possible.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `name` | string unique | Canonical name, e.g. "Cherry Tomatoes" |
| `aliases` | string[] | Post-MVP synonym matching |
| `category` | string | e.g. "Vegetables", "Dairy", "Grains" |
| `default_unit` | string | e.g. "g", "kg", "unit", "ml" |
| `image_url` | string nullable | |

---

### `vendor_stock`

Represents one ingredient listing from one vendor at one point in time. This is the live marketplace table.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `vendor_id` | UUID FK → vendor_profiles | |
| `ingredient_id` | UUID FK → ingredients | |
| `quantity_available` | decimal | Remaining quantity |
| `unit` | string | Should match or be convertible to ingredient default_unit |
| `price_per_unit` | decimal | 0.00 for free/donation listings |
| `expiry_date` | date | |
| `status` | enum: `available`, `low`, `sold_out`, `expired` | `low` threshold TBD, e.g. < 20% of original quantity |
| `original_quantity` | decimal | For calculating % remaining |
| `listed_at` | timestamp | |
| `updated_at` | timestamp | |

> **Key invariant:** A recipe is considered "available" only when all non-optional ingredients in `recipe_ingredients` have at least one matching `vendor_stock` row with `status = available OR low` and `expiry_date >= today`.

---

### `recipes`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `title` | string | |
| `slug` | string unique | URL-friendly, auto-generated from title |
| `description` | string | Short intro paragraph |
| `author_id` | UUID FK → users | |
| `base_servings` | integer | The reference serving count for all quantities |
| `prep_time_minutes` | integer | |
| `cook_time_minutes` | integer | |
| `category` | string | e.g. "Breakfast", "Dinner", "Snack" |
| `cuisine` | string | e.g. "Mediterranean", "Asian" |
| `dietary_tags` | string[] | e.g. `["vegan", "nut-free"]` |
| `image_url` | string nullable | |
| `instructions` | text | Ordered steps, stored as JSON array of strings |
| `is_published` | boolean | False while pending moderation (post-MVP) |
| `availability_score` | decimal | 0.0–1.0, % of required ingredients currently in stock. Recomputed on stock changes. |
| `created_at` | timestamp | |
| `view_count` | integer | |
| `share_count` | integer | Post-MVP |

---

### `recipe_ingredients`

Junction table linking recipes to catalog ingredients.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `recipe_id` | UUID FK → recipes | |
| `ingredient_id` | UUID FK → ingredients | |
| `quantity` | decimal | For `base_servings` number of servings |
| `unit` | string | |
| `is_optional` | boolean | Optional ingredients do not affect availability_score |
| `preparation_note` | string nullable | e.g. "finely diced", "at room temperature" |
| `sort_order` | integer | Display order |

---

### `baskets`

A basket is a temporary working document — it belongs to a student and holds their current recipe selections. One active basket per student at any time.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `student_id` | UUID FK → users | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

---

### `basket_items`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `basket_id` | UUID FK → baskets | |
| `recipe_id` | UUID FK → recipes | |
| `servings` | integer | Student's chosen serving count (used to compute scaling factor vs base_servings) |
| `added_at` | timestamp | |

---

### `orders`

Created when a student submits their basket. One order is created per vendor involved.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `student_id` | UUID FK → users | |
| `vendor_id` | UUID FK → vendor_profiles | |
| `status` | enum: `pending`, `confirmed`, `ready`, `completed`, `cancelled` | |
| `student_note` | string nullable | Free-text note from student |
| `vendor_note` | string nullable | Vendor's response note |
| `estimated_total` | decimal | Sum of `order_items.quantity_requested * price_per_unit` at time of order |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

---

### `order_items`

Line items within an order. Each row is one ingredient requested from that vendor.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `order_id` | UUID FK → orders | |
| `ingredient_id` | UUID FK → ingredients | |
| `stock_id` | UUID FK → vendor_stock | Snapshot of which listing this was drawn from |
| `quantity_requested` | decimal | Aggregated across all basket recipes |
| `quantity_confirmed` | decimal nullable | Set by vendor during confirmation |
| `unit` | string | |
| `price_per_unit` | decimal | Snapshot at time of order |

---

### `comments`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `recipe_id` | UUID FK → recipes | |
| `author_id` | UUID FK → users | |
| `body` | text | |
| `parent_comment_id` | UUID FK → comments nullable | Enables one level of threading |
| `created_at` | timestamp | |
| `is_deleted` | boolean | Soft delete |

---

## 5. Recommended Tech Stack

### Decision rationale summary

The key technical constraints driving stack choice are:
- **Real-time stock availability** — ingredient counts change as vendors update listings, and all open student sessions should reflect this without a page refresh.
- **Two distinct user flows** on the same domain with different routing and UI.
- **Complex relational queries** — the matching logic involves joins across recipes, recipe_ingredients, ingredients, and vendor_stock.
- **Student-side social features** (comments, feeds, sharing) that benefit from SSR for SEO.
- **Small team, fast iteration** — the stack should minimise operational overhead.

---

### Frontend — Next.js 14 (App Router)

**Why:** Server components handle SEO-critical recipe pages efficiently. The App Router's layout system is well-suited to the vendor/student split (different root layouts, middleware-based role routing). React Server Components reduce client bundle size for read-heavy pages like recipe browsing. The ecosystem is mature and well-documented.

**Alternatives considered:**
- *Vite + React SPA* — faster to bootstrap but loses SSR benefits for recipe SEO and complicates real-time integration.
- *Remix* — excellent for data loading but smaller ecosystem and less familiar to most developers.

### Backend / API — Next.js Route Handlers + Supabase

**Why Supabase:**
1. **PostgreSQL** with full relational query support handles the complex matching joins natively.
2. **Supabase Realtime** provides row-level change subscriptions over WebSockets out of the box — critical for live stock updates pushing to student browsers.
3. **Supabase Auth** includes JWT-based sessions, role metadata, and Row-Level Security (RLS) policies, meaning data access rules live in the database layer rather than scattered across API routes.
4. **Supabase Storage** handles recipe and vendor profile images.
5. Hosted, managed — no infrastructure to maintain in early stages.

For business logic that is too complex for direct Supabase queries (e.g. basket checkout creating multiple orders, availability score recomputation), Next.js Route Handlers act as a thin server layer.

**Alternatives considered:**
- *Firebase* — real-time is excellent but document model is a poor fit for relational matching queries.
- *PlanetScale + separate Socket.io server* — works but adds operational complexity (two services to maintain).
- *Supabase Edge Functions* — viable for some background tasks but adds latency vs Route Handlers for synchronous request flows.

### ORM — Prisma

**Why:** Type-safe queries that mirror the data model defined in this document. Schema migrations via `prisma migrate`. Works alongside Supabase's native client (use Prisma for write-heavy transactional logic, Supabase JS client for real-time subscriptions and storage).

### Styling — Tailwind CSS + shadcn/ui

**Why:** Tailwind provides low-level utility styling without runtime overhead. shadcn/ui provides accessible, unstyled component primitives (dialogs, sheets, dropdowns) that match the clean UI a food/recipe app needs, without locking into a heavy component library.

### State Management — Zustand (client-only state)

Used exclusively for basket state on the client (selected recipes, portion sizes in the basket panel). Server state (recipes, stock, orders) is handled by Next.js server components and React Query (TanStack Query) for client-side fetching and cache invalidation.

### Email — Resend

Simple transactional email (order confirmations, vendor notifications). Low setup overhead, excellent Next.js integration.

### Deployment — Vercel

Co-located with Next.js for zero-config deployment. Supabase is deployed separately on Supabase Cloud.

---

### Stack Summary Table

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | SSR for SEO, role-based routing, React ecosystem |
| Database | Supabase (PostgreSQL) | Relational queries, real-time, auth, storage |
| ORM | Prisma | Type safety, migrations |
| Real-time | Supabase Realtime | Stock change subscriptions to clients |
| Auth | Supabase Auth | JWT, RLS policies, role metadata |
| Styling | Tailwind CSS + shadcn/ui | Fast, accessible, no runtime |
| Client state | Zustand + TanStack Query | Basket local state + server cache |
| Email | Resend | Transactional emails |
| File storage | Supabase Storage | Recipe images, vendor images |
| Deployment | Vercel + Supabase Cloud | Managed, scalable, zero-config |

---

## 6. Page / Screen Map

### Student-facing pages

```
/ (Home / Landing)
  └── Hero with value prop + CTA to browse recipes or sign up

/browse
  └── Recipe feed
      ├── Filter panel (availability: all / fully available / partially available)
      ├── Search bar
      ├── Category / cuisine / dietary / sort filters
      └── Recipe card grid (shows availability badge)

/recipes/[slug]
  └── Recipe detail
      ├── Image, title, author, meta (time, servings)
      ├── Portion scaler (adjust servings → quantities recalculate)
      ├── Ingredient list with per-ingredient availability chip
      │     (In stock → green, Low stock → yellow, Unavailable → red)
      ├── Vendor attribution per ingredient
      ├── Instructions
      ├── Add to Basket button
      └── Comments section (Post-MVP)

/recipes/new
  └── Submit a recipe form
      ├── Title, description, image upload
      ├── Ingredient selector (from master catalog) + quantity + unit
      ├── Instruction steps (add/remove/reorder)
      └── Tags (category, cuisine, dietary)

/basket
  └── Basket sidebar / page
      ├── List of selected recipes with portion choices
      ├── Aggregated ingredient list (grouped by vendor)
      ├── Cost estimate per vendor
      └── "Send Request" CTA → creates orders

/orders
  └── My order history
      └── Order detail (status timeline, vendor contact, line items)

/profile
  └── Student profile
      ├── Display name, avatar, university
      ├── Dietary preferences
      └── Saved recipes (Post-MVP)

/auth/login
/auth/register
/auth/confirm  ← email confirmation redirect
```

---

### Vendor-facing pages

```
/vendor/dashboard
  └── Overview
      ├── Active listings count, low-stock alerts, expiring soon count
      └── Incoming requests summary (pending count)

/vendor/stock
  └── Stock management
      ├── Table of all active listings (ingredient, quantity, expiry, status)
      ├── "Add listing" button → inline form or modal
      └── Edit / Remove controls per listing

/vendor/stock/new
  └── Add new listing form
      ├── Ingredient selector (from master catalog)
      ├── Quantity + unit
      ├── Price per unit (or mark as Free)
      └── Expiry date

/vendor/requests
  └── Incoming ingredient requests feed
      ├── Each request card: student name, list of ingredients needed, portion counts, recipe names
      └── Confirm fulfilment (input confirmed quantities per line item) or decline

/vendor/orders
  └── Order history with status filters

/vendor/profile
  └── Business name, description, address, contact, verification status
```

---

### Admin pages (internal, Post-MVP polish)

```
/admin/vendors        ← approve/reject vendor registration
/admin/recipes        ← moderation queue for student-submitted recipes
/admin/ingredients    ← manage master catalog (add, edit, merge aliases)
```

---

## 7. Matching Logic — How Live Stock Maps to Recipes

This is the core algorithmic problem. The goal is to answer, for every recipe: *"What fraction of this recipe's required ingredients are currently in stock somewhere in the marketplace?"*

### 7.1 Availability Score Computation

**Definition:** `availability_score` on a recipe = `(count of required ingredients with at least one available stock listing) / (total count of required ingredients)`.

An ingredient is considered "available" if there exists at least one `vendor_stock` row where:
- `ingredient_id` matches
- `status IN ('available', 'low')`
- `expiry_date >= CURRENT_DATE`
- `quantity_available > 0`

Optional ingredients (`is_optional = true` in `recipe_ingredients`) are excluded from the denominator and numerator — they do not penalise the score.

**SQL sketch (conceptual):**

```sql
-- For a single recipe, the availability score is:
SELECT
  COUNT(DISTINCT ri.ingredient_id) FILTER (
    WHERE vs.id IS NOT NULL
  )::decimal
  / NULLIF(COUNT(DISTINCT ri.ingredient_id), 0)
  AS availability_score
FROM recipe_ingredients ri
LEFT JOIN vendor_stock vs
  ON vs.ingredient_id = ri.ingredient_id
  AND vs.status IN ('available', 'low')
  AND vs.expiry_date >= CURRENT_DATE
  AND vs.quantity_available > 0
WHERE ri.recipe_id = $recipeId
  AND ri.is_optional = false;
```

### 7.2 When Scores Are Recomputed

`availability_score` is stored as a column on the `recipes` table and recomputed whenever the `vendor_stock` table changes. Two triggers cause this:

1. **Vendor updates a listing** (quantity changes, status changes, listing is deleted, expiry date changes) → recompute scores for all recipes that include that ingredient.
2. **Scheduled job (daily)** → recompute all scores to catch listings that have crossed their expiry date overnight.

**Implementation approach:**
- Supabase Database Webhook (or Postgres trigger) on `vendor_stock` → calls a Next.js API Route (or Supabase Edge Function) that bulk-updates `availability_score` for affected recipes.
- This is the preferred approach over computing scores on every read request, which would be too expensive at scale.

### 7.3 Per-Ingredient Availability on Recipe Detail Page

When a student opens a recipe, the detail page performs a fresh query (not relying on the cached score) to show exactly which ingredients are available, from which vendors, and at what price. This is a live read from `vendor_stock` joined to `recipe_ingredients` for that recipe.

This gives the student:
- Which ingredients they can source
- From which vendor(s)
- At what cost
- How much stock remains (guides urgency)

### 7.4 Browse Page Filtering

The recipe feed defaults to showing **fully available** recipes first (score = 1.0), then **partially available** (0.0 < score < 1.0), then unavailable recipes are hidden by default but visible with a filter toggle. This is a simple `ORDER BY availability_score DESC` with optional `WHERE availability_score > 0` clause.

---

## 8. Basket Aggregation Logic

When a student has selected multiple recipes with different portion sizes and clicks "Send Request", the following steps occur server-side:

### Step 1 — Collect basket items

Fetch all `basket_items` for the student's active basket, including `recipe_id` and `servings`.

### Step 2 — Compute scaling factor per recipe

```
scaling_factor = chosen_servings / base_servings
```

### Step 3 — Expand to scaled ingredient list

For each basket item, fetch its `recipe_ingredients`. Multiply each ingredient's `quantity` by the item's `scaling_factor`. Unit conversion is applied where needed (e.g. vendor lists in kg, recipe calls for g).

### Step 4 — Aggregate across recipes

Group the resulting ingredient list by `ingredient_id`. Sum quantities for the same ingredient. If two recipes both need cherry tomatoes, the student needs the combined total.

Result: a flat list of `{ ingredient_id, total_quantity, unit }`.

### Step 5 — Match each ingredient to a vendor listing

For each ingredient in the aggregated list, query `vendor_stock` to find the best-fit listing. "Best fit" rules (in order of priority):
1. Status is `available` before `low`
2. Expiry date furthest away (freshest)
3. Lowest price per unit (tiebreak)

This assigns each ingredient to a specific `vendor_stock` row (and therefore a specific vendor).

### Step 6 — Group by vendor

The aggregated ingredient list, now with vendor assignments, is grouped by vendor. This produces N sub-lists, one per vendor.

### Step 7 — Create orders

One `Order` record is created per vendor group. `OrderItem` records are created for each ingredient in that group with `quantity_requested`, `price_per_unit` (snapshot), and a reference to the `vendor_stock` row. The `vendor_stock.quantity_available` is NOT decremented at this point — that happens when the vendor confirms.

### Step 8 — Notify vendors

Each vendor receives a notification (in-app + email) that a new ingredient request has arrived.

### Stock quantity reservation (important edge case)

Because two students could request the same ingredient simultaneously, the MVP approach is optimistic: stock is not reserved at request time. If a vendor cannot fulfil (stock ran out after the request was placed), the vendor confirms with a lower `quantity_confirmed` and the student is notified. Post-MVP, a reservation/hold system can be added.

---

## 9. Auth & Role Separation Strategy

### Authentication

- Supabase Auth handles session management via JWTs with a short access token TTL (1 hour) and refresh token rotation.
- Users register with email + password. A confirmation email is sent before the account is active.
- Vendor accounts additionally require `is_admin_verified = true` on their `vendor_profiles` row before they can post stock.

### Role Metadata

The user's `role` (`student`, `vendor`, `admin`) is stored in the `users` table and also embedded in the Supabase JWT as a custom claim (`app_metadata.role`). This means middleware can read the role from the JWT without a database round-trip.

### Next.js Middleware — Route Protection

```
Middleware runs on every request.
├── /vendor/* → require role = vendor AND admin_verified = true
├── /admin/* → require role = admin
├── /basket, /orders, /recipes/new → require any authenticated user
└── /browse, /recipes/[slug] → public (no auth required, but auth enhances UX)
```

Unauthenticated access to protected routes redirects to `/auth/login` with a `?next=` param for post-login redirect.

### Row-Level Security (Supabase RLS)

RLS policies live in the database itself and act as a second line of defence beyond the API layer.

Key policies:
- `vendor_stock`: INSERT/UPDATE/DELETE only by the vendor who owns the listing (`vendor_profiles.user_id = auth.uid()`).
- `orders`: SELECT by the student who created it OR the vendor it belongs to.
- `order_items`: same scoping as orders.
- `baskets` / `basket_items`: SELECT/INSERT/DELETE only by the owning student.
- `recipes`: INSERT by any authenticated user; UPDATE/DELETE only by the author or admin.
- `comments`: INSERT by any authenticated user; DELETE only by author or admin.
- `vendor_profiles`: UPDATE only by the owning user; `is_admin_verified` can only be set by admin role.

### Password Reset

Standard Supabase Auth reset-by-email flow. No additional work required.

---

## 10. API Route Outline

All routes live under `/api/`. Route Handlers in Next.js. Authentication state is read from the Supabase session cookie on every request.

### Auth

```
POST   /api/auth/register          → create user + profile row
POST   /api/auth/login             → supabase sign-in, set session cookie
POST   /api/auth/logout            → invalidate session
GET    /api/auth/me                → return current user + role + profile
```

### Recipes

```
GET    /api/recipes                → list recipes (filters: category, cuisine, dietary, availability_score_min, sort)
GET    /api/recipes/feed           → recently submitted recipes (Post-MVP social feed)
GET    /api/recipes/[id]           → recipe detail + live ingredient availability check
POST   /api/recipes                → submit new recipe (auth required)
PUT    /api/recipes/[id]           → update recipe (author or admin only)
DELETE /api/recipes/[id]           → delete recipe (author or admin only)
GET    /api/recipes/[id]/comments  → paginated comments (Post-MVP)
POST   /api/recipes/[id]/comments  → add comment (Post-MVP)
```

### Ingredients (Catalog)

```
GET    /api/ingredients            → list all catalog ingredients (for autocomplete in forms)
POST   /api/ingredients            → add new ingredient (admin only)
PUT    /api/ingredients/[id]       → edit ingredient (admin only)
```

### Vendor Stock

```
GET    /api/vendors/[id]/stock     → list all active stock for a vendor
POST   /api/vendors/[id]/stock     → add a new listing (vendor only, self)
PUT    /api/vendors/[id]/stock/[stockId]   → update listing (vendor only, self)
DELETE /api/vendors/[id]/stock/[stockId]   → remove listing (vendor only, self)
GET    /api/market                 → all active stock across all vendors (for ingredient availability map)
```

### Basket

```
GET    /api/basket                 → get student's active basket with expanded recipe + ingredient data
POST   /api/basket/items           → add recipe to basket { recipe_id, servings }
PUT    /api/basket/items/[id]      → update servings for a basket item
DELETE /api/basket/items/[id]      → remove recipe from basket
POST   /api/basket/checkout        → aggregate basket → create orders → return order IDs
```

### Orders

```
GET    /api/orders                 → list orders (student sees own; vendor sees incoming)
GET    /api/orders/[id]            → order detail
PUT    /api/orders/[id]/confirm    → vendor confirms fulfilment (sets quantity_confirmed per item, decrements vendor_stock)
PUT    /api/orders/[id]/ready      → vendor marks order ready for collection
PUT    /api/orders/[id]/complete   → student marks order collected
PUT    /api/orders/[id]/cancel     → either party cancels (with cancellation reason)
```

### Vendor Profile

```
GET    /api/vendors/[id]           → public vendor profile
PUT    /api/vendors/[id]           → update vendor profile (self only)
```

### Users / Students

```
GET    /api/users/[id]             → public profile
PUT    /api/users/[id]             → update own profile (self only)
```

### Admin (Post-MVP)

```
GET    /api/admin/vendors/pending  → vendors awaiting verification
PUT    /api/admin/vendors/[id]/verify → approve vendor
GET    /api/admin/recipes/pending  → recipes awaiting moderation
PUT    /api/admin/recipes/[id]/approve
PUT    /api/admin/recipes/[id]/reject
```

---

## 11. Real-Time Strategy

Real-time concerns in priority order:

### 1. Stock availability updates → student browsers

When a vendor edits or removes a listing, students currently browsing recipes that include that ingredient should see availability chips update without a page refresh.

**Mechanism:** Supabase Realtime channel subscribed to `vendor_stock` table changes (filtered to relevant `ingredient_id`s for the current recipe page). On change event, client refetches the ingredient availability data for the open recipe.

This is the highest-priority real-time feature and is included in MVP.

### 2. Incoming order notifications → vendor

When a student submits a basket checkout, the vendor's request feed should update live.

**Mechanism:** Supabase Realtime subscribed to `orders` table inserts filtered by `vendor_id = current vendor`. Triggers a notification badge and updates the request feed.

### 3. Order status updates → student

When a vendor confirms or marks an order ready, the student's order page should reflect this.

**Mechanism:** Supabase Realtime on `orders` table updates filtered by `student_id`.

### Fallback

All real-time features degrade gracefully to a manual refresh. If the WebSocket connection drops, a visible "Refresh to see latest stock" banner is shown on recipe pages.

---

## 12. Open Questions & Decisions Before Building

These must be resolved by the product owner before implementation begins. Each item blocks one or more features.

---

**Q1 — Payment model**
Is OneTapChef purely a request/discovery platform (students negotiate and pay the vendor directly, in-person or via external transfer), or does the platform handle payment (Stripe)?

> *Impact:* If in-app payment, the entire order flow needs a payment step, escrow logic, refund handling, and Stripe integration. This materially increases MVP scope. Recommendation: **request-only for MVP, payment in v1.x.**

---

**Q2 — Partial fulfilment UX**
If a vendor can only supply 80g of the 100g of pasta a student needs, what happens? Options:
- (a) Vendor confirms partial amount and the student decides whether to proceed.
- (b) The shortfall is automatically matched to another vendor if one has stock.
- (c) The order is flagged as partially fulfilled and the student must re-request the remainder.

> *Impact:* Option (b) requires multi-vendor fallback matching logic in checkout, significantly increasing complexity. Recommendation: **Option (a) for MVP.**

---

**Q3 — Multi-vendor basket**
If a student's basket requires ingredients from Vendor A and Vendor B, two separate orders are created. Are students expected to collect from both vendors? Is there a maximum number of vendors per basket?

> *Impact:* UX design of the basket page and checkout flow. Must be clear to students before they submit.

---

**Q4 — Vendor geolocation / service area**
How are students matched to vendors? Options:
- (a) Platform is citywide — all vendors visible to all students.
- (b) Students set a campus or postcode and see vendors within X km.
- (c) Vendor selects which universities they serve.

> *Impact:* Option (a) is simplest for MVP. Options (b) and (c) require geolocation data and filtering logic.

---

**Q5 — Recipe database seeding**
On launch day, will the recipe database be pre-seeded by the team, or does it start empty and rely entirely on student submissions?

> *Impact:* If pre-seeded, a data import pipeline and content sourcing process are needed before launch. If empty, the cold-start problem means students see no recipes on day one. Recommendation: **pre-seed with ~50–100 curated recipes covering common ingredient categories likely to appear in vendor stock.**

---

**Q6 — Ingredient catalog management**
Who can add new ingredients to the master catalog? Options:
- (a) Admins only (tight control, but vendors/recipe authors are blocked if their ingredient doesn't exist yet).
- (b) Vendors can suggest new ingredients, admin approves.
- (c) Anyone can add ingredients (fast, but risks duplicates and inconsistency).

> *Impact:* The matching logic only works if recipe authors and vendors use the *same* ingredient IDs. Freeform ingredient names break matching. Option (b) is the recommended balance.

---

**Q7 — Unit of measure normalisation**
A vendor may list flour in "kg" while a recipe calls for flour in "g" or "cups". Must units be normalised to a canonical unit per ingredient, or is it the vendor's responsibility to match the recipe's unit?

> *Impact:* Unit conversion is straightforward for metric (g ↔ kg ↔ mg), but cups/tablespoons/teaspoons require density data per ingredient. Recommendation: **enforce metric (g, ml, unit) as the only accepted units for MVP, document this for vendors clearly.**

---

**Q8 — Vendor verification**
What is the vendor verification process? Options:
- (a) Admin manually reviews and approves each vendor (secure, slow).
- (b) Vendors upload a business registration document; admin reviews asynchronously.
- (c) Any user can self-declare as a vendor (no verification — risk of abuse).

> *Impact:* Affects vendor onboarding UX and admin workload. Recommendation: **Option (b) for MVP.**

---

**Q9 — Student identity verification**
Should students be required to use a university email address (`.edu` or institutional domain) to register as a student?

> *Impact:* Increases trust and limits access to the intended audience but adds friction to signup and requires a list of approved university email domains. Recommendation: **optional university email verification for a "verified student" badge, not required for basic access.**

---

**Q10 — Expiry threshold for "near-expiring"**
At what expiry window does an ingredient qualify for listing on OneTapChef? Is there a maximum (e.g. must expire within 7 days)? Or can vendors list anything?

> *Impact:* Defines the core value proposition and vendor behaviour. Recommendation: **no enforced maximum expiry window for MVP — let vendors self-police. Post-MVP: enforce a maximum of 7 days to expiry to maintain the "near-expiring" brand promise.**

---

*Document version: 1.0 — Created before any code is written.*
*Next step: resolve Open Questions, then proceed to database schema migration files and project scaffolding.*
