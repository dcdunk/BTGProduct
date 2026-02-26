import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getWorkspaceContextFiles, updateWorkspaceContext, createWorkspaceContext } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const files = getWorkspaceContextFiles();
  return NextResponse.json(files);
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const body = await request.json();
  const { id, name, content } = body;

  if (id) {
    // Update existing
    updateWorkspaceContext(id, content ?? '');
    return NextResponse.json({ success: true });
  } else if (name?.trim()) {
    // Create new
    const file = createWorkspaceContext(name.trim(), content ?? '', userId);
    return NextResponse.json(file, { status: 201 });
  }

  return NextResponse.json({ error: 'Must provide id (to update) or name (to create)' }, { status: 400 });
}
