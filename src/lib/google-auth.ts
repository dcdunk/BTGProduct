import 'server-only';
import { OAuth2Client } from 'google-auth-library';
import { getUserGoogleTokens, setUserGoogleTokens } from './db';

/**
 * Returns a valid Google OAuth access token for the given user,
 * refreshing it if expired. Returns null if no tokens stored or refresh fails.
 */
export async function getValidGoogleToken(userId: string): Promise<string | null> {
  const tokens = getUserGoogleTokens(userId);
  if (!tokens) return null;

  // Check if token is still valid (with 5-minute buffer)
  const expiresAt = new Date(tokens.expiresAt).getTime();
  const bufferMs = 5 * 60 * 1000;
  if (Date.now() < expiresAt - bufferMs) {
    return tokens.accessToken;
  }

  // Token expired — refresh it
  try {
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({
      refresh_token: tokens.refreshToken,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    if (!credentials.access_token) return null;

    const newExpiry = credentials.expiry_date
      ? new Date(credentials.expiry_date).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString();

    setUserGoogleTokens(
      userId,
      credentials.access_token,
      tokens.refreshToken,
      newExpiry
    );

    return credentials.access_token;
  } catch {
    return null;
  }
}
