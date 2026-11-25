// Shared by the server (route handlers) and the client. Profiles and their rights live here,
// so the server decides what each profile may see and do; the client only mirrors it.
import { UserRole, UserSession } from './types';

export const ROLE_COOKIE = 'ummc_role';
export const DEFAULT_ROLE: UserRole = 'direction';

export const USERS: Record<UserRole, UserSession> = {
  direction: { role: 'direction', name: 'Nabil (Directeur Général)' },
  coordinateur: { role: 'coordinateur', name: 'Coordinateur Régional', region: "Région de l'Oriental" },
  medecin_referent: { role: 'medecin_referent', name: 'Dr Saad (Médecin Référent)' },
  demo: { role: 'demo', name: 'Membre du Jury (Invité)' },
};

export function isRole(value: unknown): value is UserRole {
  return typeof value === 'string' && value in USERS;
}

export function sessionFor(role: string | undefined): UserSession {
  return USERS[isRole(role) ? role : DEFAULT_ROLE];
}

export const canViewDoctorStats = (u: UserSession) => u.role === 'direction';
export const canAcknowledgeAlerts = (u: UserSession) => u.role === 'direction' || u.role === 'coordinateur';
export const canReviewSecondOpinion = (u: UserSession) => u.role === 'direction' || u.role === 'medecin_referent';
