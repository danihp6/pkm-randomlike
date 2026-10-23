import { spawn } from 'node:child_process';
import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { frames, page, slugOf } from './frames.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const designDir = path.join(root, 'design');
const framesDir = path.join(designDir, 'frames');
const screensDir = path.join(designDir, 'screens');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const channel = value('channel', process.env.FIGMA_CHANNEL);
const only = value('only', null)?.split(',').map((s) => s.trim()).filter(Boolean);
const depth = Number(value('depth', '8'));
const withPng = !flag('no-png');
const withSvg = !flag('no-svg');
const withJson = !flag('no-json');
const force = flag('force');
const dryRun = flag('list');
const properties = value('properties', 'name,type,x,y,width,height,fills,strokes,cornerRadius,characters,fontName,fontSize,effects,opacity').split(',');
const geometryProps = ['name', 'type', 'x', 'y', 'width', 'height', 'cornerRadius', 'fills', 'strokes', 'opacity'];
const textProps = ['name', 'characters', 'x', 'y', 'width', 'height', 'fontName', 'fontSize', 'fills'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Mcp {
  constructor() {
    this.child = null;
    this.pending = new Map();
    this.nextId = 1;
    this.buffer = '';
  }

  async start() {
    this.child = spawn('npx -y figma-edit-mcp', [], { shell: true, windowsHide: true });
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk) => this.onData(chunk));
    this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', (chunk) => {
      const text = String(chunk);
      if (text.length > 400) return;
      if (!/\[(ERROR|WARN)\]/.test(text)) return;
      process.stderr.write(`[mcp] ${text.trim()}\n`);
    });
    const init = await this.send('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'design-export', version: '1.0.0' },
    }, 60000);
    this.protocol = init.result?.protocolVersion;
    this.notify('notifications/initialized');
  }

  onData(chunk) {
    this.buffer += chunk;
    let i;
    while ((i = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, i).trim();
      this.buffer = this.buffer.slice(i + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      const entry = msg.id ? this.pending.get(msg.id) : null;
      if (entry) {
        this.pending.delete(msg.id);
        clearTimeout(entry.timer);
        entry.resolve(msg);
      }
    }
  }

  notify(method, params = {}) {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
  }

  send(method, params, timeoutMs = 180000) {
    const id = this.nextId++;
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(Object.assign(new Error(`${method} timed out after ${timeoutMs} ms`), { code: 'CLIENT_TIMEOUT' }));
      }, timeoutMs);
      this.pending.set(id, { resolve, timer });
    });
  }

  async call(name, toolArgs, timeoutMs, attempts = 6) {
    for (let attempt = 1; ; attempt += 1) {
      const response = await this.send('tools/call', { name, arguments: toolArgs }, timeoutMs);
      const result = response.result;
      const payload = unwrap(result);
      const toolError = payload && typeof payload.text === 'string' && payload.text.startsWith('MCP error') ? { message: payload.text, code: 'MCP_TOOL_ERROR' } : null;
      const failure = response.error
        ? { message: response.error.message, code: response.error.code, details: response.error.data }
        : payload?.error ?? toolError ?? (payload?.status === 'error' ? { message: payload.errorMessage, code: payload.errorCode, details: payload } : null);
      if (!failure) return unwrap(result);
      const transient = /Not connected to Figma|PLUGIN_DISCONNECTED|timed out/i.test(failure.message ?? '');
      if (!transient || attempt >= attempts) {
        throw Object.assign(new Error(`${name}: ${failure.message}`), { code: failure.code, details: failure.details });
      }
      await sleep(1000 * attempt);
    }
  }

  stop() {
    try {
      this.child?.kill();
    } catch {}
  }
}

function unwrap(result) {
  if (!result) return null;
  if (result.structuredContent) return result.structuredContent;
  const text = result.content?.find((c) => c.type === 'text')?.text;
  if (text) {
    try {
      return JSON.parse(text);
    } catch {
      return { text };
    }
  }
  return result;
}

function walk(node, visit) {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!channel) {
    console.error('usage: node scripts/design/export.mjs --channel <code> [--only slug,slug] [--list] [--force] [--no-png] [--no-svg] [--no-json] [--depth 8]');
    process.exit(2);
  }

  const selected = frames.filter((f) => {
    if (!only) return true;
    const slug = slugOf(f.name);
    return only.some((o) => o === slug || o === `m${slug}` || o === slug.replace(/^m/, ''));
  });
  if (!selected.length) {
    console.error('no frame matches --only');
    process.exit(2);
  }

  let mcp = new Mcp();
  await mcp.start();

  let joined = await mcp.call('channel_join', { channel }, 30000);
  if (joined?.status !== 'success') {
    mcp.stop();
    throw new Error(`channel_join failed: ${joined?.errorCode ?? 'unknown'} ${joined?.errorMessage ?? ''}`);
  }
  console.log(`channel ${channel} joined`);

  if (dryRun) {
    console.log(`${selected.length} frames planned, no write (--list)`);
    mcp.stop();
    return;
  }

  await mkdir(framesDir, { recursive: true });
  await mkdir(screensDir, { recursive: true });

  const pageInfo = await mcp.call('page_info', {}, 120000);
  const pages = pageInfo?.pages ?? [];
  const pageNode = pages.find((p) => (p.name ?? p.pageName) === page);
  if (!pageNode) throw new Error(`page "${page}" not found; pages: ${pages.map((p) => p.name ?? p.pageName).join(', ')}`);

  const pageId = pageNode.id ?? pageNode.pageId;
  const pageChildren = pageNode.children?.length ? pageNode.children : null;
  const tree = pageChildren
    ? { nodes: pageChildren }
    : await mcp.call('node_info', { nodeIds: [pageId], maxDepth: 1, properties: ['name', 'type'] }, 180000);
  const byName = new Map();
  for (const node of tree?.nodes ?? []) {
    walk(node, (n) => {
      if (n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'SECTION') {
        if (!byName.has(n.name)) byName.set(n.name, n.id);
      }
    });
  }
  console.log(`page resolves ${byName.size} top-level frames`);

  const manifestPath = path.join(designDir, 'board.json');
  const manifest = (await exists(manifestPath)) ? JSON.parse(await readFile(manifestPath, 'utf8')) : { page, generatedAt: null, frames: {} };
  const stamp = new Date().toISOString();

  const rows = [];
  for (const entry of selected) {
    const slug = slugOf(entry.name);
    const desktopId = byName.get(entry.name);
    const mobileId = byName.get(`M ${entry.name}`);
    if (!desktopId) {
      rows.push({ slug, name: entry.name, status: `missing: "${entry.name}" not in ${page}` });
      continue;
    }
    const targets = [{ suffix: '', id: desktopId }];
    if (mobileId) targets.push({ suffix: 'm', id: mobileId });

    const record = (manifest.frames[slug] ??= { name: entry.name, task: entry.task, panel: entry.panel, scene: entry.scene, exports: {} });
    record.name = entry.name;
    record.task = entry.task;
    record.panel = entry.panel;
    record.scene = entry.scene;
    record.desktop = desktopId;
    record.mobile = mobileId ?? null;

    for (const target of targets) {
      const base = `${target.suffix}${slug}`;
      const jsonFile = path.join(framesDir, `${base}.json`);
      const svgFile = path.join(screensDir, `${base}.svg`);
      const pngFile = path.join(screensDir, `${base}.png`);
      const sizes = {};

      if (withJson && (force || !(await exists(jsonFile)))) {
        let geometry = null;
        let usedDepth = depth;
        for (const candidate of [depth, 4, 3]) {
          try {
            geometry = await mcp.call('node_info', { nodeIds: [target.id], maxDepth: candidate, properties: geometryProps }, 300000);
            usedDepth = candidate;
            break;
          } catch (error) {
            if (!/timed out/i.test(error.message) || candidate === 3) throw error;
          }
        }
        const text = await mcp.call('node_info', { nodeIds: [target.id], maxDepth: 30, filter: { type: ['TEXT'] }, properties: textProps }, 300000);
        const payload = JSON.stringify(
          { slug: base, nodeId: target.id, depth: usedDepth, exportedAt: stamp, geometry: geometry?.nodes ?? geometry, text: text?.nodes ?? text },
          null,
          1,
        );
        await writeFile(jsonFile, payload);
        sizes.json = Buffer.byteLength(payload);
      }

      if (withSvg && (force || !(await exists(svgFile)))) {
        const svg = await mcp.call('node_export_visual', { nodeId: target.id, format: 'SVG', scale: 1 }, 300000);
        await writeFile(svgFile, svg.svg ?? '');
        sizes.svg = Buffer.byteLength(svg.svg ?? '');
      }

      if (withPng && (force || !(await exists(pngFile)))) {
        const png = await mcp.call('node_export_visual', { nodeId: target.id, format: 'PNG', scale: 2 }, 300000);
        const bytes = Buffer.from(png.imageData ?? '', 'base64');
        await writeFile(pngFile, bytes);
        sizes.png = bytes.length;
      }

      record.exports[base] = { nodeId: target.id, files: sizes };
      rows.push({ slug: base, name: entry.name, status: Object.entries(sizes).map(([k, v]) => `${k} ${(v / 1024).toFixed(0)}k`).join(' ') || 'cached' });
    }

    await writeFile(manifestPath, `${JSON.stringify({ ...manifest, generatedAt: stamp }, null, 2)}\n`);
    await sleep(50);
  }

  manifest.generatedAt = stamp;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  for (const row of rows) console.log(`${row.slug.padEnd(34)} ${row.status}`);
  const unmatched = [...byName.keys()].filter((n) => !frames.some((f) => f.name === n || `M ${f.name}` === n));
  if (unmatched.length) console.log(`\nnot in the frame table (${unmatched.length}): ${unmatched.join(' | ')}`);

  mcp.stop();
}

main().catch((error) => {
  console.error(`export failed: ${error.code ?? ''} ${error.message}`);
  if (error.details) console.error(JSON.stringify(error.details).slice(0, 800));
  process.exit(1);
});
