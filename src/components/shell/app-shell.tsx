'use client';
import { CircleAlert, CircleCheck, Menu, Moon, Sun, TriangleAlert, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRpc } from '@/client/rpc';
import { useSession } from '@/client/session';
import { useAnyMock } from '@/client/sources';
import { setTheme, useTheme } from '@/client/theme';
import { ROLE_LABELS } from '@/lib/roles';
import { fmtDay, fmtTime } from '@/lib/format';
import type { Dashboard, UserRole } from '@/lib/types';
import { NavList } from './nav';
import { selectClass } from '../ui/primitives';

function NavWithPath({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return <NavList pathname={pathname} onNavigate={onNavigate} />;
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  // usePathname attend l'URL sur les routes dynamiques (fiche unité) : repli sans élément actif.
  return (
    <Suspense fallback={<NavList pathname={null} />}>
      <NavWithPath onNavigate={onNavigate} />
    </Suspense>
  );
}

function SidebarFooter() {
  const { user } = useSession();
  return (
    <div className="mt-6 border-t border-line px-3 pt-4 text-[12px] text-ink-3">
      <p className="font-medium text-ink-2">{user.name}</p>
      <p>{ROLE_LABELS[user.role]}</p>
      {user.region && <p>Région : {user.region}</p>}
    </div>
  );
}

function ThemeToggle() {
  const theme = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line-strong bg-surface text-ink-2 hover:bg-sunken hover:text-ink"
      aria-label={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
      title={theme === 'dark' ? 'Thème clair' : 'Thème sombre'}
      data-testid="theme-toggle"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}

function RoleSelect() {
  const { user, setRole } = useSession();
  return (
    <label className="flex items-center gap-2 text-[13px] text-ink-2">
      <span className="hidden sm:inline">Profil</span>
      <select
        aria-label="Profil de démonstration"
        className={`${selectClass} max-w-[52vw] sm:max-w-none`}
        value={user.role}
        onChange={(e) => void setRole(e.target.value as UserRole)}
      >
        <option value="direction">Direction (Nabil)</option>
        <option value="coordinateur">Coordinateur régional</option>
        <option value="medecin_referent">Médecin référent (Dr Saad)</option>
        <option value="demo">Démonstration (lecture seule)</option>
      </select>
    </label>
  );
}

function DataStatus() {
  const { data, error } = useRpc<Dashboard>('ui_dashboard', {});
  if (error) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] text-crit">
        <CircleAlert className="h-4 w-4" aria-hidden="true" /> Base injoignable
      </span>
    );
  }
  if (!data) return <span className="text-[13px] text-ink-3">Chargement…</span>;
  const night = data.last_night;
  return (
    <div className="flex min-w-0 items-center gap-4 text-[13px] text-ink-2">
      <span className="truncate">
        Données au <strong className="font-semibold text-ink">{fmtDay(data.day)}</strong>
      </span>
      {night && (
        <span className={`hidden items-center gap-1.5 md:inline-flex ${night.ok ? 'text-ok' : 'text-crit'}`}>
          {night.ok ? <CircleCheck className="h-4 w-4" aria-hidden="true" /> : <TriangleAlert className="h-4 w-4" aria-hidden="true" />}
          <span>
            Passage de nuit {night.ok ? 'réussi' : 'en échec'} ({fmtTime(night.ended_at)})
          </span>
        </span>
      )}
    </div>
  );
}

function MockBanner() {
  const anyMock = useAnyMock();
  if (!anyMock) return null;
  return (
    <div role="status" className="mock-banner sticky top-14 z-20 border-b border-[color:var(--mock-stripe)]" data-testid="mock-banner">
      <div className="mx-auto flex max-w-[1360px] items-center gap-2 px-4 py-2 text-[13px] md:px-8">
        <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          <strong className="font-semibold tracking-wide">DONNÉES DE DÉMONSTRATION</strong>
          <span className="hidden sm:inline"> — chiffres fictifs, générés pour la démonstration. Ne pas les utiliser pour décider.</span>
        </p>
      </div>
    </div>
  );
}

function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label="Menu"
      className="m-0 h-dvh max-h-dvh w-[290px] max-w-[85vw] border-r border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="font-semibold">Menu</span>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-ink-2 hover:bg-sunken" aria-label="Fermer le menu">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div className="overflow-y-auto px-2 py-4">
        <Nav onNavigate={onClose} />
        <SidebarFooter />
      </div>
    </dialog>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#contenu" className="sr-only z-50 rounded-md bg-accent px-3 py-2 text-accent-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Aller au contenu
      </a>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface px-3 md:px-5">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-2 hover:bg-sunken lg:hidden"
          onClick={() => setMenu(true)}
          aria-label="Ouvrir le menu"
          aria-expanded={menu}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="flex shrink-0 items-center gap-2.5 lg:w-[232px]">
          <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden="true">
            <rect width="28" height="28" rx="7" fill="var(--accent)" />
            <path d="M8 15.5h3.2l1.8-4.5 2.4 8 1.9-5 1 1.5H20" fill="none" stroke="var(--accent-ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="hidden leading-tight sm:block">
            <p className="text-[14px] font-semibold text-ink">UMMC Supervision</p>
            <p className="hidden whitespace-nowrap text-[11px] text-ink-3 sm:block">Unités médicales mobiles</p>
          </div>
        </div>
        <div className="hidden min-w-0 flex-1 md:block">
          <DataStatus />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <RoleSelect />
          <ThemeToggle />
        </div>
      </header>
      <div className="flex flex-1">
        <div className="hidden w-[248px] shrink-0 border-r border-line bg-surface lg:block">
          <aside className="sticky top-14 h-[calc(100dvh-56px)] overflow-y-auto px-2 py-5">
            <Nav />
            <SidebarFooter />
          </aside>
        </div>
        <div className="min-w-0 flex-1">
          <MockBanner />
          <main id="contenu" tabIndex={-1} className="mx-auto max-w-[1360px] px-4 pb-16 pt-6 outline-none md:px-8">
            <div className="mb-4 md:hidden">
              <DataStatus />
            </div>
            {children}
          </main>
        </div>
      </div>
      <MobileNav open={menu} onClose={() => setMenu(false)} />
    </div>
  );
}
