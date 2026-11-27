'use client';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { useMemo, useSyncExternalStore } from 'react';
import { useTheme } from '@/client/theme';
import { NUMBER_LOCALE } from '@/lib/format';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);

export interface ChartTokens {
  ink: string;
  ink2: string;
  ink3: string;
  surface: string;
  grid: string;
  axis: string;
  series1: string;
  series2: string;
  band: string;
  crit: string;
  warn: string;
  ok: string;
  cat: Record<string, string>;
  font: string;
}

const noop = () => () => {};
/** Vrai une fois monté côté navigateur (les graphiques ne sont pas rendus côté serveur). */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

function css(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Couleurs lues dans les jetons CSS : elles suivent le thème actif. */
export function useChartTokens(): ChartTokens | null {
  const theme = useTheme();
  const mounted = useMounted();
  return useMemo(() => {
    if (!mounted) return null;
    void theme;
    return {
      ink: css('--ink'),
      ink2: css('--ink-2'),
      ink3: css('--ink-3'),
      surface: css('--surface'),
      grid: css('--grid'),
      axis: css('--axis'),
      series1: css('--series-1'),
      series2: css('--series-2'),
      band: css('--series-band'),
      crit: css('--crit'),
      warn: css('--warn'),
      ok: css('--ok'),
      cat: Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'n', 'x'].map((c) => [c.toUpperCase(), css(`--cat-${c}`)])),
      font: getComputedStyle(document.body).fontFamily,
    };
  }, [theme, mounted]);
}

const numberFmt = new Intl.NumberFormat(NUMBER_LOCALE, { maximumFractionDigits: 1 });

/** Options communes : axes discrets, une seule échelle, info-bulle au survol. */
export function baseOptions(t: ChartTokens, opts: { legend?: boolean; yTitle?: string; yMin?: number } = {}): ChartOptions<'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    layout: { padding: { top: 4, right: 8 } },
    plugins: {
      legend: {
        display: opts.legend ?? false,
        position: 'top',
        align: 'start',
        labels: { color: t.ink2, font: { family: t.font, size: 12 }, boxWidth: 14, boxHeight: 2, padding: 14, usePointStyle: false },
      },
      tooltip: {
        backgroundColor: t.surface,
        titleColor: t.ink,
        bodyColor: t.ink2,
        borderColor: t.axis,
        borderWidth: 1,
        padding: 10,
        titleFont: { family: t.font, weight: 600, size: 12 },
        bodyFont: { family: t.font, size: 12 },
        boxPadding: 4,
        callbacks: {
          label: (ctx) => {
            const v = ctx.parsed.y;
            return `${ctx.dataset.label ?? ''} : ${v === null || v === undefined ? '—' : numberFmt.format(v)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: t.axis },
        ticks: { color: t.ink3, font: { family: t.font, size: 11 }, maxRotation: 0, autoSkipPadding: 12 },
      },
      y: {
        min: opts.yMin,
        grid: { color: t.grid },
        border: { display: false },
        ticks: { color: t.ink3, font: { family: t.font, size: 11 }, callback: (v) => numberFmt.format(Number(v)), maxTicksLimit: 6 },
        title: opts.yTitle ? { display: true, text: opts.yTitle, color: t.ink3, font: { family: t.font, size: 11 } } : undefined,
      },
    },
  };
}
