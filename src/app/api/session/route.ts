import { NextRequest, NextResponse } from 'next/server';
import { ROLE_COOKIE, isRole, sessionFor } from '@/lib/roles';

// Demo session: the role selector stores the active profile in an httpOnly cookie that the
// server reads on every data call. In production this cookie is replaced by real authentication.

export async function GET(request: NextRequest) {
  return NextResponse.json(sessionFor(request.cookies.get(ROLE_COOKIE)?.value));
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const role = (body as { role?: unknown }).role;
  if (!isRole(role)) {
    return NextResponse.json({ error: 'Rôle inconnu' }, { status: 400 });
  }
  const response = NextResponse.json(sessionFor(role));
  response.cookies.set(ROLE_COOKIE, role, { httpOnly: true, sameSite: 'strict', path: '/' });
  return response;
}
