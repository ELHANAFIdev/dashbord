import type { Metadata } from 'next';
import { FactorsView } from '@/components/screens/factors';

export const metadata: Metadata = { title: 'Facteurs & causes' };

export default function Page() {
  return <FactorsView />;
}
