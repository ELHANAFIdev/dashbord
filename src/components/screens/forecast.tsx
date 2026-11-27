'use client';
import { CalendarDays, CloudRain, Store } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRpc } from '@/client/rpc';
import { fmtDateTime, fmtDayWeek, fmtDec, fmtInt, fmtSigned } from '@/lib/format';
import type { MapUnit, Prevision } from '@/lib/types';
import { ForecastChart } from '../charts/forecast-chart';
import { Chip, DataGate, EmptyState, Kpi, KpiBand, PageHeader, Panel, Skeleton, SkeletonBlock } from '../ui/primitives';
import { SortableTable, type Column } from '../ui/table';
import { UnitPicker } from './shared';

type Day = Prevision['jours'][number];
type Term = Prevision['equation'][number];

function DayFlags({ d }: { d: Day }) {
  const flags = [];
  if (d.ferie) flags.push(<Chip key="f" icon={<CalendarDays className="h-3 w-3" aria-hidden="true" />}>Jour férié</Chip>);
  if (d.souk) flags.push(<Chip key="s" icon={<Store className="h-3 w-3" aria-hidden="true" />}>{typeof d.souk === 'string' ? d.souk : 'Souk'}</Chip>);
  if (d.meteo) flags.push(<Chip key="m" tone="info" icon={<CloudRain className="h-3 w-3" aria-hidden="true" />}>{String(d.meteo)}</Chip>);
  return flags.length ? <div className="flex flex-wrap gap-1">{flags}</div> : <span className="text-ink-3">—</span>;
}

export function ForecastView() {
  const map = useRpc<MapUnit[]>('ui_map', {});
  const [picked, setPicked] = useState<number | null>(null);
  const defaultId = useMemo(() => {
    const units = map.data ?? [];
    return (units.find((u) => u.attention) ?? units[0])?.centre_id ?? null;
  }, [map.data]);
  const id = picked ?? defaultId;
  const prev = useRpc<Prevision>('ui_prevision', id ? { p_centre_id: id } : null);

  const dayCols: Column<Day>[] = [
    { key: 'jour', header: 'Jour', render: (d) => <span className="num whitespace-nowrap">{fmtDayWeek(d.jour)}</span> },
    { key: 'prevu', header: 'Prévu', align: 'right', render: (d) => <strong className="font-semibold">{fmtDec(d.prevu, 0)}</strong> },
    { key: 'int', header: 'Intervalle 90 %', align: 'right', render: (d) => `${fmtDec(d.bas, 0)} à ${fmtDec(d.haut, 0)}` },
    { key: 'ref', header: 'Référence', align: 'right', render: (d) => fmtDec(d.reference, 0) },
    { key: 'flags', header: 'Particularités', render: (d) => <DayFlags d={d} /> },
  ];
  const termCols: Column<Term>[] = [
    { key: 't', header: 'Terme', render: (t) => t.terme },
    { key: 'c', header: 'Coefficient', align: 'right', render: (t) => (t.coefficient === null ? '—' : fmtSigned(t.coefficient, 3)) },
    {
      key: 'e',
      header: 'Effet',
      align: 'right',
      sort: (t) => t.effet_pct,
      render: (t) => {
        const sig = t.ic_bas_pct !== null && t.ic_haut_pct !== null && (t.ic_bas_pct > 0 || t.ic_haut_pct < 0);
        return <span className={sig ? 'font-semibold' : 'text-ink-3'}>{t.effet_pct === null ? '—' : `${fmtSigned(t.effet_pct, 1)} %`}</span>;
      },
    },
    {
      key: 'ic',
      header: 'IC 95 %',
      align: 'right',
      render: (t) => (t.ic_bas_pct === null || t.ic_haut_pct === null ? '—' : `${fmtSigned(t.ic_bas_pct, 1)} à ${fmtSigned(t.ic_haut_pct, 1)} %`),
    },
    { key: 'n', header: 'Jours', align: 'right', sort: (t) => t.n_jours, render: (t) => fmtInt(t.n_jours) },
  ];

  return (
    <>
      <PageHeader
        title="Prévision"
        description="Consultations attendues sur 14 jours : la référence (médiane des 8 mêmes jours de semaine) corrigée par le calendrier et la météo."
        actions={<UnitPicker value={id} onChange={setPicked} />}
      />
      <DataGate state={prev} skeleton={<SkeletonBlock rows={6} height={28} />}>
        {(p) =>
          !p.modele ? (
            <Panel title={p.centre?.centre_name ?? 'Prévision'}>
              <EmptyState title="Modèle non encore ajusté">
                Aucune prévision tant que le modèle n’a pas été ajusté dans la base (étapes 5 et 6 du LISEZ-MOI des scripts).
              </EmptyState>
            </Panel>
          ) : (
            <>
              <KpiBand>
                <Kpi label="Erreur moyenne du modèle" value={`${fmtDec(p.modele.erreur_moyenne_pct, 1)} %`} detail="erreur absolue pondérée sur la période de test" />
                <Kpi
                  label="Erreur de la référence seule"
                  value={`${fmtDec(p.modele.erreur_reference_seule_pct, 1)} %`}
                  detail={
                    p.modele.erreur_reference_seule_pct !== null && p.modele.erreur_moyenne_pct !== null
                      ? `le modèle gagne ${fmtDec(p.modele.erreur_reference_seule_pct - p.modele.erreur_moyenne_pct, 1)} point(s)`
                      : 'comparaison indisponible'
                  }
                />
                <Kpi label="Jours de test" value={fmtInt(p.modele.n_jours_test)} detail="unité × jour mesurés hors ajustement" />
                <Kpi label="Version du modèle" value={<span className="text-[18px]">{p.modele.version}</span>} detail={`ajusté le ${fmtDateTime(p.modele.ajuste_le)}`} />
                <Kpi label="Somme prévue sur 14 jours" value={fmtInt(Math.round(p.jours.reduce((a, d) => a + (d.prevu ?? 0), 0)))} detail={p.centre.centre_name} />
              </KpiBand>
              <Panel className="mt-6" title={`${p.centre.centre_name}, ${p.centre.province}`} description="Bande : intervalle à 90 %. Les jours fériés sont prévus à zéro.">
                {p.jours.length ? <ForecastChart jours={p.jours} height={300} /> : <Skeleton className="h-[300px]" />}
                <div className="mt-5">
                  <SortableTable caption="Prévision jour par jour" columns={dayCols} rows={p.jours} rowKey={(d) => d.jour} dense />
                </div>
              </Panel>
              <Panel className="mt-6" title="Équation du modèle" description="log((consultations + 1) / (référence + 1)) = constante + somme des coefficients × facteurs présents. Effet en gras : intervalle qui ne croise pas zéro.">
                {p.equation.length ? (
                  <SortableTable caption="Termes de l’équation" columns={termCols} rows={p.equation} rowKey={(t) => t.terme} dense />
                ) : (
                  <EmptyState title="Équation indisponible" />
                )}
              </Panel>
            </>
          )
        }
      </DataGate>
    </>
  );
}
