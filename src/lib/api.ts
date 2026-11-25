/**
 * Client-side and server-side helper to call our Next.js RPC proxy.
 */
export async function callRpc<T>(fn: string, params: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`/api/rpc/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Erreur lors de l'appel ${fn} (${res.status})`);
  }

  return res.json();
}
