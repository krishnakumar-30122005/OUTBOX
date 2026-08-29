import axios from 'axios';
import prisma from './db';
import dotenv from 'dotenv';

dotenv.config();

const CLIENT_ID = process.env.SLACK_CLIENT_ID || '';
const CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.SLACK_REDIRECT_URI || '';

/**
 * Generates the URL to redirect the user to for Slack authorization
 */
export function getSlackAuthUrl(userId: string): string {
  const clientId = process.env.SLACK_CLIENT_ID || '';
  const redirectUri = process.env.SLACK_REDIRECT_URI || 'http://localhost:4000/api/slack/callback';

  if (!clientId || clientId === 'your_slack_client_id') {
    throw new Error('Slack Client ID is not configured in backend/.env. Please add your real Slack Client ID.');
  }

  return `https://slack.com/oauth/v2/authorize?client_id=${encodeURIComponent(clientId)}&scope=incoming-webhook&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(userId)}`;
}

/**
 * Exchanges the Slack authorization code for access tokens and webhook URLs
 */
export async function handleSlackCallback(code: string, userId: string): Promise<any> {
  const clientId = process.env.SLACK_CLIENT_ID || '';
  const clientSecret = process.env.SLACK_CLIENT_SECRET || '';
  const redirectUri = process.env.SLACK_REDIRECT_URI || 'http://localhost:4000/api/slack/callback';

  const url = 'https://slack.com/api/oauth.v2.access';
  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('code', code);
  params.append('redirect_uri', redirectUri);

  const response = await axios.post(url, params, {
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
  });

  if (!response.data.ok) {
    throw new Error(response.data.error || 'Failed to exchange Slack token');
  }

  const data = response.data;
  const accessToken = data.access_token;
  const webhookUrl = data.incoming_webhook?.url;
  const teamId = data.team?.id;

  if (!webhookUrl) {
    throw new Error('No webhook URL returned in Slack OAuth response. Make sure to request incoming-webhook scope.');
  }

  // Save/update integration
  const integration = await prisma.slackIntegration.upsert({
    where: { userId },
    update: {
      accessToken,
      webhookUrl,
      teamId,
      isActive: true,
      connectedAt: new Date(),
    },
    create: {
      userId,
      accessToken,
      webhookUrl,
      teamId,
      isActive: true,
    },
  });

  return integration;
}

/**
 * Sends a notification message to the user's connected Slack workspace
 */
export async function sendSlackAlert(userId: string, message: string) {
  try {
    const slack = await prisma.slackIntegration.findUnique({
      where: { userId },
    });
    if (!slack || !slack.isActive || !slack.webhookUrl) {
      console.log(`Slack alert skipped for user ${userId}: Slack integration not connected or active.`);
      return;
    }

    await axios.post(slack.webhookUrl, {
      text: message,
    });
    console.log(`Slack alert successfully sent to user ${userId}.`);
  } catch (error: any) {
    console.error(`Error sending Slack alert for user ${userId}:`, error?.response?.data || error?.message || error);
  }
}
