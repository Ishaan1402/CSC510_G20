# RouteDash API

Early-stage Express + TypeScript backend that will power authentication, restaurant onboarding, and menu management for RouteDash.

## Requirements

- Node.js 18+
- PostgreSQL database (local or cloud)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment variables:

   ```bash
   cp .env.example .env
   ```

   Update `.env` with a real `DATABASE_URL` and strong `JWT_SECRET`.

3. Generate Prisma client & run migrations:

   ```bash
   npm run prisma:generate
   npm run db:migrate
   ```

4. (Optional) Seed demo data (one customer + two restaurants):

   ```bash
   npm run db:seed
   ```

5. Start the dev server:

   ```bash
   npm run dev
   ```

   The API will be available at `http://localhost:4000`.

## Structure

- `src/` – Express app, routes, and shared utilities.
- `prisma/schema.prisma` – database models.
- `prisma/seed.ts` – demo users, restaurants, menu sections/items.

## Seeded accounts

After running `npm run db:seed`, you get:

| Role       | Email                 | Password      |
|------------|-----------------------|---------------|
| Customer   | customer@example.com  | password123!  |
| Merchant 1 | merchant1@example.com | password123!  |
| Merchant 2 | merchant2@example.com | password123!  |

## User Profile

Users can store a `vehicleType` preference (`"GAS"`, `"EV"`, or `null`) in their profile. This is used by the mobile app to filter gas stations vs EV charging stations along routes. Update via `PATCH /api/auth/profile`.

## Core auth endpoints

| Method | Path                        | Notes                                                   |
|--------|-----------------------------|---------------------------------------------------------|
| POST   | `/api/auth/register-customer`   | `{ name,email,password }` → creates customer + session |
| POST   | `/api/auth/register-restaurant` | `{ owner + restaurant info }` → returns user + restaurant |
| POST   | `/api/auth/login`           | `{ email,password }` → sets HttpOnly JWT cookie         |
| POST   | `/api/auth/logout`          | clears session cookie                                   |
| GET    | `/api/auth/me`              | returns current user (includes vehicleType if set)     |
| PATCH  | `/api/auth/profile`         | `{ vehicleType }` → update user profile preferences     |

The mobile app calls these endpoints via `fetch` with `credentials:"include"`; the logout button in both customer and merchant views simply invokes `POST /api/auth/logout` and clears local storage.

## Next steps

- Implement auth routes (`/api/auth/*`) using JWT cookies.
- Build restaurant menu CRUD endpoints with audit logging.
- Integrate with the React Native app for login + merchant dashboard.
- Add Vitest suites for auth utilities, RBAC, and menu services.
