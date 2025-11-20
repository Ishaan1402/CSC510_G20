# RouteDash API Reference

This document describes the primary REST endpoints exposed by the RouteDash backend (`proj2/server`). All routes are prefixed with `https://api.routedash.dev` in production and `http://localhost:4000` during development.

Authentication uses an HTTP-only cookie (`routedash_session`) managed through the auth endpoints. For script-based clients you may also send the token in the `Authorization: Bearer <token>` header.

---

## Auth

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/api/auth/register-customer` | Register a new customer account and create a session | Public |
| `POST` | `/api/auth/register-restaurant` | Register a restaurant owner and bootstrap a restaurant profile | Public |
| `POST` | `/api/auth/login` | Login with email/password and receive a session cookie | Public |
| `POST` | `/api/auth/logout` | Clear session cookie | Cookie/Bearer |
| `GET`  | `/api/auth/me` | Get the authenticated user (includes vehicleType if set) | Cookie/Bearer |
| `PATCH` | `/api/auth/profile` | Update user profile (e.g., vehicleType) | Cookie/Bearer |

### Example: `POST /api/auth/login`

```http
POST /api/auth/login HTTP/1.1
Content-Type: application/json

{
  "email": "customer@example.com",
  "password": "password123!"
}
```

```json
{
  "user": {
    "id": "9d9f0b58-...",
    "name": "Sanjana Chandrashekar",
    "email": "customer@example.com",
    "role": "CUSTOMER",
    "vehicleType": "GAS",
    "restaurantId": null
  }
}
```

---

## Restaurants

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/restaurants` | List active restaurants | Public |
| `GET` | `/api/restaurants/:restaurantId/menu` | Fetch menu sections & items | Public |
| `GET` | `/api/restaurants/:restaurantId/orders` | List orders for a restaurant | Restaurant only |
| `POST` | `/api/restaurants/:restaurantId/menu/sections` | Create new menu section | Restaurant only |
| `PATCH` | `/api/restaurants/:restaurantId/menu/sections/:sectionId` | Update menu section | Restaurant only |
| `DELETE` | `/api/restaurants/:restaurantId/menu/sections/:sectionId` | Delete menu section | Restaurant only |
| `POST` | `/api/restaurants/:restaurantId/menu/items` | Create new menu item | Restaurant only |
| `PATCH` | `/api/restaurants/:restaurantId/menu/items/:itemId` | Update menu item | Restaurant only |
| `DELETE` | `/api/restaurants/:restaurantId/menu/items/:itemId` | Delete menu item | Restaurant only |
| `PATCH` | `/api/restaurants/:restaurantId/orders/:orderId` | Update order status | Restaurant only |

### Example: `PATCH /api/auth/profile`

```http
PATCH /api/auth/profile HTTP/1.1
Content-Type: application/json
Cookie: routedash_session=...

{
  "vehicleType": "GAS"
}
```

```json
{
  "user": {
    "id": "9d9f0b58-...",
    "name": "Sanjana Chandrashekar",
    "email": "customer@example.com",
    "role": "CUSTOMER",
    "vehicleType": "GAS",
    "restaurantId": null
  }
}
```

Valid `vehicleType` values: `"GAS"`, `"EV"`, or `null`.

### Restaurant ownership

Merchant routes require:

1. Authenticated user with `role === "RESTAURANT"`.
2. Authenticated restaurant ID matching the `:restaurantId` parameter (enforced by middleware).

---

## Orders

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/api/orders` | Create a new order for the current customer | Customer only |
| `GET` | `/api/orders` | List orders for the current customer | Customer only |
| `GET` | `/api/orders/:orderId` | Fetch a specific order (including items, restaurant info) | Customer only |

### Order payload

```json
{
  "restaurantId": "uuid",
  "items": [
    {
      "menuItemId": "uuid",
      "quantity": 2
    }
  ],
  "pickupEtaMin": 20,
  "routeOrigin": "NCSU Centennial Campus",
  "routeDestination": "Downtown Raleigh"
}
```

Validation:

- `items` must contain at least one entry.
- Each `menuItemId` must belong to the same restaurant and be marked available.
- `pickupEtaMin`/`quantity` must be positive integers.

---

## Error handling

Errors adopt the following shape:

```json
{
  "error": "Message"
}
```

HTTP status codes:

- `400` — validation errors, invalid status transitions.
- `401` — missing/invalid authentication.
- `403` — insufficient privileges (role mismatch or not the restaurant owner).
- `404` — resource not found (restaurant, section, item, order).
- `409` — duplicate email on registration.
- `500` — unexpected server error.

---

## WebSocket roadmap

Real-time order updates are planned via Socket.IO. Once implemented, a web socket channel will broadcast order state changes, reducing polling by the mobile client. See the [roadmap](sustainability-evaluation.md#future-plans) for milestones.

---

For schema migrations and sample data, refer to `proj2/server/prisma/`. The `prisma/seed.ts` script seeds two demo restaurants and a customer account (credentials in `proj2/server/README.md`).
