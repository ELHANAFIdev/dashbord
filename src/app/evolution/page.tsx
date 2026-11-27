import type { Metadata } from 'next';
import { EvolutionView } from '@/components/screens/evolution';

export const metadata: Metadata = { title: 'Évolution & population' };

export default function Page() {
  return <EvolutionView />;
}
