// Formats français (Maroc), fuseau Africa/Casablanca.
export const LOCALE = 'fr-MA';
export const TIME_ZONE = 'Africa/Casablanca';
/** Nombres : espace pour les milliers (« 2 064 ») ; fr-MA met un point, qui se lit comme une décimale. */
export const NUMBER_LOCALE = 'fr-FR';

const intFmt = new Intl.NumberFormat(NUMBER_LOCALE, { maximumFractionDigits: 0 });
const decFmt = new Map<number, Intl.NumberFormat>();
const DASH = '—';

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export function fmtInt(n: number | null | undefined): string {
  return isNum(n) ? intFmt.format(n) : DASH;
}

export function fmtDec(n: number | null | undefined, digits = 1): string {
  if (!isNum(n)) return DASH;
  let f = decFmt.get(digits);
  if (!f) {
    f = new Intl.NumberFormat(NUMBER_LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    decFmt.set(digits, f);
  }
  return f.format(n);
}

/** Pourcentage déjà exprimé en points (28.7 → « 28,7 % »). */
export function fmtPct(n: number | null | undefined, digits = 0, signed = false): string {
  if (!isNum(n)) return DASH;
  const s = fmtDec(Math.abs(n), digits);
  const zero = Number(s.replace(/[^\d]/g, '')) === 0;
  const sign = zero ? '' : n > 0 ? (signed ? '+' : '') : n < 0 ? '−' : '';
  return `${sign}${s} %`;
}

export function fmtSigned(n: number | null | undefined, digits = 0): string {
  if (!isNum(n)) return DASH;
  const s = fmtDec(Math.abs(n), digits);
  if (Number(s.replace(/[^\d]/g, '')) === 0) return s;
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : s;
}

/** Une date « AAAA-MM-JJ » est lue à midi UTC pour ne jamais changer de jour. */
export function dayToDate(day: string): Date {
  return new Date(`${day.slice(0, 10)}T12:00:00Z`);
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function dtf(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(opts);
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, ...opts });
    fmtCache.set(key, f);
  }
  return { format: (d: Date) => fixMonth(f.format(d)) } as Intl.DateTimeFormat;
}

/** Les données ICU de fr-MA abrègent juin en « jui. », ambigu avec juillet : on écrit « juin ». */
function fixMonth(s: string): string {
  return s.replace(/\bjui\./g, 'juin');
}

export function fmtDay(day: string | null | undefined): string {
  return day ? dtf({ day: 'numeric', month: 'long', year: 'numeric' }).format(dayToDate(day)) : DASH;
}
export function fmtDayShort(day: string | null | undefined): string {
  return day ? dtf({ day: 'numeric', month: 'short' }).format(dayToDate(day)) : DASH;
}
export function fmtDayWeek(day: string | null | undefined): string {
  return day ? dtf({ weekday: 'short', day: 'numeric', month: 'short' }).format(dayToDate(day)) : DASH;
}
export function fmtMonth(periode: string | null | undefined): string {
  return periode ? dtf({ month: 'short', year: 'numeric' }).format(dayToDate(`${periode.slice(0, 7)}-15`)) : DASH;
}
export function fmtMonthLong(periode: string | null | undefined): string {
  return periode ? dtf({ month: 'long' }).format(dayToDate(`${periode.slice(0, 7)}-15`)) : DASH;
}
export function fmtDateTime(isoString: string | null | undefined): string {
  if (!isoString) return DASH;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return DASH;
  return dtf({ day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
}
export function fmtTime(isoString: string | null | undefined): string {
  if (!isoString) return DASH;
  const d = new Date(isoString);
  return Number.isNaN(d.getTime()) ? DASH : dtf({ hour: '2-digit', minute: '2-digit' }).format(d);
}

export const WEEKDAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
export const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/** Vrai pour un dimanche (les unités ne consultent pas le dimanche). */
export function isSunday(day: string): boolean {
  return dayToDate(day).getUTCDay() === 0;
}

export function addDays(day: string, n: number): string {
  const d = dayToDate(day);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function plural(n: number, one: string, many: string): string {
  return `${fmtInt(n)} ${Math.abs(n) >= 2 ? many : one}`;
}

/** Nom affichable d'une unité : « Unité n° id » quand le nom est vide ou sans lettre ni chiffre (ex. « . »). */
export function unitName(name: string | null | undefined, id: number): string {
  return name && /[\p{L}\p{N}]/u.test(name) ? name.trim() : `Unité n° ${id}`;
}
