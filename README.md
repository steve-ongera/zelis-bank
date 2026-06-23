# Zelis Bank

A full-stack banking web application built to demonstrate **secure RESTful API design** with **JWT authentication**, admin-verified onboarding, real-time recipient lookup for transfers, and a clean analytics dashboard.

**Backend:** Django + Django REST Framework (single core app architecture)
**Frontend:** React (Vite) — clean white & brown theme, fully responsive
**Auth:** JWT (access + refresh tokens) via `djangorestframework-simplejwt`
**Currency:** KES (Kenyan Shilling) only
**Account numbers:** Auto-generated on registration

---

## Why Zelis Bank exists (the teaching goals)

This project is a reference implementation for:

1. **RESTful API design** — resource-based URLs, proper HTTP verbs, consistent response shapes, pagination, permission classes per view.
2. **JWT auth done properly** — short-lived access tokens, refresh token rotation, blacklisting on logout, custom claims (so the frontend doesn't need a separate `/me` call just to know who's logged in).
3. **Admin-gated onboarding** — a real banking constraint: you can't just sign up and start moving money. An admin must verify your identity first.
4. **Real-time-feeling UX without overengineering** — the "who will receive this money" preview on Send Money is done via a debounced lookup endpoint, not WebSockets. It's the same pattern M-Pesa, bank apps, and most fintech UIs use before you confirm a transfer.
5. **Financial integrity** — every balance change happens inside a DB transaction with `select_for_update()` row locking, and is backed by an immutable `Transaction` ledger row. Balances are never just incremented from the frontend; they're derived from server-side logic only.

---

## Project Structure

```
zelis-bank/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── zelis_bank/              # project config
│   │   ├── settings.py
│   │   ├── urls.py               # main url
│   │   ├── asgi.py / wsgi.py
│   └── core/                     # single core app
│       ├── models.py
│       ├── serializers.py
│       ├── views.py
│       ├── permissions.py
│       ├── urls.py                # app url
│       ├── admin.py
│       └── utils.py
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api/
        │   └── axios.js
        ├── context/
        │   └── AuthContext.jsx
        ├── components/
        │   ├── Navbar.jsx
        │   ├── Sidebar.jsx
        │   ├── LoadingSpinner.jsx
        │   └── ProtectedRoute.jsx
        ├── pages/
        │   ├── Login.jsx
        │   ├── Register.jsx
        │   ├── Dashboard.jsx
        │   ├── SendMoney.jsx
        │   ├── Deposit.jsx
        │   ├── Transactions.jsx
        │   ├── Profile.jsx
        │   └── Settings.jsx
        └── styles/
            └── theme.css
```

---

## Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser  # this admin verifies new accounts
python manage.py runserver
```

`requirements.txt`:
```
Django>=5.0,<6.0
djangorestframework>=3.15
djangorestframework-simplejwt>=5.3
django-cors-headers>=4.3
python-decouple>=3.8
```

### Environment variables (`.env` in `backend/`)

```
SECRET_KEY=replace-with-a-long-random-string
DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

---

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend expects the API at `http://127.0.0.1:8000/api/` — configurable in `src/api/axios.js`.

---

## Core Concepts Explained

### 1. The data model relationship

```
User (Django auth) ──1:1── Account (KES balance, account_number, status)
Account ──1:M (as sender)── Transaction
Account ──1:M (as receiver)── Transaction
```

A `User` cannot transact until their linked `Account.status == 'active'`, which only an admin (or staff via the verify endpoint) can set.

### 2. Registration → Verification → Login flow

```
POST /api/auth/register/
   → creates User (is_active=True, so they CAN authenticate)
   → creates Account (status='pending', account_number auto-generated)
   → user receives "pending verification" message, NOT tokens

[Admin reviews in Django Admin or via /api/admin/accounts/pending/]
   → admin verifies KYC details (ID number, names, phone match)
   → PATCH /api/admin/accounts/<id>/verify/  → status='active'

POST /api/auth/login/
   → if Account.status != 'active' → 403 "Account pending verification"
   → if active → returns access + refresh JWT tokens
```

This is intentional: tokens are only issued to verified accounts, so the frontend never needs to special-case "verified but can't transact" states post-login — if you have a token, you're cleared.

### 3. JWT lifecycle

| Token   | Lifetime   | Stored where                | Purpose |
|---------|-----------|------------------------------|---------|
| Access  | 15 min    | memory / localStorage        | Sent as `Authorization: Bearer <token>` on every request |
| Refresh | 7 days    | localStorage (httpOnly cookie recommended for production) | Used to silently mint new access tokens via `/api/auth/refresh/` |

On logout, the refresh token is blacklisted server-side (`rest_framework_simplejwt.token_blacklist`) so it can't be replayed even if it leaked.

### 4. The "real-time recipient preview" on Send Money

When the user types a destination account number on the Send Money page:

1. Frontend **debounces** input (600ms) to avoid hammering the API on every keystroke.
2. Calls `GET /api/accounts/lookup/?account_number=2200145821`.
3. Backend returns a **masked** name only if the account exists and is active: `{"exists": true, "account_holder": "J*** M***", "account_number": "2200145821"}`.
4. Frontend shows a green "✓ Sending to J*** M***" confirmation box before the user can submit.
5. On submit, the actual transfer endpoint re-validates everything server-side regardless of what the frontend showed.

This mirrors real banking apps: you see *who* you're paying before you commit, without exposing full PII over an unauthenticated-feeling lookup.

### 5. Money movement integrity

`SendMoney` and `Deposit` views wrap balance changes in:

```python
with transaction.atomic():
    sender_account = Account.objects.select_for_update().get(user=request.user)
    receiver_account = Account.objects.select_for_update().get(account_number=...)
    # validate, then mutate, then create Transaction row
```

This prevents race conditions (e.g., two simultaneous transfers double-spending the same balance) — a core correctness requirement for any system that touches money.

---

## API Endpoint Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register/` | Public | Create user + pending account |
| POST | `/api/auth/login/` | Public | Returns JWT pair (only if account active) |
| POST | `/api/auth/refresh/` | Public (refresh token) | Rotate access token |
| POST | `/api/auth/logout/` | Authenticated | Blacklist refresh token |
| GET  | `/api/profile/` | Authenticated | Current user + account info |
| PATCH| `/api/profile/` | Authenticated | Update profile fields |
| POST | `/api/profile/change-password/` | Authenticated | Change password |
| GET  | `/api/accounts/lookup/?account_number=` | Authenticated | Masked recipient preview |
| GET  | `/api/dashboard/summary/` | Authenticated | Balance, totals, chart data |
| POST | `/api/transactions/send/` | Authenticated | Send money to another account |
| POST | `/api/transactions/deposit/` | Authenticated | Deposit into own account |
| GET  | `/api/transactions/` | Authenticated | Paginated transaction history |
| GET  | `/api/transactions/<id>/` | Authenticated | Transaction detail |
| GET  | `/api/admin/accounts/pending/` | Admin (staff) | List unverified accounts |
| PATCH| `/api/admin/accounts/<id>/verify/` | Admin (staff) | Approve/reject account |

---

## Security Notes

- Passwords hashed via Django's default PBKDF2 (or swap to Argon2 in production).
- All money-related endpoints require `IsAuthenticated` + active account check.
- Admin endpoints require `IsAdminUser`.
- CORS locked to the Vite dev origin only.
- Refresh tokens are blacklisted on logout (requires `rest_framework_simplejwt.token_blacklist` in `INSTALLED_APPS`).
- Account lookup endpoint returns **masked names only**, never full PII, and never confirms whether a number *doesn't* exist vs. is just inactive (avoids account enumeration).
- Rate limiting recommended in production (e.g. `django-ratelimit` on `/auth/login/`).

---

## Next steps / things intentionally left open

- Email/SMS notifications on transfer (Africa's Talking integration point if you want it later)
- M-Pesa Daraja STK Push for real deposits (currently `Deposit` is a simulated "self top-up" for demo purposes)
- 2FA on login
- Audit log for admin actions