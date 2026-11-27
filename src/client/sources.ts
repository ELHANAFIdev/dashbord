'use client';
// Registre des sources des données affichées : dès qu'une donnée à l'écran vient de la
// démonstration, le bandeau « DONNÉES DE DÉMONSTRATION » s'affiche.
import { useSyncExternalStore } from 'react';
import type { DataSource } from '@/lib/types';

const sources = new Map<string, DataSource>();
const listeners = new Set<() => void>();
let snapshot = false;

function emit() {
  snapshot = [...sources.values()].includes('mock');
  listeners.forEach((l) => l());
}

export function reportSource(id: string, source: DataSource | null) {
  if (source === null) sources.delete(id);
  else sources.set(id, source);
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAnyMock(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => false,
  );
}
