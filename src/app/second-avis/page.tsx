import type { Metadata } from 'next';
import { SecondOpinionView } from '@/components/screens/second-opinion';

export const metadata: Metadata = { title: 'Second avis IA' };

export default function Page() {
  return <SecondOpinionView />;
}
