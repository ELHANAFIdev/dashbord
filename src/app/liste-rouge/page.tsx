import type { Metadata } from 'next';
import { RedListView } from '@/components/screens/redlist';

export const metadata: Metadata = { title: 'Liste rouge' };

export default function Page() {
  return <RedListView />;
}
