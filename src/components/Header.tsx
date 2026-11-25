'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { DATE_REFERENCE } from '@/lib/constants';
import { Activity, ShieldCheck, Users, Calendar, ChevronDown } from 'lucide-react';
import { UserRole } from '@/lib/types';

export function Header() {
  const { user, setRole } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-6 py-3.5 backdrop-blur-md">
      {/* Brand & Reference Date */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-950/40">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-white">UMMC Supervision</span>
            <span className="ml-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              104 Centres
            </span>
          </div>
        </div>

        <div className="hidden h-5 w-px bg-slate-800 md:block" />

        {/* Date de référence badge */}
        <div className="hidden items-center gap-2 rounded-lg border border-slate-800 bg-slate-800/50 px-3 py-1 text-xs text-slate-300 md:flex">
          <Calendar className="h-3.5 w-3.5 text-teal-400" />
          <span>Aujourd&apos;hui : <strong className="text-white">{DATE_REFERENCE}</strong></span>
          <span className="rounded bg-teal-500/20 px-1.5 py-0.5 text-[10px] text-teal-300 font-medium">Clone figé</span>
        </div>
      </div>

      {/* System Health Quick Indicator & Role Switcher */}
      <div className="flex items-center gap-3">
        {/* Night run indicator */}
        <div className="hidden items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-xs text-emerald-400 sm:flex">
          <ShieldCheck className="h-4 w-4" />
          <span>Passage nuit 02:04 <strong className="font-semibold">OK</strong></span>
        </div>

        {/* Role Switcher for Demo */}
        <div className="relative flex items-center">
          <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-200 shadow-inner">
            <Users className="h-3.5 w-3.5 text-teal-400" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Rôle actif</span>
              <select
                aria-label="Sélectionner le rôle actif"
                value={user.role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="cursor-pointer bg-transparent font-semibold text-white focus:outline-none"
              >
                <option value="direction" className="bg-slate-900 text-white">Direction (Nabil)</option>
                <option value="coordinateur" className="bg-slate-900 text-white">Coordinateur (Oriental)</option>
                <option value="medecin_referent" className="bg-slate-900 text-white">Médecin Référent (Dr Saad)</option>
                <option value="demo" className="bg-slate-900 text-white">Invité Démo (Jury)</option>
              </select>
            </div>
            <ChevronDown className="h-3 w-3 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>
    </header>
  );
}
