import { NextResponse, type NextRequest } from 'next/server';
import { ROLE_COOKIE, isRole, sessionFor } from '@/lib/roles';
import { isMockMode } from '@/server/live';
import type { SessionInfo } from '@/lib/types';

// Session de démonstration : le sélecteur de profil écrit le rôle dans un cookie httpOnly que
// le serveur relit à chaque appel de données. En production, il est remplacé par une vraie
// authentification.

function info(role: string | undefined): SessionInfo {
  return { ...sessionFor(role, process.env.UMMC_COORD_REGION), dataMode: isMockMode() ? 'mock' : 'live' };
}

export async function GET(request: NextRequest) {
  return NextResponse.json(info(request.cookies.get(ROLE_COOKIE)?.value), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => ({}));
  const role = (body as { role?: unknown })?.role;
  if (!isRole(role)) return NextResponse.json({ error: 'Profil inconnu' }, { status: 400 });
  const response = NextResponse.json(info(role));
  response.cookies.set(ROLE_COOKIE, role, { httpOnly: true, sameSite: 'strict', path: '/' });
  return response;
}
