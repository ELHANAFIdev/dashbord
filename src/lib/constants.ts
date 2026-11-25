import { CentreCategory } from './types';

export const DATE_REFERENCE = '2026-08-13';

export const CATEGORY_COLORS: Record<CentreCategory, { bg: string; text: string; hex: string; label: string; border: string }> = {
  A: { bg: 'bg-[#1b7f3b]/15', text: 'text-[#1b7f3b]', hex: '#1b7f3b', label: 'Cible atteinte (>21)', border: 'border-[#1b7f3b]' },
  B: { bg: 'bg-[#6aa84f]/15', text: 'text-[#6aa84f]', hex: '#6aa84f', label: 'Bon niveau (17–21)', border: 'border-[#6aa84f]' },
  C: { bg: 'bg-[#d4a017]/15', text: 'text-[#d4a017]', hex: '#d4a017', label: 'Moyen (13–17)', border: 'border-[#d4a017]' },
  D: { bg: 'bg-[#e07b00]/15', text: 'text-[#e07b00]', hex: '#e07b00', label: 'À surveiller (8–13)', border: 'border-[#e07b00]' },
  E: { bg: 'bg-[#c0392b]/15', text: 'text-[#c0392b]', hex: '#c0392b', label: 'Critique (<8)', border: 'border-[#c0392b]' },
  N: { bg: 'bg-[#5b7db1]/15', text: 'text-[#5b7db1]', hex: '#5b7db1', label: 'Nouveau centre', border: 'border-[#5b7db1]' },
  X: { bg: 'bg-[#9e9e9e]/15', text: 'text-[#9e9e9e]', hex: '#9e9e9e', label: 'Données insuffisantes', border: 'border-[#9e9e9e]' },
};

export const ACK_CAUSES = [
  'Souk hebdomadaire local',
  'Conditions météo défavorables (neige / canicule / crue)',
  'Fête locale / Moussem / Circoncision collective',
  'Panne de groupe électrogène ou alimentation',
  'Absence inopinée du médecin / congé maladie',
  'Panne liaison satellite VSAT / Télécom',
  'Campagne de vaccination extérieure',
  'Autre motif justifié'
];

export const REGIONS_MOROCCO = [
  "Toutes les régions",
  "Région de Drâa-Tafilalet",
  "Région de l'Oriental",
  "Région de Béni Mellal-Khénifra",
  "Région de Marrakech-Safi",
  "Région de Souss-Massa",
  "Région de Tanger-Tétouan-Al Hoceïma",
  "Région de Fès-Meknès",
  "Région de Guelmim-Oued Noun"
];
