'use client';
import type { ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { fmtDayWeek, isSunday } from '@/lib/format';
import type { Prevision } from '@/lib/types';
import { Skeleton } from '../ui/primitives';
import { baseOptions, useChartTokens } from './tokens';

const BOUNDS = new Set(['Borne haute (90 %)', 'Borne basse (90 %)']);

/** Prévision à 14 jours : intervalle à 90 % (bande), valeur prévue, référence. */
export function ForecastChart({ jours: all, height = 260 }: { jours: Prevision['jours']; height?: number }) {
  const t = useChartTokens();
  // Dimanches retirés du tracé (unités fermées) ; ils restent dans le tableau.
  const jours = all.filter((j) => !(isSunday(j.jour) && !j.prevu));
  if (!t) return <Skeleton style={{ height }} />;
  const base = baseOptions(t, { legend: true, yMin: 0 });
  const options: ChartOptions<'line'> = {
    ...base,
    plugins: {
      ...base.plugins,
      legend: {
        ...base.plugins?.legend,
        labels: { ...base.plugins?.legend?.labels, filter: (item) => !BOUNDS.has(item.text) },
      },
    },
  };
  const hasRef = jours.some((j) => j.reference !== null && j.reference !== undefined);
  return (
    <div style={{ height }}>
      <Line
        role="img"
        aria-label="Prévision des consultations sur quatorze jours avec intervalle"
        options={options}
        data={{
          labels: jours.map((j) => fmtDayWeek(j.jour)),
          datasets: [
            { label: 'Borne haute (90 %)', data: jours.map((j) => j.haut), borderWidth: 0, pointRadius: 0, pointHoverRadius: 0, fill: '+1', backgroundColor: t.band, borderColor: 'transparent' },
            { label: 'Borne basse (90 %)', data: jours.map((j) => j.bas), borderWidth: 0, pointRadius: 0, pointHoverRadius: 0, fill: false, borderColor: 'transparent' },
            {
              label: 'Prévision',
              data: jours.map((j) => j.prevu),
              borderColor: t.series1,
              backgroundColor: t.series1,
              borderWidth: 2,
              pointRadius: 3,
              pointHoverRadius: 5,
              tension: 0.2,
            },
            ...(hasRef
              ? [
                  {
                    label: 'Référence (8 mêmes jours)',
                    data: jours.map((j) => j.reference),
                    borderColor: t.ink3,
                    backgroundColor: t.ink3,
                    borderWidth: 1.5,
                    borderDash: [4, 4],
                    pointRadius: 0,
                    tension: 0.2,
                  },
                ]
              : []),
          ],
        }}
      />
    </div>
  );
}
