import React from 'react';
import { Info } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-900/90 px-6 py-2.5 text-center text-xs text-slate-400">
      <div className="flex items-center justify-center gap-2">
        <Info className="h-3.5 w-3.5 text-teal-400 flex-shrink-0" />
        <span>
          Données au <strong>13/08/2026</strong> — clone anonymisé. Aide à la supervision : toute alerte se vérifie avec le terrain.
        </span>
      </div>
    </footer>
  );
}
