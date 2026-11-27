import type { Metadata } from 'next';
import { AlertsView } from '@/components/screens/alerts';

export const metadata: Metadata = { title: 'Alertes' };

export default function Page() {
  return <AlertsView />;
}
