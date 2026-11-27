'use client';
import { CircleCheck, CircleX } from 'lucide-react';
import { useRpc } from '@/client/rpc';
import { fmtDateTime, fmtDay, fmtInt, plural } from '@/lib/format';
import type { Health, HealthNight } from '@/lib/types';
import { Chip, DataGate, EmptyState, Kpi, KpiBand, PageHeader, Panel, SkeletonBlock } from '../ui/primitives';
import { SortableTable, type Column } from '../ui/table';

function OkIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-ok">
      <CircleCheck className="h-4 w-4" aria-hidden="true" /> Réussi
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-crit">
      <CircleX className="h-4 w-4" aria-hidden="true" /> Échec
    </span>
  );
}

/** Les étapes d'un passage de nuit, quelle que soit leur forme (liste, objet ou nombre). */
function Steps({ steps }: { steps: unknown }) {
  if (Array.isArray(steps)) {
    return (
      <div className="flex flex-wrap gap-1">
        {steps.map((s, i) => {
          if (s && typeof s === 'object') {
            const o = s as Record<string, unknown>;
            const name = String(o.etape ?? o.step ?? o.name ?? `Étape ${i + 1}`);
            const ok = o.ok !== false && o.status !== 'error';
            const dur = typeof o.duree_s === 'number' ? ` (${fmtInt(o.duree_s)} s)` : '';
            return (
              <Chip key={i} tone={ok ? 'neutral' : 'crit'}>
                {ok ? '' : 'Échec : '}
                {name}
                {dur}
              </Chip>
            );
          }
          return <Chip key={i}>{String(s)}</Chip>;
        })}
      </div>
    );
  }
  if (typeof steps === 'number') return <span>{plural(steps, 'étape', 'étapes')}</span>;
  if (steps && typeof steps === 'object') {
    return (
      <div className="flex flex-wrap gap-1">
        {Object.entries(steps as Record<string, unknown>).map(([k, v]) => (
          <Chip key={k}>
            {k} : {typeof v === 'object' ? JSON.stringify(v) : String(v)}
          </Chip>
        ))}
      </div>
    );
  }
  return <span className="text-ink-3">—</span>;
}

export function HealthView() {
  const health = useRpc<Health>('ui_health', {});
  const nightCols: Column<HealthNight>[] = [
    { key: 'start', header: 'Début', sort: (n) => n.started_at, render: (n) => <span className="num whitespace-nowrap">{fmtDateTime(n.started_at)}</span> },
    { key: 'end', header: 'Fin', render: (n) => <span className="num whitespace-nowrap">{fmtDateTime(n.ended_at)}</span> },
    { key: 'ok', header: 'Résultat', sort: (n) => Number(n.ok), render: (n) => <OkIcon ok={n.ok} /> },
    { key: 'steps', header: 'Étapes', render: (n) => <Steps steps={n.steps} />, className: 'min-w-[320px]' },
  ];
  type Delivery = Health['last_deliveries'][number];
  const delCols: Column<Delivery>[] = [
    { key: 'at', header: 'Envoyé le', sort: (d) => d.sent_at, render: (d) => <span className="num whitespace-nowrap">{fmtDateTime(d.sent_at)}</span> },
    { key: 'ch', header: 'Canal', render: (d) => d.channel },
    { key: 'to', header: 'Destinataire', render: (d) => d.recipient },
    { key: 'ok', header: 'Résultat', render: (d) => <OkIcon ok={d.ok} /> },
    { key: 'ev', header: 'Alerte', align: 'right', render: (d) => (d.event_id ? `n° ${d.event_id}` : 'synthèse') },
  ];
  type Load = Health['context_loads'][number];
  const loadCols: Column<Load>[] = [
    { key: 'ds', header: 'Jeu de données', render: (l) => l.dataset },
    { key: 'at', header: 'Chargé le', sort: (l) => l.loaded_at, render: (l) => <span className="num whitespace-nowrap">{fmtDateTime(l.loaded_at)}</span> },
    { key: 'n', header: 'Lignes', align: 'right', render: (l) => fmtInt(l.n_rows) },
    { key: 'st', header: 'État', render: (l) => <Chip tone={l.status === 'ok' ? 'ok' : 'warn'}>{l.status === 'ok' ? 'À jour' : l.status}</Chip> },
  ];

  return (
    <>
      <PageHeader title="Santé du système" description="Passages de nuit, envois de notifications et chargement des données de contexte." />
      <DataGate state={health} skeleton={<SkeletonBlock rows={8} height={26} />}>
        {(h) => {
          const last = h.nights[0];
          const failedNights = h.nights.filter((n) => !n.ok).length;
          const failedSends = h.last_deliveries.filter((d) => !d.ok).length;
          const lateLoads = h.context_loads.filter((l) => l.status !== 'ok').length;
          return (
            <>
              <KpiBand>
                <Kpi label="Dernier jour de données" value={<span className="text-[22px]">{fmtDay(h.data_last_day)}</span>} />
                <Kpi label="Dernier passage de nuit" value={last ? (last.ok ? 'Réussi' : 'En échec') : '—'} tone={last ? (last.ok ? 'ok' : 'crit') : undefined} detail={last ? fmtDateTime(last.ended_at ?? last.started_at) : undefined} />
                <Kpi label="Nuits en échec" value={fmtInt(failedNights)} tone={failedNights ? 'warn' : undefined} detail={`sur ${plural(h.nights.length, 'nuit', 'nuits')} affichées`} />
                <Kpi label="Envois en échec" value={fmtInt(failedSends)} tone={failedSends ? 'crit' : undefined} detail={`sur ${plural(h.last_deliveries.length, 'envoi', 'envois')}`} />
                <Kpi label="Contexte en retard" value={fmtInt(lateLoads)} tone={lateLoads ? 'warn' : undefined} detail={`sur ${plural(h.context_loads.length, 'jeu', 'jeux')} de données`} />
              </KpiBand>
              <Panel className="mt-6" title="Passages de nuit">
                {h.nights.length ? <SortableTable caption="Passages de nuit" columns={nightCols} rows={h.nights} rowKey={(n) => n.run_id} initialSort={{ key: 'start', dir: 'desc' }} /> : <EmptyState title="Aucun passage enregistré" />}
              </Panel>
              <div className="mt-6 grid gap-6">
                <Panel title="Derniers envois">
                  {h.last_deliveries.length ? <SortableTable caption="Derniers envois" columns={delCols} rows={h.last_deliveries} rowKey={(d) => `${d.sent_at}-${d.recipient}`} initialSort={{ key: 'at', dir: 'desc' }} /> : <EmptyState title="Aucun envoi" />}
                </Panel>
                <Panel title="Données de contexte">
                  {h.context_loads.length ? <SortableTable caption="Chargements de contexte" columns={loadCols} rows={h.context_loads} rowKey={(l) => l.dataset} /> : <EmptyState title="Aucun chargement" />}
                </Panel>
              </div>
            </>
          );
        }}
      </DataGate>
    </>
  );
}
