import type { Metadata } from 'next';
import { UnitsIndexView } from '@/components/screens/redlist';

export const metadata: Metadata = { title: 'Fiche unité' };

export default function Page() {
  return <UnitsIndexView />;
}
