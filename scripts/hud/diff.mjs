// The prototype gate (`D49`): screenshots the running HUD at both viewports and measures it against
// the board, reporting geometry and colour apart. Geometry is the position of the strongest
// horizontal and vertical edges, matched within 2 px, so a moving panel, row pitch or radius shows up
// while glyph antialiasing does not; colour is the mean ΔE on flat fills (≤ 2). Text is not measured
// yet: its boxes live in `design/frames/<slug>.json` and the check lands with the first DOM panel
// (`[Task-127]`), never as a per-pixel comparison.
//
// Usage:
//   node scripts/hud/diff.mjs --slug 02-options [--url http://127.0.0.1:4173] [--settle 1200]
//   node scripts/hud/diff.mjs --slug 02-options --dev            # boots `vite dev` instead of the preview
//
// Artifacts: design/diff/<slug>/<viewport>.diff.png (pixelmatch) and .report.json.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import pixelmatch from 'pixelmatch';
import pngjs from 'pngjs';

const { PNG } = pngjs;

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const slug = value('slug');
if (!slug) {
  console.error('usage: node scripts/hud/diff.mjs --slug <slug> [--url <url>] [--preview] [--settle ms] [--keep-open]');
  process.exit(2);
}

const settle = Number(value('settle', '1200'));
const viewports = [
  { name: '1280x800', width: 1280, height: 800, reference: `${slug}.png` },
  { name: '390x844', width: 390, height: 844, reference: `m${slug}.png` },
];
const GEOMETRY_TOLERANCE = 2;
const COLOUR_TOLERANCE = 2;
const outDir = join('design', 'diff', slug);

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean).find((candidate) => existsSync(candidate));

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
    this.listeners = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        message.error ? reject(new Error(message.error.message)) : resolve(message.result);
      } else if (message.method) {
        for (const listener of this.listeners.get(message.method) ?? []) listener(message.params);
      }
    });
  }

  on(method, listener) {
    const list = this.listeners.get(method) ?? [];
    list.push(listener);
    this.listeners.set(method, list);
  }

  once(method, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${method} never arrived`)), timeoutMs);
      const listener = (params) => {
        clearTimeout(timer);
        const list = this.listeners.get(method) ?? [];
        this.listeners.set(method, list.filter((entry) => entry !== listener));
        resolve(params);
      };
      this.on(method, listener);
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

async function launchChrome(port) {
  const profile = join(process.env.TEMP ?? '/tmp', `pkm-hud-diff-${Date.now()}`);
  const child = spawn(CHROME, [
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
  ], { stdio: 'ignore' });
  child.on('exit', () => rmSync(profile, { recursive: true, force: true }));

  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) return { child, wsUrl: page.webSocketDebuggerUrl };
    } catch {}
    await delay(100);
  }
  killTree(child.pid);
  throw new Error(`chrome never opened its debugging port (${CHROME ?? 'not found'})`);
}

async function startServer() {
  const url = value('url');
  if (url) return { url, stop: async () => {} };
  const { createServer, preview } = await import('vite');
  const port = await freePort();
  const options = { logLevel: 'error', server: { port, strictPort: true, host: '127.0.0.1' } };
  const server = flag('dev') ? await createServer(options) : await preview({ ...options, preview: options.server });
  if (flag('dev')) await server.listen();
  const address = server.httpServer?.address();
  const bound = typeof address === 'object' && address ? address.port : port;
  return { url: `http://127.0.0.1:${bound}`, stop: () => server.close() };
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

async function main() {
  const referenceDir = join('design', 'screens');
  for (const viewport of viewports) {
    const file = join(referenceDir, viewport.reference);
    if (!existsSync(file)) throw new Error(`no reference for ${viewport.name}: ${file}`);
  }
  if (!CHROME) throw new Error('no Chrome or Edge found; set CHROME_PATH');

  const server = await startServer();
  const port = await freePort();
  const { child, wsUrl } = await launchChrome(port);
  const socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('could not attach to chrome')), { once: true });
  });
  const cdp = new Cdp(socket);
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  mkdirSync(outDir, { recursive: true });

  const reports = [];
  let failed = false;
  try {
    for (const viewport of viewports) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 2,
        mobile: viewport.width < 600,
      });
      const loaded = cdp.once('Page.loadEventFired');
      await cdp.send('Page.navigate', { url: `${server.url}/?hud=dom&hudFixture=${slug}` });
      await loaded;
      await delay(settle);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
      const actual = PNG.sync.read(Buffer.from(shot.data, 'base64'));
      const reference = readPng(join(referenceDir, viewport.reference));
      const result = compare(reference, actual);

      if (result.error) {
        reports.push({ viewport: viewport.name, error: result.error });
        failed = true;
        continue;
      }

      writeFileSync(join(outDir, `${viewport.name}.shot.png`), PNG.sync.write(actual));
      writeFileSync(join(outDir, `${viewport.name}.diff.png`), PNG.sync.write(result.diff));
      const report = {
        viewport: viewport.name,
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
      };
      reports.push(report);
      failed ||= !result.pass;
    }
  } finally {
    socket.close();
    killTree(child.pid);
    await server.stop();
  }

  writeFileSync(join(outDir, 'report.json'), `${JSON.stringify({ slug, reports }, null, 2)}\n`);
  for (const report of reports) {
    if (report.error) {
      console.log(`${slug} ${report.viewport}: ${report.error}`);
      continue;
    }
    console.log(
      `${slug} ${report.viewport}: ${(report.ratio * 100).toFixed(2)}% pixels differ, ` +
        `geometry median ${report.geometry.median} / max ${report.geometry.max} px (${report.geometry.peaks} edges), ` +
        `colour flat ΔE ${report.colour.flat} / all ${report.colour.all} / p99 ${report.colour.p99} — ${report.pass ? 'PASS' : 'FAIL'}`,
    );
  }
  console.log(`artifacts: ${outDir}`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(`hud:diff failed: ${error.message}`);
  process.exit(1);
});
