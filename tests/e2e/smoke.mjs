// Test de fumée : démarre `next start` (données de démonstration), ouvre chaque écran en thème
// clair et sombre, vérifie l'absence d'erreur console et de débordement horizontal, et enregistre
// une capture dans docs/captures/<ecran>_<theme>.png.
// Prérequis : `npm run build`. Usage : npm run test:e2e
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const OUT = path.join(ROOT, 'docs', 'captures');
const SCREENS = [
  ['vue-ensemble', '/'],
  ['carte', '/carte'],
  ['liste-rouge', '/liste-rouge'],
  ['alertes', '/alertes'],
  ['unites', '/unites'],
  ['fiche-unite', '/unites/24'],
  ['affluence', '/affluence'],
  ['evolution', '/evolution'],
  ['prevision', '/prevision'],
  ['anomalies', '/anomalies'],
  ['facteurs', '/facteurs'],
  ['pratique', '/statistiques'],
  ['second-avis', '/second-avis'],
  ['sante', '/sante'],
];

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitFor(url, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* pas encore prêt */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Le serveur ne répond pas : ${url}`);
}

const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const env = { ...process.env, USE_MOCK: 'true', PORT: String(port) };
delete env.SUPA_URL;
const server = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(port), '-H', '127.0.0.1'], {
  cwd: ROOT,
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: process.platform !== 'win32',
});
// Arrête le serveur et ses processus enfants.
const stopServer = () => {
  try {
    if (process.platform !== 'win32') process.kill(-server.pid, 'SIGTERM');
    else server.kill();
  } catch {
    /* déjà arrêté */
  }
};
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));

const failures = [];
let browser;
try {
  await waitFor(`${base}/api/session`);
  fs.mkdirSync(OUT, { recursive: true });
  browser = await chromium.launch();

  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'fr-MA', timezoneId: 'Africa/Casablanca' });
    await context.addInitScript((t) => {
      try {
        localStorage.setItem('ummc-theme', t);
      } catch {
        /* stockage indisponible */
      }
    }, theme);
    const page = await context.newPage();
    for (const [name, url] of SCREENS) {
      const errors = [];
      const onConsole = (msg) => msg.type() === 'error' && errors.push(msg.text());
      const onPageError = (err) => errors.push(String(err));
      page.on('console', onConsole);
      page.on('pageerror', onPageError);
      await page.goto(base + url, { waitUntil: 'networkidle' });
      // données chargées : plus aucun squelette à l'écran
      await page.waitForFunction(() => document.querySelectorAll('.skeleton').length === 0, null, { timeout: 20000 }).catch(() => errors.push('squelettes encore visibles après 20 s'));
      if (name === 'carte') {
        await page.waitForSelector('path.leaflet-interactive', { timeout: 15000 }).catch(() => errors.push('fond de carte non affiché'));
        await page.waitForSelector('.unit-marker', { timeout: 15000 }).catch(() => errors.push('aucun repère d’unité'));
      }
      await page.waitForTimeout(250);
      const state = await page.evaluate(() => ({
        theme: document.documentElement.getAttribute('data-theme'),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        banner: Boolean(document.querySelector('[data-testid="mock-banner"]')),
        h1: document.querySelector('h1')?.textContent ?? '',
      }));
      if (state.theme !== theme) errors.push(`thème ${state.theme} au lieu de ${theme}`);
      if (state.overflow > 1) errors.push(`débordement horizontal de ${state.overflow}px`);
      if (!state.banner) errors.push('bandeau « DONNÉES DE DÉMONSTRATION » absent');
      if (!state.h1) errors.push('titre de page absent');
      await page.screenshot({ path: path.join(OUT, `${name}_${theme}.png`), fullPage: true });
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      const status = errors.length ? 'ÉCHEC' : 'ok';
      console.log(`${status.padEnd(5)} ${theme.padEnd(5)} ${name.padEnd(14)} ${state.h1}`);
      if (errors.length) failures.push(`${name} (${theme}) : ${errors.join(' | ')}`);
    }
    await context.close();
  }

  // Téléphone : menu replié, pas de débordement.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await phone.newPage();
  for (const [name, url] of [['vue-ensemble', '/'], ['alertes', '/alertes']]) {
    await p.goto(base + url, { waitUntil: 'networkidle' });
    await p.waitForFunction(() => document.querySelectorAll('.skeleton').length === 0, null, { timeout: 20000 }).catch(() => {});
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const menu = await p.getByRole('button', { name: 'Ouvrir le menu' }).isVisible();
    const toggle = await p.getByTestId('theme-toggle').boundingBox();
    if (!toggle || toggle.x + toggle.width > 390) failures.push(`téléphone ${name} : bouton de thème hors de l’écran`);
    if (overflow > 1) failures.push(`téléphone ${name} : débordement horizontal de ${overflow}px`);
    if (!menu) failures.push(`téléphone ${name} : bouton de menu absent`);
    await p.screenshot({ path: path.join(OUT, `${name}_telephone.png`), fullPage: false });
    console.log(`${overflow > 1 || !menu ? 'ÉCHEC' : 'ok   '} phone ${name}`);
  }
  await phone.close();
} catch (e) {
  failures.push(String(e));
  console.error(serverLog.slice(-3000));
} finally {
  await browser?.close();
  stopServer();
}

if (failures.length) {
  console.error(`\n${failures.length} échec(s) :\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`\nTous les écrans passent (${SCREENS.length} écrans × 2 thèmes). Captures : docs/captures/`);
