# App360 Mini — Network Operations Center

> A fullstack AIOps application demonstrating RBAC, Alarm Correlation, Interactive Map, and Multi-Source API Integration following a strict 3-layer architecture.

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Presentation Layer (Next.js 14 – App Router)               │
│  Port 3000 · Consumes backend via REST API only             │
├─────────────────────────────────────────────────────────────┤
│  Business Logic Layer (Express.js)                          │
│  Port 4000 · Controller → Service → Repository             │
│  RBAC enforcement · Correlation engine · Normalization      │
├─────────────────────────────────────────────────────────────┤
│  Data Layer (PostgreSQL + Prisma ORM)                       │
│  users · permissions · raw_alarms · correlated_events       │
│  sites · api_sources                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL (running locally)

### Step 1 — Create Database

Open PostgreSQL and run:
```sql
CREATE DATABASE app360;
```

### Step 2 — Backend Setup

```bash
cd backend
npm install
npx prisma migrate dev --name init
node prisma/seed.js
npm run dev
```

Backend runs on: **http://localhost:4000**

### Step 3 — Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on: **http://localhost:3000**

---

## 🔑 Login Credentials

| Role     | Email                    | Password   | Access                          |
|----------|--------------------------|------------|---------------------------------|
| ADMIN    | admin@app360.com         | admin123   | Full access to all modules      |
| ENGINEER | engineer@app360.com      | eng123     | Alarms, Map, Sources (no Users) |
| VIEWER   | viewer@app360.com        | view123    | Dashboard + Map (read-only)     |

---

## 📡 Ingestion Pipeline (Automatic)

Every **10 seconds**, the backend runs:

```
Mock Generate → Normalize → Save → Correlate → Update Site Status
```

1. **Mock Generate** — Pulls 4–10 alarms from sourceA & sourceB (different formats)
2. **Normalize** — Maps both schemas → unified `raw_alarms` schema
3. **Save** — Persists to PostgreSQL
4. **Correlate** — Applies 3-rule correlation engine
5. **Update Sites** — Recalculates site status from open events

Console will show:
```
[INGEST] Pulled 4 alarms from sourceA, 3 from sourceB
[CORRELATE] Rule 1 CREATE → <siteId>:<deviceId>
[INGEST] Correlation complete
```

---

## 🧠 Correlation Rules

| Rule | Condition | Group Key |
|------|-----------|-----------|
| Rule 1 | Same site + same device within 5 minutes | `siteId:deviceId` |
| Rule 2 | Same site, 2+ CRITICAL/MAJOR devices within 10 minutes | `siteId:MULTI` |
| Rule 3 | No match → standalone event | `siteId:deviceId:STANDALONE` |

---

## 🔐 RBAC

Permissions are stored in the `permissions` table (not hardcoded). Each row:
- `role` (ADMIN / ENGINEER / VIEWER)
- `module` (ALARM / MAP / API / USER)
- `canRead`, `canWrite`, `canDelete`

Backend enforces: `authMiddleware → rbacMiddleware(module, action) → controller`

Frontend reflects via `<RoleGuard roles={[...]}>` and role-filtered nav.

---

## 🗺 Map — India Region Sites

| Site | Region | Status |
|------|--------|--------|
| Mumbai NOC | West | CRITICAL |
| Delhi Hub | North | WARNING |
| Bangalore Core | South | OK |
| Chennai Edge | South | OK |
| Kolkata Ring | East | WARNING |
| Hyderabad DC | South | CRITICAL |
| Pune Relay | West | OK |

---

## 📁 Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma          # DB schema
│   └── seed.js                # Seed data
└── src/
    ├── controllers/           # HTTP req/res handlers
    ├── services/              # Business logic
    │   ├── correlationService.js   # AIOps 3-rule engine
    │   ├── normalizationService.js # Schema mapping
    │   └── apiIngestionService.js  # Pipeline orchestrator
    ├── repositories/          # Prisma DB queries
    ├── middleware/
    │   ├── authMiddleware.js  # JWT verification
    │   └── rbacMiddleware.js  # Dynamic permission check
    ├── mock/
    │   └── mockAlarmGenerator.js   # 2 source formats
    └── app.js                 # Entry + 10s polling loop

frontend/
├── app/                       # Next.js App Router pages
│   ├── login/                 # Auth page
│   ├── dashboard/             # Stats + live events
│   ├── alarms/                # Correlated events list + [id] drill-down
│   ├── map/                   # Leaflet interactive map
│   ├── users/                 # ADMIN: user CRUD + permissions matrix
│   └── sources/               # API source management
├── components/                # Reusable UI components
├── context/AuthContext.js     # Global auth state
└── lib/
    ├── api.js                 # Axios + JWT interceptor
    └── auth.js                # localStorage helpers
```

---

## 🌐 API Endpoints

| Method | Endpoint | Auth | Permission |
|--------|----------|------|------------|
| POST | /api/auth/login | ❌ | - |
| GET | /api/alarms/stats | ✅ | ALARM.canRead |
| GET | /api/alarms/raw | ✅ | ALARM.canRead |
| GET | /api/alarms/correlated | ✅ | ALARM.canRead |
| POST | /api/alarms/ingest | ✅ | ALARM.canWrite |
| GET | /api/map/sites | ✅ | MAP.canRead |
| GET | /api/users | ✅ | USER.canRead |
| POST | /api/users | ✅ | USER.canWrite |
| PUT | /api/users/permissions/:role/:module | ✅ | USER.canWrite |
| GET | /api/sources | ✅ | API.canRead |
| POST | /api/sources/:id/poll | ✅ | API.canRead |
