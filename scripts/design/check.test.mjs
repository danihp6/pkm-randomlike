import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CHECK_NAMES, runCheck } from './check.mjs';
import { runImport } from './import.mjs';

const FIXTURES = fileURLToPath(new URL('./fixtures', import.meta.url));
const ENV = { FIGMA_TOKEN: 'fixture-token', FIGMA_FILE_KEY: 'fixtureFileKey' };

function makeRoot() {
  const root = mkdtempSync(path.join(tmpdir(), 'design-import-'));
  mkdirSync(path.join(root, 'design'), { recursive: true });
  copyFileSync(path.join(FIXTURES, 'map.json'), path.join(root, 'design', 'import.json'));
  mkdirSync(path.join(root, 'src', 'scenes'), { recursive: true });
  writeFileSync(path.join(root, 'src', 'scenes', 'SettingsScene.ts'), 'export {};\n');
  mkdirSync(path.join(root, 'src', 'ui', 'hud', 'panels', 'options'), { recursive: true });
  writeFileSync(path.join(root, 'src', 'ui', 'hud', 'panels', 'options', 'index.ts'), 'export {};\n');
  return root;
}

function fixtureFetch(calls) {
  const index = readFileSync(path.join(FIXTURES, 'file.json'), 'utf8');
  const nodes = readFileSync(path.join(FIXTURES, 'nodes.json'), 'utf8');
  const images = readFileSync(path.join(FIXTURES, 'images.json'), 'utf8');
  const desktop = readFileSync(path.join(FIXTURES, 'exports', '02-options.png'));
  const mobile = readFileSync(path.join(FIXTURES, 'exports', 'm02-options.png'));
  const json = (body) => new Response(body, { headers: { 'content-type': 'application/json' } });

  return async (url, init) => {
    calls.push({ url, init });
    if (url.includes('/v1/files/') && url.endsWith('depth=3')) return json(index);
    if (url.includes('/v1/files/')) return json(nodes);
    if (url.includes('/v1/images/')) return json(images);
    if (url.endsWith('fixture-desktop')) return new Response(desktop);
    if (url.endsWith('fixture-mobile')) return new Response(mobile);
    return new Response('', { status: 404 });
  };
}

async function imported() {
  const root = makeRoot();
  const calls = [];
  const result = await runImport({ root, env: ENV, fetch: fixtureFetch(calls) });
  return { root, calls, result };
}

describe('import command', () => {
  it('makes no request without a token and names the variable', async () => {
    const calls = [];
    const result = await runImport({ root: makeRoot(), env: {}, fetch: fixtureFetch(calls) });
    expect(result.code).toBe(2);
    expect(calls).toHaveLength(0);
    expect(result.wrote).toEqual([]);
  });

  it('names FIGMA_TOKEN first when both variables are missing', async () => {
    const root = makeRoot();
    const calls = [];
    const result = await runImport({ root, env: { FIGMA_TOKEN: '' }, fetch: fixtureFetch(calls) });
    expect(result.code).toBe(2);
    expect(calls).toHaveLength(0);
  });

  it('writes the four artifact families in order', async () => {
    const { result } = await imported();
    expect(result.code).toBe(0);
    expect(result.problems).toEqual([]);
    expect(result.wrote).toEqual([
      'design/tokens.json',
      'design/board.json',
      'design/screens/02-options.json',
      'design/exports/02-options.png',
      'design/exports/m02-options.png',
    ]);
  });

  it('authenticates the API calls and fetches the images plain', async () => {
    const { calls } = await imported();
    for (const call of calls) {
      if (call.url.startsWith('https://api.figma.com')) {
        expect(call.init?.headers?.['X-Figma-Token']).toBe(ENV.FIGMA_TOKEN);
      } else {
        expect(call.init).toBeUndefined();
      }
    }
  });
});

describe('runCheck', () => {
  it('prints exactly four named lines and is green on a fresh import', async () => {
    const { root } = await imported();
    const result = runCheck({ root });
    expect(result.code).toBe(0);
    expect(result.lines).toHaveLength(4);
    for (const [index, name] of CHECK_NAMES.entries()) expect(result.lines[index].startsWith(`${name}: `)).toBe(true);
    expect(result.lines[0]).toContain('1 screens, 0 violations');
    expect(result.lines[1]).toContain('0 violations');
    expect(result.lines[2]).toContain('0 mismatched, 0 pending the import');
  });

  it('says 0 screens when no spec has been imported yet', async () => {
    const { root } = await imported();
    rmSync(path.join(root, 'design', 'screens'), { recursive: true, force: true });
    rmSync(path.join(root, 'design', 'exports'), { recursive: true, force: true });

    const result = runCheck({ root });
    expect(result.lines[0]).toBe('colour_outside_tokens: 0 screens (run the import)');
    expect(result.lines[2]).toContain('1 pending the import');
    expect(result.code).toBe(0);
  });

  it('fails colour_outside_tokens when a screen colour is not in the tokens', async () => {
    const { root } = await imported();
    const specPath = path.join(root, 'design', 'screens', '02-options.json');
    const spec = JSON.parse(readFileSync(specPath, 'utf8'));
    spec.colours.push('#123456@1');
    writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`);

    const result = runCheck({ root });
    expect(result.code).toBe(1);
    expect(result.report.colour_outside_tokens).toEqual(['02-options: #123456@1']);
    expect(result.lines[0]).toContain('02-options: #123456@1');
  });

  it('reports a frame whose panel has no component', async () => {
    const { root } = await imported();
    const mapPath = path.join(root, 'design', 'import.json');
    const map = JSON.parse(readFileSync(mapPath, 'utf8'));
    map.screens[0].panel = 'missing-panel';
    writeFileSync(mapPath, `${JSON.stringify(map, null, 2)}\n`);

    const result = runCheck({ root });
    expect(result.code).toBe(1);
    expect(result.report.frame_without_component).toEqual([
      '02-options: panel does not match the board',
      '02-options: no component for panel missing-panel',
    ]);
  });

  it('reports a scene that is not on disk', async () => {
    const { root } = await imported();
    const mapPath = path.join(root, 'design', 'import.json');
    const map = JSON.parse(readFileSync(mapPath, 'utf8'));
    map.screens[0].scene = 'src/scenes/RetiredScene.ts';
    writeFileSync(mapPath, `${JSON.stringify(map, null, 2)}\n`);

    const result = runCheck({ root });
    expect(result.code).toBe(1);
    expect(result.report.frame_without_component).toContain('02-options: scene src/scenes/RetiredScene.ts is missing');
  });

  it('catches one byte of a PNG moving', async () => {
    const { root } = await imported();
    const png = path.join(root, 'design', 'exports', '02-options.png');
    const bytes = readFileSync(png);
    bytes[bytes.length - 1] ^= 0xff;
    writeFileSync(png, bytes);

    const result = runCheck({ root });
    expect(result.code).toBe(1);
    expect(result.report.snapshot_hash_mismatch[0]).toContain('02-options: 1 byte moved');
    expect(result.lines[2]).toContain('1 mismatched, 0 pending the import');
  });

  it('keeps a declared state with no frame report-only', async () => {
    const { root } = await imported();
    const mapPath = path.join(root, 'design', 'import.json');
    const map = JSON.parse(readFileSync(mapPath, 'utf8'));
    map.screens[0].states = ['02-options-armed'];
    writeFileSync(mapPath, `${JSON.stringify(map, null, 2)}\n`);

    const result = runCheck({ root });
    expect(result.code).toBe(0);
    expect(result.report.variant_missing).toEqual(['02-options: 02-options-armed has no frame']);
    expect(result.lines[3]).toContain('02-options-armed has no frame');
  });
});

describe('--check', () => {
  it('is green on a clean tree and leaves the artifacts alone', async () => {
    const { root } = await imported();
    const result = await runImport({ root, env: ENV, fetch: fixtureFetch([]), check: true });
    expect(result.code).toBe(0);
    expect(result.drifted).toEqual([]);
    expect(result.wrote).toEqual([]);
  });

  it('exits 1 when one byte moves', async () => {
    const { root } = await imported();
    const png = path.join(root, 'design', 'exports', 'm02-options.png');
    const bytes = readFileSync(png);
    bytes[0] ^= 0xff;
    writeFileSync(png, bytes);

    const result = await runImport({ root, env: ENV, fetch: fixtureFetch([]), check: true });
    expect(result.code).toBe(1);
    expect(result.drifted).toEqual(['design/exports/m02-options.png']);
  });

  it('treats a missing artifact as drift and writes nothing', async () => {
    const root = makeRoot();
    const result = await runImport({ root, env: ENV, fetch: fixtureFetch([]), check: true });
    expect(result.code).toBe(1);
    expect(result.drifted).toEqual([
      'design/board.json',
      'design/exports/02-options.png',
      'design/exports/m02-options.png',
      'design/screens/02-options.json',
      'design/tokens.json',
    ]);
    expect(existsSync(path.join(root, 'design', 'screens'))).toBe(false);
    expect(existsSync(path.join(root, 'design', 'exports'))).toBe(false);
  });
});
