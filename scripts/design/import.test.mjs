import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runImport } from './import.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FIXTURES = path.join(ROOT, 'scripts', 'design', 'fixtures');

const readJson = (target) => JSON.parse(readFileSync(target, 'utf8'));

const copy = (from, to) => copyFileSync(from, to);

function fixtureRoot() {
  const dir = mkdtempSync(path.join(tmpdir(), 'design-import-'));
  mkdirSync(path.join(dir, 'design', 'frames'), { recursive: true });
  mkdirSync(path.join(dir, 'design', 'screens'), { recursive: true });
  copy(path.join(FIXTURES, 'map.json'), path.join(dir, 'design', 'import.json'));
  for (const slug of ['02-options', 'm02-options']) {
    copy(path.join(FIXTURES, 'frames', `${slug}.json`), path.join(dir, 'design', 'frames', `${slug}.json`));
    copy(path.join(FIXTURES, 'screens', `${slug}.png`), path.join(dir, 'design', 'screens', `${slug}.png`));
  }
  return { dir, from: path.join(dir, 'design', 'frames') };
}

let stderr;
let stdout;

beforeEach(() => {
  stderr = [];
  stdout = [];
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    stderr.push(String(chunk));
    return true;
  });
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    stdout.push(String(chunk));
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runImport from the committed snapshot', () => {
  it('writes the four artifact families with no token and no request', async () => {
    const { dir, from } = fixtureRoot();
    const never = () => {
      throw new Error('the offline path must not fetch');
    };

    const result = await runImport({ root: dir, from, env: {}, fetch: never });

    expect(result.code).toBe(0);
    expect(result.problems).toEqual([]);
    expect(result.drifted).toEqual([]);
    expect(result.wrote.filter((relative) => relative.startsWith('design/screens/'))).toEqual([
      'design/screens/02-options.json',
    ]);
    expect(result.wrote.filter((relative) => relative.startsWith('design/exports/'))).toEqual([
      'design/exports/02-options.png',
    ]);
    expect(result.wrote).toEqual([
      'design/tokens.json',
      'design/board.json',
      'design/screens/02-options.json',
      'design/exports/02-options.png',
    ]);
    expect(existsSync(path.join(dir, 'design', 'tokens.json'))).toBe(true);
    expect(existsSync(path.join(dir, 'design', 'board.json'))).toBe(true);
    expect(readFileSync(path.join(dir, 'design', 'exports', '02-options.png'))).toEqual(
      readFileSync(path.join(FIXTURES, 'screens', '02-options.png')),
    );

    const spec = readJson(path.join(dir, 'design', 'screens', '02-options.json'));
    const raster = readFileSync(path.join(FIXTURES, 'screens', '02-options.png'));
    expect(spec.snapshot.file).toBe('design/exports/02-options.png');
    expect(spec.snapshot.sha256).toBe(createHash('sha256').update(raster).digest('hex'));
    expect(spec.snapshot.bytes).toBe(raster.length);
    expect(stderr).toEqual([]);
  });

  it('ignores FIGMA_TOKEN and FIGMA_FILE_KEY instead of asking Figma', async () => {
    const { dir, from } = fixtureRoot();
    const never = () => {
      throw new Error('the offline path must not fetch');
    };

    const result = await runImport({ root: dir, from, env: { FIGMA_TOKEN: 'pat', FIGMA_FILE_KEY: 'key' }, fetch: never });
    expect(result.code).toBe(0);
  });

  it('is fatal and names a caption no dump carries, writing nothing', async () => {
    const { dir, from } = fixtureRoot();
    const map = readJson(path.join(dir, 'design', 'import.json'));
    map.screens.push({
      slug: '99-missing',
      caption: '99 Missing',
      panel: 'options',
      scene: 'src/scenes/SettingsScene.ts',
      mobile: 'm99-missing',
      states: [],
      snapshot: true,
    });
    writeFileSync(path.join(dir, 'design', 'import.json'), `${JSON.stringify(map, null, 2)}\n`);

    const result = await runImport({ root: dir, from, env: {} });

    expect(result.code).toBe(1);
    expect(result.wrote).toEqual([]);
    expect(stderr.join('')).toContain('frame_missing 99-missing: 99 Missing');
    expect(existsSync(path.join(dir, 'design', 'tokens.json'))).toBe(false);
    expect(existsSync(path.join(dir, 'design', 'board.json'))).toBe(false);
    expect(existsSync(path.join(dir, 'design', 'screens', '02-options.json'))).toBe(false);
    expect(existsSync(path.join(dir, 'design', 'exports'))).toBe(false);
  });

  it('is fatal and names a duplicated caption, writing nothing', async () => {
    const { dir, from } = fixtureRoot();
    const duplicate = readJson(path.join(dir, 'design', 'frames', '02-options.json'));
    writeFileSync(
      path.join(dir, 'design', 'frames', '02b-options-duplicate.json'),
      `${JSON.stringify({ ...duplicate, slug: '02b-options-duplicate' }, null, 2)}\n`,
    );

    const result = await runImport({ root: dir, from, env: {} });

    expect(result.code).toBe(1);
    expect(result.wrote).toEqual([]);
    expect(stderr.join('')).toContain('frame_duplicated 02b-options-duplicate: 02 Options');
    expect(existsSync(path.join(dir, 'design', 'tokens.json'))).toBe(false);
    expect(existsSync(path.join(dir, 'design', 'exports'))).toBe(false);
  });

  it('fails with code 2 and names a raster the snapshot does not carry', async () => {
    const { dir, from } = fixtureRoot();
    rmSync(path.join(dir, 'design', 'screens', '02-options.png'));

    const result = await runImport({ root: dir, from, env: {} });

    expect(result.code).toBe(2);
    expect(result.wrote).toEqual([]);
    expect(stderr.join('')).toContain(path.join('screens', '02-options.png'));
  });

  it('checks without writing, and reports the one byte that moves', async () => {
    const { dir, from } = fixtureRoot();
    const written = await runImport({ root: dir, from, env: {} });
    expect(written.code).toBe(0);

    const clean = await runImport({ root: dir, from, env: {}, check: true });
    expect(clean.code).toBe(0);
    expect(clean.drifted).toEqual([]);
    expect(clean.wrote).toEqual([]);

    const spec = path.join(dir, 'design', 'screens', '02-options.json');
    writeFileSync(spec, readFileSync(spec, 'utf8').replace('"caption": "02 Options"', '"caption": "02 Optionz"'));
    const drifted = readFileSync(spec, 'utf8');

    const broken = await runImport({ root: dir, from, env: {}, check: true });
    expect(broken.code).toBe(1);
    expect(broken.drifted).toEqual(['design/screens/02-options.json']);
    expect(stdout.join('')).toContain('design/screens/02-options.json');
    expect(readFileSync(spec, 'utf8')).toBe(drifted);

    const tokens = path.join(dir, 'design', 'tokens.json');
    rmSync(spec);
    await runImport({ root: dir, from, env: {} });
    writeFileSync(tokens, `${readFileSync(tokens, 'utf8')}\n`);
    const tokenDrift = await runImport({ root: dir, from, env: {}, check: true });
    expect(tokenDrift.code).toBe(1);
    expect(tokenDrift.drifted).toEqual(['design/tokens.json']);
  });

  it('projects the real 66 dumps into 33 specs and 33 desktop exports', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'design-import-'));
    const design = path.join(dir, 'design');
    mkdirSync(path.join(design, 'screens'), { recursive: true });
    copy(path.join(ROOT, 'design', 'import.json'), path.join(design, 'import.json'));
    const map = readJson(path.join(ROOT, 'design', 'import.json'));
    for (const entry of map.screens) {
      copy(path.join(ROOT, 'design', 'screens', `${entry.slug}.png`), path.join(design, 'screens', `${entry.slug}.png`));
    }

    const from = path.join(ROOT, 'design', 'frames');
    const result = await runImport({ root: dir, from, env: {} });

    expect(result.code).toBe(0);
    expect(result.problems).toEqual([]);
    expect(readdirSync(path.join(design, 'screens')).filter((name) => name.endsWith('.json'))).toHaveLength(33);
    expect(readdirSync(path.join(design, 'exports')).filter((name) => name.endsWith('.png'))).toHaveLength(33);
    expect(result.wrote.filter((relative) => relative.endsWith('.json') && relative.startsWith('design/screens/'))).toHaveLength(33);
    expect(result.wrote.filter((relative) => relative.endsWith('.png'))).toHaveLength(33);
    expect(readFileSync(path.join(design, 'exports', '02-options.png'))).toEqual(
      readFileSync(path.join(ROOT, 'design', 'screens', '02-options.png')),
    );
  });

  it('is still the REST path when no directory is named', async () => {
    const result = await runImport({ root: ROOT, env: {} });
    expect(result.code).toBe(2);
    expect(stderr.join('')).toContain('missing FIGMA_TOKEN');
  });
});
