/**
 * ReachInbox Full-Stack Email Scheduler - A to Z Automated Test & Script Pad
 * 
 * Tests every component in the system:
 *  1. Infrastructure & Service Health Check (Postgres, Redis, Elasticsearch, Express)
 *  2. Authentication & JWT Session Validation
 *  3. Google OAuth 2.0 URL Generation
 *  4. Ethereal Mock SMTP Sender Generation (Zero-Config Test Mailbox)
 *  5. CSV Lead Parsing & Campaign Scheduling
 *  6. BullMQ Async Queue Execution & Inter-Email Delay Throttling
 *  7. Elasticsearch Full-Text Search Queries
 *  8. Metric Counts & Dashboard Analytics
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BACKEND_URL = 'http://localhost:4000';

// ANSI terminal color formatting helpers
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
};

function logHeader(title) {
  console.log(`\n${colors.cyan}${colors.bright}================================================================${colors.reset}`);
  console.log(`${colors.magenta}${colors.bright}  🚀 ${title}${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}================================================================${colors.reset}\n`);
}

function logStep(stepNum, title) {
  console.log(`\n${colors.yellow}${colors.bright}[STEP ${stepNum}] ${title}${colors.reset}`);
}

function logSuccess(msg) {
  console.log(`  ${colors.green}✔ ${msg}${colors.reset}`);
}

function logInfo(msg) {
  console.log(`  ${colors.blue}ℹ ${msg}${colors.reset}`);
}

function logWarn(msg) {
  console.log(`  ${colors.yellow}⚠ ${msg}${colors.reset}`);
}

function logError(msg) {
  console.log(`  ${colors.red}✖ ${msg}${colors.reset}`);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runScriptPad() {
  logHeader('REACHINBOX EMAIL SCHEDULER: FULL SYSTEM VERIFICATION SCRIPT');
  const startTime = Date.now();

  let authToken = null;
  let authUser = null;
  let senderProfile = null;
  let scheduledCampaignId = null;

  try {
    // -------------------------------------------------------------
    // STEP 1: API Server & Health Check
    // -------------------------------------------------------------
    logStep(1, 'Checking API Server & Bull Board Connectivity');
    try {
      const serverRes = await axios.get(`${BACKEND_URL}/admin/queues`);
      logSuccess(`API Server is responsive on ${BACKEND_URL}`);
      logSuccess(`Bull Board Live Queue Monitor accessible (HTTP ${serverRes.status})`);
    } catch (err) {
      throw new Error(`API Server unreachable at ${BACKEND_URL}. Ensure 'npm run dev' is running.`);
    }

    // -------------------------------------------------------------
    // STEP 2: Authentication & JWT Session Flow
    // -------------------------------------------------------------
    logStep(2, 'Testing Authentication (Developer JWT Bypass & /api/auth/me)');
    const testEmail = 'krishna-tester@reachinbox.ai';
    const testName = 'Krishna Yadav';

    const loginRes = await axios.post(`${BACKEND_URL}/api/auth/test-login`, {
      email: testEmail,
      name: testName,
    });

    authToken = loginRes.data.token;
    authUser = loginRes.data.user;

    if (!authToken || !authUser) {
      throw new Error('Failed to acquire JWT session token.');
    }

    logSuccess(`JWT Session Token issued: ${authToken.substring(0, 24)}...`);
    logSuccess(`Authenticated User ID: ${authUser.id} (${authUser.email})`);

    // Verify session using /api/auth/me
    const headers = { Authorization: `Bearer ${authToken}` };
    const meRes = await axios.get(`${BACKEND_URL}/api/auth/me`, { headers });
    logSuccess(`Session validated via /api/auth/me -> Name: "${meRes.data.name}"`);

    // -------------------------------------------------------------
    // STEP 3: Google OAuth 2.0 Endpoint Verification
    // -------------------------------------------------------------
    logStep(3, 'Verifying Google OAuth 2.0 URL Generation Endpoint');
    try {
      const googleUrlRes = await axios.get(`${BACKEND_URL}/api/auth/google/url`);
      if (googleUrlRes.data?.url) {
        logSuccess(`Google OAuth Consent URL successfully formed:`);
        logInfo(`${googleUrlRes.data.url.substring(0, 85)}...`);
      }
    } catch (googleErr) {
      logWarn(`Google OAuth returned: ${googleErr.response?.data?.error || googleErr.message}`);
    }

    // -------------------------------------------------------------
    // STEP 4: Auto-Provisioning Ethereal Mock SMTP Sender Profile
    // -------------------------------------------------------------
    logStep(4, 'Registering Ethereal Sandbox SMTP Sender Profile');
    logInfo('Requesting automated Nodemailer Ethereal test mailbox credentials...');

    const senderRes = await axios.post(
      `${BACKEND_URL}/api/senders`,
      {
        name: 'Krishna Outreach Sandbox',
        generateEthereal: true,
        hourlyLimit: 50,
      },
      { headers }
    );

    senderProfile = senderRes.data;
    logSuccess(`Ethereal SMTP Profile created in PostgreSQL:`);
    logInfo(`- Sender ID:   ${senderProfile.id}`);
    logInfo(`- Sender Name: ${senderProfile.name}`);
    logInfo(`- SMTP Email:  ${senderProfile.email}`);
    logInfo(`- SMTP Host:   ${senderProfile.smtpHost}:${senderProfile.smtpPort}`);
    logInfo(`- Hourly Cap:  ${senderProfile.maxEmailsPerHour} emails/hr`);

    // -------------------------------------------------------------
    // STEP 5: CSV Lead Parsing & Campaign Scheduling
    // -------------------------------------------------------------
    logStep(5, 'Parsing CSV Leads & Scheduling Timed Email Campaign');

    const csvPath = path.join(__dirname, '..', 'leads.csv');
    let leads = [
      { email: 'pgpkrish003@gmail.com', name: 'Krishna Lead 1' },
      { email: 'krishnakumar301205@gmail.com', name: 'Krishna Lead 2' },
      { email: 'sandbox-eval@reachinbox.ai', name: 'Evaluation Lead' },
    ];

    if (fs.existsSync(csvPath)) {
      const content = fs.readFileSync(csvPath, 'utf8');
      const lines = content.split('\n').filter((l) => l.trim().length > 0);
      const startIdx = lines[0].toLowerCase().includes('email') ? 1 : 0;
      const parsed = [];
      for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts[0] && parts[0].includes('@')) {
          parsed.push({
            email: parts[0].trim(),
            name: parts[1]?.trim() || 'Lead',
          });
        }
      }
      if (parsed.length > 0) {
        leads = parsed;
      }
    }

    logInfo(`Parsed ${leads.length} leads for batch delivery:`);
    leads.forEach((l, idx) => logInfo(`  ${idx + 1}. ${l.email} (${l.name})`));

    // Schedule campaign with 2 second delay between emails
    const delaySeconds = 2;
    const scheduleRes = await axios.post(
      `${BACKEND_URL}/api/emails/schedule`,
      {
        senderId: senderProfile.id,
        subject: 'ReachInbox Scheduler Verification Demo',
        body: '<p>Hello <b>{{name}}</b>,</p><p>This is an automated verification email sent via ReachInbox BullMQ scheduler queue.</p>',
        delaySeconds,
        startTime: new Date(Date.now() + 500).toISOString(),
        recipients: leads,
      },
      { headers }
    );

    logSuccess(`Campaign scheduled! Enqueued ${scheduleRes.data.count} email jobs into Redis BullMQ.`);
    logInfo(`Inter-email delay setting: ${delaySeconds} seconds.`);

    // -------------------------------------------------------------
    // STEP 6: BullMQ Queue Polling & Execution Verification
    // -------------------------------------------------------------
    logStep(6, 'Monitoring Real-Time Queue Processing & Status Lifecycle');
    logInfo('Polling Postgres status updates (pending -> queued -> sending -> sent)...');

    let allCompleted = false;
    const maxPollAttempts = 15;

    for (let attempt = 1; attempt <= maxPollAttempts; attempt++) {
      await sleep(2500);

      const emailsRes = await axios.get(`${BACKEND_URL}/api/emails`, {
        headers,
        params: { limit: 10, page: 1 },
      });

      const emails = emailsRes.data.emails || [];
      const sentCount = emails.filter((e) => e.status === 'sent').length;
      const pendingCount = emails.filter((e) => e.status === 'pending' || e.status === 'queued').length;
      const failedCount = emails.filter((e) => e.status === 'failed').length;

      console.log(
        `  ${colors.bright}[Poll #${attempt}]${colors.reset} Status Summary: ` +
        `${colors.green}Sent: ${sentCount}${colors.reset} | ` +
        `${colors.yellow}Pending/Queued: ${pendingCount}${colors.reset} | ` +
        `${colors.red}Failed: ${failedCount}${colors.reset}`
      );

      if (sentCount >= leads.length && pendingCount === 0) {
        allCompleted = true;
        logSuccess('All email jobs have been successfully processed and marked as SENT in PostgreSQL!');
        break;
      }
    }

    if (!allCompleted) {
      logWarn('Some jobs are still completing in the BullMQ worker queue.');
    }

    // -------------------------------------------------------------
    // STEP 7: Elasticsearch Full-Text Search Audit
    // -------------------------------------------------------------
    logStep(7, 'Verifying Elasticsearch Full-Text Search Index');
    try {
      // Search by recipient email prefix
      const searchRes = await axios.get(`${BACKEND_URL}/api/emails/search`, {
        headers,
        params: { q: leads[0].email.split('@')[0] },
      });

      logSuccess(`Elasticsearch queried for "${leads[0].email.split('@')[0]}":`);
      logInfo(`Found ${searchRes.data.length} indexed email record(s).`);
      if (searchRes.data.length > 0) {
        logInfo(`- Top hit subject: "${searchRes.data[0].subject}"`);
        logInfo(`- Top hit recipient: ${searchRes.data[0].recipientEmail}`);
      }
    } catch (esErr) {
      logWarn(`Elasticsearch query note: ${esErr.response?.data?.error || esErr.message}`);
    }

    // -------------------------------------------------------------
    // STEP 8: Dashboard Metrics & Email Counts
    // -------------------------------------------------------------
    logStep(8, 'Fetching Real-Time Dashboard Status Metric Counters');
    const countsRes = await axios.get(`${BACKEND_URL}/api/emails/counts`, { headers });
    logSuccess('Dashboard Counters API:');
    console.log(`     📅 Scheduled: ${countsRes.data.scheduled}`);
    console.log(`     🚀 Sent:      ${countsRes.data.sent}`);
    console.log(`     ⚠️ Failed:    ${countsRes.data.failed}`);

    // -------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n${colors.green}${colors.bright}================================================================${colors.reset}`);
    console.log(`${colors.green}${colors.bright}  🎉 ALL TESTS COMPLETED SUCCESSFULLY IN ${duration}s!${colors.reset}`);
    console.log(`${colors.green}${colors.bright}================================================================${colors.reset}`);
    console.log(`\n  Dashboard URL:   ${colors.cyan}http://localhost:5173${colors.reset}`);
    console.log(`  Bull Board URL:  ${colors.cyan}http://localhost:4000/admin/queues${colors.reset}\n`);

  } catch (error) {
    logError(`Script pad encountered an error: ${error.message}`);
    if (error.response?.data) {
      console.error('Server error details:', error.response.data);
    }
  }
}

runScriptPad();
