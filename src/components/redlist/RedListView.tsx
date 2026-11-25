'use client';

import React, { useEffect, useState } from 'react';
import { callRpc } from '@/lib/api';
import { CentreCategoryItem } from '@/lib/types';
import { CATEGORY_COLORS, REGIONS_MOROCCO } from '@/lib/constants';
import { ScreenId } from '../Sidebar';
import { useAuth } from '@/lib/auth-context';
import {
  AlertTriangle,
  Download,
  Printer,
  ArrowUpDown,
  ArrowDownRight,
  Search,
  ExternalLink
} from 'lucide-react';

interface RedListViewProps {
  onNavigate: (screen: ScreenId, centreId?: number) => void;
}

export function RedListView({ onNavigate }: RedListViewProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<CentreCategoryItem[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>(user.region || 'Toutes les régions');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof CentreCategoryItem>('mean_patients');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRedList() {
      try {
        const data = await callRpc<CentreCategoryItem[]>('sup_centre_category_list', { p_attention_only: true });
        setItems(data);
      } catch (err) {
        console.error('Erreur chargement liste rouge', err);
      } finally {
        setLoading(false);
      }
    }
    loadRedList();
  }, []);

  // Filter
  const filteredItems = items.filter((item) => {
    if (selectedRegion !== 'Toutes les régions' && item.region !== selectedRegion) {
      return false;
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = item.centre_name.toLowerCase().includes(term);
      const matchProv = item.province.toLowerCase().includes(term);
      if (!matchName && !matchProv) return false;
    }
    return true;
  });

  // Sort
  const sortedItems = [...filteredItems].sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];
    if (valA === valB) return 0;
    if (valA === null || valA === undefined) return 1;
    if (valB === null || valB === undefined) return -1;
    if (valA < valB) return sortAsc ? -1 : 1;
    return sortAsc ? 1 : -1;
  });

  const toggleSort = (field: keyof CentreCategoryItem) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'Centre ID',
      'Nom du Centre',
      'Province',
      'Région',
      'Catégorie',
      'Moyenne/j',
      'IC Bas (95%)',
      'IC Haut (95%)',
      '% Jours > 21',
      'Évolution (%)',
      'Jours sans activité',
      'Motif'
    ];
    const rows = sortedItems.map((c) => [
      c.centre_id,
      `"${c.centre_name}"`,
      `"${c.province}"`,
      `"${c.region}"`,
      c.category,
      c.mean_patients,
      c.ci_low,
      c.ci_high,
      c.pct_days_over_target,
      c.adj_change_pct,
      c.days_zero,
      `"${c.attention_reason || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `UMMC_Liste_Rouge_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Header and Controls */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-red-500/10 p-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Liste Rouge — Centres à Surveiller
              </h1>
              <p className="text-xs text-slate-400">
                Unités en sous-activité (&lt; 21 prises en charge/jour) ou en chute brutale
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white"
          >
            <Download className="h-4 w-4 text-teal-400" />
            <span>Exporter CSV</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white"
          >
            <Printer className="h-4 w-4 text-emerald-400" />
            <span>Imprimer / PDF</span>
          </button>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Rechercher un centre ou province..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64 rounded-xl border border-slate-700 bg-slate-800 py-1.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <select
            aria-label="Filtrer la liste par région"
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            disabled={user.role === 'coordinateur'}
            className="disabled:cursor-not-allowed disabled:opacity-70 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white focus:outline-none"
          >
            {REGIONS_MOROCCO.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <span className="text-xs text-slate-400">
          <strong className="text-white">{sortedItems.length}</strong> centres nécessitant une intervention terrain
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="border-b border-slate-800 bg-slate-800/60 text-[11px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3.5">Catégorie</th>
              <th
                onClick={() => toggleSort('centre_name')}
                className="cursor-pointer px-4 py-3.5 hover:text-white"
              >
                <div className="flex items-center gap-1">
                  <span>Centre / Localisation</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                onClick={() => toggleSort('mean_patients')}
                className="cursor-pointer px-4 py-3.5 hover:text-white"
              >
                <div className="flex items-center gap-1">
                  <span>Moyenne/j (IC 95%)</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                onClick={() => toggleSort('pct_days_over_target')}
                className="cursor-pointer px-4 py-3.5 hover:text-white"
              >
                <div className="flex items-center gap-1">
                  <span>Jours &gt; 21 (%)</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                onClick={() => toggleSort('adj_change_pct')}
                className="cursor-pointer px-4 py-3.5 hover:text-white"
              >
                <div className="flex items-center gap-1">
                  <span>Évolution</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                onClick={() => toggleSort('days_zero')}
                className="cursor-pointer px-4 py-3.5 hover:text-white"
              >
                <div className="flex items-center gap-1">
                  <span>Jours 0</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="px-4 py-3.5">Motif principal</th>
              <th className="px-4 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500">
                  Chargement des données...
                </td>
              </tr>
            ) : sortedItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500">
                  Aucun centre trouvé pour ces critères.
                </td>
              </tr>
            ) : (
              sortedItems.map((item) => {
                const catCfg = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.X;
                const isSevereDrop = item.adj_change_pct <= -20;
                return (
                  <tr
                    key={item.centre_id}
                    className="transition hover:bg-slate-800/40 cursor-pointer"
                    onClick={() => onNavigate('centre', item.centre_id)}
                  >
                    <td className="px-4 py-3.5">
                      <span
                        style={{ backgroundColor: catCfg.hex }}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black text-white"
                      >
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-white hover:text-teal-400">{item.centre_name}</div>
                      <div className="text-[11px] text-slate-400">
                        {item.province} • <span className="text-teal-400/80">{item.region}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-bold text-white">{item.mean_patients.toFixed(1)}</span>
                      <span className="ml-1 text-[10px] text-slate-400">
                        [{item.ci_low.toFixed(1)} – {item.ci_high.toFixed(1)}]
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-300">
                      {item.pct_days_over_target.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3.5">
                      <div
                        className={`flex items-center gap-1 font-bold ${
                          isSevereDrop ? 'text-red-400' : 'text-amber-400'
                        }`}
                      >
                        {isSevereDrop && <ArrowDownRight className="h-3.5 w-3.5" />}
                        <span>{item.adj_change_pct > 0 ? `+${item.adj_change_pct}%` : `${item.adj_change_pct}%`}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`font-bold ${
                          item.days_zero > 3 ? 'text-red-400' : 'text-slate-300'
                        }`}
                      >
                        {item.days_zero} j
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3.5 text-[11px] text-slate-300">
                      {item.attention_reason}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate('centre', item.centre_id);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-teal-300 hover:bg-slate-700 hover:text-white"
                      >
                        <span>Fiche</span>
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
