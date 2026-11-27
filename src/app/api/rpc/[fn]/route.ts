import { NextResponse, type NextRequest } from 'next/server';
import { ROLE_COOKIE, sessionFor } from '@/lib/roles';
import { callLive, isMockMode } from '@/server/live';
import { readMock } from '@/server/mock';
import { handleRpc } from '@/server/rpc';

// Proxy des fonctions Supabase : la clé et le jeton restent côté serveur, l'auteur des
// écritures vient de la session (cookie httpOnly), jamais du corps de la requête.
export async function POST(request: NextRequest, context: { params: Promise<{ fn: string }> }) {
  const { fn } = await context.params;
  const user = sessionFor(request.cookies.get(ROLE_COOKIE)?.value, process.env.UMMC_COORD_REGION);
  const body: unknown = await request.json().catch(() => ({}));

  const result = await handleRpc(fn, body, user, {
    mode: isMockMode() ? 'mock' : 'live',
    callLive,
    readMock,
  });

  const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  if (result.source) headers['x-ummc-source'] = result.source;
  return NextResponse.json(result.body, { status: result.status, headers });
}
