import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getLLMProvider } from '@/lib/llm';
import { getApiKeyForProvider } from '@/lib/db';
import { getValidGoogleToken } from '@/lib/google-auth';
import { sanitizeForLog } from '@/lib/sanitize';
import type { Provider } from '@/types';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = (session.user as { role: string }).role;
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const userId = (session.user as { id: string }).id;
  const body = await request.json();
  const { provider } = body;

  if (!provider || !['anthropic', 'openai', 'google'].includes(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  }

  let oauthToken: string | undefined;
  if (provider === 'google') {
    oauthToken = await getValidGoogleToken(userId) ?? undefined;
  }

  const apiKey = getApiKeyForProvider(provider);
  if (!apiKey && !oauthToken) {
    return NextResponse.json({ error: `No API key configured for ${provider}` }, { status: 400 });
  }

  try {
    const llm = getLLMProvider(provider as Provider);
    const { stream } = await llm.createStream({
      model: provider === 'anthropic' ? 'claude-haiku-4-5-20251001' : provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash',
      systemPrompt: 'Reply with OK.',
      messages: [{ role: 'user', content: 'Test' }],
      temperature: 0,
      apiKey: apiKey ?? '',
      oauthToken,
    });

    // Consume the stream to verify it works
    for await (const _chunk of stream) {
      break; // Just need the first chunk
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? sanitizeForLog(err.message) : 'Unknown error';
    return NextResponse.json({ error: `Connection failed: ${message}` }, { status: 400 });
  }
}
