'use client';
import { useMemo, useState } from 'react';
import { callRpc, invalidate, RpcError, useRpc } from '@/client/rpc';
import { useSession } from '@/client/session';
import { ANOMALY_STATUS_LABELS, ANOMALY_TYPE_LABELS, CONFIANCE_LABELS, DATA_DAY } from '@/lib/constants';
import { addDays, fmtDateTime, fmtDay, fmtDayWeek, fmtDec, fmtInt, fmtPct, plural } from '@/lib/format';
import { regionKey } from '@/lib/regions';
import type { Anomaly, AnomalyStatus, Cause, EnqueteResult } from '@/lib/types';
import { Drawer } from '../ui/drawer';
import { Button, Chip, DataGate, EmptyState, Field, Kpi, KpiBand, PageHeader, Panel, Select, SkeletonBlock, selectClass } from '../ui/primitives';
import { SortableTable, type Column } from '../ui/table';
import { AnomalyStatusChip, CauseOptions, ContextChips, RegionSelect, UnitLink } from './shared';

const PERIODS = [
  { value: '7', label: '7 derniers jours' },
  { value: '30', label: '30 derniers jours' },
  { value: '90', label: '90 derniers jours' },
];
const STATUSES: AnomalyStatus[] = ['a_enqueter', 'explique', 'confirme', 'ecarte'];

function confianceTone(c: string | null) {
  return c === 'forte' ? 'ok' : c === 'moyenne' ? 'info' : 'neutral';
}

function InvestigationDrawer({ anomaly, causes, onClose }: { anomaly: Anomaly | null; causes: Cause[] | undefined; onClose: () => void }) {
  const { can } = useSession();
  const [form, setForm] = useState<{ id: number; statut: string; cause: string; comment: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Le formulaire est initialisé à l'ouverture de chaque anomalie.
  const current =
    anomaly && form?.id === anomaly.id
      ? form
      : anomaly
        ? {
            id: anomaly.id,
            statut: anomaly.statut === 'a_enqueter' ? 'explique' : anomaly.statut,
            cause: anomaly.cause_confirmee ?? (anomaly.cause_code && anomaly.cause_code !== 'X' ? anomaly.cause_code : ''),
            comment: anomaly.commentaire ?? '',
          }
        : null;
  const set = (patch: Partial<NonNullable<typeof form>>) => current && setForm({ ...current, ...patch });

  const submit = async () => {
    if (!anomaly || !current) return;
    setBusy(true);
    setError(null);
    try {
      await callRpc<EnqueteResult>('ui_anomalie_enquete', {
        p_id: anomaly.id,
        p_statut: current.statut,
        p_cause_code: current.cause || undefined,
        p_commentaire: current.comment.trim() || undefined,
      });
      invalidate(['ui_anomalies', 'ui_evolution']);
      onClose();
    } catch (e) {
      setError(e instanceof RpcError ? e.message : 'Échec de l’enregistrement.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={Boolean(anomaly)}
      onClose={onClose}
      title="Enquête sur un jour anormal"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
          {can.investigate && (
            <Button onClick={submit} disabled={busy}>
              {busy ? 'Enregistrement…' : 'Enregistrer l’enquête'}
            </Button>
          )}
        </div>
      }
    >
      {anomaly && current && (
        <div className="space-y-5 text-[13px]">
          <div>
            <p className="text-[15px] font-semibold">{anomaly.centre_name}</p>
            <p className="text-ink-3">
              {anomaly.province}, {anomaly.region}, {fmtDayWeek(anomaly.jour)}
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-3 rounded-md bg-surface-2 p-3">
            <div>
              <dt className="text-ink-3">Observé</dt>
              <dd className="num text-[18px] font-semibold">{fmtDec(anomaly.observe, 0)}</dd>
            </div>
            <div>
              <dt className="text-ink-3">Attendu</dt>
              <dd className="num text-[18px] font-semibold">{fmtDec(anomaly.attendu, 0)}</dd>
            </div>
            <div>
              <dt className="text-ink-3">Écart</dt>
              <dd className="num text-[18px] font-semibold">{fmtPct(anomaly.ecart_pct, 0, true)}</dd>
            </div>
          </dl>
          <div>
            <p className="mb-1.5 font-medium">Contexte du jour</p>
            <ContextChips ctx={anomaly.contexte} />
          </div>
          <div>
            <p className="mb-1 font-medium">Cause proposée</p>
            <p>
              {anomaly.cause_code && anomaly.cause_code !== 'X' && <span className="num mr-1 text-ink-3">{anomaly.cause_code}</span>}
              {anomaly.cause_proposee ?? '—'}
            </p>
            {anomaly.confiance && (
              <Chip className="mt-1.5" tone={confianceTone(anomaly.confiance)}>
                {CONFIANCE_LABELS[anomaly.confiance] ?? anomaly.confiance}
              </Chip>
            )}
          </div>
          {anomaly.par && (
            <p className="text-ink-3">
              Dernière mise à jour par {anomaly.par}, {fmtDateTime(anomaly.maj)}.
            </p>
          )}

          {can.investigate ? (
            <fieldset className="space-y-4 border-t border-line pt-4">
              <legend className="sr-only">Résultat de l’enquête</legend>
              <div role="radiogroup" aria-label="Statut de l’enquête" className="grid grid-cols-2 gap-2">
                {STATUSES.map((s) => (
                  <label key={s} className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-2 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                    <input type="radio" name="statut" value={s} checked={current.statut === s} onChange={() => set({ statut: s })} className="accent-[var(--accent)]" />
                    {ANOMALY_STATUS_LABELS[s]}
                  </label>
                ))}
              </div>
              <Field label="Cause retenue (catalogue)">
                <select className={selectClass} value={current.cause} onChange={(e) => set({ cause: e.target.value })}>
                  <option value="">Aucune cause retenue</option>
                  {causes && <CauseOptions causes={causes} />}
                </select>
              </Field>
              <Field label="Commentaire">
                <textarea className={`${selectClass} h-24 py-2`} value={current.comment} maxLength={1000} onChange={(e) => set({ comment: e.target.value })} />
              </Field>
              {error && (
                <p role="alert" className="text-crit">
                  {error}
                </p>
              )}
            </fieldset>
          ) : (
            <p className="rounded-md border border-line px-3 py-2 text-ink-2">
              {can.readOnly ? 'Profil démonstration : consultation seule.' : 'Les enquêtes sont renseignées par la direction et les coordinateurs.'}
            </p>
          )}
        </div>
      )}
    </Drawer>
  );
}

export function AnomaliesView() {
  const { user } = useSession();
  const [period, setPeriod] = useState('30');
  const [type, setType] = useState('');
  const [statut, setStatut] = useState('');
  const [region, setRegion] = useState('');
  const [open, setOpen] = useState<Anomaly | null>(null);
  const du = addDays(DATA_DAY, -(Number(period) - 1));
  const params: Record<string, unknown> = { p_du: du, p_au: DATA_DAY, p_limit: 2000 };
  if (type) params.p_type = type;
  const all = useRpc<Anomaly[]>('ui_anomalies', params);
  const causes = useRpc<Cause[]>('ui_causes', {});
  const regions = useMemo(() => [...new Set((all.data ?? []).map((a) => a.region))].sort((a, b) => a.localeCompare(b, 'fr')), [all.data]);
  const inRegion = useMemo(() => (all.data ?? []).filter((a) => !region || regionKey(a.region) === regionKey(region)), [all.data, region]);
  const rows = useMemo(() => inRegion.filter((a) => !statut || a.statut === statut), [inRegion, statut]);
  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, inRegion.filter((a) => a.statut === s).length])), [inRegion]);

  const columns: Column<Anomaly>[] = [
    { key: 'jour', header: 'Jour', sort: (a) => a.jour, render: (a) => <span className="num whitespace-nowrap">{fmtDayWeek(a.jour)}</span> },
    {
      key: 'unit',
      header: 'Unité et type',
      sort: (a) => a.centre_name,
      render: (a) => (
        <div className="min-w-[170px]">
          <UnitLink id={a.centre_id} name={a.centre_name} />
          <p className="text-[12px] text-ink-3">
            {a.province}, {ANOMALY_TYPE_LABELS[a.type]?.toLowerCase() ?? a.type}
          </p>
        </div>
      ),
    },
    {
      key: 'ecart',
      header: 'Observé / attendu',
      sort: (a) => a.ecart_pct,
      align: 'right',
      render: (a) => (
        <div className="whitespace-nowrap">
          <span>
            {fmtDec(a.observe, 0)} <span className="text-ink-3">/ {fmtDec(a.attendu, 0)}</span>
          </span>
          <p className={`text-[12px] ${a.ecart_pct !== null && a.ecart_pct < 0 ? 'text-crit' : 'text-ok'}`}>{fmtPct(a.ecart_pct, 0, true)}</p>
        </div>
      ),
    },
    { key: 'ctx', header: 'Contexte', render: (a) => <ContextChips ctx={a.contexte} />, className: 'min-w-[200px] max-w-[320px]' },
    {
      key: 'cause',
      header: 'Cause proposée',
      sort: (a) => a.cause_code,
      render: (a) => (
        <div className="min-w-[180px] max-w-[260px] text-[13px]">
          <p>{a.cause_proposee ?? '—'}</p>
          {a.confiance && (
            <Chip className="mt-1" tone={confianceTone(a.confiance)}>
              {CONFIANCE_LABELS[a.confiance] ?? a.confiance}
            </Chip>
          )}
        </div>
      ),
    },
    {
      key: 'statut',
      header: 'Statut',
      sort: (a) => a.statut,
      render: (a) => (
        <div className="flex flex-col items-start gap-1.5">
          <AnomalyStatusChip statut={a.statut} />
          <Button size="sm" variant="secondary" onClick={() => setOpen(a)}>
            {a.statut === 'a_enqueter' ? 'Enquêter' : 'Voir'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Anomalies & enquêtes"
        description="Jours où une unité s’écarte nettement de son habitude (médiane des 8 mêmes jours de semaine). Confirmez ou corrigez la cause proposée : chaque réponse enrichit l’historique."
      />
      <KpiBand loading={!all.data && !all.error} count={4}>
        {STATUSES.map((s) => (
          <Kpi key={s} label={ANOMALY_STATUS_LABELS[s]} value={fmtInt(counts[s] ?? 0)} tone={s === 'a_enqueter' && counts[s] ? 'warn' : undefined} detail={`du ${fmtDay(du)} au ${fmtDay(DATA_DAY)}`} />
        ))}
      </KpiBand>
      <Panel
        className="mt-6"
        title={all.data ? plural(rows.length, 'jour anormal', 'jours anormaux') : 'Jours anormaux'}
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <Select label="Période" value={period} onChange={setPeriod} options={PERIODS} />
            {!user.region && <RegionSelect value={region} onChange={setRegion} regions={regions} />}
            <Select
              label="Type"
              value={type}
              onChange={setType}
              options={[{ value: '', label: 'Tous les types' }, ...Object.entries(ANOMALY_TYPE_LABELS).map(([value, label]) => ({ value, label }))]}
            />
            <Select
              label="Statut"
              value={statut}
              onChange={setStatut}
              options={[{ value: '', label: 'Tous les statuts' }, ...STATUSES.map((s) => ({ value: s, label: ANOMALY_STATUS_LABELS[s] }))]}
            />
          </div>
        }
      >
        <DataGate state={all} skeleton={<SkeletonBlock rows={8} height={30} />}>
          {() => (
            <SortableTable
              caption="Jours anormaux"
              columns={columns}
              rows={rows}
              rowKey={(a) => a.id}
              initialSort={{ key: 'jour', dir: 'desc' }}
              empty={<EmptyState title="Aucun jour anormal">Aucune anomalie ne correspond aux filtres choisis.</EmptyState>}
              maxHeight={720}
            />
          )}
        </DataGate>
      </Panel>
      <InvestigationDrawer anomaly={open} causes={causes.data} onClose={() => setOpen(null)} />
    </>
  );
}
