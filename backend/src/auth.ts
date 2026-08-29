import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import prisma from './db';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkeyforreachinboxjwt';
export function getOAuthClient() {
  const clientId =
    process.env.GOOGLE_CLIENT_ID ||
    '852608121103-5d3itjnk956b0f9pt47lctk103b0scgd.apps.googleusercontent.com';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/auth/google/callback';

  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

/**
 * Creates a signed JWT session token valid for 24 hours
 */
export function generateToken(user: { id: string; email: string; name?: string | null }): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name || '' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * Express middleware to protect API routes with JWT Bearer authentication
 */
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. No Bearer token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; name?: string };
    req.user = decoded;
    next();
  } catch (err: any) {
    return res.status(401).json({ error: 'Session expired or invalid token. Please log in again.' });
  }
}

/**
 * Builds the Google OAuth consent screen URL for redirect-based login
 */
export function getGoogleAuthUrl(): string {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  if (!clientId || clientId === 'your_google_client_id') {
    throw new Error('Google Client ID is not configured in backend/.env');
  }

  const client = getOAuthClient();
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid',
  ];

  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    include_granted_scopes: true,
  });
}

/**
 * Handles the redirect callback from Google by exchanging the authorization code
 * for tokens, retrieving the user profile, and storing/updating the user in Postgres.
 */
export async function handleGoogleCallback(code: string) {
  try {
    const client = getOAuthClient();
    // 1. Exchange authorization code for access/id tokens
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // 2. Fetch authenticated user's profile info from Google API
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data: profile } = await oauth2.userinfo.get();

    if (!profile.email) {
      throw new Error('Could not retrieve email address from Google profile');
    }

    const email = profile.email.toLowerCase().trim();
    const name = profile.name || profile.given_name || email.split('@')[0];
    const avatarUrl = profile.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`;
    const googleId = profile.id || undefined;

    // 3. Upsert user in database
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        avatarUrl,
        ...(googleId ? { googleId } : {}),
      },
      create: {
        email,
        name,
        avatarUrl,
        googleId,
      },
    });

    // 4. Generate application JWT
    const token = generateToken(user);
    return { user, token };
  } catch (error: any) {
    console.error('Google OAuth callback exchange failed:', error?.message || error);
    throw new Error(error?.message || 'Failed to authenticate with Google');
  }
}

/**
 * Handles popup/GIS credential responses where the frontend provides a direct Google ID Token
 */
export async function verifyGoogleToken(idToken: string) {
  try {
    const clientId =
      process.env.GOOGLE_CLIENT_ID ||
      '852608121103-5d3itjnk956b0f9pt47lctk103b0scgd.apps.googleusercontent.com';
    const client = getOAuthClient();
    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new Error('Invalid Google token payload');
    }

    const email = payload.email.toLowerCase().trim();
    const name = payload.name || payload.given_name || email.split('@')[0];
    const avatarUrl = payload.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`;
    const googleId = payload.sub;

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        avatarUrl,
        googleId,
      },
      create: {
        email,
        name,
        avatarUrl,
        googleId,
      },
    });

    const token = generateToken(user);
    return { user, token };
  } catch (error: any) {
    console.error('Google token verification failed:', error?.message || error);
    throw new Error('Google credential verification failed');
  }
}

