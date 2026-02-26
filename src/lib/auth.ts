import 'server-only';
import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { getOrCreateUser, setUserGoogleTokens } from './db';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/cloud-platform',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return false;

      // Restrict to allowed email domain if configured
      const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN;
      if (allowedDomain && !user.email.endsWith(`@${allowedDomain}`)) {
        return false;
      }

      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (user?.email) {
        // Create or update user in database on sign-in
        const dbUser = getOrCreateUser(
          user.email,
          user.name ?? user.email,
          user.image ?? null
        );
        token.userId = dbUser.id;
        token.role = dbUser.role;

        // Store Google OAuth tokens for Gemini API access
        if (account?.access_token && account?.refresh_token) {
          try {
            setUserGoogleTokens(
              dbUser.id,
              account.access_token,
              account.refresh_token,
              new Date((account.expires_at ?? 0) * 1000).toISOString()
            );
          } catch {
            // Non-fatal: Gemini OAuth tokens are optional
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.userId as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
  },
};
