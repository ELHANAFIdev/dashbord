import type { Metadata } from 'next';
import { HealthView } from '@/components/screens/health';

export const metadata: Metadata = { title: 'Santé du système' };

export default function Page() {
  return <HealthView />;
}
