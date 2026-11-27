import type { Metadata } from 'next';
import { AnomaliesView } from '@/components/screens/anomalies';

export const metadata: Metadata = { title: 'Anomalies & enquêtes' };

export default function Page() {
  return <AnomaliesView />;
}
