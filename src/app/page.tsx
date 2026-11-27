import type { Metadata } from 'next';
import { HomeView } from '@/components/screens/home';

export const metadata: Metadata = { title: 'Vue d’ensemble' };

export default function Page() {
  return <HomeView />;
}
