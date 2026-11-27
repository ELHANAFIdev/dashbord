'use client';
// Accès aux données via le proxy /api/rpc. Cache par profil et paramètres, dédoublonnage
// des requêtes simultanées, invalidation après écriture, et remontée de la source
// (x-ummc-source) pour le bandeau de démonstration.
import { useCallback, useEffect, useId, useState, useSyncExternalStore } from 'react';
import type { DataSource } from '@/lib/types';
import { reportSource } from './sources';

export class RpcError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface RpcResponse<T> {
  data: T;
  source: DataSource;
}

type Params = Record<string, unknown>;
const cache = new Map<string, Promise<RpcResponse<unknown>>>();
const listeners = new Set<() => void>();
let generation = 0;

function bump() {
  generation += 1;
  listeners.forEach((l) => l());
}

export async function callRpc<T>(fn: string, params: Params = {}): Promise<RpcResponse<T>> {
  let res: Response;
  try {
    res = await fetch(`/api/rpc/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      cache: 'no-store',
    });
  } catch {
    throw new RpcError(0, 'Le serveur du tableau de bord ne répond pas. Vérifiez la connexion.');
  }
  const body = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const msg = (body as { error?: string } | null)?.error ?? `Erreur ${res.status} sur ${fn}.`;
    throw new RpcError(res.status, msg);
  }
  const source = res.headers.get('x-ummc-source') === 'live' ? 'live' : 'mock';
  return { data: body as T, source };
}

function cached<T>(fn: string, params: Params): Promise<RpcResponse<T>> {
  const key = `${fn}:${JSON.stringify(params)}`;
  let p = cache.get(key);
  if (!p) {
    p = callRpc<unknown>(fn, params);
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p as Promise<RpcResponse<T>>;
}

/** Vide le cache des fonctions données (toutes si aucune) et relance les lectures affichées. */
export function invalidate(fns?: string[]) {
  for (const key of [...cache.keys()]) {
    if (!fns || fns.some((f) => key.startsWith(`${f}:`))) cache.delete(key);
  }
  bump();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const getGeneration = () => generation;

export interface RpcState<T> {
  data: T | undefined;
  source: DataSource | undefined;
  error: RpcError | undefined;
  loading: boolean;
  reload: () => void;
}

/** Lecture d'une fonction. `params = null` désactive l'appel. */
export function useRpc<T>(fn: string, params: Params | null): RpcState<T> {
  const id = useId();
  const gen = useSyncExternalStore(subscribe, getGeneration, getGeneration);
  const key = params ? `${fn}:${JSON.stringify(params)}#${gen}` : null;
  const [state, setState] = useState<{ key: string; data?: T; source?: DataSource; error?: RpcError } | null>(null);

  useEffect(() => {
    if (!key || !params) return;
    let alive = true;
    cached<T>(fn, params).then(
      (r) => alive && setState({ key, data: r.data, source: r.source }),
      (e: unknown) => alive && setState({ key, error: e instanceof RpcError ? e : new RpcError(0, String(e)) }),
    );
    return () => {
      alive = false;
    };
    // params est sérialisé dans key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fn]);

  const current = state && state.key === key ? state : null;
  const source = current?.source;
  useEffect(() => {
    if (source) reportSource(id, source);
    return () => reportSource(id, null);
  }, [id, source]);

  const reload = useCallback(() => invalidate([fn]), [fn]);
  // Pendant un rechargement des mêmes données, on garde l'affichage précédent.
  const sameRequest = state && key && state.key.split('#')[0] === key.split('#')[0];
  const stale = sameRequest && !current && !state.error ? state : null;
  return {
    data: current?.data ?? stale?.data,
    source: current?.source ?? stale?.source,
    error: current?.error,
    loading: Boolean(key) && !current,
    reload,
  };
}
