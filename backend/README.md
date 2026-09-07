# HostelEats Backend

Secure API for HostelEats - food delivery for hostel students.

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your MongoDB, Redis, secrets
npm run dev
```

Server runs on `http://localhost:5000`.

## Requirements

- Node.js 16+
- MongoDB (local or Atlas)
- Redis (local or hosted)

## Default Credentials (after seeding)

| Role     | Email                          | Password           |
|----------|--------------------------------|--------------------|
| Admin    | admin@hosteleats.com           | SuperSecure@2024!  |
| Vendor   | spicejunction@hosteleats.com   | Vendor@123         |
| Delivery | delivery1@hosteleats.com       | Delivery@123       |
| Customer | customer1@hosteleats.com       | Customer@123       |

Disable seeding by setting `SEED_DB=false` in `.env`.

## API Routes

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Logout
- `GET  /api/auth/me` - Current user
- `POST /api/auth/2fa/setup` - Generate 2FA secret
- `POST /api/auth/2fa/enable` - Enable 2FA

- `GET  /api/customer/vendors` - List vendors
- `GET  /api/customer/vendors/:id` - Vendor + menu
- `POST /api/customer/orders` - Place order
- `GET  /api/customer/orders` - Order history
- `POST /api/customer/orders/:id/cancel`
- `POST /api/customer/orders/:id/rate`

- `GET  /api/vendor/profile` - Shop profile
- `GET  /api/vendor/menu` - List menu items
- `POST /api/vendor/menu` - Add item
- `PUT  /api/vendor/menu/:id` - Update item
- `DELETE /api/vendor/menu/:id` - Delete item
- `GET  /api/vendor/orders` - Vendor orders
- `PUT  /api/vendor/orders/:id/status` - Update status
- `GET  /api/vendor/dashboard` - Stats
- `GET  /api/vendor/earnings` - Earnings

- `GET  /api/delivery/orders/available` - New orders
- `POST /api/delivery/orders/:id/accept` - Accept
- `POST /api/delivery/orders/:id/pick` - Picked up
- `POST /api/delivery/orders/:id/deliver` - Delivered
- `GET  /api/delivery/orders/active`

- `GET  /api/admin/stats` - System stats
- `GET  /api/admin/users`
- `GET  /api/admin/vendors`
- `GET  /api/admin/orders`
- `GET  /api/admin/audit-logs`
- `POST /api/admin/blacklist/ip`

## Security Features

- JWT with refresh token rotation (HTTP-only cookies)
- bcrypt hashing (12 rounds)
- Helmet security headers
- CORS whitelist
- Rate limiting (global, login, order, API)
- Account lockout (5 failed attempts / 30 min)
- 2FA via TOTP
- Device fingerprinting + IP tracking
- Trust score system
- Audit logging for all sensitive actions
- IP blacklist support
- Request signing
- XSS + HPP protection
- Field-level encryption (optional)
- Socket.IO auth via JWT

## Socket.IO Events

- `newOrder` (vendor) - new order received
- `orderConfirmed` (customer) - vendor accepted
- `orderPreparing` (customer)
- `orderReady` (customer, delivery)
- `orderPicked` (customer)
- `orderDelivered` (customer, vendor)
- `orderCancelled` (customer, vendor, delivery)
- `deliveryAssigned` (customer, vendor)
- `delivery:location` (customer) - live location