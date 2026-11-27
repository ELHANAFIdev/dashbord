'use client';
import { useMemo, useState } from 'react';
import { useRpc } from '@/client/rpc';
import { EVOLUTION_STATUS_LABELS } from '@/lib/constants';
import { fmtDec, fmtInt, fmtPct, plural } from '@/lib/format';
import { regionKey } from '@/lib/regions';
import type { EvolutionRow, PopulationRow } from '@/lib/types';
import { Chip, DataGate, EmptyState, Kpi, KpiBand, PageHeader, Panel, Segmented, SkeletonBlock, type Tone } from '../ui/primitives';
import { SortableTable, type Column } from '../ui/table';
import { RegionSelect, UnitLink } from './shared';

const STATUS_ORDER = ['a_risque', 'declin', 'nouveau', 'stable', 'croissance', 'inactif'];
const statusTone = (s: string): Tone => (s === 'a_risque' ? 'crit' : s === 'declin' ? 'warn' : s === 'croissance' ? 'ok' : s === 'nouveau' ? 'info' : 'neutral');
const NATIONAL_POPULATION = 36828330;

type Tab = 'unites' | 'provinces';

export function EvolutionView() {
  const evo = useRpc<EvolutionRow[]>('ui_evolution', {});
  const pop = useRpc<PopulationRow[]>('ui_population', {});
  const [tab, setTab] = useState<Tab>('unites');
  const [statut, setStatut] = useState('');
  const [region, setRegion] = useState('');
  const regions = useMemo(() => [...new Set((evo.data ?? []).map((r) => r.region))].sort((a, b) => a.localeCompare(b, 'fr')), [evo.data]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of evo.data ?? []) c[r.statut] = (c[r.statut] ?? 0) + 1;
    return c;
  }, [evo.data]);
  const rows = useMemo(
    () => (evo.data ?? []).filter((r) => (!statut || r.statut === statut) && (!region || regionKey(r.region) === regionKey(region))),
    [evo.data, statut, region],
  );
  const popRows = useMemo(() => (pop.data ?? []).filter((r) => !region || regionKey(r.region) === regionKey(region)), [pop.data, region]);

  const unitCols: Column<EvolutionRow>[] = [
    {
      key: 'name',
      header: 'Unité',
      sort: (r) => r.centre_name,
      render: (r) => (
        <div className="min-w-[160px]">
          <UnitLink id={r.centre_id} name={r.centre_name} />
          <p className="text-[12px] text-ink-3">
            {r.province}, {r.region}
          </p>
        </div>
      ),
    },
    { key: 'statut', header: 'Statut', sort: (r) => STATUS_ORDER.indexOf(r.statut), render: (r) => <Chip tone={statusTone(r.statut)}>{EVOLUTION_STATUS_LABELS[r.statut] ?? r.statut}</Chip> },
    {
      key: 'trend',
      header: 'Tendance / an',
      sort: (r) => r.tendance_pct_an,
      align: 'right',
      render: (r) => <span className={r.tendance_pct_an !== null && r.tendance_pct_an <= -15 ? 'text-crit' : ''}>{fmtPct(r.tendance_pct_an, 1, true)}</span>,
    },
    { key: 'pj', header: 'Par jour (3 mois)', sort: (r) => r.par_jour_3_derniers_mois, align: 'right', render: (r) => fmtDec(r.par_jour_3_derniers_mois, 1) },
    { key: 'prev', header: 'Projection 3 mois', sort: (r) => r.prevision_3_mois, align: 'right', render: (r) => fmtDec(r.prevision_3_mois, 1) },
    {
      key: 'p1000',
      header: 'Pour 1 000 hab.',
      sort: (r) => r.pour_1000_hab_an,
      align: 'right',
      render: (r) => (
        <span className={r.mediane_reseau_pour_1000 && r.pour_1000_hab_an !== null && r.pour_1000_hab_an < r.mediane_reseau_pour_1000 / 2 ? 'text-warn' : ''}>
          {fmtDec(r.pour_1000_hab_an, 0)}
        </span>
      ),
    },
    {
      key: 'sig',
      header: 'Signaux et recommandation',
      render: (r) => (
        <div className="min-w-[260px] max-w-[420px]">
          {r.recommandation && <p className="text-[13px] font-medium text-ink">{r.recommandation}</p>}
          {r.signaux?.length ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] text-ink-2">
              {r.signaux.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ),
    },
  ];

  const popCols: Column<PopulationRow>[] = [
    {
      key: 'prov',
      header: 'Province',
      sort: (r) => r.province,
      render: (r) => (
        <div>
          <p className="font-medium">{r.province}</p>
          <p className="text-[12px] text-ink-3">{r.region}</p>
        </div>
      ),
    },
    { key: 'pop', header: 'Population', sort: (r) => r.population, align: 'right', render: (r) => fmtInt(r.population) },
    { key: 'rur', header: 'Dont rurale', sort: (r) => r.population_rurale, align: 'right', render: (r) => fmtInt(r.population_rurale) },
    { key: 'men', header: 'Ménages', sort: (r) => r.menages, align: 'right', render: (r) => fmtInt(r.menages) },
    { key: 'u', header: 'Unités', sort: (r) => r.centres, align: 'right', render: (r) => fmtInt(r.centres) },
    { key: 'hpu', header: 'Habitants par unité', sort: (r) => r.habitants_par_unite, align: 'right', render: (r) => fmtInt(r.habitants_par_unite) },
    { key: 'c12', header: 'Consultations 12 mois', sort: (r) => r.consultations_12_mois, align: 'right', render: (r) => fmtInt(r.consultations_12_mois) },
    { key: 'p1000', header: 'Pour 1 000 hab.', sort: (r) => r.pour_1000_hab_an, align: 'right', render: (r) => fmtDec(r.pour_1000_hab_an, 1) },
    { key: 'cov', header: 'Couverture', sort: (r) => r.couverture_pct, align: 'right', render: (r) => fmtPct(r.couverture_pct, 1) },
  ];

  const covered = popRows.reduce((a, r) => a + (r.population ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Évolution & population"
        description="Tendance de chaque unité sur 12 mois et fréquentation rapportée à la population (RGPH 2024), avec une recommandation d’action."
        actions={
          <Segmented<Tab>
            label="Vue"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'unites', label: 'Unités' },
              { value: 'provinces', label: 'Provinces' },
            ]}
          />
        }
      />
      {tab === 'unites' ? (
        <>
          <KpiBand loading={!evo.data && !evo.error}>
            {['croissance', 'stable', 'declin', 'a_risque', 'nouveau'].map((s) => (
              <Kpi
                key={s}
                label={EVOLUTION_STATUS_LABELS[s]}
                value={fmtInt(counts[s] ?? 0)}
                tone={s === 'a_risque' && counts[s] ? 'crit' : s === 'declin' && counts[s] ? 'warn' : undefined}
                detail={s === 'nouveau' && counts.inactif ? `et ${plural(counts.inactif, 'unité inactive', 'unités inactives')}` : 'unités'}
              />
            ))}
          </KpiBand>
          <Panel
            className="mt-6"
            title={evo.data ? plural(rows.length, 'unité', 'unités') : 'Unités'}
            actions={
              <div className="flex flex-wrap items-end gap-3">
                <RegionSelect value={region} onChange={setRegion} regions={regions} />
                <label className="flex flex-col gap-1 text-[12px] font-medium text-ink-2">
                  Statut
                  <select className="h-9 rounded-md border border-line-strong bg-surface px-2.5 text-[14px] font-normal text-ink" value={statut} onChange={(e) => setStatut(e.target.value)}>
                    <option value="">Tous les statuts</option>
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {EVOLUTION_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            }
          >
            <DataGate state={evo} skeleton={<SkeletonBlock rows={8} height={30} />}>
              {() => (
                <SortableTable
                  caption="Évolution des unités"
                  columns={unitCols}
                  rows={rows}
                  rowKey={(r) => r.centre_id}
                  initialSort={{ key: 'statut', dir: 'asc' }}
                  empty={<EmptyState title="Aucune unité pour ces filtres" />}
                  maxHeight={720}
                />
              )}
            </DataGate>
            <p className="mt-3 text-[12px] text-ink-3">
              Pour 1 000 habitants : consultations sur 12 mois rapportées à la population de la province divisée par le nombre d’unités qui la desservent. Projection : consultations par jour ouvré dans 3 mois.
            </p>
          </Panel>
        </>
      ) : (
        <Panel
          title={pop.data ? plural(popRows.length, 'province desservie', 'provinces desservies') : 'Provinces'}
          description={pop.data ? `Population couverte : ${fmtInt(covered)} habitants, soit ${fmtPct((covered / NATIONAL_POPULATION) * 100, 1)} de la population nationale (${fmtInt(NATIONAL_POPULATION)}).` : undefined}
          actions={<RegionSelect value={region} onChange={setRegion} regions={[...new Set((pop.data ?? []).map((r) => r.region))].sort((a, b) => a.localeCompare(b, 'fr'))} />}
        >
          <DataGate state={pop} skeleton={<SkeletonBlock rows={8} height={26} />}>
            {() => <SortableTable caption="Population par province" columns={popCols} rows={popRows} rowKey={(r) => `${r.region}-${r.province}`} initialSort={{ key: 'p1000', dir: 'asc' }} maxHeight={720} />}
          </DataGate>
          <p className="mt-3 text-[12px] text-ink-3">Source : {pop.data?.[0]?.source ?? 'HCP, RGPH 2024 (population légale)'}. Couverture : patients distincts sur 12 mois rapportés à la population.</p>
        </Panel>
      )}
    </>
  );
}
