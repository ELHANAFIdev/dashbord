import type { Metadata } from 'next';
import { AffluenceView } from '@/components/screens/affluence';

export const metadata: Metadata = { title: 'Affluence' };

export default function Page() {
  return <AffluenceView />;
}
