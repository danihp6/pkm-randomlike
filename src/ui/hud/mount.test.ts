import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { hudRequested, mountHud } from './mount';

const ROOT_CSS = fileURLToPath(new URL('./styles/root.css', import.meta.url));
const FONTS = new URL('../../assets/fonts/', import.meta.url);

const TYPE_SCALE: readonly (readonly [string, number, number])[] = [
  ['tag', 8, 10],
  ['meta', 9, 12],
  ['body', 10, 13],
  ['chip', 11, 15],
  ['name', 12, 15],
  ['section', 14, 18],
  ['readout', 16, 20],
  ['title', 18, 23],
  ['display', 20, 26],
  ['hero', 24, 31],
];

function fontFile(name: string): Buffer {
  return readFileSync(new URL(name, FONTS));
}

function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.#]/g, (char) => `\\${char}`);
  const match = new RegExp(`${escaped}\\s*{([^}]*)}`).exec(css);
  return match === null ? '' : match[1];
}

describe('hudRequested', () => {
  it('enables the DOM HUD for ?hud=dom anywhere in the query string', () => {
    for (const search of ['?hud=dom', '?a=1&hud=dom', 'HUD=DOM', '?hud=DOM&x=1', '?a=1&hud=dom&b=2']) {
      expect(hudRequested(search), search).toBe(true);
    }
  });

  it('leaves every other search alone', () => {
    for (const search of [
      '',
      '?',
      '?hud',
      '?hud=phaser',
      '?hud=domx',
      '?hudx=dom',
      '?x=1',
      '?ahud=dom',
    ]) {
      expect(hudRequested(search), search).toBe(false);
    }
  });

  it('mounts nothing when the flag is absent', () => {
    expect(mountHud('')).toBeNull();
    expect(mountHud('?hud=phaser')).toBeNull();
  });
});

describe('the vendored Silkscreen faces', () => {
  it('ships the two WOFF2 files with the font signature and a real payload', () => {
    for (const name of ['silkscreen-400.woff2', 'silkscreen-700.woff2']) {
      const bytes = fontFile(name);
      expect(bytes.subarray(0, 4).toString('latin1'), name).toBe('wOF2');
      expect(bytes.byteLength, name).toBeGreaterThan(1024);
    }
  });

  it('ships the OFL licence that travels with them', () => {
    const licence = fontFile('OFL.txt').toString('utf8');
    expect(licence).toContain('SIL Open Font License');
    expect(licence).toContain('Version 1.1');
  });

  it('names both weights and the ten board size/line-height pairs in root.css', () => {
    const css = readFileSync(ROOT_CSS, 'utf8');
    for (const weight of [400, 700]) {
      expect(css).toContain(`font-weight: ${weight};`);
      expect(css).toContain(`silkscreen-${weight}.woff2`);
    }
    for (const [name, size, line] of TYPE_SCALE) {
      expect(css, name).toContain(`--hud-type-${name}-size: ${size}px;`);
      expect(css, name).toContain(`--hud-type-${name}-line: ${line}px;`);
    }
  });

  it('resolves every @font-face src to a file that exists', () => {
    const css = readFileSync(ROOT_CSS, 'utf8');
    const srcs = [...css.matchAll(/url\('([^']+\.woff2)'\)/g)].map((match) => match[1]);
    expect(srcs).toHaveLength(2);
    for (const src of srcs) {
      expect(existsSync(fileURLToPath(new URL(src, pathToFileURL(ROOT_CSS)))), src).toBe(true);
    }
  });

  it('keeps the layer contract: full viewport, z-index 1, no pointer capture', () => {
    const css = readFileSync(ROOT_CSS, 'utf8');
    const root = rule(css, '#hud');
    expect(root).toContain('position: fixed;');
    expect(root).toContain('inset: 0;');
    expect(root).toContain('z-index: 1;');
    expect(root).toContain('pointer-events: none;');
    expect(root).toContain('font-family: var(--hud-font);');
    const layer = rule(css, '.hud');
    expect(layer).toContain('width: 100%;');
    expect(layer).toContain('height: 100%;');
    expect(layer).toContain('pointer-events: none;');
    expect(layer).toContain('font-family: var(--hud-font);');
  });
});
