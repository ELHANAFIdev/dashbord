'use client';
import {
  BellRing,
  BrainCircuit,
  Building2,
  CalendarRange,
  Clock,
  ClipboardCheck,
  HeartPulse,
  LayoutGrid,
  ListChecks,
  Map as MapIcon,
  SearchCheck,
  Sigma,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRpc } from '@/client/rpc';
import { DATA_DAY, DETAIL_FROM } from '@/lib/constants';
import { fmtInt } from '@/lib/format';
import type { Anomaly, CategoryRow, EventRow } from '@/lib/types';
import { cx } from '../ui/primitives';

type BadgeKey = 'redlist' | 'alerts' | 'anomalies';
interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: BadgeKey;
}

export const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Pilotage',
    items: [
      { href: '/', label: 'Vue d’ensemble', icon: LayoutGrid },
      { href: '/carte', label: 'Carte', icon: MapIcon },
      { href: '/liste-rouge', label: 'Liste rouge', icon: ListChecks, badge: 'redlist' },
      { href: '/alertes', label: 'Alertes', icon: BellRing, badge: 'alerts' },
    ],
  },
  {
    group: 'Analyse',
    items: [
      { href: '/unites', label: 'Fiche unité', icon: Building2 },
      { href: '/affluence', label: 'Affluence', icon: Clock },
      { href: '/evolution', label: 'Évolution & population', icon: TrendingUp },
      { href: '/prevision', label: 'Prévision', icon: CalendarRange },
    ],
  },
  {
    group: 'Qualité & IA',
    items: [
      { href: '/anomalies', label: 'Anomalies & enquêtes', icon: SearchCheck, badge: 'anomalies' },
      { href: '/facteurs', label: 'Facteurs & causes', icon: Sigma },
      { href: '/statistiques', label: 'Problèmes de pratique', icon: ClipboardCheck },
      { href: '/second-avis', label: 'Second avis IA', icon: BrainCircuit },
    ],
  },
  { group: 'Système', items: [{ href: '/sante', label: 'Santé du système', icon: HeartPulse }] },
];

export function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

function useBadges(): Record<BadgeKey, number | undefined> {
  const red = useRpc<CategoryRow[]>('sup_centre_category_list', { p_attention_only: true });
  const alerts = useRpc<EventRow[]>('ui_events', { p_status: 'open' });
  const anomalies = useRpc<Anomaly[]>('ui_anomalies', { p_du: DETAIL_FROM, p_au: DATA_DAY, p_statut: 'a_enqueter' });
  return { redlist: red.data?.length, alerts: alerts.data?.length, anomalies: anomalies.data?.length };
}

const BADGE_LABEL: Record<BadgeKey, string> = {
  redlist: 'unités à surveiller',
  alerts: 'alertes ouvertes',
  anomalies: 'anomalies à enquêter',
};

export function NavList({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  const badges = useBadges();
  return (
    <nav aria-label="Navigation principale" className="space-y-5">
      {NAV.map((g) => (
        <div key={g.group}>
          <p className="px-3 pb-1.5 text-[12px] font-medium text-ink-3">{g.group}</p>
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              const n = item.badge ? badges[item.badge] : undefined;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cx(
                      'group relative flex items-center gap-2.5 rounded-md px-3 py-[7px] text-[14px] transition-colors',
                      active ? 'bg-accent-soft font-medium text-ink' : 'text-ink-2 hover:bg-sunken hover:text-ink',
                    )}
                  >
                    {active && <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-accent" />}
                    <Icon className={cx('h-[17px] w-[17px] shrink-0', active ? 'text-accent' : 'text-ink-3 group-hover:text-ink-2')} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {n !== undefined && n > 0 && (
                      <span
                        className={cx(
                          'num rounded-full px-1.5 text-[11px] font-semibold leading-[18px]',
                          item.badge === 'alerts' ? 'bg-crit-soft text-crit' : 'bg-sunken text-ink-2',
                        )}
                        aria-label={`${fmtInt(n)} ${BADGE_LABEL[item.badge as BadgeKey]}`}
                      >
                        {fmtInt(n)}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
