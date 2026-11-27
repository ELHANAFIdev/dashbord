// Appel réel d'une fonction Supabase (PostgREST). La clé anon et le jeton `ui` ne quittent
// jamais le serveur.

export class LiveError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function isMockMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.USE_MOCK ?? '').toLowerCase() === 'true' || !env.SUPA_URL || !env.SUPA_ANON_KEY || !env.SUPA_TOKEN;
}

export async function callLive(fn: string, params: Record<string, unknown>): Promise<unknown> {
  const key = process.env.SUPA_ANON_KEY as string;
  let res: Response;
  try {
    res = await fetch(`${process.env.SUPA_URL}/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ ...params, p_token: process.env.SUPA_TOKEN }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new LiveError(502, `Base de données injoignable (${fn}).`);
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new LiveError(res.status >= 500 ? 502 : res.status, `La base a refusé ${fn} (${res.status}) ${detail}`.trim());
  }
  return normalizeLive(fn, params, await res.json());
}

/**
 * Met la réponse réelle à la forme du contrat quand la base l'enveloppe autrement.
 * `flux_indicateurs` renvoie `{indicateur, du, au, lignes}` : on garde `lignes`.
 * Pour `croissance`, la base donne le mois en nombre (1 à 12) et renvoie aussi les mois sans données
 * de l'année en cours, ou après `p_au` : on écrit le mois `AAAA-MM` et on ne garde que les mois remplis jusqu'à `p_au`.
 */
export function normalizeLive(fn: string, params: Record<string, unknown>, data: unknown): unknown {
  if (fn !== 'flux_indicateurs' || !data || typeof data !== 'object' || Array.isArray(data)) return data;
  const lignes = (data as { lignes?: unknown }).lignes;
  if (!Array.isArray(lignes)) return data;
  if (params.p_indicateur !== 'croissance') return lignes;
  const year = String(params.p_au ?? '').slice(0, 4);
  const lastMonth = Number(String(params.p_au ?? '').slice(5, 7)) || 12;
  return lignes
    .filter((r: { mois: number | string; consultations_n?: number }) =>
      Number(r.consultations_n ?? 0) > 0 && (typeof r.mois !== 'number' || r.mois <= lastMonth))
    .map((r: { mois: number | string }) => ({
      ...r,
      mois: typeof r.mois === 'number' ? `${year}-${String(r.mois).padStart(2, '0')}` : r.mois,
    }));
}
