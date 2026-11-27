'use client';
import { useMemo, useState } from 'react';
import { callRpc, invalidate, RpcError, useRpc } from '@/client/rpc';
import { useSession } from '@/client/session';
import { signalLabel } from '@/lib/constants';
import { fmtDateTime, fmtDayShort, fmtDec, fmtInt, plural } from '@/lib/format';
import { regionKey } from '@/lib/regions';
import type { AckResult, Cause, EventRow } from '@/lib/types';
import { Drawer } from '../ui/drawer';
import { Button, DataGate, EmptyState, Field, PageHeader, Panel, Segmented, SkeletonBlock, selectClass } from '../ui/primitives';
import { SortableTable, type Column } from '../ui/table';
import { CauseOptions, EventStatusChip, RegionSelect, SeverityChip, UnitLink } from './shared';

type StatusFilter = 'open' | 'explained' | 'resolved' | 'all';
const SEV: Record<string, number> = { high: 0, medium: 1, low: 2 };

function AckDrawer({ event, onClose }: { event: EventRow | null; onClose: () => void }) {
  const causes = useRpc<Cause[]>('ui_causes', event ? {} : null);
  const [cause, setCause] = useState('');
  const [comment, setComment] = useState('');
  const [resolve, setResolve] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!event) return;
    if (!cause && !comment.trim()) {
      setError('Choisissez une cause ou décrivez-la en quelques mots.');
      return;
    }
    setBusy(true);
    setError(null);
    const label = causes.data?.find((c) => c.code === cause)?.libelle;
    const text = [cause && label ? `${cause} ${label}` : '', comment.trim()].filter(Boolean).join(' : ');
    try {
      await callRpc<AckResult>('sup_event_ack', { p_id: event.id, p_cause: text, p_resolve: resolve });
      invalidate(['ui_events', 'ui_dashboard', 'ui_map', 'ui_centre_detail', 'sup_centre_category_list']);
      setCause('');
      setComment('');
      setResolve(false);
      onClose();
    } catch (e) {
      setError(e instanceof RpcError ? e.message : 'Échec de l’enregistrement.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={Boolean(event)}
      onClose={onClose}
      title="Acquitter l’alerte"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? 'Enregistrement…' : resolve ? 'Acquitter et résoudre' : 'Acquitter'}
          </Button>
        </div>
      }
    >
      {event && (
        <div className="space-y-4">
          <div className="rounded-md bg-surface-2 p-3 text-[13px]">
            <p className="font-medium">{event.centre_name}</p>
            <p className="text-ink-3">
              {event.province}, {event.region}
            </p>
            <p className="mt-2">
              {signalLabel(event.signal_type)} : {event.message}
            </p>
          </div>
          <Field label="Cause (catalogue)">
            <select className={selectClass} value={cause} onChange={(e) => setCause(e.target.value)}>
              <option value="">Choisir une cause…</option>
              {causes.data && <CauseOptions causes={causes.data} />}
            </select>
          </Field>
          {causes.error && <p className="text-[12px] text-crit">Catalogue indisponible : {causes.error.message}</p>}
          <Field label="Précision (facultatif)">
            <textarea className={`${selectClass} h-24 py-2`} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
          </Field>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={resolve} onChange={(e) => setResolve(e.target.checked)} />
            Le problème est résolu
          </label>
          <p className="text-[12px] text-ink-3">L’auteur enregistré est celui de votre session, pas un nom saisi.</p>
          {error && (
            <p role="alert" className="text-[13px] text-crit">
              {error}
            </p>
          )}
        </div>
      )}
    </Drawer>
  );
}

export function AlertsView() {
  const { can, user } = useSession();
  const [status, setStatus] = useState<StatusFilter>('open');
  const [region, setRegion] = useState('');
  const events = useRpc<EventRow[]>('ui_events', { p_status: status });
  const [acking, setAcking] = useState<EventRow | null>(null);
  const regions = useMemo(() => [...new Set((events.data ?? []).map((e) => e.region))].sort((a, b) => a.localeCompare(b, 'fr')), [events.data]);
  const rows = useMemo(() => (events.data ?? []).filter((e) => !region || regionKey(e.region) === regionKey(region)), [events.data, region]);

  const columns: Column<EventRow>[] = [
    { key: 'sev', header: 'Gravité', sort: (e) => SEV[e.severity] ?? 3, render: (e) => <SeverityChip severity={e.severity} /> },
    {
      key: 'unit',
      header: 'Unité',
      sort: (e) => e.centre_name,
      render: (e) => (
        <div>
          <UnitLink id={e.centre_id} name={e.centre_name} />
          <p className="text-[12px] text-ink-3">{e.region}</p>
        </div>
      ),
    },
    {
      key: 'msg',
      header: 'Signal',
      render: (e) => (
        <div className="max-w-[420px]">
          <p className="font-medium">{signalLabel(e.signal_type)}</p>
          <p className="text-[13px] text-ink-2">{e.message}</p>
          {e.explanation && (
            <p className="mt-1 text-[12px] text-ink-3">
              Expliqué par {e.ack_by ?? '—'} le {fmtDateTime(e.ack_at)} : {e.explanation}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Dernière valeur',
      align: 'right',
      render: (e) => (
        <span>
          {fmtDec(e.last_value, 0)} <span className="text-ink-3">/ {fmtDec(e.last_expected, 0)}</span>
        </span>
      ),
    },
    { key: 'since', header: 'Depuis', sort: (e) => e.first_seen, align: 'right', render: (e) => fmtDayShort(e.first_seen) },
    { key: 'occ', header: 'Jours', sort: (e) => e.occurrences, align: 'right', render: (e) => fmtInt(e.occurrences) },
    { key: 'status', header: 'Statut', render: (e) => <EventStatusChip status={e.status} /> },
    {
      key: 'action',
      header: <span className="sr-only">Action</span>,
      render: (e) =>
        e.status === 'open' ? (
          <Button size="sm" variant="secondary" disabled={!can.acknowledge} onClick={() => setAcking(e)} title={can.acknowledge ? undefined : 'Votre profil ne peut pas acquitter'}>
            Acquitter
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Alertes"
        description="Signaux détectés chaque nuit. Acquittez une alerte en indiquant sa cause : elle sort de la liste des alertes ouvertes."
      />
      {!can.acknowledge && (
        <p className="mb-4 rounded-md border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink-2">
          {can.readOnly ? 'Profil démonstration : consultation seule.' : `Le profil « ${user.name} » consulte les alertes ; l’acquittement est réservé à la direction et aux coordinateurs.`}
        </p>
      )}
      <Panel
        title={events.data ? plural(rows.length, 'alerte', 'alertes') : 'Alertes'}
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <Segmented<StatusFilter>
              label="Statut des alertes"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'open', label: 'Ouvertes' },
                { value: 'explained', label: 'Expliquées' },
                { value: 'resolved', label: 'Résolues' },
                { value: 'all', label: 'Toutes' },
              ]}
            />
            {!user.region && <RegionSelect value={region} onChange={setRegion} regions={regions} />}
          </div>
        }
      >
        <DataGate state={events} skeleton={<SkeletonBlock rows={8} height={30} />}>
          {() => (
            <SortableTable
              caption="Alertes"
              columns={columns}
              rows={rows}
              rowKey={(e) => e.id}
              initialSort={{ key: 'sev', dir: 'asc' }}
              empty={<EmptyState title="Aucune alerte">Aucune alerte ne correspond à ce filtre.</EmptyState>}
            />
          )}
        </DataGate>
      </Panel>
      <AckDrawer event={acking} onClose={() => setAcking(null)} />
    </>
  );
}
