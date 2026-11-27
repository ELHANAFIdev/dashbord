import type { Metadata } from 'next';
import { PracticeView } from '@/components/screens/practice';

export const metadata: Metadata = { title: 'Problèmes de pratique' };

export default function Page() {
  return <PracticeView />;
}
