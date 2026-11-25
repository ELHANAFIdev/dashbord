// Ramadan periods (approximate Gregorian dates, Morocco) used to shade seasonal dips in the history charts.
const RAMADAN_PERIODS: { start: string; end: string }[] = [
  { start: '2024-03-12', end: '2024-04-09' },
  { start: '2025-03-02', end: '2025-03-30' },
  { start: '2026-02-19', end: '2026-03-19' },
  { start: '2027-02-08', end: '2027-03-09' },
];

/** Start and end dates (UTC) of a period written "YYYY-Www" (ISO week) or "YYYY-MM" (month). */
function periodRange(period: string): [Date, Date] | null {
  const week = /^(\d{4})-W(\d{2})$/.exec(period);
  if (week) {
    const year = Number(week[1]);
    const w = Number(week[2]);
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const monday = new Date(jan4);
    monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (w - 1) * 7);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return [monday, sunday];
  }
  const month = /^(\d{4})-(\d{2})$/.exec(period);
  if (month) {
    const y = Number(month[1]);
    const m = Number(month[2]) - 1;
    return [new Date(Date.UTC(y, m, 1)), new Date(Date.UTC(y, m + 1, 0))];
  }
  return null;
}

/** True when the period overlaps a Ramadan month. */
export function overlapsRamadan(period: string): boolean {
  const range = periodRange(period);
  if (!range) return false;
  const [from, to] = range;
  return RAMADAN_PERIODS.some(({ start, end }) => new Date(start) <= to && new Date(end) >= from);
}
