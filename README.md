# 🚀 ReachInbox Full-stack Email Job Scheduler

This is a production-grade full-stack email scheduler service and dashboard. It allows scheduling campaign outreach lists (with CSV lead parsing) and processes email queue delivery asynchronously with inter-email throttling, per-sender hourly rate caps, Slack alerts on limit hit, and full-text Elasticsearch audits.

---

## 🏗 System Architecture & Design

### 💡 Core Design Principles
1. **PostgreSQL as the Source of Truth**: All user OAuth details, SMTP configurations, campaign runs, and email logs are persisted first in the relational database.
2. **Redis + BullMQ as the Execution Engine**: Job metadata is enqueued to Redis, separating scheduling requests from delivery.
3. **Elasticsearch as a Derived Search Index**: The search database is compiled from transactional database mutations. It is fully rebuildable and searchable on recipients, sender display, subjects, and HTML bodies.

```
                         ┌──────────────────────────┐
                         │        Frontend           │
                         │    React + Vite + TW     │
                         │    Google OAuth Login    │
                         └────────────┬─────────────┘
                                      │ REST APIs
                                      ▼
┌───────────────────────────────────────────────────────────────────┐
│                          Express API Server                        │
│ ┌────────────┐ ┌────────────────┐ ┌───────────────────────────┐   │
│ │ Auth routes│ │ Email routes    │ │ Slack OAuth routes         │   │
│ └────────────┘ └────────────────┘ └───────────────────────────┘   │
│ ┌─────────────────────────────────────────────────────────────┐   │
│ │ Bull Board mounted at /admin/queues (live queue dashboard)   │   │
│ └─────────────────────────────────────────────────────────────┘   │
│ ┌─────────────────────────────────────────────────────────────┐   │
│ │ Boot-time reconciliation job (Postgres-to-Queue sync)        │   │
│ └─────────────────────────────────────────────────────────────┘   │
└───────┬────────────────────────┬────────────────────────┬─────────┘
        ▼                        ▼                        ▼
┌────────────────┐    ┌────────────────────┐   ┌───────────────────┐
│   PostgreSQL   │    │    Redis (BullMQ)  │   │   Elasticsearch   │
│ (Port 5433)    │    │ (Port 6380)        │   │ (Port 9200)       │
└────────────────┘    └──────────┬─────────┘   └───────────────────┘
                                  ▼
                       ┌──────────────────────┐
                       │  BullMQ Worker(s)    │
                       │  concurrency=N       │
                       │  limiter (min delay) │
                       │  hourly-cap check    │
                       └──────────┬───────────┘
                     ┌────────────┼───────────┐
                     ▼                        ▼
           ┌──────────────────┐      ┌──────────────────┐
           │  Ethereal SMTP   │      │  Slack Webhook   │
           │  (smtp mailer)   │      │ (limit reached)  │
           └──────────────────┘      └──────────────────┘
```

---

## ⚙️ Concurrency, Delay, & Rate Limiting

The application runs two independent, stacking controls to ensure distributed delivery:
1. **Worker Concurrency**: Configured through `WORKER_CONCURRENCY` in the `.env` file (controls the count of parallel processing threads within workers).
2. **Min Delay**: Configured through `MIN_SEND_DELAY_MS` in the `.env` file (enforces a minimum delay spacing between consecutive email sends across worker queues to avoid mail provider throttling).
3. **Sender Hourly Cap**:
   * Evaluated per sender using Redis atomic counters: `rate:${senderId}:${YYYYMMDDHH}`.
   * If a sender exceeds their configured limit, the email status is marked as `rate_limited` in the DB.
   * The job is re-enqueued with a delay mapping to the next hour window (`msUntilNextHourWindow()`) to ensure no jobs are permanently lost or dropped.
   * A Slack notification is fired to the user's workspace alerts channel. A Redis lock ensures only one Slack alert is dispatched per sender per hour window.

---

## 🛡 Fault Tolerance & Crash Recovery

The system handles three distinct crash-recovery scenarios:
* **Scenario A (Server Crashes, Redis Intact)**: BullMQ delayed jobs are persisted in Redis. When the server process restarts, workers immediately reconnect and resume.
* **Scenario B (Worker crashes mid-processing)**: Handled via BullMQ locked stalled-job sweeps. Before executing Nodemailer commands, the worker verifies if the database status is already `sent` to guarantee absolute **idempotency** (preventing double-sends on retries).
* **Scenario C (Total Redis Data Loss)**: Express runs a boot-time reconciliation scan before launching `app.listen()`. It matches database records flagged as `pending`, `queued`, or `rate_limited` against Redis BullMQ job keys. Any missing jobs are automatically re-queued.

---

## 🔧 Installation & Setup

### Prerequisites
* **Node.js** (v18+ recommended)
* **Docker Desktop** (running and available on path)

### 1. Launch Infrastructure Services
The Docker Compose script has been configured to map ports **5433** (Postgres), **6380** (Redis), and **9200** (Elasticsearch) to prevent conflicts with standard local port instances.

Start the containers:
```bash
# Add Docker folder to PATH in PowerShell if needed:
$env:PATH = "C:\Program Files\Docker\Docker\resources\bin;" + $env:PATH
docker-compose up -d
```

### 2. Configure Backend
```bash
cd backend
npm install
```

Configure the environment in `backend/.env`:
```ini
PORT=4000
DATABASE_URL=postgresql://postgres:password@localhost:5433/reachinbox?schema=public
REDIS_HOST=localhost
REDIS_PORT=6380
ELASTICSEARCH_NODE=http://localhost:9200
JWT_SECRET=supersecretkeyforreachinboxjwt

# OAuth Keys (Optional for testing, see bypass below)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback

SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_REDIRECT_URI=http://localhost:4000/api/slack/callback

FRONTEND_URL=http://localhost:5173
WORKER_CONCURRENCY=5
MIN_SEND_DELAY_MS=2000
```

Deploy DB migrations & generate Prisma client:
```bash
npx prisma db push
npx prisma generate
```

Start the API Server:
```bash
npm run dev
```

### 3. Configure Frontend
```bash
cd ../frontend
npm install
```

Open `frontend/src/App.tsx` and configure the `GOOGLE_CLIENT_ID` if utilizing real Google Sign-In.

Start the client dashboard:
```bash
npm run dev
```

---

## 🔑 Tester & Recruiter Bypass Features

For easy evaluation without configuring Google and Slack API credentials:
1. **Google Auth Bypass**: If `GOOGLE_CLIENT_ID` is not configured, the login screen displays a "Use Development Bypass" option. Enter any test email (e.g. `tester@reachinbox.ai`) and name to sign in instantly with a JWT token session.
2. **Auto Ethereal SMTP Generation**: When adding a sender, select the checkbox "Generate Ethereal Test Account (Recommended)". It will dynamically call Nodemailer's test account generator and register real, temporary Ethereal SMTP logins, saving you from manual credential setup.
3. **BullMQ Admin Panel**: Access the live BullMQ queue dashboard at `http://localhost:4000/admin/queues` to inspect job states, delays, and completions in real-time.
