// Écritures de démonstration conservées en mémoire du serveur (perdues au redémarrage).
// En mode réel, seules les validations de second avis (so_review) passent par ici.
import type { ReviewVerdict } from '@/lib/types';

export interface AckRecord {
  status: 'explained' | 'resolved';
  explanation: string | null;
  explanation_source: string;
  ack_by: string;
  ack_at: string;
}
export interface EnqueteRecord {
  statut: string;
  cause_confirmee: string | null;
  commentaire: string | null;
  par: string;
  maj: string;
}
export interface ReviewRecord {
  verdict: ReviewVerdict;
  comment: string;
  by: string;
  at: string;
}

interface Store {
  acks: Map<number, AckRecord>;
  enquetes: Map<number, EnqueteRecord>;
  reviews: Map<string, ReviewRecord>;
}

const g = globalThis as unknown as { __ummcStore?: Store };
export const store: Store = (g.__ummcStore ??= { acks: new Map(), enquetes: new Map(), reviews: new Map() });

export function resetStore() {
  store.acks.clear();
  store.enquetes.clear();
  store.reviews.clear();
}
