'use client';

import React from 'react';
import {
  LayoutDashboard,
  MapPin,
  AlertTriangle,
  Building2,
  BellRing,
  BarChart3,
  TrendingUp,
  Radio,
  HeartPulse,
  BrainCircuit
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export type ScreenId =
  | 'dashboard'
  | 'map'
  | 'redlist'
  | 'centre'
  | 'alerts'
  | 'stats'
  | 'history'
  | 'live'
  | 'health'
  | 'secondavis';

interface SidebarProps {
  activeScreen: ScreenId;
  onSelectScreen: (screen: ScreenId) => void;
}

export function Sidebar({ activeScreen, onSelectScreen }: SidebarProps) {
  const { user } = useAuth();

  const navigation = [
    { id: 'dashboard' as ScreenId, name: 'Tableau de bord', icon: LayoutDashboard, badge: null },
    { id: 'map' as ScreenId, name: 'Carte nationale', icon: MapPin, badge: '104' },
    { id: 'redlist' as ScreenId, name: 'Liste rouge (Priorité)', icon: AlertTriangle, badge: '26', badgeColor: 'bg-red-500/20 text-red-400' },
    { id: 'centre' as ScreenId, name: 'Fiche centre', icon: Building2, badge: null },
    { id: 'alerts' as ScreenId, name: 'Gestion alertes', icon: BellRing, badge: '5', badgeColor: 'bg-amber-500/20 text-amber-400' },
    { id: 'stats' as ScreenId, name: 'Statistiques & Entonnoirs', icon: BarChart3, badge: null },
    { id: 'history' as ScreenId, name: 'Flux historique', icon: TrendingUp, badge: null },
    { id: 'live' as ScreenId, name: 'Direct (Rejeu 13/08)', icon: Radio, badge: 'Rejeu', badgeColor: 'bg-emerald-500/20 text-emerald-400' },
    { id: 'health' as ScreenId, name: 'Santé du système', icon: HeartPulse, badge: null },
    { id: 'secondavis' as ScreenId, name: 'Second avis IA', icon: BrainCircuit, badge: 'Phase 2', badgeColor: 'bg-purple-500/20 text-purple-300' },
  ];

  return (
    <aside className="w-64 flex-shrink-0 border-r border-slate-800 bg-slate-900/60 p-4">
      {/* User greeting */}
      <div className="mb-6 rounded-xl border border-slate-800 bg-slate-800/40 p-3">
        <p className="text-xs text-slate-400">Connecté en tant que</p>
        <p className="truncate text-sm font-semibold text-white">{user.name}</p>
        {user.region && (
          <p className="mt-1 text-[11px] font-medium text-teal-400">
            Filtre : {user.region}
          </p>
        )}
      </div>

      <nav className="space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectScreen(item.id)}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950/40'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                    isActive ? 'bg-white/20 text-white' : item.badgeColor || 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
