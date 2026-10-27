import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { STATS_NARROW_QUERY } from './view';

const RAW = readFileSync(fileURLToPath(new URL('./stats.css', import.meta.url)), 'utf8');
/** The stylesheet without its comments, so a selector list is never read off a note. */
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, '');

type Declaration = readonly [property: string, value: string];

function declarationsOf(block: string): readonly Declaration[] {
  const found: Declaration[] = [];
  for (const part of block.split(';')) {
    const text = part.trim();
    const separator = text.indexOf(':');
    if (separator < 0) continue;
    found.push([text.slice(0, separator).trim(), text.slice(separator + 1).trim()]);
  }
  return found;
}

/** Every declaration of every block whose selector list names `selector`. */
function declarationsFor(selector: string): readonly Declaration[] {
  const found: Declaration[] = [];
  for (const match of CSS.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selectors = match[1]!.split(',').map((part) => part.trim());
    if (!selectors.includes(selector)) continue;
    found.push(...declarationsOf(match[2]!));
  }
  return found;
}

function valueOf(selector: string, property: string): string | undefined {
  return declarationsFor(selector).find(([name]) => name === property)?.[1];
}

describe('stats.css paints the rule from the board token', () => {
  it('keeps the token the frames measure, white at 8 %, declared once', () => {
    expect(valueOf('.stats', '--stats-rule')).toBe('rgb(255 255 255 / 8%)');
    expect(RAW.match(/--stats-rule\s*:/g)).toHaveLength(1);
  });

  it('draws the figure’s rule and the row’s rule with that one token', () => {
    for (const selector of ['.stats__figure-rule', '.stats__row-rule']) {
      expect(valueOf(selector, 'position'), selector).toBe('absolute');
      expect(valueOf(selector, 'height'), selector).toBe('1px');
      expect(valueOf(selector, 'background'), selector).toBe('var(--stats-rule)');
    }
  });

  it('flushes the row’s rule with the row card’s bottom edge', () => {
    expect(valueOf('.stats__row-rule', 'right')).toBe('0');
    expect(valueOf('.stats__row-rule', 'bottom')).toBe('0');
    expect(valueOf('.stats__row-rule', 'left')).toBe('0');
    expect(valueOf('.stats__row-rule', 'width')).toBeUndefined();
  });

  it('keeps the figure block relative, so the rule is positioned inside it', () => {
    expect(valueOf('.stats__figure', 'position')).toBe('relative');
    expect(valueOf('.stats__figure', 'width')).toBe('320px');
    expect(valueOf('.stats__figure', 'height')).toBe('16px');
  });

  it('switches its phone column at the breakpoint the panel reads', () => {
    expect(CSS).toContain(`@media ${STATS_NARROW_QUERY}`);
    expect(STATS_NARROW_QUERY).toBe('(max-width: 600px)');
  });
});
