'use client';

import React, { useEffect, useState, useRef } from 'react';
import { callRpc } from '@/lib/api';
import { CentreMapItem } from '@/lib/types';
import { CATEGORY_COLORS, REGIONS_MOROCCO } from '@/lib/constants';
import { ScreenId } from '../Sidebar';
import { useAuth } from '@/lib/auth-context';
import { Filter, Layers, AlertCircle, ArrowRight, ExternalLink } from 'lucide-react';

interface MapViewProps {
  onNavigate: (screen: ScreenId, centreId?: number) => void;
}

export function MapView({ onNavigate }: MapViewProps) {
  const { user } = useAuth();
  const [centres, setCentres] = useState<CentreMapItem[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>(user.region || 'Toutes les régions');
  const [onlyAttention, setOnlyAttention] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeCentre, setActiveCentre] = useState<CentreMapItem | null>(null);
  const [loading, setLoading] = useState(true);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersLayerRef = useRef<any>(null);

  useEffect(() => {
    async function loadMapData() {
      try {
        const data = await callRpc<CentreMapItem[]>('ui_map');
        setCentres(data);
        if (data.length > 0) {
          setActiveCentre(data[0]);
        }
      } catch (err) {
        console.error('Erreur chargement centres carte', err);
      } finally {
        setLoading(false);
      }
    }
    loadMapData();
  }, []);

  // Filtered centres
  const filteredCentres = centres.filter((c) => {
    if (selectedRegion !== 'Toutes les régions' && c.region !== selectedRegion) {
      return false;
    }
    if (onlyAttention && !c.attention) {
      return false;
    }
    if (selectedCategory !== 'all' && c.category !== selectedCategory) {
      return false;
    }
    return true;
  });

  // Centres without coordinates
  const centresWithoutCoords = filteredCentres.filter((c) => !c.latitude || !c.longitude);
  const centresWithCoords = filteredCentres.filter((c) => c.latitude && c.longitude);

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (typeof window === 'undefined' || loading || !mapContainerRef.current) return;

    let isMounted = true;

    import('leaflet').then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        // Morocco center: [31.7917, -7.0926]
        const map = L.map(mapContainerRef.current, {
          center: [31.7917, -6.5],
          zoom: 6,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);

        markersLayerRef.current = L.layerGroup().addTo(map);
        mapInstanceRef.current = map;
      }

      // Clear previous markers
      if (markersLayerRef.current) {
        markersLayerRef.current.clearLayers();

        centresWithCoords.forEach((c) => {
          const catConfig = CATEGORY_COLORS[c.category] || CATEGORY_COLORS.X;
          const hasOpenEvent = c.open_events > 0;

          // Custom HTML Marker Icon
          const customIcon = L.divIcon({
            className: 'custom-map-marker',
            html: `
              <div style="
                background-color: ${catConfig.hex};
                width: 28px;
                height: 28px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 11px;
                font-weight: 800;
                box-shadow: 0 4px 10px rgba(0,0,0,0.5);
                border: ${hasOpenEvent ? '3px solid #ef4444' : '2px solid #ffffff'};
                cursor: pointer;
                transition: transform 0.2s;
              ">
                ${c.category}
              </div>
            `,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          });

          const marker = L.marker([c.latitude, c.longitude], { icon: customIcon });

          marker.on('click', () => {
            setActiveCentre(c);
          });

          markersLayerRef.current.addLayer(marker);
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [loading, centresWithCoords]);

  return (
    <div className="space-y-5">
      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Filter className="h-4 w-4 text-teal-400" />
            <span>Filtres :</span>
          </div>

          {/* Region filter */}
          <select
            aria-label="Filtrer par région"
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            disabled={user.role === 'coordinateur'}
            className="disabled:cursor-not-allowed disabled:opacity-70 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            {REGIONS_MOROCCO.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          {/* Category filter */}
          <select
            aria-label="Filtrer par catégorie"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-white focus:outline-none"
          >
            <option value="all">Toutes les catégories (A–E, N, X)</option>
            <option value="A">Catégorie A (&gt; 21/j)</option>
            <option value="B">Catégorie B (17–21/j)</option>
            <option value="C">Catégorie C (13–17/j)</option>
            <option value="D">Catégorie D (8–13/j)</option>
            <option value="E">Catégorie E (&lt; 8/j)</option>
            <option value="N">Catégorie N (Nouveau)</option>
            <option value="X">Catégorie X (Données manquantes)</option>
          </select>

          {/* Only Attention checkbox */}
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/10">
            <input
              type="checkbox"
              checked={onlyAttention}
              onChange={(e) => setOnlyAttention(e.target.checked)}
              className="rounded text-red-500 focus:ring-0"
            />
            <span>Seulement à surveiller</span>
          </label>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Layers className="h-4 w-4 text-slate-500" />
          <span>
            Affichés : <strong className="text-white">{filteredCentres.length}</strong> / 104 centres
          </span>
        </div>
      </div>

      {/* Main Map + Side Detail Panel */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Map Container */}
        <div className="relative min-h-[500px] rounded-2xl border border-slate-800 bg-slate-900/40 p-1 lg:col-span-2">
          <div ref={mapContainerRef} className="h-[520px] w-full rounded-xl" />

          {/* Legend Overlay */}
          <div className="absolute bottom-4 left-4 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/90 p-2.5 shadow-xl backdrop-blur-md">
            <span className="text-[10px] font-bold uppercase text-slate-400">Légende :</span>
            {(['A', 'B', 'C', 'D', 'E', 'N', 'X'] as const).map((cat) => (
              <div key={cat} className="flex items-center gap-1.5">
                <span
                  style={{ backgroundColor: CATEGORY_COLORS[cat].hex }}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-white"
                >
                  {cat}
                </span>
                <span className="text-[10px] text-slate-300 font-medium">
                  {cat === 'A' ? '>21' : cat === 'E' ? '<8' : cat}
                </span>
              </div>
            ))}
            <div className="ml-2 flex items-center gap-1 border-l border-slate-700 pl-2">
              <span className="h-3 w-3 rounded-full border-2 border-red-500 bg-slate-800" />
              <span className="text-[10px] text-red-400 font-semibold">Alerte ouverte</span>
            </div>
          </div>
        </div>

        {/* Selected Center Preview Card */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          {activeCentre ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-medium text-slate-400">{activeCentre.province}</span>
                  <h3 className="text-base font-bold text-white">{activeCentre.centre_name}</h3>
                  <p className="text-xs text-teal-400">{activeCentre.region}</p>
                </div>
                <div
                  style={{ backgroundColor: CATEGORY_COLORS[activeCentre.category].hex }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black text-white shadow-lg"
                >
                  {activeCentre.category}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Moyenne journalière :</span>
                  <strong className="text-white text-sm">
                    {activeCentre.mean_value} <span className="text-[10px] font-normal text-slate-400">actes/j</span>
                  </strong>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Cible nationale :</span>
                  <strong className="text-emerald-400">&gt; 21 prises en charge</strong>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Alertes actives :</span>
                  <strong className={activeCentre.open_events > 0 ? 'text-red-400' : 'text-slate-400'}>
                    {activeCentre.open_events} alerte(s)
                  </strong>
                </div>
              </div>

              {activeCentre.attention && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">
                  <div className="flex items-center gap-1.5 font-bold text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    <span>Centre à surveiller</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed">{activeCentre.attention_reason}</p>
                </div>
              )}

              <button
                onClick={() => onNavigate('centre', activeCentre.centre_id)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-950/40 transition hover:from-emerald-500 hover:to-teal-500"
              >
                <span>Accéder à la fiche détaillée</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-500">
              Cliquez sur un marqueur pour inspecter un centre
            </div>
          )}

          {/* Quick list of centres without position */}
          {centresWithoutCoords.length > 0 && (
            <div className="mt-4 border-t border-slate-800 pt-3">
              <span className="text-[11px] font-semibold text-slate-400">
                Centres sans position GPS ({centresWithoutCoords.length}) :
              </span>
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                {centresWithoutCoords.map((cw) => (
                  <div
                    key={cw.centre_id}
                    onClick={() => setActiveCentre(cw)}
                    className="flex cursor-pointer items-center justify-between rounded-lg bg-slate-800/40 px-2 py-1 text-[11px] hover:bg-slate-800 text-slate-300"
                  >
                    <span>{cw.centre_name}</span>
                    <ExternalLink className="h-3 w-3 text-slate-500" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
