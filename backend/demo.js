const axios = require('axios');

const BACKEND_URL = 'http://localhost:4000';

async function runDemo() {
  console.log('🏁 Starting Scheduler End-to-End Simulation...\n');

  try {
    // Step 1: Login Bypass
    console.log('🔑 Step 1: Requesting Developer JWT Bypass Token...');
    const loginRes = await axios.post(`${BACKEND_URL}/api/auth/test-login`, {
      email: 'demo-recruiter@reachinbox.ai',
      name: 'ReachInbox Recruiter'
    });
    
    const token = loginRes.data.token;
    console.log(`✅ Token received: JWT ${token.substring(0, 15)}...\n`);
    
    const headers = { Authorization: `Bearer ${token}` };

    // Step 2: Add Ethereal Sender Profile
    console.log('📤 Step 2: Generating Ethereal SMTP Profile (Auto SMTP keys)...');
    const senderRes = await axios.post(`${BACKEND_URL}/api/senders`, {
      name: 'ReachInbox Outreach',
      email: 'test@reachinbox.ai',
      generateEthereal: true,
      hourlyLimit: 10
    }, { headers });

    const sender = senderRes.data;
    console.log(`✅ Sender profile registered!`);
    console.log(`   - ID: ${sender.id}`);
    console.log(`   - Name: ${sender.name}`);
    console.log(`   - Generated SMTP User: ${sender.smtpUser}`);
    console.log(`   - Hourly Limit Cap: ${sender.maxEmailsPerHour} emails/hr\n`);

    // Step 3: Schedule Campaign
    console.log('📅 Step 3: Scheduling Cold Email Campaign for 3 leads...');
    const scheduleRes = await axios.post(`${BACKEND_URL}/api/emails/schedule`, {
      senderId: sender.id,
      subject: 'Opportunity at Outbox Labs',
      body: '<p>Hello!</p><p>We are scheduling this cold email to verify the BullMQ queue delivery pipeline.</p>',
      delaySeconds: 3, // Spacing delay of 3s
      startTime: new Date(Date.now() + 1000).toISOString(), // Start in 1 second
      recipients: [
        { email: 'lead-one@reachinbox.ai', name: 'Lead One' },
        { email: 'lead-two@reachinbox.ai', name: 'Lead Two' },
        { email: 'lead-three@reachinbox.ai', name: 'Lead Three' }
      ]
    }, { headers });

    console.log(`✅ Campaign Scheduled! Enqueued ${scheduleRes.data.count} emails to BullMQ.\n`);

    // Step 4: Poll Outbox Status
    console.log('🔍 Step 4: Polling Outbox log status (respecting 3s inter-email spacing)...');
    
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const emailsRes = await axios.get(`${BACKEND_URL}/api/emails`, {
        headers,
        params: { limit: 10, page: 1 }
      });
      
      const emails = emailsRes.data.emails;
      console.log(`\n--- Outbox State Check #${i + 1} ---`);
      emails.forEach(e => {
        console.log(`📧 To: ${e.recipientEmail} (${e.recipientName || 'N/A'}) - Status: [${e.status.toUpperCase()}] (Attempts: ${e.attempts})`);
      });

      const allSent = emails.every(e => e.status === 'sent');
      if (allSent) {
        console.log('\n🎉 Success! All emails in the campaign have been processed and sent successfully!');
        break;
      }
    }

  } catch (error) {
    console.error('❌ Error during simulation:', error.response ? error.response.data : error.message);
  }
}

runDemo();
