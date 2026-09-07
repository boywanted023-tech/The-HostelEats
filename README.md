# HostelEats

Secure food delivery platform for hostel students.

## Structure

```
HostelEats/
├── backend/         # Node.js + Express + MongoDB API (port 5000)
├── website-buyer/   # Customer ordering site (port 3000)
└── website-vendor/  # Vendor management portal (port 3001)
```

## Setup

### Prerequisites
- Node.js 16+
- MongoDB (local or Atlas)
- Redis (optional but recommended)

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your values
npm run dev
```

Runs on `http://localhost:5000`

### 2. Buyer website

```bash
cd website-buyer
npm install
npm run dev
```

Runs on `http://localhost:3000`

### 3. Vendor website

```bash
cd website-vendor
npm install
npm run dev
```

Runs on `http://localhost:3001`

## Default Credentials (after first backend run)

| Role     | Email                            | Password           |
|----------|----------------------------------|--------------------|
| Admin    | admin@hosteleats.com             | SuperSecure@2024!  |
| Vendor   | spicejunction@hosteleats.com     | Vendor@123         |
| Delivery | delivery1@hosteleats.com         | Delivery@123       |
| Customer | customer1@hosteleats.com         | Customer@123       |

The backend auto-seeds the database on first start. Set `SEED_DB=false` to disable.

## Features

### Buyer
- Browse vendors with search & category filter
- View menus with veg/non-veg indicators
- Add to cart, manage quantities
- Place orders with real-time tracking
- Rate delivered orders
- Profile & password management

### Vendor
- Dashboard with real-time stats
- Order management with status transitions
- Menu CRUD (add, edit, delete, toggle availability)
- Earnings view with chart
- Shop profile & hours management
- Sound alerts for new orders
- Real-time updates via Socket.IO

### Backend
- JWT auth with refresh token rotation (HTTP-only cookies)
- bcrypt password hashing (12 rounds)
- 2FA support (TOTP)
- Account lockout after 5 failed logins
- Rate limiting (global, login, order, API)
- Helmet security headers
- Strict CORS whitelist
- XSS + HPP protection
- Device fingerprinting + IP tracking
- Trust score system
- Field-level encryption (optional)
- Audit logging for all sensitive actions
- IP blacklist
- Socket.IO with JWT auth
- MongoDB connection pooling & retry logic

## Production Notes

1. Replace all secrets in `.env`
2. Enable HTTPS
3. Use MongoDB Atlas with field-level encryption
4. Set up SMTP for security alerts
5. Enable Redis for rate-limiting and blacklist
6. Use a reverse proxy (nginx) with HTTPS termination
7. Set `NODE_ENV=production`