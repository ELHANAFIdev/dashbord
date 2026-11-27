import type { Metadata } from 'next';
import { MapView } from '@/components/screens/map';

export const metadata: Metadata = { title: 'Carte' };

export default function Page() {
  return <MapView />;
}
