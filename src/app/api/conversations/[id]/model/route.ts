import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getConversationById, updateConversationModel } from '@/lib/db';
import { PROVIDER_MODELS, type Provider } from '@/types';

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const conversation = getConversationById(params.id);
  if (!conversation || conversation.user_id !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json();
  const { provider, model } = body;

  if (!provider || !['anthropic', 'openai', 'google'].includes(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  }

  const validModels = PROVIDER_MODELS[provider as Provider];
  if (!model || !validModels.includes(model)) {
    return NextResponse.json({ error: 'Invalid model for provider' }, { status: 400 });
  }

  updateConversationModel(params.id, provider, model);
  return NextResponse.json({ success: true });
}
