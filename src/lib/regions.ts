// Comparaison tolérante des noms de région : « Région de l'Oriental », « L'Oriental »
// et « l’oriental » désignent la même région.
export function regionKey(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/^region\s+(de\s+l'|de\s+la\s+|du\s+|des\s+|de\s+|d')?/, '')
    .replace(/^l'/, '')
    .replace(/[^a-z0-9]+/g, '');
}

export function sameRegion(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = regionKey(a);
  return ka !== '' && ka === regionKey(b);
}

/** Codes officiels des 12 régions (découpage 2015), utilisés en secours pour relier la carte. */
export const REGION_CODES: Record<string, string> = {
  '01': 'Tanger-Tétouan-Al Hoceïma',
  '02': "L'Oriental",
  '03': 'Fès-Meknès',
  '04': 'Rabat-Salé-Kénitra',
  '05': 'Béni Mellal-Khénifra',
  '06': 'Casablanca-Settat',
  '07': 'Marrakech-Safi',
  '08': 'Drâa-Tafilalet',
  '09': 'Souss-Massa',
  '10': 'Guelmim-Oued Noun',
  '11': 'Laâyoune-Sakia El Hamra',
  '12': 'Dakhla-Oued Ed-Dahab',
};
