ReachInbox

A full-stack email outreach and scheduling tool I built for cold email campaigns. It handles CSV lead imports, spaces out sends so you don't look like a bot, respects per-mailbox hourly limits, pings Slack when something needs attention, and — the part I'm most proud of — survives a server restart without losing or duplicating a single scheduled email.

Think of it as a lightweight Mailshake/Lemlist clone, minus the SaaS pricing.

Stack
Backend: Node.js + Express + TypeScript
Database: SQLite by default (Postgres works too, just swap the connection string) via Prisma
Queue: BullMQ on Redis doing the actual sending
Search: Elasticsearch, with a SQL fallback so search never just... breaks
Monitoring: Bull Board at /admin/queues — handy for watching jobs move in real time
Frontend: React + Vite + TypeScript + Tailwind, Google login via GIS
Running it locally

You'll need Node 18+. Docker is optional — only grab it if you want real Postgres/Redis/Elasticsearch instead of the zero-dependency local mode.

Backend
bash
cd backend
npm install

Drop a .env in the backend folder (or copy .env.example):

env
PORT=4000
DATABASE_URL="file:./dev.db"
REDIS_HOST=localhost
REDIS_PORT=6380
ELASTICSEARCH_NODE=http://localhost:9200
JWT_SECRET=supersecretkeyforreachinboxjwt

# Google OAuth (for login)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback

# Slack (optional — only needed for rate-limit alerts)
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_REDIRECT_URI=http://localhost:4000/api/slack/callback

FRONTEND_URL=http://localhost:5173

# Scheduler tuning
WORKER_CONCURRENCY=5
MIN_SEND_DELAY_MS=2000

Then set up the database and fire up the server:

bash
npx prisma db push
npx prisma generate
npm run dev
API: http://localhost:4000
Queue dashboard: http://localhost:4000/admin/queues
Frontend

New terminal:

bash
cd frontend
npm install
npm run dev

Opens at http://localhost:5173.

Docker (optional)

If you'd rather run real infra instead of the local fallback mode:

bash
docker-compose up -d

Heads up — the compose file maps Postgres to 5433, Redis to 6380, and Elasticsearch to 9200, just to stay out of the way of anything else you might have running on default ports.

Testing email sends without spamming real people

I used Ethereal Email — it's a fake SMTP sandbox that gives you real handshakes and preview links without ever touching a real inbox.

Easiest way: In the dashboard, click the + next to Outreach Senders, then hit "⚡ Auto-Create Sandbox Mailbox." It talks to Ethereal's API, provisions a throwaway account, and wires it up automatically. Once you send something, check your backend terminal — Nodemailer prints a preview URL you can click to see the email like a real inbox would render it.

Manual way, if you want more control:

Grab a mailbox from ethereal.email/create
Hit + under Outreach Senders in the dashboard
Fill in the sender name, the email Ethereal gave you, SMTP host (smtp.ethereal.email), port 587, and the username/password Ethereal generated
Set an hourly limit (50 is a reasonable default) and save
How the scheduling actually works

When you kick off a campaign — whether from a CSV or typed-in recipients — the frontend hits POST /api/emails/schedule. From there:

Every recipient gets a target send time. It's just startTime + (index × delayMs), so if you set a 5-second delay, recipient #10 goes out roughly 50 seconds after the first.
The job gets written to the database first, marked queued or pending. This matters — more on why below.
Then it gets handed to BullMQ as a delayed job (or a plain in-memory timer if Redis isn't running).
When the timer fires, a worker picks it up, double-checks the sender hasn't blown past their hourly cap, connects via that sender's SMTP creds, and sends. Status flips to sent.
Why the DB comes first — surviving a crash or restart

This was the part I actually spent the most time getting right. If the backend dies mid-campaign — crash, deploy, Ctrl+C, whatever — nothing should be lost, and nothing should get sent twice.

The trick is that the database is the source of truth, not Redis. Every job lands in the EmailJob table before it ever touches BullMQ. So on boot, before the server even starts listening, it runs a reconciliation pass:

Pull every record still marked pending, queued, or rate_limited
If its scheduled time already passed while the server was down → queue it immediately
If it's still in the future → re-enqueue it with whatever time is left

And as a safety net, the worker always checks "is this already marked sent?" right before dispatching — so even if something weird happens and a job gets picked up twice, it won't double-send.

Rate limiting and concurrency
Concurrency is just WORKER_CONCURRENCY in the .env — BullMQ spins up that many workers pulling jobs off Redis in parallel, so multiple campaigns from different users don't block each other.
Per-sender hourly limits are tracked with an atomic Redis counter keyed by sender + hour (rate:<senderId>:<YYYYMMDDHH>). If a sender's about to blow past their cap, the job doesn't fail — it gets marked rate_limited, gets pushed to the start of the next hour, and (if you've connected Slack) you get pinged so you're not left wondering why sends stalled.
What's actually in here
Backend
What	Where	Why it matters
Scheduler engine	queue.ts, server.ts	Handles the per-recipient delay math and staggered dispatch
Crash recovery	server.ts → reconcileOnBoot	Rebuilds the queue from the DB on every startup
Hourly rate limiter	queue.ts, redis.ts	Atomic per-sender counters, auto-defers to next hour
Worker concurrency	queue.ts	Parallel job processing, tunable via .env
CRUD endpoints	server.ts	Full get/edit/delete/batch-delete on scheduled emails
Search	elasticsearch.ts, server.ts	Full-text search with a SQL fallback if ES is down
Queue dashboard	queueAdapter.ts	Bull Board at /admin/queues, backed by live DB data
Slack alerts	slack.ts	Fires when a mailbox hits its hourly cap
Auth	auth.ts	Google OAuth2, plus a one-click dev bypass for local testing
Frontend
What	Where	Why it matters
Login	Login.tsx	Google sign-in, or skip it entirely with dev bypass
Dashboard	Dashboard.tsx	Live counts for scheduled/sent/failed, polls in the background
Compose	ComposeModal.tsx	CSV upload, {{name}}-style variable swaps, delay picker
Sender setup	SenderModal.tsx	Manual SMTP config or one-click Ethereal sandbox
Email detail	EmailDetailModal.tsx	Full breakdown — recipient, sender used, timestamps, retries, rendered HTML
Edit/reschedule	EditEmailModal.tsx	Change subject, body, or send time before it fires
Cancel/delete	EmailsTable.tsx	Pulls the job out of BullMQ and removes the DB record
Search bar	Dashboard.tsx	Live search across subjects, recipients, and body text
If you're recording a demo

Rough 5-minute flow that covers everything worth showing:

Login (0:00–0:45) — log in (Google or dev bypass), show the dashboard and live counters
Sender setup (0:45–1:30) — hit the sandbox auto-create button, show how fast it provisions
Compose a campaign (1:30–2:30) — upload a leads.csv, use a {{name}} variable, set a short delay, schedule it
Watch it work (2:30–3:30) — check the Scheduled tab, pop open Bull Board to show jobs processing, then look at a sent email's detail view
Kill the server mid-flight (3:30–4:30) — schedule something 2 minutes out, Ctrl+C the backend, restart it, and point at the reconciliation log line ([Reconciliation] Successfully re-enqueued X pending emails). Wait for it to actually send.
Edit and delete (4:30–5:00) — reschedule one email, cancel another
Trade-offs I made on purpose

A few decisions here were deliberate shortcuts, not oversights — figured I'd be upfront about them:

SQLite by default. Nobody wants to spin up Postgres just to try out a side project. SQLite means npm install && npm run dev just works. Swap the DATABASE_URL and the Postgres schema is right there when you actually need it.

A custom Bull Board adapter. Bull Board normally just falls over if Redis isn't reachable, which felt like a bad first-run experience. So there's a small adapter that bridges the DB's job metrics into Bull Board when Redis is offline — you still get a dashboard even in local mode.

Elasticsearch is optional, not required. If ES isn't running, search quietly falls back to SQL LIKE-style queries across subject/body/recipient. Slower, sure, but it never just breaks on you.

Ethereal instead of real SMTP. I didn't want a bug in my delay logic to accidentally blast real inboxes during testing. Ethereal gives you a real SMTP handshake and a preview link, without any of the risk.


**ARCHITECTURAL EXPLANATION**

How it's built, in plain terms

ReachInbox is split into three pieces: a frontend you click around in, a backend that does the thinking, and a worker that actually sends the emails. They talk to each other through a database and a queue, not directly — which is what makes the crash-recovery trick possible.

Frontend (React) This is the dashboard. You log in with Google, upload a CSV, write your email, and hit schedule. It doesn't send anything itself — it just asks the backend to.

Backend (Express API) This is the part that receives your request. When you schedule a campaign, it does two things, in order:

Writes every single email as a row in the database, marked "pending."
Only after that's saved, hands the job off to the queue with a timer on it.

Saving to the database first is the whole trick — if the row exists, the email is safe, even if everything else crashes a second later.

The queue (Redis + BullMQ) Think of this as an alarm clock for each email. Every scheduled email gets its own timer — recipient #1 fires now, #2 fires 5 seconds later, and so on, so you're not blasting 200 emails in the same second like a bot would.

The worker When an alarm goes off, the worker wakes up, checks two things before it does anything: "has this sender already sent too many emails this hour?" and "is this email already marked as sent?" If the hourly limit's blown, it pushes the email to next hour and pings Slack. If it's already sent, it just skips it — that's what stops duplicates. Otherwise, it sends the email through that sender's SMTP account and marks it "sent" in the database.

Search (Elasticsearch, with a plain SQL backup) Every email gets indexed so you can search by subject, recipient, or body text. If Elasticsearch happens to be down, search doesn't break — it quietly switches to a slower plain-database search instead, so you never hit a dead end.

Surviving a restart This is the part that actually matters most. Because every email's real status lives in the database — not just in Redis's memory — restarting the server doesn't erase anything. On startup, the backend looks through the database for anything still marked "pending" or "queued," figures out how much time is left on each one, and re-arms the timer. If the time already passed while the server was down, it sends immediately. Nothing gets lost, and nothing gets sent twice.

The moving parts, one-line summary:

Piece	Job
Frontend	Where you compose and schedule campaigns
Backend API	Saves jobs to the database, hands them to the queue
Database	The permanent record — source of truth for every email's status
Redis + BullMQ	The timer system that fires each email at the right moment
Worker	Checks limits, sends the email, updates the status
Elasticsearch	Fast search, with SQL as a safety net
Slack	Gets pinged when a sender hits its hourly cap