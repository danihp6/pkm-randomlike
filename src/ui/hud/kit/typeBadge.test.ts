import { h } from 'preact';
import { describe, expect, it } from 'vitest';
import { TypeBadge, typeBadgeTone } from './typeBadge';
import { typeBadgeClass } from './classes';

const CANON_TYPES = [
  'normal',
  'fire',
  'water',
  'electric',
  'grass',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy',
] as const;

const INKS = ['#0b1017', '#f8fafc'] as const;

function channel(value: number): number {
  const ratio = value / 255;
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

function luminance(colour: string): number {
  const value = Number.parseInt(colour.slice(1), 16);
  return (
    0.2126 * channel((value >> 16) & 0xff) +
    0.7152 * channel((value >> 8) & 0xff) +
    0.0722 * channel(value & 0xff)
  );
}

function contrast(a: string, b: string): number {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe('typeBadgeTone', () => {
  it('formats the canon fill as lowercase #rrggbb', () => {
    for (const type of CANON_TYPES) {
      expect(typeBadgeTone(type).fill, type).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(typeBadgeTone('Fire').fill).toBe('#f08030');
    expect(typeBadgeTone('steel').fill).toBe('#b8b8d0');
  });

  it('reaches 4.5:1 contrast for all 18 canon types and the unknown-type fallback', () => {
    for (const type of [...CANON_TYPES, 'stellar', '']) {
      const { fill, ink } = typeBadgeTone(type);
      expect(INKS.includes(ink as (typeof INKS)[number]), `${type} ink`).toBe(true);
      expect(contrast(fill, ink), type).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('picks the ink with the higher contrast against the fill', () => {
    for (const type of CANON_TYPES) {
      const { fill, ink } = typeBadgeTone(type);
      const other = ink === INKS[0] ? INKS[1] : INKS[0];
      expect(contrast(fill, ink), type).toBeGreaterThanOrEqual(contrast(fill, other));
    }
  });
});

describe('TypeBadge', () => {
  it('is a span whose class comes from its helper', () => {
    const vnode = h(TypeBadge, { type: 'fire' });
    expect(vnode.type).toBe(TypeBadge);
    const rendered = TypeBadge({ type: 'fire' });
    expect(rendered.type).toBe('span');
    expect(rendered.props.class).toBe(typeBadgeClass());
  });

  it('paints the canon fill with the readable ink', () => {
    const tone = typeBadgeTone('water');
    const rendered = TypeBadge({ type: 'water' });
    expect(rendered.props.style).toEqual({ color: tone.ink, background: tone.fill });
  });

  it('falls back to the type name and prefers a given label', () => {
    expect(TypeBadge({ type: 'grass' }).props.children).toBe('grass');
    expect(TypeBadge({ type: 'grass', label: 'Grass' }).props.children).toBe('Grass');
  });
});
