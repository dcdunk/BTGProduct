import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getMcpServerById, updateMcpServer, deleteMcpServer, getUserByEmail } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const server = getMcpServerById(params.id);
  if (!server) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(server);
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = getUserByEmail(session.user.email);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const server = getMcpServerById(params.id);
  if (!server) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  updateMcpServer(params.id, body);

  const updated = getMcpServerById(params.id);
  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = getUserByEmail(session.user.email);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const server = getMcpServerById(params.id);
  if (!server) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  deleteMcpServer(params.id);
  return NextResponse.json({ success: true });
}
