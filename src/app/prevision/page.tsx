import type { Metadata } from 'next';
import { ForecastView } from '@/components/screens/forecast';

export const metadata: Metadata = { title: 'Prévision' };

export default function Page() {
  return <ForecastView />;
}
