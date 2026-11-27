import type { Metadata } from 'next';
import { Suspense } from 'react';
import { UnitView } from '@/components/screens/unit';
import { SkeletonBlock } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Fiche unité' };

async function UnitFromParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UnitView id={Number(id)} />;
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  // Sans generateStaticParams, l'identifiant n'est connu qu'à la requête : il est lu sous Suspense.
  return (
    <Suspense fallback={<SkeletonBlock rows={8} height={28} />}>
      <UnitFromParams params={params} />
    </Suspense>
  );
}
