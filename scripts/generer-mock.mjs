// Génère les données de démonstration de src/mock/ (toutes fictives, déterministes).
// Usage : node scripts/generer-mock.mjs
// Les formes suivent exactement CONTRATS_API.md. Aucune valeur n'est réelle.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'src', 'mock');

// ---------------------------------------------------------------- aléatoire
let seed = 20260813;
function rnd() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (a, b) => a + rnd() * (b - a);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
function gauss() {
  const u = Math.max(rnd(), 1e-9);
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function poissonish(mean) {
  if (mean <= 0) return 0;
  return Math.max(0, Math.round(mean + gauss() * Math.sqrt(mean) * 1.15));
}

// ---------------------------------------------------------------- dates
const DAY_REF = '2026-08-13';
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const dow = (s) => ((new Date(`${s}T00:00:00Z`).getUTCDay() + 6) % 7) + 1; // 1 = lundi … 7 = dimanche
function range(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
const SERIES_FROM = '2026-05-15';
const DAYS = range(SERIES_FROM, DAY_REF);

const FERIES = {
  '2026-05-27': 'Aïd Al-Adha',
  '2026-05-28': 'Aïd Al-Adha (2e jour)',
  '2026-06-16': 'Nouvel an de l’Hégire',
  '2026-07-30': 'Fête du Trône',
  '2026-08-14': 'Allégeance Oued Eddahab',
  '2026-08-20': 'Révolution du Roi et du Peuple',
  '2026-08-21': 'Fête de la Jeunesse',
  '2026-08-26': 'Aïd Al-Mawlid',
};
const VEILLES = { '2026-05-26': 'Veille de l’Aïd Al-Adha' };
const VACANCES_FROM = '2026-06-27';
function calendarOf(day) {
  if (FERIES[day]) return FERIES[day];
  if (VEILLES[day]) return VEILLES[day];
  if (day >= VACANCES_FROM) return 'Vacances scolaires';
  return null;
}
const SOUKS = { 1: 'Souk Letnine', 2: 'Souk Tlata', 3: 'Souk Larbaa', 4: 'Souk Lkhemis', 5: 'Souk Jemaa', 6: 'Souk Sebt' };

// ---------------------------------------------------------------- territoire
// [nom du lieu, province, latitude, longitude]
const REGIONS = {
  'Drâa-Tafilalet': [
    ['Imi n’Oulaoune', 'Ouarzazate', 31.18, -7.05], ['Skoura', 'Ouarzazate', 31.06, -6.56], ['Tazenakht', 'Ouarzazate', 30.58, -7.2],
    ['Ighrem n’Ougdal', 'Ouarzazate', 31.23, -7.41], ['Boumalne Dadès', 'Tinghir', 31.37, -5.99], ['Msemrir', 'Tinghir', 31.7, -5.82],
    ['Alnif', 'Tinghir', 31.12, -5.17], ['Ikniouen', 'Tinghir', 31.2, -5.67], ['Tagounite', 'Zagora', 29.98, -5.58],
    ['Mhamid El Ghizlane', 'Zagora', 29.82, -5.72], ['Tamegroute', 'Zagora', 30.26, -5.68], ['Rissani', 'Errachidia', 31.28, -4.26],
    ['Goulmima', 'Errachidia', 31.69, -4.96], ['Amellago', 'Errachidia', 31.89, -5.03], ['Imilchil', 'Midelt', 32.15, -5.63],
    ['Tounfite', 'Midelt', 32.47, -5.24],
  ],
  'L\'Oriental': [
    ['Talsint', 'Figuig', 32.55, -3.44], ['Bouarfa', 'Figuig', 32.53, -1.96], ['Tendrara', 'Figuig', 33.05, -2.0],
    ['Beni Tadjite', 'Figuig', 32.29, -3.47], ['Aïn Beni Mathar', 'Jerada', 34.01, -2.03], ['Gafait', 'Jerada', 34.24, -2.32],
    ['Debdou', 'Taourirt', 33.98, -3.04], ['El Aïoun Sidi Mellouk', 'Taourirt', 34.58, -2.5], ['Midar', 'Driouch', 34.94, -3.53],
    ['Tafersit', 'Driouch', 35.05, -3.55], ['Saka', 'Guercif', 34.62, -3.4], ['Tiztoutine', 'Nador', 34.98, -3.14],
  ],
  'Béni Mellal-Khénifra': [
    ['Tabant', 'Azilal', 31.66, -6.43], ['Zaouiat Ahansal', 'Azilal', 31.83, -6.1], ['Ouaouizeght', 'Azilal', 32.16, -6.36],
    ['Tilougguite', 'Azilal', 32.03, -6.21], ['Foum El Anceur', 'Béni Mellal', 32.37, -6.25], ['Aghbala', 'Béni Mellal', 32.48, -5.64],
    ['Aguelmam Azegza', 'Khénifra', 32.97, -5.43], ['El Kbab', 'Khénifra', 32.74, -5.52], ['Moulay Bouazza', 'Khénifra', 33.22, -6.2],
    ['Naour', 'Khénifra', 32.48, -5.95], ['Boujniba', 'Khouribga', 32.9, -6.78], ['Dar Ould Zidouh', 'Fquih Ben Salah', 32.31, -6.9],
  ],
  'Marrakech-Safi': [
    ['Asni', 'Al Haouz', 31.25, -7.98], ['Imlil', 'Al Haouz', 31.14, -7.92], ['Ijoukak', 'Al Haouz', 30.99, -8.15],
    ['Tighdouine', 'Al Haouz', 31.4, -7.53], ['Amizmiz', 'Al Haouz', 31.22, -8.24], ['Imintanoute', 'Chichaoua', 31.17, -8.85],
    ['Mzouda', 'Chichaoua', 31.27, -8.45], ['Tamanar', 'Essaouira', 31.0, -9.68], ['Smimou', 'Essaouira', 31.21, -9.71],
    ['Had Draa', 'Essaouira', 31.58, -9.53], ['Sidi Bou Othmane', 'Rehamna', 31.9, -7.94], ['Tamallalt', 'El Kelâa des Sraghna', 31.82, -7.51],
    ['Sebt Gzoula', 'Safi', 32.11, -9.08], ['Chemaia', 'Youssoufia', 32.08, -8.63],
  ],
  'Souss-Massa': [
    ['Taliouine', 'Taroudant', 30.53, -7.92], ['Igherm', 'Taroudant', 30.09, -8.47], ['Tafingoult', 'Taroudant', 30.78, -8.4],
    ['Aoulouz', 'Taroudant', 30.68, -8.15], ['Tafraout', 'Tiznit', 29.72, -8.97], ['Anzi', 'Tiznit', 29.62, -9.44],
    ['Aït Baha', 'Chtouka-Aït Baha', 30.07, -9.15], ['Tanalt', 'Chtouka-Aït Baha', 29.78, -9.05], ['Akka', 'Tata', 29.39, -8.25],
    ['Foum Zguid', 'Tata', 30.08, -6.87], ['Imouzzer Ida Outanane', 'Agadir Ida-Outanane', 30.67, -9.48], ['Tamri', 'Agadir Ida-Outanane', 30.71, -9.83],
  ],
  'Tanger-Tétouan-Al Hoceïma': [
    ['Bab Taza', 'Chefchaouen', 35.06, -5.2], ['Bab Berred', 'Chefchaouen', 35.0, -4.98], ['Talambote', 'Chefchaouen', 35.25, -5.19],
    ['Targuist', 'Al Hoceïma', 34.94, -4.31], ['Beni Bouayach', 'Al Hoceïma', 35.1, -3.84], ['Issaguen', 'Al Hoceïma', 34.91, -4.56],
    ['Mokrisset', 'Ouezzane', 34.89, -5.34], ['Tatoft', 'Larache', 35.03, -5.79], ['Oued Laou', 'Tétouan', 35.45, -5.1],
  ],
  'Fès-Meknès': [
    ['Missour', 'Boulemane', 33.05, -3.99], ['Outat El Haj', 'Boulemane', 33.35, -3.7], ['Imouzzer Marmoucha', 'Boulemane', 33.46, -4.21],
    ['Tissa', 'Taounate', 34.28, -4.66], ['Ghafsai', 'Taounate', 34.63, -4.91], ['Ribat El Kheir', 'Sefrou', 33.82, -4.41],
    ['Timahdite', 'Ifrane', 33.24, -5.06], ['Tahla', 'Taza', 34.05, -4.43], ['Aknoul', 'Taza', 34.65, -3.87],
    ['Aïn Taoujdate', 'El Hajeb', 33.93, -5.21], ['Aïn Kansra', 'Moulay Yacoub', 34.15, -5.17],
  ],
  'Casablanca-Settat': [
    ['Ben Ahmed', 'Settat', 33.07, -7.25], ['Ouled Saïd', 'Settat', 32.98, -7.83], ['El Gara', 'Berrechid', 33.28, -7.23],
    ['Sidi Smaïl', 'El Jadida', 32.82, -8.51], ['Oulad Frej', 'El Jadida', 32.96, -8.23], ['Zemamra', 'Sidi Bennour', 32.63, -8.7],
    ['Ziaida', 'Benslimane', 33.45, -6.98],
  ],
  'Rabat-Salé-Kénitra': [
    ['Oulmès', 'Khémisset', 33.42, -6.01], ['Aït Ikkou', 'Khémisset', 33.66, -6.1], ['Rommani', 'Khémisset', 33.53, -6.6],
    ['Jorf El Melha', 'Sidi Kacem', 34.49, -5.51], ['Had Kourt', 'Sidi Kacem', 34.66, -5.73], ['Sidi Yahya El Gharb', 'Sidi Slimane', 34.3, -6.3],
    ['Moulay Bousselham', 'Kénitra', 34.88, -6.29],
  ],
};

// Population de démonstration par province (ordre de grandeur, valeurs fictives arrondies).
const POPULATION = {
  Ouarzazate: 301000, Tinghir: 329000, Zagora: 318000, Errachidia: 428000, Midelt: 302000,
  Figuig: 141000, Jerada: 104000, Taourirt: 231000, Driouch: 209000, Guercif: 219000, Nador: 588000,
  Azilal: 562000, 'Béni Mellal': 598000, Khénifra: 362000, Khouribga: 521000, 'Fquih Ben Salah': 518000,
  'Al Haouz': 581000, Chichaoua: 371000, Essaouira: 449000, Rehamna: 322000, 'El Kelâa des Sraghna': 541000, Safi: 703000, Youssoufia: 259000,
  Taroudant: 862000, Tiznit: 221000, 'Chtouka-Aït Baha': 418000, Tata: 118000, 'Agadir Ida-Outanane': 651000,
  Chefchaouen: 468000, 'Al Hoceïma': 409000, Ouezzane: 301000, Larache: 502000, Tétouan: 583000,
  Boulemane: 201000, Taounate: 648000, Sefrou: 289000, Ifrane: 152000, Taza: 521000, 'El Hajeb': 251000, 'Moulay Yacoub': 181000,
  Settat: 651000, Berrechid: 602000, 'El Jadida': 829000, 'Sidi Bennour': 452000, Benslimane: 238000,
  Khémisset: 541000, 'Sidi Kacem': 522000, 'Sidi Slimane': 331000, Kénitra: 1201000,
};

// ---------------------------------------------------------------- unités
const CATS = ['A', 'B', 'C', 'D', 'E'];
const CAT_RANGE = { A: [23, 30], B: [17.6, 20.6], C: [13.6, 16.6], D: [8.6, 12.4], E: [4.5, 7.3] };
const categoryOf = (m) => (m >= 21 ? 'A' : m >= 17 ? 'B' : m >= 13 ? 'C' : m >= 8 ? 'D' : 'E');

const centres = [];
let id = 1;
for (const [region, places] of Object.entries(REGIONS)) {
  for (const [place, province, lat, lon] of places) {
    centres.push({
      centre_id: id++,
      centre_name: `UM1 ${place}`,
      province,
      region,
      latitude: r2(lat + between(-0.02, 0.02)),
      longitude: r2(lon + between(-0.02, 0.02)),
    });
  }
}

// Catégories cibles : A 55 / B 16 / C 12 / D 13 / E 4. Marrakech-Safi entièrement en A (meilleur rendement).
const bag = [];
const quotas = { A: 55, B: 16, C: 12, D: 13, E: 4 };
const ms = centres.filter((c) => c.region === 'Marrakech-Safi');
ms.forEach((c) => (c.target_cat = 'A'));
quotas.A -= ms.length;
for (const [k, n] of Object.entries(quotas)) for (let i = 0; i < n; i++) bag.push(k);
for (let i = bag.length - 1; i > 0; i--) {
  const j = Math.floor(rnd() * (i + 1));
  [bag[i], bag[j]] = [bag[j], bag[i]];
}
centres.filter((c) => !c.target_cat).forEach((c, i) => (c.target_cat = bag[i]));

for (const c of centres) {
  const [lo, hi] = c.region === 'Marrakech-Safi' ? [29, 33.5] : c.region === 'Casablanca-Settat' && c.target_cat === 'A' ? [22.5, 25] : CAT_RANGE[c.target_cat];
  c.level = between(lo, hi);
  c.souk_dow = 1 + Math.floor(rnd() * 6);
  c.new = false;
  c.trend = between(0.18, 0.42); // croissance annuelle sous-jacente
}
// Quelques unités en déclin (D/E) ou récentes.
centres.filter((c) => ['D', 'E'].includes(c.target_cat)).forEach((c) => (c.trend = between(-0.32, 0.02)));
centres.filter((c) => c.target_cat === 'C').slice(0, 4).forEach((c) => (c.trend = between(-0.2, -0.08)));
centres.filter((c) => ['A', 'B'].includes(c.target_cat) && c.region !== 'Marrakech-Safi').slice(5, 11).forEach((c) => (c.trend = between(-0.26, -0.17)));
const newOnes = centres.filter((c) => c.target_cat === 'B').slice(0, 3);
newOnes.forEach((c) => (c.new = true));

// Facteurs multiplicatifs (cohérents avec ui_facteurs).
const DOW_FACTOR = { 1: 1.12, 2: 1.03, 3: 1.0, 4: 0.98, 5: 0.93, 6: 0.91, 7: 0 };
const SOUK_FACTOR = 0.86;
const FERIE_FACTOR = 0.36;

// ---------------------------------------------------------------- météo
function weatherFor(c, day) {
  const south = c.latitude < 31.5;
  const mountain = /Imilchil|Tounfite|Msemrir|Tabant|Zaouiat|Imlil|Ijoukak|Tighdouine|Ikniouen|Amellago|Timahdite|Aguelmam|Issaguen|Bab Berred/.test(c.centre_name);
  const month = Number(day.slice(5, 7));
  const base = 28 + (month - 5) * 3 + (south ? 4 : 0) - (mountain ? 6 : 0) - (c.latitude > 34.3 ? 3 : 0);
  const tmax = r1(base + gauss() * 2.5);
  const tmin = r1(tmax - between(11, 16));
  const storm = rnd() < (mountain ? 0.06 : 0.025) && month >= 6;
  const precip = storm ? r1(between(12, 38)) : rnd() < 0.08 ? r1(between(0.2, 4)) : 0;
  const gust = Math.round(between(18, 45) + (rnd() < 0.05 ? 25 : 0));
  const heavy_rain = precip >= 10;
  const strong_wind = gust >= 60;
  const extreme_heat = tmax >= 42;
  const cold = tmin <= 2;
  return {
    t_min_c: tmin,
    t_max_c: tmax,
    precip_mm: precip,
    snow_cm: 0,
    gust_max_kmh: gust,
    heavy_rain,
    snow: false,
    strong_wind,
    extreme_heat,
    cold,
    adverse_weather: heavy_rain || strong_wind || extreme_heat || cold,
  };
}

// ---------------------------------------------------------------- séries quotidiennes (pec)
const ANOMALY_TYPES = [];
for (const c of centres) {
  c.ctx = [];
  c.series = [];
  const silentStart = c.target_cat === 'E' && rnd() < 0.7 ? addDays(DAY_REF, -Math.floor(between(2, 6))) : null;
  for (const day of DAYS) {
    const w = weatherFor(c, day);
    const d = dow(day);
    const cal = calendarOf(day);
    const souk = d === c.souk_dow ? SOUKS[d] : null;
    c.ctx.push({ day, ...w, souk_today: souk, calendar: cal });
    let expected = c.level * DOW_FACTOR[d];
    if (souk) expected *= SOUK_FACTOR;
    if (FERIES[day]) expected *= FERIE_FACTOR;
    if (VEILLES[day]) expected *= 0.82;
    expected = d === 7 ? 0 : r1(expected);
    let factor = 1;
    if (w.heavy_rain) factor *= 0.62;
    if (w.extreme_heat) factor *= 0.88;
    let value = d === 7 ? 0 : poissonish(expected * factor);
    let signal = null;
    if (d !== 7 && rnd() < 0.012) {
      value = Math.round(expected * between(0.15, 0.45));
      signal = 'DAY_ANOMALY';
    }
    if (d !== 7 && w.heavy_rain && value < expected * 0.6) signal = 'DAY_ANOMALY';
    if (d !== 7 && rnd() < 0.004) {
      value = Math.round(expected * between(1.7, 2.2));
      signal = 'DAY_HIGH';
    }
    if (silentStart && day >= silentStart && d !== 7) {
      value = 0;
      signal = 'SILENT_CENTRE';
    }
    c.series.push({ day, value, expected, signal });
  }
}

// Indicateurs de catégorie (30 derniers jours ouverts).
const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
for (const c of centres) {
  const last = c.series.filter((s) => s.day > addDays(DAY_REF, -30) && dow(s.day) !== 7 && !FERIES[s.day]);
  const prev = c.series.filter((s) => s.day <= addDays(DAY_REF, -30) && s.day > addDays(DAY_REF, -60) && dow(s.day) !== 7 && !FERIES[s.day]);
  // Le niveau retenu est la moyenne attendue, hors jours de silence, pour rester fidèle à la catégorie cible.
  const vals = last.map((s) => (s.signal === 'SILENT_CENTRE' ? s.expected : s.value));
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length - 1));
  const half = (1.96 * sd) / Math.sqrt(vals.length);
  c.mean_value = r1(mean);
  c.ci_low = r1(mean - half);
  c.ci_high = r1(mean + half);
  c.category = categoryOf(c.mean_value);
  const meanPrev = prev.reduce((a, s) => a + s.value, 0) / prev.length;
  c.mean_prev = r1(c.trend < 0 ? meanPrev * (1 - c.trend * 0.6) : meanPrev);
  c.adj_change_pct = r1(((c.mean_value - c.mean_prev) / c.mean_prev) * 100);
  c.trend_z = r2(c.adj_change_pct / 8);
  c.days_open = last.length;
  c.days_zero = last.filter((s) => s.value === 0).length;
  c.pct_days_over_target = r1((last.filter((s) => s.value >= 21).length / last.length) * 100);
  const reasons = [];
  if (c.category === 'E' || c.category === 'D') {
    reasons.push(`Niveau faible : ${c.mean_value.toFixed(1).replace('.', ',')} prises en charge par jour (IC 95 % ${c.ci_low.toFixed(1).replace('.', ',')}–${c.ci_high.toFixed(1).replace('.', ',')}), cible 21`);
  }
  if (c.adj_change_pct <= -12) reasons.push(`Baisse de ${Math.abs(c.adj_change_pct).toFixed(0)} % par rapport aux 30 jours précédents`);
  if (c.days_zero >= 2) reasons.push(`${c.days_zero} jours sans activité sur ${c.days_open} jours ouvrés`);
  c.attention = reasons.length > 0;
  c.attention_reason = reasons.length ? reasons.join(' ; ') : null;
}

// ---------------------------------------------------------------- événements
const events = [];
let evId = 5001;
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const frDay = (d) => `${Number(d.slice(8, 10))}${d.slice(8, 10) === '01' ? 'er' : ''} ${MOIS[Number(d.slice(5, 7)) - 1]}`;
const frNum = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
const signalMessage = {
  SILENT_CENTRE: (c, s) => `Aucune prise en charge enregistrée depuis le ${frDay(s.first_seen)} (${frNum(s.last_expected)} attendues par jour).`,
  DAY_ANOMALY: (c, s) => `Activité très inférieure à l’attendu : ${s.last_value} prises en charge pour ${frNum(s.last_expected)} attendues.`,
  TREND_DROP: (c) => `Baisse durable de ${Math.abs(c.adj_change_pct).toFixed(0)} % sur 30 jours.`,
  LOW_LEVEL: (c) => `Niveau durablement sous la cible : ${c.mean_value.toFixed(1).replace('.', ',')} par jour pour une cible de 21.`,
};
for (const c of centres) {
  const silent = c.series.filter((s) => s.signal === 'SILENT_CENTRE');
  if (silent.length) {
    events.push({ c, signal_type: 'SILENT_CENTRE', severity: 'high', first_seen: silent[0].day, last_seen: silent[silent.length - 1].day, occurrences: silent.length, last_value: 0, last_expected: silent[silent.length - 1].expected });
  }
  if (c.category === 'E' && !silent.length) events.push({ c, signal_type: 'LOW_LEVEL', severity: 'high', first_seen: addDays(DAY_REF, -12), last_seen: DAY_REF, occurrences: 9, last_value: c.series[c.series.length - 1].value, last_expected: 21 });
  if (c.category === 'D') events.push({ c, signal_type: 'LOW_LEVEL', severity: 'medium', first_seen: addDays(DAY_REF, -20), last_seen: DAY_REF, occurrences: 14, last_value: c.series[c.series.length - 1].value, last_expected: 21 });
  if (c.adj_change_pct <= -12 && c.category !== 'D' && c.category !== 'E') events.push({ c, signal_type: 'TREND_DROP', severity: 'medium', first_seen: addDays(DAY_REF, -9), last_seen: DAY_REF, occurrences: 6, last_value: Math.round(c.mean_value), last_expected: Math.round(c.mean_prev) });
  const anomalies = c.series.filter((s) => s.signal === 'DAY_ANOMALY' && s.day >= addDays(DAY_REF, -21));
  for (const s of anomalies) events.push({ c, signal_type: 'DAY_ANOMALY', severity: 'low', first_seen: s.day, last_seen: s.day, occurrences: 1, last_value: s.value, last_expected: s.expected });
}
const ACKERS = ['Coordination L’Oriental', 'Direction du programme', 'Coordination Drâa-Tafilalet', 'Coordination Souss-Massa'];
const EXPLANATIONS = ['Pluie forte, piste coupée', 'Médecin en formation régionale', 'Jour de souk exceptionnel (moussem)', 'Coupure réseau, saisie différée', 'Véhicule en révision'];
const eventRows = events
  .sort((a, b) => (a.first_seen < b.first_seen ? 1 : -1))
  .map((e) => {
    const old = e.signal_type === 'DAY_ANOMALY' && e.first_seen < addDays(DAY_REF, -2);
    const status = old ? (rnd() < 0.5 ? 'explained' : 'resolved') : 'open';
    const ackAt = old ? `${addDays(e.first_seen, 1)}T09:${String(10 + Math.floor(rnd() * 40)).padStart(2, '0')}:00+01:00` : null;
    const row = {
      id: evId++,
      centre_id: e.c.centre_id,
      centre_name: e.c.centre_name,
      province: e.c.province,
      region: e.c.region,
      signal_type: e.signal_type,
      severity: e.severity,
      status,
      first_seen: e.first_seen,
      last_seen: e.last_seen,
      occurrences: e.occurrences,
      last_value: e.last_value,
      last_expected: e.last_expected,
      message: signalMessage[e.signal_type](e.c, e),
      explanation: old ? pick(EXPLANATIONS) : null,
      explanation_source: old ? 'manuel' : null,
      ack_by: old ? pick(ACKERS) : null,
      ack_at: ackAt,
    };
    return row;
  });
for (const c of centres) c.open_events = eventRows.filter((e) => e.centre_id === c.centre_id && e.status === 'open').length;

// ---------------------------------------------------------------- écriture
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const write = (rel, data, compact = false) => {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, compact ? JSON.stringify(data) : `${JSON.stringify(data, null, 2)}\n`);
};

// ui_map
write('ui_map.json', centres.map((c) => ({
  centre_id: c.centre_id, centre_name: c.centre_name, province: c.province, region: c.region,
  latitude: c.latitude, longitude: c.longitude, category: c.category, mean_value: c.mean_value,
  attention: c.attention, attention_reason: c.attention_reason, open_events: c.open_events,
})));

// sup_centre_category_list (toutes les unités ; le serveur filtre p_attention_only)
write('sup_centre_category_list.json', centres.map((c) => ({
  measure: 'pec', period_end: DAY_REF, centre_id: c.centre_id, centre_name: c.centre_name, province: c.province, region: c.region,
  category: c.category, mean_value: c.mean_value, ci_low: c.ci_low, ci_high: c.ci_high, pct_days_over_target: c.pct_days_over_target,
  mean_prev: c.mean_prev, adj_change_pct: c.adj_change_pct, trend_z: c.trend_z, days_open: c.days_open, days_zero: c.days_zero,
  attention: c.attention, attention_reason: c.attention_reason,
})));

write('ui_events.json', eventRows);

// ui_dashboard
const today = centres.map((c) => c.series[c.series.length - 1].value);
const pecTotal = today.reduce((a, b) => a + b, 0);
const consultationsTotal = Math.round(pecTotal * 0.78);
write('ui_dashboard.json', {
  day: DAY_REF,
  centres_actifs: centres.length,
  centres_total: centres.length,
  pec_total: pecTotal,
  patients_total: Math.round(consultationsTotal * 0.96),
  consultations_total: consultationsTotal,
  admissions_total: Math.round(pecTotal * 0.92),
  pec_median_centre: median(today),
  events_open: eventRows.filter((e) => e.status === 'open').length,
  events_urgent: eventRows.filter((e) => e.status === 'open' && e.severity === 'high').length,
  attention: centres.filter((c) => c.attention).length,
  last_night: { run_id: 'nuit-2026-08-13', started_at: '2026-08-13T02:00:04+01:00', ended_at: '2026-08-13T02:04:37+01:00', ok: true },
});

// ui_centre_detail / ctx_centre_context (un fichier par unité)
const MONTH_ENDS = ['2025-09-30', '2025-10-31', '2025-11-30', '2025-12-31', '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30', '2026-07-31', DAY_REF];
for (const c of centres) {
  const history = MONTH_ENDS.map((period_end, i) => {
    const back = MONTH_ENDS.length - 1 - i;
    const m = c.mean_value / (1 + c.trend) ** (back / 12) + gauss() * 1.2;
    return { period_end, category: c.new && back > 5 ? 'N' : categoryOf(m), mean_value: r1(Math.max(0, m)) };
  });
  write(`ui_centre_detail/${c.centre_id}.json`, {
    measure: 'pec',
    centre: {
      centre_id: c.centre_id, centre_name: c.centre_name, province: c.province, region: c.region,
      latitude: c.latitude, longitude: c.longitude, category: c.category, mean_value: c.mean_value,
      ci_low: c.ci_low, ci_high: c.ci_high, days_zero: c.days_zero, attention_reason: c.attention_reason, target: 21,
    },
    series: c.series,
    category_history: c.new ? history.filter((h) => h.category !== 'N' || h.period_end >= '2026-01-31') : history,
    events: eventRows.filter((e) => e.centre_id === c.centre_id),
  }, true);
  write(`ctx_centre_context/${c.centre_id}.json`, c.ctx, true);
}

// ---------------------------------------------------------------- causes (catalogue de la base, database/20)
const sql20 = fs.readFileSync(path.join(ROOT, 'database', '20_anomalies_causes.sql'), 'utf-8');
const CAUSES = [...sql20.matchAll(/^\s*\('(\d+\.\d+|X)','([^']+)','((?:[^']|'')+)','((?:[^']|'')+)','([^']+)','([^']+)',(true|false)\)/gm)].map((m) => ({
  code: m[1],
  famille: m[2],
  libelle: m[3].replace(/''/g, "'"),
  effet: m[4].replace(/''/g, "'"),
  portee: m[5],
  donnees: m[6],
  detection_auto: m[7] === 'true',
}));
if (CAUSES.length < 40) throw new Error(`Catalogue des causes incomplet (${CAUSES.length})`);
write('ui_causes.json', CAUSES);

// ---------------------------------------------------------------- facteurs (forme de ui_facteurs, script 20)
function verdictOf(f, eff, lo, hi, n) {
  if (n < 30) return 'trop peu de jours';
  if (f === 'lundi' || f === 'vendredi') return 'référence par jour de semaine';
  if (lo > 0) return eff >= 5 ? 'hausse démontrée' : 'hausse faible';
  if (hi < 0) return eff <= -5 ? 'baisse démontrée' : 'baisse faible';
  return "pas d'effet démontré";
}
write('ui_facteurs.json', [
  ['ferie', 'Jour férié ou fête', 'Calendrier', 'national', -91.5, -94.2, -88.8, 1840, 22.4, 0.6],
  ['veille_fete', 'Veille de fête', 'Calendrier', 'national', -17.8, -24.6, -11.0, 410, 3.1, 1.1],
  ['lendemain_fete', 'Lendemain de fête (2 jours)', 'Calendrier', 'national', 6.2, 1.4, 11.0, 820, 4.0, 2.1],
  ['ramadan', 'Ramadan', 'Calendrier', 'national', -15.4, -17.9, -12.9, 5230, 14.8, 7.6],
  ['vacances', 'Vacances scolaires', 'Calendrier', 'national', 1.8, -0.9, 4.5, 9120, 21.0, 22.3],
  ['fin_mois', 'Fin de mois (26 au 31)', 'Calendrier', 'national', -2.1, -3.9, -0.3, 6010, 17.2, 16.5],
  ['debut_mois', 'Début de mois (1 au 5)', 'Calendrier', 'national', 3.4, 1.5, 5.3, 5480, 16.1, 15.9],
  ['ete', 'Été (juillet-août)', 'Calendrier', 'national', -6.8, -8.6, -5.0, 8930, 19.5, 17.4],
  ['hiver', 'Hiver (décembre à février)', 'Calendrier', 'national', 4.9, 3.0, 6.8, 8710, 18.3, 24.2],
  ['lundi', 'Lundi', 'Calendrier', 'national', 0.4, -1.1, 1.9, 6320, 21.7, 17.0],
  ['vendredi', 'Vendredi', 'Calendrier', 'national', -0.3, -1.8, 1.2, 6290, 15.2, 16.9],
  ['souk', 'Jour de souk (≤ 20 km)', 'Calendrier', 'unité', -11.6, -14.1, -9.1, 7410, 24.8, 19.6],
  ['pluie_forte', 'Pluie forte', 'Environnement', 'province', -33.9, -38.7, -29.1, 412, 6.3, 1.0],
  ['pluie_moderee', 'Pluie modérée (5 mm à seuil)', 'Environnement', 'province', -8.7, -12.9, -4.5, 980, 4.1, 2.5],
  ['neige', 'Neige', 'Environnement', 'province', -52.0, -68.3, -35.7, 24, 0.9, 0.1],
  ['vent', 'Vent fort', 'Environnement', 'province', -4.1, -9.8, 1.6, 640, 2.6, 1.7],
  ['chaleur', 'Chaleur extrême', 'Environnement', 'province', -19.6, -23.0, -16.2, 1720, 9.8, 4.4],
  ['froid', 'Froid', 'Environnement', 'province', -2.9, -7.7, 1.9, 1180, 3.3, 3.0],
  ['hors_ligne_fort', 'Plus de la moitié des saisies hors ligne', 'Offre de soins', 'unité', -3.5, -6.2, -0.8, 2310, 12.9, 6.0],
].map(([facteur, libelle, famille, portee, effet_pct, ic_bas, ic_haut, n_jours, pct_anomalies, pct_jours_normaux]) => ({
  facteur, libelle, famille, portee, effet_pct, ic_bas, ic_haut, n_jours, pct_anomalies, pct_jours_normaux,
  lift: r2(pct_anomalies / pct_jours_normaux),
  verdict: verdictOf(facteur, effet_pct, ic_bas, ic_haut, n_jours),
})));

// ---------------------------------------------------------------- anomalies (forme de ui_anomalies, script 20)
const anomalies = [];
let anId = 9001;
const COMMENTS = ['Piste coupée après l’orage, confirmé par le coordinateur.', 'Médecin en formation régionale ce jour-là.', 'Saisies hors ligne synchronisées le lendemain.', 'Variation normale, pas d’action.'];
const ferieDays = new Set(Object.keys(FERIES));
const wasHoliday = (day, n) => ferieDays.has(addDays(day, -n));
const causeLibelle = Object.fromEntries(CAUSES.map((c) => [c.code, c.libelle]));
for (const c of centres) {
  c.series.forEach((s, i) => {
    if (!s.signal) return;
    if (s.signal === 'SILENT_CENTRE' && c.series[i - 1]?.signal === 'SILENT_CENTRE' && i < c.series.length - 1) return;
    const ctx = c.ctx[i];
    const type = s.signal === 'DAY_HIGH' ? 'consultations_hautes' : rnd() < 0.1 ? 'ecart_admissions' : 'consultations_basses';
    const observe = type === 'ecart_admissions' ? Math.round(s.expected * between(0.3, 0.55)) : s.value;
    const attendu = r1(s.expected);
    const meteo = [ctx.precip_mm >= 10 ? `pluie ${ctx.precip_mm} mm` : null, ctx.t_max_c >= 42 ? `chaleur ${ctx.t_max_c} °C` : null, ctx.gust_max_kmh >= 60 ? `vent ${ctx.gust_max_kmh} km/h` : null]
      .filter(Boolean)
      .join(', ');
    const baisseProv = rnd() < 0.12 ? Math.round(between(50, 80)) : rnd() < 0.3 ? Math.round(between(5, 35)) : null;
    const zerosBefore = s.signal === 'SILENT_CENTRE' ? c.series.slice(Math.max(0, i - 6), i).filter((x) => x.value === 0 && dow(x.day) <= 5).length : 0;
    const provisoire = s.day >= addDays(DAY_REF, -2) || undefined;
    const contexte = {
      meteo: meteo || undefined,
      calendrier: ctx.calendar ?? undefined,
      souk: ctx.souk_today ?? undefined,
      lendemain_fete: wasHoliday(s.day, 1) || wasHoliday(s.day, 2) || undefined,
      veille_fete: ferieDays.has(addDays(s.day, 1)) || undefined,
      baisse_province_pct: baisseProv ?? undefined,
      baisse_reseau_pct: Math.round(between(2, 9)),
      hors_ligne_pct: observe > 0 ? Math.round(rnd() < 0.2 ? between(40, 90) : between(0, 15)) : undefined,
      jours_zero_avant: zerosBefore,
      provisoire,
    };
    // Arbre de décision simplifié du script 20 : la première règle vraie l'emporte.
    let rule;
    if (type === 'consultations_basses') {
      if (baisseProv >= 50 && ctx.precip_mm >= 10) rule = ['2.2', 'Baisse commune à la province avec météo défavorable', 'forte'];
      else if (baisseProv >= 50) rule = ['4.9', 'Baisse commune à la province sans météo : grève, événement ou fête locale ?', 'moyenne'];
      else if (ctx.precip_mm >= 10) rule = ['2.2', 'Fortes pluies à l’emplacement de l’unité', 'moyenne'];
      else if (ctx.t_max_c >= 42) rule = ['2.3', 'Chaleur extrême', 'faible'];
      else if (observe === 0 && zerosBefore >= 2) rule = ['4.5', 'Unité à l’arrêt plusieurs jours : panne, véhicule ou fermeture', 'moyenne'];
      else if (observe === 0) rule = ['4.1', 'Aucune consultation un jour ouvré : médecin absent ?', 'moyenne'];
      else if (provisoire) rule = ['7.1', 'Journée non consolidée : saisies hors ligne en attente', 'faible'];
    } else if (type === 'consultations_hautes') {
      if (contexte.lendemain_fete) rule = ['1.4', 'Rattrapage après une fête ou un pont', 'moyenne'];
      else if (ctx.souk_today) rule = ['1.5', 'Jour de souk', 'faible'];
      else rule = ['3.5', 'Hausse ponctuelle : campagne, caravane, épidémie ou doublons ? à vérifier', 'faible'];
    } else {
      rule = observe < attendu ? ['7.6', 'Admissions non saisies ce jour (agent d’accueil absent ?)', 'moyenne'] : ['7.4', 'Plus d’admissions que d’habitude : doublons ou patients non vus ?', 'faible'];
    }
    rule ??= ['X', 'Aucune cause connue : demander au coordinateur', 'aucune'];
    const recent = s.day >= addDays(DAY_REF, -14);
    const statut = recent ? 'a_enqueter' : pick(['explique', 'explique', 'confirme', 'ecarte', 'a_enqueter']);
    const done = statut !== 'a_enqueter';
    const confirmed = rule[0] === 'X' ? pick(['1.6', '4.7', '2.7']) : rule[0];
    anomalies.push({
      id: anId++,
      centre_id: c.centre_id, centre_name: c.centre_name, province: c.province, region: c.region,
      jour: s.day,
      type,
      observe,
      attendu,
      ecart_pct: attendu ? Math.round(((observe - attendu) / attendu) * 100) : null,
      score: r2(((observe - attendu) / Math.max(1.3 * Math.sqrt(Math.max(attendu, 1)), 1)) * (type === 'consultations_hautes' ? 1 : 1)),
      contexte: JSON.parse(JSON.stringify(contexte)),
      cause_proposee: rule[1],
      cause_code: rule[0],
      confiance: rule[2],
      statut,
      cause_confirmee: done && statut !== 'ecarte' ? confirmed : null,
      commentaire: done ? pick(COMMENTS) : null,
      par: done ? pick(ACKERS) : null,
      maj: done ? `${addDays(s.day, 2)}T10:15:00+01:00` : null,
    });
  });
}
anomalies.sort((a, b) => Math.abs(b.score) - Math.abs(a.score) || (a.jour < b.jour ? 1 : -1));
write('ui_anomalies.json', anomalies);
void causeLibelle;

// ---------------------------------------------------------------- prévision (forme de ui_prevision, script 22)
const TERMS = [
  ['Constante', -0.018, 'n'], ['Veille de fête', -0.196, 410], ['Lendemain de fête (2 jours)', 0.06, 820], ['Ramadan', -0.169, 5230],
  ['Part de Ramadan dans la référence', 0.121, 6900], ['Vacances scolaires', 0.012, 9120], ['Été (juillet-août)', -0.07, 8930],
  ['Hiver (décembre à février)', 0.048, 8710], ['Début de mois (1 au 5)', 0.031, 5480], ['Fin de mois (26 au 31)', -0.022, 6010],
  ['Pluie modérée', -0.091, 980], ['Pluie forte', -0.414, 412], ['Neige', -0.73, 24], ['Vent fort', -0.042, 640],
  ['Chaleur extrême', -0.218, 1720], ['Froid', -0.029, 1180],
];
const equation = TERMS.map(([terme, b, n], i) => {
  const se = i === 0 ? 0.01 : Math.min(0.25, 0.9 / Math.sqrt(Number(n)));
  return {
    terme,
    coefficient: Math.round(b * 10000) / 10000,
    effet_pct: r1((Math.exp(b) - 1) * 100),
    ic_bas_pct: r1((Math.exp(b - 1.96 * se) - 1) * 100),
    ic_haut_pct: r1((Math.exp(b + 1.96 * se) - 1) * 100),
    n_jours: i === 0 ? 182400 : n,
  };
});
const PREV_FROM = addDays(DAY_REF, 1);
for (const c of centres) {
  const days = range(PREV_FROM, addDays(PREV_FROM, 13));
  const sigma = between(0.22, 0.34) + (c.category === 'E' ? 0.12 : 0);
  const jours = days.map((day) => {
    const d = dow(day);
    const souk = d === c.souk_dow ? SOUKS[d] : null;
    const ferie = Boolean(FERIES[day]);
    const hot = c.latitude < 31.5 && rnd() < 0.3;
    const reference = d === 7 ? 0 : r1(c.level * 0.78 * DOW_FACTOR[d] * (souk ? SOUK_FACTOR : 1));
    const s = -0.018 - 0.07 + (hot ? -0.218 : 0) + (ferieDays.has(addDays(day, 1)) ? -0.196 : 0) + (wasHoliday(day, 1) || wasHoliday(day, 2) ? 0.06 : 0);
    const prevu = ferie || d === 7 ? 0 : r1(Math.max(0, (reference + 1) * Math.exp(s + (sigma * sigma) / 2) - 1));
    const bas = ferie || d === 7 ? 0 : r1(Math.max(0, (reference + 1) * Math.exp(s - 1.645 * sigma) - 1));
    const haut = ferie || d === 7 ? 0 : r1(Math.max(0, (reference + 1) * Math.exp(s + 1.645 * sigma) - 1));
    return { jour: day, prevu, bas, haut, reference, ferie, souk, meteo: hot ? 'chaleur' : null };
  });
  write(`ui_prevision/${c.centre_id}.json`, {
    centre: { centre_id: c.centre_id, centre_name: c.centre_name, province: c.province },
    modele: { version: 'v2026-08-13', ajuste_le: '2026-08-13T03:12:00+01:00', erreur_moyenne_pct: 21.4, erreur_reference_seule_pct: 24.9, n_jours_test: 7410 },
    jours,
    equation,
  }, true);
}

// ---------------------------------------------------------------- consultations annuelles par unité
const OPEN_DAYS_YEAR = 296;
for (const c of centres) {
  const share = c.new ? between(0.4, 0.6) : 1;
  c.consult_day = c.mean_value * 0.78;
  c.consult_12m = Math.round(c.consult_day * OPEN_DAYS_YEAR * share / (1 + c.trend / 4));
  c.days_active_12m = Math.round(OPEN_DAYS_YEAR * share - c.days_zero * 4);
}

// ui_population (par province, script 21)
const provinces = [...new Map(centres.map((c) => [c.province, c.region])).entries()];
const population = provinces.map(([province, region]) => {
  const pop = POPULATION[province];
  const units = centres.filter((c) => c.province === province);
  const cons = units.reduce((a, c) => a + c.consult_12m, 0);
  const patients = Math.round(cons * 0.42);
  return {
    region, province, population: pop, menages: Math.round(pop / 4.3), population_rurale: Math.round(pop * between(0.45, 0.8)),
    centres: units.length, consultations_12_mois: cons, pour_1000_hab_an: r1((cons / pop) * 1000),
    patients_12_mois: patients, couverture_pct: r2((patients / pop) * 100), habitants_par_unite: Math.round(pop / units.length),
    source: 'HCP, RGPH 2024 (population légale)',
  };
}).sort((a, b) => a.region.localeCompare(b.region, 'fr') || a.province.localeCompare(b.province, 'fr'));
write('ui_population.json', population);

// ui_evolution (par unité, script 23)
const evolution = centres.map((c) => {
  const pop = POPULATION[c.province];
  const unites = centres.filter((x) => x.province === c.province).length;
  const tendance = r1(c.trend * 100);
  const tstat = r2((c.trend / 0.07) * (c.new ? 0.4 : 1));
  const parJour = r1(c.consult_day);
  const prev3 = r1(parJour * (1 + c.trend) ** 0.25);
  const zero90 = c.days_zero * 3;
  const ano90 = Math.min(9, Math.round(c.days_zero + (c.category === 'E' ? 3 : c.category === 'D' ? 1 : 0)));
  const pour1000 = r1((c.consult_12m / (pop / unites)) * 1000);
  let statut;
  if (c.new) statut = 'nouveau';
  else if (tendance <= -15 && Math.abs(tstat) >= 2 && (parJour < 13 || prev3 < 8)) statut = 'a_risque';
  else if (tendance <= -15 && Math.abs(tstat) >= 2) statut = 'declin';
  else if (parJour < 8 || zero90 >= 20) statut = 'a_risque';
  else if (tendance >= 15 && Math.abs(tstat) >= 2) statut = 'croissance';
  else statut = 'stable';
  return { c, pop, unites, tendance, tstat, parJour, prev3, zero90, ano90, pour1000, statut };
});
const med1000 = median(evolution.filter((e) => e.statut !== 'nouveau').map((e) => e.pour1000));
const order = { a_risque: 1, declin: 2, nouveau: 3, stable: 4, croissance: 5 };
write('ui_evolution.json', evolution
  .sort((a, b) => order[a.statut] - order[b.statut] || a.tendance - b.tendance)
  .map(({ c, pop, unites, tendance, tstat, parJour, prev3, zero90, ano90, pour1000, statut }) => {
    const fr = (x) => String(x).replace('.', ',');
    const signaux = [
      tendance <= -15 && Math.abs(tstat) >= 2 ? `Baisse de ${fr(Math.abs(tendance))} % par an` : null,
      tendance >= 15 && Math.abs(tstat) >= 2 ? `Hausse de ${fr(tendance)} % par an` : null,
      parJour < 13 ? `${fr(parJour)} consultations par jour ouvré (objectif 21)` : null,
      prev3 < 8 ? `Projection à 3 mois : ${fr(prev3)} par jour` : null,
      zero90 >= 10 ? `${zero90} jours ouvrés sans activité sur 90` : null,
      ano90 >= 3 ? `${ano90} baisses anormales non expliquées sur 90 jours` : null,
      pour1000 < med1000 / 2 ? `Fréquentation faible : ${fr(pour1000)} pour 1 000 habitants (médiane ${Math.round(med1000)})` : null,
    ].filter(Boolean);
    let reco;
    if (statut === 'nouveau') reco = 'Suivre la montée en charge (3 à 6 mois) ; informer la population des jours de passage.';
    else if (zero90 >= 20) reco = 'Vérifier l’équipe, le véhicule et le matériel : trop de jours sans activité.';
    else if (statut === 'a_risque' && pour1000 < med1000 / 2) reco = 'Informer la population (souk, associations, radio) et étudier un emplacement plus proche des douars peuplés.';
    else if (statut === 'a_risque') reco = 'Enquête terrain : causes des baisses, horaires, équipe ; campagne d’information au souk.';
    else if (statut === 'declin') reco = 'Analyser les baisses anormales récentes et les retours terrain ; vérifier l’offre (médecin, télé-expertise).';
    else if (statut === 'croissance' && parJour >= 30) reco = 'Forte demande : renforcer (deuxième station, télé-expertise) pour éviter l’attente.';
    else if (pour1000 < med1000 / 2) reco = 'Fréquentation faible pour la population : campagne d’information.';
    else reco = 'Poursuivre le suivi.';
    return {
      centre_id: c.centre_id, centre_name: c.centre_name, province: c.province, region: c.region,
      population_province: pop, unites_province: unites, premier_jour: c.new ? '2026-03-02' : '2023-10-19',
      consultations_periode: c.consult_12m, par_jour_3_derniers_mois: parJour, tendance_pct_an: tendance, t_stat: tstat,
      prevision_3_mois: prev3, pour_1000_hab_an: pour1000, mediane_reseau_pour_1000: r1(med1000),
      jours_sans_activite_90: zero90, anomalies_ouvertes_90: ano90, statut, signaux, recommandation: reco,
    };
  }));

// ---------------------------------------------------------------- flux_indicateurs
// volumes mensuels nationaux : 2026 ≈ +29 % sur 2025 (janvier–juillet), creux du Ramadan.
const julyDaily = centres.reduce((a, c) => a + c.consult_day, 0); // consultations par jour ouvré
const monthFactor2026 = { 1: 0.9, 2: 0.82, 3: 0.84, 4: 0.95, 5: 0.97, 6: 1.0, 7: 1.0, 8: 0.97 };
const monthFactor2025 = { 1: 0.93, 2: 0.98, 3: 0.79, 4: 0.97, 5: 1.0, 6: 1.0, 7: 1.0, 8: 0.95, 9: 1.0, 10: 1.02, 11: 1.0, 12: 0.96 };
const openDaysIn = (y, m) => range(`${y}-${String(m).padStart(2, '0')}-01`, iso(new Date(Date.UTC(y, m, 0)))).filter((d) => dow(d) !== 7 && !FERIES[d]).length;
const volumes = [];
const growthTarget = { 1: 1.27, 2: 1.31, 3: 1.36, 4: 1.25, 5: 1.29, 6: 1.28, 7: 1.27 };
const v2026 = {};
for (let m = 1; m <= 8; m++) {
  const open = m === 8 ? range('2026-08-01', DAY_REF).filter((d) => dow(d) !== 7).length : openDaysIn(2026, m);
  const ramp = 1 - (7 - Math.min(m, 7)) * 0.012;
  v2026[m] = Math.round(julyDaily * open * monthFactor2026[m] * ramp);
}
const v2025 = {};
for (let m = 1; m <= 12; m++) {
  const base = m <= 7 ? v2026[m] / growthTarget[m] : (v2026[7] / 1.27) * (openDaysIn(2025, m) / openDaysIn(2025, 7)) * monthFactor2025[m] * (1 + (m - 7) * 0.02);
  v2025[m] = Math.round(base);
}
const v2024 = {};
for (let m = 1; m <= 12; m++) v2024[m] = Math.round(v2025[m] / between(1.15, 1.21));
const pushVol = (y, m, cons) => {
  const patients = Math.round(cons * 0.71);
  volumes.push({ periode: `${y}-${String(m).padStart(2, '0')}`, consultations: cons, patients, nouveaux_patients: Math.round(patients * between(0.33, 0.4)) });
};
for (let m = 1; m <= 12; m++) pushVol(2024, m, v2024[m]);
for (let m = 1; m <= 12; m++) pushVol(2025, m, v2025[m]);
for (let m = 1; m <= 8; m++) pushVol(2026, m, v2026[m]);
write('flux_indicateurs/volumes.national.mois.json', volumes);
write('flux_indicateurs/volumes.national.annee.json', [2024, 2025, 2026].map((y) => {
  const rows = volumes.filter((v) => v.periode.startsWith(String(y)));
  return { periode: String(y), consultations: rows.reduce((a, r) => a + r.consultations, 0), patients: Math.round(rows.reduce((a, r) => a + r.patients, 0) * 0.62), nouveaux_patients: rows.reduce((a, r) => a + r.nouveaux_patients, 0) };
}));

write('flux_indicateurs/croissance.national.json', Array.from({ length: 7 }, (_, i) => i + 1).map((m) => ({
  mois: `2026-${String(m).padStart(2, '0')}`,
  consultations_n: v2026[m],
  consultations_n_1: v2025[m],
  variation_pct: r1(((v2026[m] - v2025[m]) / v2025[m]) * 100),
})));

// répartition par région (12 derniers mois)
const regionNames = Object.keys(REGIONS);
const rep = regionNames.map((region) => {
  const units = centres.filter((c) => c.region === region);
  const cons = units.reduce((a, c) => a + c.consult_12m, 0);
  const jours = units.reduce((a, c) => a + c.days_active_12m, 0);
  return { niveau: region, centres: units.length, consultations: cons, patients: Math.round(cons * 0.58), jours_actifs: jours, consultations_par_jour_actif: r1(cons / jours) };
}).sort((a, b) => b.consultations_par_jour_actif - a.consultations_par_jour_actif).map((r, i) => ({ ...r, rang: i + 1 }));
write('flux_indicateurs/repartition.region.json', rep);
write('flux_indicateurs/repartition.province.json', provinces.map(([province]) => {
  const units = centres.filter((c) => c.province === province);
  const cons = units.reduce((a, c) => a + c.consult_12m, 0);
  const jours = units.reduce((a, c) => a + c.days_active_12m, 0);
  return { niveau: province, centres: units.length, consultations: cons, patients: Math.round(cons * 0.58), jours_actifs: jours, consultations_par_jour_actif: r1(cons / jours) };
}).sort((a, b) => b.consultations_par_jour_actif - a.consultations_par_jour_actif).map((r, i) => ({ ...r, rang: i + 1 })));

const totalPatients = Math.round(rep.reduce((a, r) => a + r.patients, 0));
write('flux_indicateurs/retour.national.json', [{ niveau: 'national', patients: totalPatients, patients_revenus: Math.round(totalPatients * 0.304), taux_retour_pct: 30.4 }]);
write('flux_indicateurs/retour.region.json', rep.map((r) => {
  const t = r1(between(25, 35));
  return { niveau: r.niveau, patients: r.patients, patients_revenus: Math.round((r.patients * t) / 100), taux_retour_pct: t };
}));

// carte de chaleur heure × jour (lundi 10 h = pic)
const HOUR_PROFILE = { 7: 0.18, 8: 0.62, 9: 0.92, 10: 1.0, 11: 0.9, 12: 0.7, 13: 0.42, 14: 0.5, 15: 0.56, 16: 0.44, 17: 0.26, 18: 0.1, 19: 0.03 };
const heures = [];
const totalYear = rep.reduce((a, r) => a + r.consultations, 0);
const profSum = Object.values(HOUR_PROFILE).reduce((a, b) => a + b, 0) * Object.values(DOW_FACTOR).reduce((a, b) => a + b, 0);
for (let d = 1; d <= 6; d++) {
  for (let h = 7; h <= 19; h++) {
    const cons = Math.round((totalYear * HOUR_PROFILE[h] * DOW_FACTOR[d] * between(0.97, 1.03)) / profSum);
    const activeHours = Math.round(centres.length * 49 * (h >= 8 && h <= 16 ? 0.96 : h === 17 ? 0.7 : h === 7 ? 0.35 : 0.2));
    heures.push({ jour_semaine: d, heure: h, consultations: cons, heures_actives: activeHours, consultations_par_heure_active: r2(cons / activeHours) });
  }
}
write('flux_indicateurs/heures.national.json', heures);

write('flux_indicateurs/profil.national.json', [
  { dimension: 'sexe', valeur: 'Femme', patients: Math.round(totalPatients * 0.58), part_pct: 58.0 },
  { dimension: 'sexe', valeur: 'Homme', patients: Math.round(totalPatients * 0.42), part_pct: 42.0 },
  { dimension: 'age', valeur: 'Moins de 5 ans', patients: Math.round(totalPatients * 0.11), part_pct: 11.0 },
  { dimension: 'age', valeur: '5 à 14 ans', patients: Math.round(totalPatients * 0.12), part_pct: 12.0 },
  { dimension: 'age', valeur: '15 à 49 ans', patients: Math.round(totalPatients * 0.39), part_pct: 39.0 },
  { dimension: 'age', valeur: '50 à 64 ans', patients: Math.round(totalPatients * 0.2), part_pct: 20.0 },
  { dimension: 'age', valeur: '65 ans et plus', patients: Math.round(totalPatients * 0.18), part_pct: 18.0 },
]);
write('flux_indicateurs/entonnoir.national.json', [{ niveau: 'national', admissions: Math.round(totalYear * 1.12), patients_admis: Math.round(totalPatients * 1.1), consultations: totalYear, patients_consultes: totalPatients, taux_consultes_sur_admis_pct: r1((totalPatients / (totalPatients * 1.1)) * 100) }]);

// ---------------------------------------------------------------- problèmes de pratique (ui_stats_formation, script 24)
const LETTERS = 'ABCDEFGHIKLMNORSTYZ';
const initials = (id) => `Dr ${pick(LETTERS.split(''))}. ${pick(LETTERS.split(''))}. (n° ${id})`;
// [code, libellé (seuils inclus), famille, base, bornes habituelles en %] dans l'ordre du script 24
const PRATIQUE = [
  ['P01', 'Consultation très longue (plus de 60 min)', 'Durée', 'consultations', [0.3, 3]],
  ['P02', 'Dossier ouvert et clôturé en moins d’une minute', 'Durée', 'consultations', [0.5, 4]],
  ['P03', 'Consultation laissée ouverte (clôturée tard, un autre jour ou jamais)', 'Durée', 'consultations', [0.5, 4]],
  ['P04', 'Attente longue (plus de 120 min après l’admission)', 'Attente', 'attentes mesurées', null],
  ['P05', 'Saisie hors horaires (avant 7 h ou après 20 h)', 'Horaires', 'consultations', [0.5, 4]],
  ['P06', 'Consultation un dimanche ou un jour férié', 'Horaires', 'consultations', [0, 1.2]],
  ['P11', 'Ouverture tardive (1re consultation après 10 h)', 'Horaires', 'jours', [3, 14]],
  ['P12', 'Fin précoce (dernière consultation avant 13 h)', 'Horaires', 'jours', [2, 12]],
  ['P07', 'Dossier modifié plus de 3 jours après la consultation', 'Tenue du dossier', 'consultations', [0.3, 3]],
  ['P08', 'Dossier sans conclusion du généraliste', 'Tenue du dossier', 'consultations lues', null],
  ['P09', 'Doublon (même patient, même médecin, même jour)', 'Tenue du dossier', 'consultations', [0.1, 1.5]],
  ['P10', 'Journée surchargée (plus de 80 consultations)', 'Charge', 'consultations', [0, 1]],
  ['P13', 'Saisie hors ligne (souvent la connexion)', 'Information', 'consultations', [2, 25]],
];
function pratiqueRow(groupe_id, groupe_nom, c, consultations, jours) {
  const pct = {};
  for (const [code, , , , range] of PRATIQUE) {
    if (!range) { pct[code] = null; continue; }
    const [lo, hi] = range;
    pct[code] = r1(rnd() < 0.035 ? between(Math.max(hi * 2.5, 6), Math.max(hi * 4, 12)) : between(lo, hi));
  }
  return {
    groupe_id, groupe_nom, centre_name: c.centre_name, region: c.region, province: c.province,
    consultations, jours_actifs: jours, consultations_par_jour: r1(consultations / jours),
    duree_mediane_min: r1(between(6, 14)), attente_mediane_min: null, attentes_mesurees: 0,
    _pct: pct,
  };
}
function addIndicators(rows) {
  const med = Object.fromEntries(PRATIQUE.map(([code]) => {
    const v = rows.map((r) => r._pct[code]).filter((x) => x !== null);
    return [code, v.length ? median(v) : null];
  }));
  for (const r of rows) {
    r.indicateurs = PRATIQUE.map(([code, libelle, famille, base]) => {
      const p = r._pct[code];
      const denom = base === 'jours' ? r.jours_actifs : r.consultations;
      const n = p === null ? null : Math.round((p / 100) * denom);
      const m = med[code];
      const alerte = code !== 'P13' && p !== null && p >= Math.max(2 * (m ?? 0), 5) && (n ?? 0) >= 3;
      return { code, libelle, famille, base, n, pct: p, mediane_reseau_pct: m === null ? null : r1(m), alerte };
    });
    r.problemes = r.indicateurs
      .filter((i) => i.alerte)
      .sort((a, b) => b.pct / Math.max(b.mediane_reseau_pct ?? 0, 0.1) - a.pct / Math.max(a.mediane_reseau_pct ?? 0, 0.1))
      .map((i) => i.libelle);
    delete r._pct;
  }
  return rows.sort((a, b) => b.problemes.length - a.problemes.length || b.consultations - a.consultations);
}
const PERIOD_DAYS = DAYS.filter((d) => dow(d) !== 7 && !FERIES[d]).length;
const doctorRows = [];
let docId = 301;
for (const c of centres) {
  const cons = Math.round(c.mean_value * 0.78 * (PERIOD_DAYS - c.days_zero));
  const second = rnd() < 0.18;
  const mainShare = second ? between(0.72, 0.9) : 1;
  const jours = PERIOD_DAYS - c.days_zero;
  const id1 = docId++;
  doctorRows.push(pratiqueRow(id1, initials(id1), c, Math.round(cons * mainShare), Math.round(jours * mainShare)));
  if (second) {
    const n = Math.round(cons * (1 - mainShare));
    const id2 = docId++;
    if (n >= 10) doctorRows.push(pratiqueRow(id2, initials(id2), c, n, Math.max(1, Math.round(jours * (1 - mainShare)))));
  }
}
write('ui_stats_formation/medecin.json', addIndicators(doctorRows));
write('ui_stats_formation/centre.json', addIndicators(centres.map((c) => {
  const jours = PERIOD_DAYS - c.days_zero;
  return pratiqueRow(c.centre_id, c.centre_name, c, Math.round(c.mean_value * 0.78 * jours), jours);
})));

// ---------------------------------------------------------------- santé du système
const nights = range(addDays(DAY_REF, -6), DAY_REF).reverse().map((day) => {
  const ko = day === addDays(DAY_REF, -4);
  const steps = [
    { etape: 'Ingestion VisioStation', ok: true, duree_s: Math.round(between(80, 140)) },
    { etape: 'Contexte (météo, calendrier, souks)', ok: true, duree_s: Math.round(between(10, 30)) },
    { etape: 'Calcul des séries et catégories', ok: !ko, duree_s: Math.round(between(40, 80)) },
    { etape: 'Détection des signaux', ok: !ko, duree_s: ko ? 0 : Math.round(between(15, 35)) },
    { etape: 'Notifications', ok: !ko, duree_s: ko ? 0 : Math.round(between(2, 6)) },
  ];
  const dur = steps.reduce((a, s) => a + s.duree_s, 0);
  const start = `${day}T02:00:0${Math.floor(between(1, 9))}+01:00`;
  const end = new Date(new Date(start).getTime() + dur * 1000);
  return { run_id: `nuit-${day}`, started_at: start, ended_at: `${iso(end)}T${end.toISOString().slice(11, 19)}+01:00`.replace(/T(\d\d)/, (m, h) => `T${String((Number(h) + 1) % 24).padStart(2, '0')}`), ok: !ko, steps };
});
write('ui_health.json', {
  data_last_day: DAY_REF,
  nights,
  last_deliveries: [
    { channel: 'courriel', recipient: 'direction@ummc.example', sent_at: '2026-08-13T08:00:12+01:00', ok: true, event_id: null },
    { channel: 'sms', recipient: 'coordination-oriental@ummc.example', sent_at: '2026-08-13T02:05:31+01:00', ok: true, event_id: eventRows.find((e) => e.severity === 'high')?.id ?? null },
    { channel: 'courriel', recipient: 'coordination-draa@ummc.example', sent_at: '2026-08-13T08:00:14+01:00', ok: true, event_id: null },
    { channel: 'sms', recipient: 'coordination-souss@ummc.example', sent_at: '2026-08-12T02:05:02+01:00', ok: false, event_id: eventRows[3]?.id ?? null },
    { channel: 'courriel', recipient: 'medecin-referent@ummc.example', sent_at: '2026-08-12T08:00:09+01:00', ok: true, event_id: null },
  ],
  context_loads: [
    { dataset: 'Météo quotidienne', loaded_at: '2026-08-13T01:40:00+01:00', n_rows: 100 * 7, status: 'ok' },
    { dataset: 'Calendrier (fériés, vacances)', loaded_at: '2026-08-01T01:30:00+01:00', n_rows: 412, status: 'ok' },
    { dataset: 'Souks hebdomadaires', loaded_at: '2026-07-15T10:12:00+01:00', n_rows: 100, status: 'ok' },
    { dataset: 'Population (RGPH 2024)', loaded_at: '2026-06-02T09:00:00+01:00', n_rows: population.length, status: 'ok' },
    { dataset: 'Prévisions météo', loaded_at: '2026-08-12T01:40:00+01:00', n_rows: 100 * 14, status: 'en retard' },
  ],
});

// ---------------------------------------------------------------- contrôle
const counts = Object.fromEntries(CATS.map((k) => [k, centres.filter((c) => c.category === k).length]));
console.log('Catégories', counts);
console.log('Unités à surveiller', centres.filter((c) => c.attention).length);
console.log('Alertes ouvertes', eventRows.filter((e) => e.status === 'open').length, 'urgentes', eventRows.filter((e) => e.status === 'open' && e.severity === 'high').length);
console.log('Consultations du jour', consultationsTotal, 'pec', pecTotal);
console.log('Croissance jan–juil', r1(((Object.values(v2026).slice(0, 7).reduce((a, b) => a + b, 0) / Object.values(v2025).slice(0, 7).reduce((a, b) => a + b, 0)) - 1) * 100), '%');
console.log('Rang 1', rep[0].niveau, rep[0].consultations_par_jour_actif, '| suivants', rep.slice(1, 3).map((r) => `${r.niveau} ${r.consultations_par_jour_actif}`).join(', '));
console.log('Anomalies', anomalies.length, 'à enquêter', anomalies.filter((a) => a.statut === 'a_enqueter').length);
console.log('Médecins', doctorRows.length, 'avec problème', doctorRows.filter((r) => r.problemes.length).length);
