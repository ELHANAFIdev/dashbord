// Profils de démonstration et droits. Partagé par le serveur (qui applique les règles)
// et par le client (qui ne fait qu'adapter l'affichage).
import type { UserRole, UserSession } from './types';

export const ROLE_COOKIE = 'ummc_role';
export const DEFAULT_ROLE: UserRole = 'direction';

/** Région du coordinateur de démonstration (modifiable par UMMC_COORD_REGION côté serveur). */
export const DEFAULT_COORD_REGION = "L'Oriental";

export const ROLE_LABELS: Record<UserRole, string> = {
  direction: 'Direction',
  coordinateur: 'Coordinateur régional',
  medecin_referent: 'Médecin référent',
  demo: 'Démonstration (lecture seule)',
};

export function usersFor(coordRegion: string = DEFAULT_COORD_REGION): Record<UserRole, UserSession> {
  return {
    direction: { role: 'direction', name: 'Nabil, direction du programme' },
    coordinateur: { role: 'coordinateur', name: `Coordination ${coordRegion}`, region: coordRegion },
    medecin_referent: { role: 'medecin_referent', name: 'Dr Saad, médecin référent' },
    demo: { role: 'demo', name: 'Invité (jury)' },
  };
}

export function isRole(value: unknown): value is UserRole {
  return value === 'direction' || value === 'coordinateur' || value === 'medecin_referent' || value === 'demo';
}

export function sessionFor(role: string | undefined, coordRegion?: string): UserSession {
  return usersFor(coordRegion)[isRole(role) ? role : DEFAULT_ROLE];
}

export const canViewDoctorNames = (u: UserSession) => u.role === 'direction';
export const canAcknowledgeAlerts = (u: UserSession) => u.role === 'direction' || u.role === 'coordinateur';
export const canInvestigate = (u: UserSession) => u.role === 'direction' || u.role === 'coordinateur';
export const canReviewSecondOpinion = (u: UserSession) => u.role === 'direction' || u.role === 'medecin_referent';
export const isReadOnly = (u: UserSession) => u.role === 'demo';
