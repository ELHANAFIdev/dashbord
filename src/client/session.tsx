'use client';
// Le serveur détient la session (cookie httpOnly) et applique les droits à chaque appel ;
// ce contexte ne fait que la refléter pour adapter l'interface.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_ROLE,
  canAcknowledgeAlerts,
  canInvestigate,
  canReviewSecondOpinion,
  canViewDoctorNames,
  isReadOnly,
  usersFor,
} from '@/lib/roles';
import type { DataSource, SessionInfo, UserRole, UserSession } from '@/lib/types';
import { invalidate } from './rpc';

interface SessionContextValue {
  user: UserSession;
  ready: boolean;
  dataMode: DataSource | undefined;
  setRole: (role: UserRole) => Promise<void>;
  can: {
    viewDoctorNames: boolean;
    acknowledge: boolean;
    investigate: boolean;
    review: boolean;
    readOnly: boolean;
  };
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<SessionInfo | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/session', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<SessionInfo>) : null))
      .then((s) => {
        if (alive && s) setInfo(s);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const setRole = useCallback(async (role: UserRole) => {
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      setInfo((await res.json()) as SessionInfo);
      invalidate();
    }
  }, []);

  const value = useMemo<SessionContextValue>(() => {
    const user: UserSession = info ?? usersFor()[DEFAULT_ROLE];
    return {
      user,
      ready: info !== null,
      dataMode: info?.dataMode,
      setRole,
      can: {
        viewDoctorNames: canViewDoctorNames(user),
        acknowledge: canAcknowledgeAlerts(user),
        investigate: canInvestigate(user),
        review: canReviewSecondOpinion(user),
        readOnly: isReadOnly(user),
      },
    };
  }, [info, setRole]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession doit être utilisé dans SessionProvider');
  return ctx;
}
