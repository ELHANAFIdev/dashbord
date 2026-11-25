'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { UserRole, UserSession } from './types';
import {
  USERS,
  DEFAULT_ROLE,
  canViewDoctorStats as canViewDoctorStatsFor,
  canAcknowledgeAlerts as canAcknowledgeAlertsFor,
  canReviewSecondOpinion as canReviewSecondOpinionFor,
} from './roles';

interface AuthContextType {
  user: UserSession;
  setRole: (role: UserRole) => Promise<void>;
  canViewDoctorStats: boolean;
  canAcknowledgeAlerts: boolean;
  canReviewSecondOpinion: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// The server owns the session (httpOnly cookie) and enforces rights on every data call;
// this context only mirrors it so the interface can adapt.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSession>(USERS[DEFAULT_ROLE]);

  useEffect(() => {
    fetch('/api/session')
      .then((r) => (r.ok ? r.json() : null))
      .then((s: UserSession | null) => s && setUser(s))
      .catch(() => {});
  }, []);

  const setRole = async (role: UserRole) => {
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (res.ok) setUser(await res.json());
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setRole,
        canViewDoctorStats: canViewDoctorStatsFor(user),
        canAcknowledgeAlerts: canAcknowledgeAlertsFor(user),
        canReviewSecondOpinion: canReviewSecondOpinionFor(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
