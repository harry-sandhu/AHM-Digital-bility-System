# AHM Bilty System

A freight consignment-note ("bilty") management system. It lets authenticated users generate numbered bilties (consignment notes) against allocated numbering ranges, pay a tiered access fee based on freight value, and lets admins/superadmins manage users, numbering ranges, and all bilty records.

## What This App Does

Based on the models, controllers, and routes in this repository:

- **Bilty generation** — users generate a bilty, which is assigned a unique `biltyNumber`/consignment number drawn from an allocated numbering range (`NumberRange` model, `numberRange` util with `allocateConsignmentNumber`).
- **Numbering ranges** — superadmins create and manage numeric ranges (`master` or `personal` scope) that bilty numbers are drawn from, including handling exhausted ranges.
- **Tiered access pricing** — generating a bilty requires "access" that is priced by freight amount tiers (`biltyPricing.ts`): ₹200 up to ₹10,000 freight, ₹300 up to ₹30,000, ₹400 up to ₹50,000, ₹500 above that. Access is tracked per user with paid/expiry timestamps (`biltyAccessPaidAt`, `biltyAccessExpiresAt`), with daily expiry computed against Indian Standard Time midnight.
- **Bilty lifecycle** — bilties can be created as drafts, updated, fetched individually or listed ("my bilties" for a user, "all bilties" for superadmins), and deleted (superadmin-only).
- **User management** — role-based accounts (`superadmin`, `admin`, `user`), with superadmins able to create admin accounts, list users, and disable users.
- **Auth** — JWT-based authentication (`jsonwebtoken` + `bcryptjs` for password hashing), with `authMiddleware` protecting routes and an `authorize(...)` middleware enforcing role checks.

## Tech Stack

**Backend** (`backend/`)
- Node.js + Express 5 (TypeScript)
- MongoDB with Mongoose
- JWT authentication, bcrypt password hashing
- `express-validator` for request validation
- A seeder script (`seedSuperAdmin`) that provisions an initial superadmin user on startup

**Frontend** (`frontend/`)
- React 18 + Vite (TypeScript)
- React Router v7
- Tailwind CSS
- Axios for API calls

## Project Structure

```
AHM Bilty System/
├── backend/
│   └── src/
│       ├── server.ts          # Entry point, DB connection, superadmin seeding, server start
│       ├── controllers/       # authController, biltyController, numberRangeController, userController
│       ├── middleware/        # auth (JWT verification), authorize (role check), errorMiddleware
│       ├── models/            # User, Bilty, BiltyCounter, NumberRange
│       ├── routes/            # /api/auth, /api/bilty, /api/users, /api/number-ranges
│       ├── seeder/            # seedSuperAdmin
│       ├── scripts/           # standalone maintenance scripts
│       └── utils/             # biltyPricing, numberRange, phoneUtils, tokenUtils
└── frontend/
    └── src/
        ├── Pages/              # HomePage, LoginPage, SignupPage, BiltyPage, BiltyEditPage,
        │                        BiltyPaymentPage, BiltyTermsPage, UsersPage, CreateAdminPage,
        │                        SuperadminDashboardPage
        ├── components/
        ├── context/            # likely auth/session context
        └── api/                # API client code
```

## Running Locally

### Backend

```bash
cd backend
npm install
# create a .env with MONGO_URI, PORT, JWT secret, etc.
npm run dev      # nodemon + ts-node
# or
npm run build && npm start
```

On startup, the backend connects to MongoDB and runs `seedSuperAdmin()` to ensure an initial superadmin account exists before the server starts listening.

### Frontend

```bash
cd frontend
npm install
npm run dev      # Vite dev server
```

See `frontend/.env.example` for the environment variables the frontend expects (e.g. API base URL).

## Auth Notes

- Tokens are issued on login/register and must be sent as `Authorization: Bearer <token>`.
- `authMiddleware` verifies the token and attaches the authenticated user to the request.
- `authorize("superadmin", ...)` restricts specific routes (user management, number ranges, deleting/listing all bilties) to the given role(s).

## Notes

- No automated test suite is currently present in this repository.
- This README describes only what is verifiable from the current code — no client, company, or business-relationship details beyond what already exists in the repository are included here.
