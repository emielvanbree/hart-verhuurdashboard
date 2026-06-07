# Verhuurdashboard — Project Plan
**App:** verhuurdashboard | **Stack:** Node.js + Express + React (Vite) + SQLite | **Port:** 3000

## Feature List

1. **Authentication** — Login/logout, session management, bcrypt passwords, login lockout (5 failures → 15min), 8hr session timeout, 30min idle timeout, forced password reset on first login
2. **Article Management (Admin)** — Add/edit/deactivate individual physical items (name, description, price, deposit, dimensions, status). Status: AVAILABLE / RESERVED / CHECKED_OUT / INACTIVE
3. **Availability Check** — Filter articles available in window: due_date -4w through +3w. Basis: article status = AVAILABLE
4. **Reservation Flow** — Enter client (name, email, due_date), select available articles, confirm → articles → RESERVED, agreement PDF emailed
5. **Walk-in Rental** — Direct pickup without prior reservation: select client/articles → process pickup in one flow
6. **Pickup Processing** — Record payment method (pin/cash), generate invoice PDF, articles → CHECKED_OUT, calculate expected return date
7. **Agreement PDF** — Generated on reservation: client details, articles, period, deposit conditions. Emailed as attachment
8. **Invoice PDF** — Generated on pickup: articles, price, deposit, date, client details
9. **Return Processing** — Checklist (complete set Y/N, clean Y/N, disposables unopened Y/N), automatic deposit settlement calculation
10. **Deposit Settlement Docs** — Extra invoice (€30/€60) and/or credit note (€75) based on checklist
11. **Free-text Extra Invoice** — Pre-filled standard texts, editable amounts
12. **Overdue Dashboard** — List of CHECKED_OUT articles past expected return date, visible on dashboard and login
13. **Reservation Cancellation** — Cancel before pickup → articles → AVAILABLE, dossier → CANCELLED
14. **Rental Dossier** — Full detail view: client info, articles, all documents, audit trail (reservation → agreement → pickup → return → settlement)
15. **Search & Filter** — Filter rentals by client name, status, due date
16. **User Management (Admin)** — Create/edit/deactivate users, assign roles (ASSISTANT/ADMIN)
17. **Settings (Admin)** — Practice name, email address for outbound mail, SMTP config
18. **Audit Log** — All user actions logged; accessible to Admin

## File Structure
```
verhuurdashboard/
├── server/
│   ├── index.js              # Express app, middleware, serve React build
│   ├── db.js                 # SQLite setup, schema, seed data
│   ├── auth.js               # Auth middleware, session validation
│   ├── routes/
│   │   ├── auth.js           # POST /api/auth/login, /logout, GET /me
│   │   ├── articles.js       # CRUD + availability endpoint
│   │   ├── clients.js        # Client CRUD
│   │   ├── reservations.js   # Reservation lifecycle
│   │   ├── rentals.js        # Rental transactions (pickup, walk-in)
│   │   ├── returns.js        # Return processing + settlement
│   │   ├── documents.js      # PDF download
│   │   ├── users.js          # User management (admin)
│   │   ├── settings.js       # Settings (admin)
│   │   └── dashboard.js      # Dashboard stats
│   └── services/
│       ├── pdf.js            # PDF generation (html-pdf-node / puppeteer)
│       └── email.js          # Nodemailer (file transport local)
├── client/
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx           # Router, auth context
│       ├── api.js            # Fetch wrapper
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Dashboard.jsx
│       │   ├── Reservations.jsx
│       │   ├── ReservationNew.jsx
│       │   ├── ReservationDetail.jsx
│       │   ├── WalkIn.jsx
│       │   ├── ReturnProcess.jsx
│       │   ├── Articles.jsx
│       │   ├── Users.jsx
│       │   └── Settings.jsx
│       └── components/
│           ├── Layout.jsx    # Sidebar + mobile header
│           ├── Modal.jsx
│           ├── StatusBadge.jsx
│           └── TrafficLight.jsx
├── pdfs/                     # Local PDF storage
├── uat/
│   ├── tests/
│   │   ├── auth.spec.js
│   │   ├── articles.spec.js
│   │   ├── reservation.spec.js
│   │   ├── walkin.spec.js
│   │   └── return.spec.js
│   └── test-results.json
├── package.json
├── playwright.config.js
├── .gitignore
├── start.bat
└── start.ps1
```

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/auth/login | Login with email+password |
| POST | /api/auth/logout | Destroy session |
| GET | /api/auth/me | Get current user |
| GET | /api/articles | List articles (with availability filter) |
| POST | /api/articles | Create article (admin) |
| PUT | /api/articles/:id | Update article (admin) |
| DELETE | /api/articles/:id | Deactivate article (admin) |
| GET | /api/articles/available | Articles available for date window |
| GET | /api/clients | List clients |
| POST | /api/clients | Create client |
| GET | /api/clients/:id | Get client + rentals |
| GET | /api/reservations | List reservations |
| POST | /api/reservations | Create reservation |
| GET | /api/reservations/:id | Get dossier detail |
| PATCH | /api/reservations/:id/cancel | Cancel reservation |
| POST | /api/rentals | Create rental (pickup or walk-in) |
| GET | /api/rentals | List rentals |
| GET | /api/rentals/:id | Get rental detail |
| POST | /api/rentals/:id/return | Process return + settlement |
| POST | /api/rentals/:id/extra-invoice | Generate free-text invoice |
| GET | /api/documents/:id/download | Download PDF |
| GET | /api/dashboard | Stats + overdue items |
| GET | /api/users | List users (admin) |
| POST | /api/users | Create user (admin) |
| PUT | /api/users/:id | Update user (admin) |
| GET | /api/settings | Get settings (admin) |
| PUT | /api/settings | Update settings (admin) |

## Data Models (SQLite)
- **users**: id, name, email, password_hash, role, must_reset_password, last_login_at, failed_login_attempts, locked_until
- **articles**: id, name, description, price, deposit_amount, dimensions, photo_url, status, created_at, updated_at
- **clients**: id, name, email, due_date, created_at
- **reservations**: id, client_id, created_by, status, created_at, cancelled_at
- **reservation_items**: id, reservation_id, article_id
- **rental_transactions**: id, reservation_id (nullable), client_id, pickup_date, expected_return_date, birth_date, return_date, status, is_complete_set, is_clean, disposables_unopened, payment_method, processed_by
- **rental_items**: id, rental_transaction_id, article_id
- **documents**: id, rental_transaction_id, reservation_id, type, file_path, created_at
- **audit_log**: id, user_id, action, entity_type, entity_id, details, timestamp
- **settings**: key, value, updated_at

## Deposit Settlement Rules
| Condition | Action |
|-----------|--------|
| On time + clean | No action |
| Late (>3 working days after birth/pickup) | Extra invoice €30 |
| Dirty | Extra invoice €30 |
| Late + dirty | Extra invoice €60 |
| Disposables unopened | Credit note €75 |
| Late + disposables unopened | Extra invoice €30 + credit note €75 |
| Dirty + disposables unopened | Extra invoice €30 + credit note €75 |

## Acceptance Criteria (Playwright)
1. AC-001: Unauthenticated user is redirected to login page
2. AC-002: Login with valid credentials creates session, redirects to dashboard
3. AC-003: Login with invalid credentials shows error, does not log in
4. AC-004: After 5 failed logins, account is locked for 15 minutes
5. AC-005: Admin can create a new article with all fields
6. AC-006: Article availability filter returns only AVAILABLE articles in date window
7. AC-007: Double-booking is prevented — RESERVED article does not appear in availability
8. AC-008: Reservation created with valid client + articles → articles become RESERVED
9. AC-009: Reservation cancellation sets articles back to AVAILABLE
10. AC-010: Walk-in rental processes pickup without prior reservation
11. AC-011: Pickup processing changes article status to CHECKED_OUT, generates invoice PDF
12. AC-012: Return checklist submitted → deposit settlement calculated correctly
13. AC-013: Credit note generated when disposables returned unopened
14. AC-014: Overdue items appear on dashboard when past expected return date
15. AC-015: Dossier shows all documents for a rental

---
**Decisions made:**
- Article model: individual physical items (each has own status)
- Signature: not implemented — agreement PDF emailed directly as attachment
- OQ-007: unsigned agreement = warning only, does not block pickup
- OQ-009: walk-in rental IS included
- Local storage: SQLite + local file system for PDFs
- Email: Nodemailer with file transport (emails saved to /tmp/emails/) in dev
- Expected return fallback: pickup_date + 14 calendar days (if no birth date)
