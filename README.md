# Library Management System — AI-Powered Edition

A production-grade library management system for a small school library (~500 members, ~5,000 books, 1–3 staff), with applied ML layered on top of a deterministic core.

**Guiding principle:** the ML service is independently deployable and severable. Cut it, and the library still issues and returns books.

---

## Quick start

### Prerequisites

| Requirement | Version | Check with |
|---|---|---|
| Node.js | `^20.19.0` or `>=22.12.0` | `node -v` |
| npm | 10 or newer | `npm -v` |

If Node is missing or too old, install it from [nodejs.org](https://nodejs.org) or via `nvm install 22 && nvm use 22`.

### 1. Install dependencies

Run once, from the project root:

```bash
npm install
```

### 2. Start MongoDB and the API

Data lives in MongoDB, reached through a small Express service. Start MongoDB
first if it is not already running:

```bash
brew services start mongodb-community   # or: mongod --config /opt/homebrew/etc/mongod.conf
```

Then the API, in its own terminal:

```bash
npm run server
```

```
Connected to MongoDB at mongodb://127.0.0.1:27017/library_management_system
API listening on http://localhost:4000
```

Override the defaults with `MONGODB_URI`, `MONGODB_DB`, or `PORT` if needed.

### 3. Start the development server

In a second terminal:

```bash
npm run dev
```

```
  ➜  Local:   http://localhost:5173/
```

The app redirects to `/login`. Vite forwards `/api` to the Express service, so
the browser talks to a single origin. Edits under `src/` refresh instantly.

**With the API stopped the app still runs**, falling back to browser storage —
useful for a quick look, but the two stores then hold different data.

Stop either server with `Ctrl + C`.

### 4. First run — claim the library

**There is no public sign-up.** Accounts are issued by the library owner. That leaves one bootstrap problem: a brand-new install has no accounts, so nobody could sign in. A one-time setup screen solves it:

1. On the login screen you will see **No accounts exist yet — Set up the owner account**. Click it.
2. Enter the owner's name, email, and a password of at least 8 characters with upper case, lower case, and a number.
3. Submitting creates the owner account and signs you in.

From that moment `/setup` is sealed: visiting the URL redirects to the login screen, and `/signup` does the same. Staff and member accounts are issued by the owner from inside the system — that screen is not built yet, so the owner is currently the only account.

To reset back to an unclaimed library, open your browser devtools console and run:

```js
localStorage.clear()
```

Reload and the setup screen returns.

### Other commands

| Command | What it does |
|---|---|
| `npm run server` | Express + MongoDB API at `http://localhost:4000` |
| `npm run dev` | Development server with hot reload, at `http://localhost:5173` |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serves the built `dist/` locally, to check the production output |

---

## Tech stack

Deliberately narrow — HTML, CSS, JavaScript, React, and Tailwind, nothing else:

| Layer | Choice |
|---|---|
| UI | React 19 (plain JavaScript, no TypeScript) |
| Styling | Tailwind CSS 4, theme tokens defined in [`src/index.css`](src/index.css) |
| Routing | React Router 7 |
| Build tool | Vite 8 |
| Database | MongoDB, via a small Express API in [`server/`](server/) |
| Persistence | The API when it answers; browser storage as a fallback |

**Data lives in MongoDB.** A browser cannot reach MongoDB directly — it speaks the Mongo wire protocol over TCP, not HTTP, and a connection string in client code is one anyone can read — so [`server/index.js`](server/index.js) holds the credentials and exposes a small HTTP API.

Everything in the app reads and writes through [`src/services/storage.js`](src/services/storage.js), which picks its driver on first use: **MongoDB** when the API answers its health check, **browser storage** when it does not. Adding the database therefore changed exactly one file — no page, dialog, or table was touched.

`session` and `preferences` stay in the browser on purpose: a shared session would sign in one machine because another did, and the theme belongs to the screen in front of you.

**The API has no authentication.** Anyone who can reach port 4000 can read and write everything, including password hashes. That is acceptable on localhost and must not be exposed to a network as it stands.

> **The current authentication is a workflow, not a security control.** Every check runs client-side, so anyone with devtools can bypass it. Passwords are still salted and hashed with PBKDF2-SHA256 (210,000 iterations) so a leaked store does not expose passwords people reuse elsewhere. Real enforcement arrives with the backend.

---

## The dashboard

The dashboard is the one module built so far. It carries ten summary cards, four charts, quick actions, and eight side panels, inside a shell with a nested sidebar, global search, notifications, breadcrumbs, and a dark/light toggle.

**Every number on it is computed, not typed.** [`src/data/demoLibrary.js`](src/data/demoLibrary.js) generates a seeded year of library activity — around 7,300 borrowings across 48 titles and 512 members — and [`src/lib/analytics.js`](src/lib/analytics.js) derives each figure from it with pure functions. Replace the generator with the real catalog service and no widget changes. Generation is seeded, so totals stay stable between reloads.

**The charts are hand-written SVG.** No charting library, because the stack is HTML/CSS/JS/React/Tailwind and nothing else. Each one carries a hover tooltip *and* a table view — toggle any chart card between **chart** and **table** — so no value is reachable by hover alone. Series colours come from a colourblind-validated categorical palette, defined once as CSS variables in [`src/index.css`](src/index.css) and stepped separately for light and dark surfaces.

Sidebar destinations other than the dashboard and profile are routed but not built; they resolve to a placeholder that says so rather than an empty table.

## The profile page

Reachable from the sidebar or the topbar profile menu. It edits the signed-in user's own record:

- **Photo** — click the pencil badge on the avatar to pick an image. It is centre-cropped square and resized to 256px before storage, because an unmodified phone photo would consume most of the ~5 MB browser-storage budget on its own. Falls back to initials when there is no photo; **Remove photo** clears it.
- **Fields** — full name, phone (the `+91` is a fixed prefix, so only the 10 digits are typed), email, full postal address, and account number.
- **Cancel and Save stay disabled until something actually differs from the saved record.** An "Unsaved changes" pill appears alongside them, and leaving the tab mid-edit prompts a browser warning. Cancel restores the saved values exactly; Save validates every field, writes once, and confirms.

Because the topbar menu, the dashboard greeting card, and the profile form all read the same user record via `useAuth`, one save updates all of them without a reload — and the same record is what an admin staff register will read when that module is built.

## Project structure

```
src/
├── components/
│   ├── charts/          Hand-written SVG charts: donut, grouped bar,
│   │                    horizontal bar, area, plus shared chart plumbing
│   ├── dashboard/       Stat cards, quick actions, activity and alert panels,
│   │                    popular books, calendar, system health
│   ├── layout/          AppShell, Sidebar, Topbar, Breadcrumbs
│   └── *.jsx            Auth UI — AuthLayout, BrandPanel, TextField,
│                        PasswordField, Button, Alert, Logo
├── context/
│   ├── AuthContext.jsx        Session state (useAuth hook)
│   └── PreferencesContext.jsx Theme and locale, persisted
├── data/
│   └── demoLibrary.js   Seeded demo dataset — replace with the real catalog
├── hooks/
│   └── useDismiss.js    Outside-click and Escape handling for popovers
├── lib/
│   ├── analytics.js     Every dashboard figure, derived from the dataset
│   ├── format.js        Locale-aware number, currency, and date formatting
│   ├── image.js         Avatar crop and downscale before storage
│   └── validation.js    Field validators and password strength scoring
├── pages/
│   ├── LoginPage.jsx        Sign in
│   ├── SetupPage.jsx        One-time owner setup, sealed after first account
│   ├── DashboardPage.jsx    The dashboard
│   ├── ProfilePage.jsx      Editable profile: photo, contact, account number
│   └── PlaceholderPage.jsx  Routed-but-unbuilt modules
├── services/
│   ├── auth.js          Accounts, sessions, PBKDF2 hashing, owner-only issuing
│   └── storage.js       Storage abstraction — swap this for a backend
├── App.jsx              Routes and route guards
├── index.css            Tailwind import, theme tokens, chart palette
└── main.jsx             Entry point
```

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `Port 5173 is in use` | Another Vite server is already running. Use it, or start on another port: `npm run dev -- --port 5174` |
| `vite: command not found` | Dependencies are not installed. Run `npm install` |
| Crash on `npm run dev` mentioning Node version | Node is older than 20.19. Upgrade Node |
| "Secure browser crypto is unavailable" | The app was opened over plain `http://` on a non-local host. Use `http://localhost:5173` or serve over HTTPS |
| Signed in on one browser but not another | Expected. Accounts are stored per browser until a backend exists |
| Accounts vanished | Browser site data was cleared. Also expected, and a known risk of the current architecture |

---

## Status

| Phase | Name | Status |
|---|---|---|
| 1 | Problem Definition | ✅ Complete |
| 2 | System Design | ⬜ Not started |
| 3 | Data Collection | ⬜ Not started |
| 4 | Database Design | ⬜ Not started |
| 5 | AI/ML Design | ⬜ Not started |
| 6 | Data Processing | ⬜ Not started |
| 7 | Model Training | ⬜ Not started |
| 8 | Evaluation | ⬜ Not started |
| 9 | Explainable AI | ⬜ Not started |
| 10 | Backend Development | ⬜ Not started |
| 11 | Frontend Development | 🟡 Auth screens and dashboard built ahead of sequence |
| 12 | Deployment | ⬜ Not started |
| 13 | Monitoring | ⬜ Not started |
| 14 | Security | ⬜ Not started |
| 15 | Scaling | ⬜ Not started |
| 16 | Testing | ⬜ Not started |
| 17 | Maintenance | ⬜ Not started |

The authentication screens and the dashboard were built on request, out of phase order, and the dashboard runs on demo data because Phases 3 and 4 (data collection, database design) have not happened. The Phase 1 document has **not** yet been amended to reflect the frontend-only stack decision — sections §8.2, §11, and risks R2/R3/R11 still describe a Python ML service and free-tier server hosting.

## Documentation

Each phase produces a document in [`docs/`](docs/). These are the specification — read them before reading code.

- [Phase 1 — Problem Definition](docs/phase-01-problem-definition.md)

## MVP Scope Summary

**Core LMS:** auth + RBAC, book/member/category CRUD, issue/return/renew, fines, overdue dashboard, reports, audit log.

**AI in MVP:** semantic search, auto-categorization, barcode/ISBN capture — the three capabilities that need no borrowing history.

**Deferred:** overdue-risk ML model, recommendation ML model, demand forecasting, cover-image CV. These ship as transparent rule-based fallbacks with their input features logged, and upgrade to models once real data crosses defined activation thresholds.

See [the MVP boundary contract](docs/phase-01-problem-definition.md#5-mvp-boundary-contract) for the full in/out-of-scope table.
