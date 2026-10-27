// The prototype gate (`D49`): screenshots the running HUD at both viewports and measures it against
// the board, reporting geometry and colour apart. Geometry is the position of the strongest
// horizontal and vertical edges, matched within 2 px, so a moving panel, row pitch or radius shows up
// while glyph antialiasing does not; colour is the mean ΔE on flat fills (≤ 2). Text is not measured
// yet: its boxes live in `design/frames/<slug>.json` and the check lands with the first DOM panel
// (`[Task-127]`), never as a per-pixel comparison.
//
// A frame names the screen it draws (`design/fixtures/<slug>.json`'s `screen`), so the gate says what
// it measured instead of assuming it: the page's mounted roots are read after the settle, a frame whose
// screen is not on the page is `unavailable` with the screen it needs, and every other root is hidden
// before the capture so the shot holds the frame's one screen and not the live scene painted on top.
//
// Usage:
//   node scripts/hud/diff.mjs --slug 02-options [--url http://127.0.0.1:4173] [--settle 1200]
//   node scripts/hud/diff.mjs --slug 02-options --dev            # boots `vite dev` instead of the preview
//
// Artifacts: design/diff/<slug>/<viewport>.shot.png (the capture), .diff.png (pixelmatch, when the row
// is compared) and report.json.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import pixelmatch from 'pixelmatch';
import pngjs from 'pngjs';

const { PNG } = pngjs;

const GEOMETRY_TOLERANCE = 2;
const COLOUR_TOLERANCE = 2;
const READY_POLL_MS = 100;
const READY_BUDGET_MS = 30000;

const USAGE =
  'usage: node scripts/hud/diff.mjs --slug <slug> [--url <url>] [--dev] [--settle ms]';

/**
 * The panels whose root is a bare marker instead of a `data-hud-panel` value: the board's frame names
 * one of these and the page has to carry it for the row to be comparable.
 */
export const SCREEN_MARKERS = Object.freeze({
  starter: '[data-hud-starter]',
  hud: '[data-hud-strip]',
  'battle-hp': '[data-hud-battle-hp]',
  'battle-log': '[data-hud-battle-log]',
  'run-over': '[data-hud-run-over]',
});

/**
 * Frames the gate cannot frame yet, each with the reason in one line. A frame may only skip a fixture
 * here, and only when its state is not a `HudState` at all.
 */
export const FIXTURE_ALLOWLIST = Object.freeze({
  '03c-panels-compress': 'the compressed state lives in the saved layout, not in a HudState',
});

/** The lower-kebab the `screen` field and a fixture slug share. */
const SCREEN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * Where this machine's Chrome may be, in order: the override first, then Linux, then Windows, so a
 * checkout on any host finds one without `CHROME_PATH`.
 */
export function chromeCandidates(env = process.env) {
  return [
    env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    `${env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].filter(Boolean);
}

/** The first candidate that exists on this machine, or null. */
export function findChrome(env = process.env) {
  return chromeCandidates(env).find((candidate) => existsSync(candidate)) ?? null;
}

/** The screen a fixture file names: its `screen`, or null when absent or not lower-kebab. */
export function screenOf(fixture) {
  if (typeof fixture !== 'object' || fixture === null || Array.isArray(fixture)) return null;
  const value = fixture.screen;
  return typeof value === 'string' && SCREEN.test(value) ? value : null;
}

/** The screen slugs the board's desktop frames carry, ascending. */
export function desktopSlugs(entries) {
  const slugs = new Set();
  for (const entry of entries) {
    const name = String(entry);
    if (!name.toLowerCase().endsWith('.png')) continue;
    const slug = name.slice(0, -'.png'.length);
    if (slug.startsWith('m')) continue;
    slugs.add(slug);
  }
  return [...slugs].sort();
}

/** The screens that have no fixture, ignoring the frames whose allow-list entry names a reason. */
export function framesWithoutFixtures(screenSlugs, fixtureSlugs, allowlist = FIXTURE_ALLOWLIST) {
  const framed = new Set(fixtureSlugs);
  const allowed = new Set(Object.keys(allowlist));
  return [...new Set(screenSlugs)]
    .filter((slug) => !framed.has(slug) && !allowed.has(slug))
    .sort();
}

/**
 * What a page's mounted roots say about a fixture's screen. `comparable` is false only when the frame
 * names a screen the page does not carry — the row is then `unavailable`, never a pixel FAIL.
 */
export function classifyScreen(screen, mounted) {
  const list = (Array.isArray(mounted) ? mounted : []).filter(
    (id) => typeof id === 'string' && id.length > 0,
  );
  if (screen === null) return { comparable: true, measured: list[0] ?? 'none', reason: null };
  if (list.includes(screen)) return { comparable: true, measured: screen, reason: null };
  return {
    comparable: false,
    measured: list[0] ?? 'none',
    reason: `the frame needs screen "${screen}"`,
  };
}

/** The fixture a slug's frame carries, parsed, or null when there is no file for it. */
export function readFixture(slug, dir = join('design', 'fixtures')) {
  const file = join(dir, `${slug}.json`);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

async function freePort() {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        message.error ? reject(new Error(message.error.message)) : resolve(message.result);
      }
    });
  }

  send(method, params = {}, timeoutMs = 60000) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (result) => {
          clearTimeout(timer);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
    });
  }
}

function killTree(pid) {
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
  } else {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {}
  }
}

async function launchChrome(port, chrome) {
  const profile = join(process.env.TEMP ?? '/tmp', `pkm-hud-diff-${Date.now()}`);
  const child = spawn(chrome, [
    '--headless=new',
    '--hide-scrollbars',
    '--mute-audio',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--force-color-profile=srgb',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    'about:blank',
    // Its own process group, so `killTree` takes the renderers with the browser; without it a
    // measurement leaves a headless Chrome behind and the next run starves.
  ], { stdio: 'ignore', detached: process.platform !== 'win32' });
  child.on('exit', () => {
    // The renderers may still hold the profile for a beat after the SIGKILL: the removal is a
    // courtesy, never a reason to fail a measurement.
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {}
  });

  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) return { child, wsUrl: page.webSocketDebuggerUrl };
    } catch {}
    await delay(100);
  }
  killTree(child.pid);
  throw new Error(`chrome never opened its debugging port (${chrome})`);
}

async function startServer(dev, url) {
  if (url) return { url, stop: async () => {} };
  const { createServer: viteServer, preview } = await import('vite');
  const port = await freePort();
  const options = { logLevel: 'error', server: { port, strictPort: true, host: '127.0.0.1' } };
  const server = dev
    ? await viteServer(options)
    : await preview({ ...options, preview: options.server });
  if (dev) await server.listen();
  const address = server.httpServer?.address();
  const bound = typeof address === 'object' && address ? address.port : port;
  return { url: `http://127.0.0.1:${bound}`, stop: () => server.close() };
}

/** Reads one value out of the page; a context torn down by a navigation is not ready either. */
async function evaluate(cdp, expression, awaitPromise = false) {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
  return result.result?.value;
}

/** The page's own answer to "may I be measured": complete, the HUD layer is up, the webfonts are in. */
async function readiness(cdp) {
  const reading = await evaluate(
    cdp,
    `({ readyState: document.readyState, hud: document.querySelector('#hud') !== null, fonts: document.fonts.status })`,
  );
  const ready =
    reading !== null &&
    typeof reading === 'object' &&
    reading.readyState === 'complete' &&
    reading.hud === true &&
    reading.fonts === 'loaded';
  return { ready, reading };
}

function describeReading(reading) {
  if (reading === null || typeof reading !== 'object') return 'the page answered no reading';
  const readState = typeof reading.readyState === 'string' ? reading.readyState : 'unknown';
  const hud = reading.hud === true ? 'up' : 'missing';
  const fonts = typeof reading.fonts === 'string' ? reading.fonts : 'unknown';
  return `readyState=${readState}, #hud=${hud}, fonts=${fonts}`;
}

/** Polls the readiness rule instead of waiting for an event both boot paths can miss. */
async function waitForReady(cdp) {
  const deadline = Date.now() + READY_BUDGET_MS;
  let last = null;
  while (Date.now() < deadline) {
    try {
      const { ready, reading } = await readiness(cdp);
      last = reading;
      if (ready) return last;
    } catch {}
    await delay(READY_POLL_MS);
  }
  throw new Error(`page never became ready (${describeReading(last)})`);
}

const MOUNTED_EXPRESSION = `(() => {
  const panels = [];
  for (const element of document.querySelectorAll('[data-hud-panel]')) {
    const id = element.getAttribute('data-hud-panel');
    if (id) panels.push(id);
  }
  const markers = [];
  for (const [id, selector] of ${JSON.stringify(Object.entries(SCREEN_MARKERS))}) {
    if (document.querySelector(selector) !== null) markers.push(id);
  }
  return [...panels, ...markers];
})()`;

/** Hides every mounted screen but the frame's own, so the shot is the board's one screen. */
function isolateExpression(screen) {
  return `(() => {
    const keep = ${JSON.stringify(screen)};
    const markers = ${JSON.stringify(Object.entries(SCREEN_MARKERS))};
    let hidden = 0;
    for (const element of document.querySelectorAll('[data-hud-panel]')) {
      if (element.getAttribute('data-hud-panel') === keep) continue;
      element.style.display = 'none';
      hidden += 1;
    }
    for (const [id, selector] of markers) {
      if (id === keep) continue;
      for (const element of document.querySelectorAll(selector)) {
        element.style.display = 'none';
        hidden += 1;
      }
    }
    return hidden;
  })()`;
}

function readPng(file) {
  return PNG.sync.read(readFileSync(file));
}

function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function toLab(r, g, b) {
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [channel(r), channel(g), channel(b)];
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function profile(image, axis) {
  const { width, height, data } = image;
  const length = axis === 'x' ? width : height;
  const other = axis === 'x' ? height : width;
  const counts = new Float64Array(length);
  for (let i = 1; i < length; i += 1) {
    for (let j = 0; j < other; j += 1) {
      const index = axis === 'x' ? (j * width + i) * 4 : (i * width + j) * 4;
      const previous = axis === 'x' ? (j * width + i - 1) * 4 : ((i - 1) * width + j) * 4;
      const delta = Math.abs(
        luminance(data[index], data[index + 1], data[index + 2]) -
          luminance(data[previous], data[previous + 1], data[previous + 2]),
      );
      if (delta > 24) counts[i] += 1;
    }
  }
  return counts;
}

function peaks(edges, limit = 40) {
  const candidates = [];
  for (let i = 1; i < edges.length - 1; i += 1) {
    if (edges[i] >= edges[i - 1] && edges[i] >= edges[i + 1] && edges[i] > 4) candidates.push([i, edges[i]]);
  }
  return candidates.sort((a, b) => b[1] - a[1]).slice(0, limit).map(([position]) => position);
}

function geometryError(reference, actual) {
  const offsets = [];
  let unmatched = 0;
  for (const axis of ['x', 'y']) {
    const expected = peaks(profile(reference, axis));
    const found = peaks(profile(actual, axis));
    for (const position of expected) {
      if (!found.length) {
        unmatched += 1;
        continue;
      }
      let best = Infinity;
      for (const candidate of found) best = Math.min(best, Math.abs(candidate - position));
      offsets.push(best);
    }
  }
  if (!offsets.length) return { peaks: 0, median: 0, max: unmatched ? Infinity : 0, unmatched };
  offsets.sort((a, b) => a - b);
  return {
    peaks: offsets.length,
    unmatched,
    median: offsets[Math.floor(offsets.length / 2)],
    max: offsets[offsets.length - 1],
  };
}

function colourError(reference, actual) {
  const { width, height, data } = reference;
  const referenceData = reference.data;
  const actualData = actual.data;
  let flat = 0;
  let flatSum = 0;
  let allSum = 0;
  const samples = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = (y * width + x) * 4;
      const lum = luminance(referenceData[index], referenceData[index + 1], referenceData[index + 2]);
      const neighbour = luminance(
        referenceData[index + 4],
        referenceData[index + 5],
        referenceData[index + 6],
      );
      const below = luminance(
        referenceData[index + width * 4],
        referenceData[index + width * 4 + 1],
        referenceData[index + width * 4 + 2],
      );
      const isFlat = Math.abs(lum - neighbour) < 3 && Math.abs(lum - below) < 3;
      const error = deltaE(
        toLab(referenceData[index], referenceData[index + 1], referenceData[index + 2]),
        toLab(actualData[index], actualData[index + 1], actualData[index + 2]),
      );
      allSum += error;
      if (isFlat) {
        flat += 1;
        flatSum += error;
        samples.push(error);
      }
    }
  }
  samples.sort((a, b) => a - b);
  return {
    flat: flat ? flatSum / flat : 0,
    all: allSum / (width * height),
    p99: samples.length ? samples[Math.floor(samples.length * 0.99)] : 0,
    flatPixels: flat,
  };
}

function compare(reference, actual) {
  if (reference.width !== actual.width || reference.height !== actual.height) {
    return { error: `size ${actual.width}x${actual.height} against reference ${reference.width}x${reference.height}` };
  }
  const diff = new PNG({ width: reference.width, height: reference.height });
  const differing = pixelmatch(reference.data, actual.data, diff.data, reference.width, reference.height, { threshold: 0.1 });
  const geometry = geometryError(reference, actual);
  const colour = colourError(reference, actual);
  const pass = geometry.max <= GEOMETRY_TOLERANCE && colour.flat <= COLOUR_TOLERANCE;
  return { differing, ratio: differing / (reference.width * reference.height), geometry, colour, pass, diff };
}

function viewportsFor(slug) {
  return [
    { name: '1280x800', width: 1280, height: 800, reference: `${slug}.png` },
    { name: '390x844', width: 390, height: 844, reference: `m${slug}.png` },
  ];
}

function readArgs(argv) {
  const value = (name, fallback) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  return {
    slug: value('slug'),
    url: value('url'),
    settle: Number(value('settle', '1200')),
    dev: argv.includes('--dev'),
  };
}

function reportLine(report) {
  if (report.error) return `${report.viewport}: ${report.error}`;
  if (report.verdict === 'unavailable') {
    return `${report.viewport}: measured ${report.measured} — unavailable, ${report.reason}`;
  }
  return (
    `${report.viewport}: measured ${report.measured} — ${(report.ratio * 100).toFixed(2)}% pixels differ, ` +
    `geometry median ${report.geometry.median} / max ${report.geometry.max} px (${report.geometry.peaks} edges), ` +
    `colour flat ΔE ${report.colour.flat} / all ${report.colour.all} / p99 ${report.colour.p99} — ` +
    `${report.verdict.toUpperCase()}`
  );
}

async function main(argv = process.argv.slice(2)) {
  const { slug, url, settle, dev } = readArgs(argv);
  if (!slug) {
    console.error(USAGE);
    process.exit(2);
  }

  const fixture = readFixture(slug);
  const screen = screenOf(fixture);
  const viewports = viewportsFor(slug);
  const outDir = join('design', 'diff', slug);
  const referenceDir = join('design', 'screens');

  if (fixture === null && !Object.prototype.hasOwnProperty.call(FIXTURE_ALLOWLIST, slug)) {
    console.error(`hud:diff ${slug}: no fixture in design/fixtures and no allow-list entry`);
    process.exit(2);
  }

  const chrome = findChrome();
  if (chrome === null) throw new Error('no Chrome or Edge found; set CHROME_PATH');

  const server = await startServer(dev, url);
  const port = await freePort();
  const { child, wsUrl } = await launchChrome(port, chrome);
  const socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('could not attach to chrome')), { once: true });
  });
  const cdp = new Cdp(socket);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  mkdirSync(outDir, { recursive: true });

  const reports = [];
  try {
    for (const viewport of viewports) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 2,
        mobile: viewport.width < 600,
      });
      await cdp.send('Page.navigate', { url: `${server.url}/?hud=dom&hudFixture=${slug}` });
      await waitForReady(cdp);
      await delay(settle);

      if (fixture === null) {
        const reason =
          FIXTURE_ALLOWLIST[slug] ?? 'no fixture for this frame';
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
        writeFileSync(join(outDir, `${viewport.name}.shot.png`), Buffer.from(shot.data, 'base64'));
        reports.push({
          viewport: viewport.name,
          screen: null,
          measured: 'none',
          verdict: 'unavailable',
          reason,
        });
        continue;
      }

      const mounted = await evaluate(cdp, MOUNTED_EXPRESSION);
      const { comparable, measured, reason } = classifyScreen(screen, mounted);

      if (comparable) {
        const hidden = screen === null ? 0 : await evaluate(cdp, isolateExpression(screen));
        if (hidden > 0) {
          await evaluate(
            cdp,
            'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))',
            true,
          );
        }
      }

      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
      const actual = PNG.sync.read(Buffer.from(shot.data, 'base64'));
      writeFileSync(join(outDir, `${viewport.name}.shot.png`), PNG.sync.write(actual));

      if (!comparable) {
        reports.push({
          viewport: viewport.name,
          screen,
          measured,
          verdict: 'unavailable',
          reason,
        });
        continue;
      }

      const referenceFile = join(referenceDir, viewport.reference);
      if (!existsSync(referenceFile)) {
        reports.push({ viewport: viewport.name, screen, measured, verdict: 'fail', error: `no reference: ${referenceFile}` });
        continue;
      }
      const reference = readPng(referenceFile);
      const result = compare(reference, actual);
      if (result.error) {
        reports.push({ viewport: viewport.name, screen, measured, verdict: 'fail', error: result.error });
        continue;
      }

      writeFileSync(join(outDir, `${viewport.name}.diff.png`), PNG.sync.write(result.diff));
      reports.push({
        viewport: viewport.name,
        screen,
        measured,
        verdict: result.pass ? 'pass' : 'fail',
        differing: result.differing,
        ratio: Number(result.ratio.toFixed(4)),
        geometry: {
          peaks: result.geometry.peaks,
          unmatched: result.geometry.unmatched ?? 0,
          median: Number(result.geometry.median.toFixed(2)),
          max: Number.isFinite(result.geometry.max) ? Number(result.geometry.max.toFixed(2)) : 'no edges found',
        },
        colour: {
          flat: Number(result.colour.flat.toFixed(2)),
          all: Number(result.colour.all.toFixed(2)),
          p99: Number(result.colour.p99.toFixed(2)),
        },
        pass: result.pass,
      });
    }
  } finally {
    socket.close();
    killTree(child.pid);
    await server.stop();
  }

  writeFileSync(join(outDir, 'report.json'), `${JSON.stringify({ slug, screen, reports }, null, 2)}\n`);
  for (const report of reports) console.log(`${slug} ${reportLine(report)}`);
  console.log(`artifacts: ${outDir}`);
  const failed = reports.some((report) => report.verdict === 'fail');
  process.exit(failed ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(`hud:diff failed: ${error.message}`);
    process.exit(1);
  });
}
