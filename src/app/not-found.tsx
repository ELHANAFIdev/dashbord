import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-[22px] font-semibold">Page introuvable</h1>
      <p className="mt-2 text-ink-2">Cette adresse ne correspond à aucun écran du tableau de bord.</p>
      <Link href="/" className="mt-4 inline-block font-medium text-accent hover:underline">
        Revenir à la vue d’ensemble
      </Link>
    </div>
  );
}
