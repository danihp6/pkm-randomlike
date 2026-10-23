import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const KIT_CSS = fileURLToPath(new URL('./kit.css', import.meta.url));
const CSS = readFileSync(KIT_CSS, 'utf8');

const SIZED = [
  '.kit-panel',
  '.kit-row',
  '.kit-chip',
  '.kit-bar',
  '.kit-sheet',
  '.kit-sheet__close',
  '.kit-button',
  '.kit-type',
] as const;

const COLOUR_PROPERTIES = new Set([
  'color',
  'background',
  'background-color',
  'border',
  'border-color',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'outline',
  'outline-color',
]);

const NAMED_COLOURS = new Set([
  'black',
  'white',
  'red',
  'lime',
  'blue',
  'yellow',
  'cyan',
  'aqua',
  'magenta',
  'fuchsia',
  'silver',
  'gray',
  'grey',
  'maroon',
  'olive',
  'green',
  'purple',
  'teal',
  'navy',
  'orange',
  'transparent',
  'currentcolor',
]);

type Declaration = readonly [property: string, value: string];

function body(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(CSS);
  return match === null ? '' : match[1];
}

function declarations(block: string): readonly Declaration[] {
  const found: Declaration[] = [];
  for (const part of block.split(';')) {
    const text = part.trim();
    const separator = text.indexOf(':');
    if (separator < 0) continue;
    found.push([text.slice(0, separator).trim(), text.slice(separator + 1).trim()]);
  }
  return found;
}

function allDeclarations(): readonly Declaration[] {
  const found: Declaration[] = [];
  for (const match of CSS.matchAll(/\{([^}]*)\}/g)) found.push(...declarations(match[1]));
  return found;
}

describe('kit.css keeps the measured geometry', () => {
  it('never writes a literal colour', () => {
    expect(CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(CSS).not.toMatch(/\brgba?\(/);
    expect(CSS).not.toMatch(/\bhsla?\(/);
    for (const [property, value] of allDeclarations()) {
      for (const token of value.toLowerCase().split(/[\s,()]+/)) {
        expect(NAMED_COLOURS.has(token), `${property}: ${value}`).toBe(false);
      }
    }
  });

  it('takes every chrome colour from a --hud token', () => {
    for (const [property, value] of allDeclarations()) {
      if (!COLOUR_PROPERTIES.has(property)) continue;
      expect(value, property).toMatch(/var\(--hud-[a-z-]+\)/);
    }
  });

  it('pins every font-size and line-height to one of the ten board pairs', () => {
    let sizes = 0;
    for (const [property, value] of allDeclarations()) {
      if (property === 'font-size') {
        expect(value).toMatch(/^var\(--hud-type-[a-z]+-size\)$/);
        sizes += 1;
      }
      if (property === 'line-height') {
        expect(value).toMatch(/^var\(--hud-type-[a-z]+-line\)$/);
      }
    }
    expect(sizes).toBeGreaterThan(0);
  });

  it('draws no shadow and hides no focus ring', () => {
    expect(CSS).not.toMatch(/box-shadow/);
    expect(CSS).not.toMatch(/text-shadow/);
    expect(CSS).not.toMatch(/outline:\s*(none|0)/);
  });

  it('keeps every border at 1 px', () => {
    let borders = 0;
    for (const [property, value] of allDeclarations()) {
      if (!/^border(-(top|right|bottom|left))?$/.test(property)) continue;
      expect(value, property).toMatch(/^1px solid var\(--hud-[a-z-]+\)$/);
      borders += 1;
    }
    expect(borders).toBeGreaterThanOrEqual(7);
  });

  it('boxes every sized primitive with border-box', () => {
    for (const selector of SIZED) {
      expect(body(selector), selector).toContain('box-sizing: border-box;');
    }
  });

  it('declares exactly the three kit-scoped radii, once, on the .kit block', () => {
    const kit = body('.kit');
    expect(kit).toContain('--kit-chip-radius: 6px;');
    expect(kit).toContain('--kit-button-radius: 10px;');
    expect(kit).toContain('--kit-sheet-radius: 16px;');
    const scoped = [...CSS.matchAll(/--kit-[a-z-]*radius:\s*([^;]+);/g)].map((match) => match[1].trim());
    expect(scoped).toEqual(['6px', '10px', '16px']);
  });

  it('takes every radius from a token and never from a literal', () => {
    let radii = 0;
    for (const [property, value] of allDeclarations()) {
      if (property.startsWith('--') || !property.endsWith('radius')) continue;
      expect(value, property).toMatch(/^var\(--(hud|kit)-[a-z-]*radius\)$/);
      radii += 1;
    }
    expect(radii).toBeGreaterThan(0);
    expect(body('.kit-panel')).toContain('border-radius: var(--hud-panel-radius);');
    expect(body('.kit-row')).toContain('border-radius: var(--hud-row-radius);');
  });

  it('widens the row and the chip to a 44 px target without growing the drawn box', () => {
    for (const selector of ['.kit-row--interactive::after', '.kit-chip::after']) {
      const target = body(selector);
      expect(target, selector).toContain('min-width: 44px;');
      expect(target, selector).toContain('min-height: 44px;');
    }
    expect(body('.kit-row')).toContain('min-height: 26px;');
    expect(body('.kit-chip')).toContain('width: 26px;');
    expect(body('.kit-chip')).toContain('height: 26px;');
  });

  it('has exactly one visible focus ring', () => {
    const focus = [...CSS.matchAll(/([^{}]*:focus-visible[^{}]*)\{([^}]*)\}/g)];
    expect(focus).toHaveLength(1);
    const [, selectors, block] = focus[0];
    for (const selector of ['.kit-row', '.kit-chip', '.kit-sheet__close', '.kit-button']) {
      expect(selectors, selector).toContain(selector);
    }
    expect(block).toContain('outline: 2px solid var(--hud-accent);');
    expect(block).toContain('outline-offset: 2px;');
  });

  it('draws the panel highlight in CSS, not as a node', () => {
    const highlight = body('.kit-panel::before');
    expect(highlight).toContain('top: 12px;');
    expect(highlight).toContain('height: 1px;');
    expect(highlight).toContain('background: var(--hud-row-border);');
  });

  it('keeps one block per primitive in the components order', () => {
    const anchors = [
      '.kit-panel {',
      '.kit-row {',
      '.kit-chip {',
      '.kit-bar {',
      '.kit-sheet {',
      '.kit-button {',
      '.kit-meta {',
      '.kit-type {',
    ];
    let last = -1;
    for (const anchor of anchors) {
      const index = CSS.indexOf(anchor);
      expect(index, anchor).toBeGreaterThan(last);
      last = index;
    }
  });
});
