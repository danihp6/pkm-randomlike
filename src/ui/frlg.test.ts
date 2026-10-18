import { describe, expect, it } from 'vitest';
import chrome from '../data/ui/chrome.json';
import { FRLG_FOREST_PALETTE } from '../data/tilesets/palettes';
import { FLOOR, WALL } from '../engine/map';
import {
  FRLG_ACCENT,
  FRLG_HAIRLINE,
  FRLG_HIGHLIGHT,
  FRLG_MUTED,
  FRLG_NEGATIVE,
  FRLG_POSITIVE,
  FRLG_ROW_FILL,
  FRLG_ROW_STROKE,
  FRLG_SELECTED_FILL,
  FRLG_SELECTED_STROKE,
  FRLG_SHADOW,
  FRLG_SURFACE,
  FRLG_TEXTBOX_ALPHA,
  FRLG_TEXTBOX_CORNER,
  FRLG_TRACK,
  FRLG_WINDOW_ALPHA,
  FRLG_WINDOW_CORNER,
  frlgColour,
} from './frlg';
import { FRLG_INK } from './frlgFont';

type Rgb = readonly [number, number, number];

const WHITE = frlgColour(chrome.tokens.hairline.colour);
const BLACK = frlgColour(chrome.tokens.shadow.colour);

function hexChannels(hex: string): Rgb {
  const value = frlgColour(hex);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function channels(value: number): Rgb {
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/** A tone's own colour mixed over a background at the tone's alpha. */
function over(tone: Readonly<{ colour: number; alpha: number }>, background: Rgb): Rgb {
  return blend(channels(tone.colour), tone.alpha, background);
}

function blend(foreground: Rgb, alpha: number, background: Rgb): Rgb {
  return [
    background[0] + alpha * (foreground[0] - background[0]),
    background[1] + alpha * (foreground[1] - background[1]),
    background[2] + alpha * (foreground[2] - background[2]),
  ];
}

function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(colour: Rgb): number {
  return 0.2126 * linear(colour[0]) + 0.7152 * linear(colour[1]) + 0.0722 * linear(colour[2]);
}

function ratio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const INK: Rgb = channels(FRLG_INK);
const MUTED: Rgb = channels(FRLG_MUTED);
const ACCENT: Rgb = channels(FRLG_ACCENT);
const POSITIVE: Rgb = channels(FRLG_POSITIVE);
const NEGATIVE: Rgb = channels(FRLG_NEGATIVE);
const SURFACE: Rgb = channels(FRLG_SURFACE);
const TRACK: Rgb = channels(FRLG_TRACK.colour);

/** Each ground tone the card floats over, with the light one first. */
const GROUNDS: readonly Readonly<{ ground: Rgb; name: string }>[] = [
  { ground: hexChannels(FRLG_FOREST_PALETTE[FLOOR]!), name: 'forest floor' },
  { ground: hexChannels(FRLG_FOREST_PALETTE[WALL]!), name: 'forest canopy' },
];

const ALPHAS: readonly number[] = [FRLG_WINDOW_ALPHA, FRLG_TEXTBOX_ALPHA];

/** Every (ground, skin alpha) pair the card is drawn over, worst first. */
const CASES = GROUNDS.flatMap(({ ground, name }) =>
  ALPHAS.map((alpha) => ({ ground, alpha, name, composite: blend(SURFACE, alpha, ground) })),
);

describe('the glass card tokens', () => {
  it('pins the packer’s corner, alpha and padding', () => {
    expect(chrome.window.corner).toBe(11);
    expect(chrome.textbox.corner).toBe(11);
    expect(chrome.window.alpha).toBe(0.72);
    expect(chrome.textbox.alpha).toBe(0.8);
    expect(chrome.window.padding).toEqual({ x: 20, top: 16, bottom: 8 });
    expect(chrome.textbox.padding).toEqual({ x: 36, top: 28, bottom: 28 });
  });

  it('pins the whole tokens block', () => {
    expect(chrome.tokens).toEqual({
      surface: '#10161f',
      ink: '#f8fafc',
      muted: '#94a3b8',
      accent: '#7dd3fc',
      badgeInk: '#10161f',
      positive: '#4ad15c',
      negative: '#f87171',
      hairline: { colour: '#ffffff', alpha: 0.16 },
      highlight: { colour: '#ffffff', alpha: 0.14 },
      shadow: { colour: '#000000', alpha: 0.35 },
      row: {
        fill: { colour: '#ffffff', alpha: 0.06 },
        stroke: { colour: '#ffffff', alpha: 0.1 },
      },
      selected: {
        fill: { colour: '#7dd3fc', alpha: 0.16 },
        stroke: { colour: '#7dd3fc', alpha: 1 },
      },
      track: { colour: '#ffffff', alpha: 0.12 },
    });
  });

  it('maps the tokens onto the exported tones', () => {
    expect(FRLG_INK).toBe(0xf8fafc);
    expect(FRLG_MUTED).toBe(0x94a3b8);
    expect(FRLG_ACCENT).toBe(0x7dd3fc);
    expect(FRLG_SURFACE).toBe(0x10161f);
    expect(FRLG_WINDOW_ALPHA).toBe(0.72);
    expect(FRLG_TEXTBOX_ALPHA).toBe(0.8);
    expect(FRLG_WINDOW_CORNER).toBe(11);
    expect(FRLG_TEXTBOX_CORNER).toBe(11);
    expect(hexChannels(chrome.tokens.positive)).toEqual(channels(FRLG_POSITIVE));
    expect(hexChannels(chrome.tokens.negative)).toEqual(channels(FRLG_NEGATIVE));
    expect(FRLG_HAIRLINE).toEqual({ colour: WHITE, alpha: 0.16 });
    expect(FRLG_HIGHLIGHT).toEqual({ colour: WHITE, alpha: 0.14 });
    expect(FRLG_SHADOW).toEqual({ colour: BLACK, alpha: 0.35 });
    expect(FRLG_ROW_FILL).toEqual({ colour: WHITE, alpha: 0.06 });
    expect(FRLG_ROW_STROKE).toEqual({ colour: WHITE, alpha: 0.1 });
    expect(FRLG_SELECTED_FILL).toEqual({ colour: frlgColour(chrome.tokens.accent), alpha: 0.16 });
    expect(FRLG_SELECTED_STROKE).toEqual({ colour: frlgColour(chrome.tokens.accent), alpha: 1 });
    expect(FRLG_TRACK).toEqual({ colour: WHITE, alpha: 0.12 });
    expect(frlgColour('#10161f')).toBe(0x10161f);
  });
});

describe('the glass card contrast pass', () => {
  it('keeps body ink at 7:1 over every ground and skin', () => {
    for (const { composite, name, alpha } of CASES) {
      expect(ratio(INK, composite), `${name} @ ${alpha}`).toBeGreaterThanOrEqual(7);
    }
  });

  it('keeps the muted tone at 4.5:1 over every ground and skin', () => {
    const measured = CASES.map(({ composite, name, alpha }) => ({
      label: `${name} @ ${alpha}`,
      value: ratio(MUTED, composite),
    }));
    for (const { label, value } of measured) expect(value, label).toBeGreaterThanOrEqual(4.5);
    const worst = measured.reduce((a, b) => (b.value < a.value ? b : a));
    expect(worst.label).toBe('forest floor @ 0.72');
  });

  it('keeps the muted tone at 3:1 over a row', () => {
    for (const { composite, name, alpha } of CASES) {
      const row = over(FRLG_ROW_FILL, composite);
      expect(ratio(MUTED, row), `${name} @ ${alpha}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps a disabled row’s ink at 3:1 over the field', () => {
    for (const { composite, name, alpha } of CASES) {
      const dimmed = blend(INK, 0.4, composite);
      expect(ratio(dimmed, composite), `${name} @ ${alpha}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps the accent at 4.5:1 over a selected cell’s fill', () => {
    for (const { composite, name, alpha } of CASES) {
      const selected = over(FRLG_SELECTED_FILL, composite);
      expect(ratio(ACCENT, selected), `${name} @ ${alpha}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('separates a selected cell from an unselected one by 15 in blue', () => {
    for (const { composite, name, alpha } of CASES) {
      const selected = over(FRLG_SELECTED_FILL, composite);
      const row = over(FRLG_ROW_FILL, composite);
      expect(selected[2] - row[2], `${name} @ ${alpha}`).toBeGreaterThanOrEqual(15);
    }
  });

  it('lifts the HP/XP track 15 per channel above the field it lies on', () => {
    for (const { composite, name, alpha } of CASES) {
      const track = over(FRLG_TRACK, composite);
      for (let channel = 0; channel < 3; channel++) {
        expect(track[channel] - composite[channel], `${name} @ ${alpha}`).toBeGreaterThanOrEqual(15);
      }
    }
  });

  it('keeps the semantic pair readable over the field and a row', () => {
    for (const { composite, name, alpha } of CASES) {
      const row = over(FRLG_ROW_FILL, composite);
      expect(ratio(POSITIVE, composite), `${name} @ ${alpha}`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(POSITIVE, row), `${name} @ ${alpha}`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(NEGATIVE, composite), `${name} @ ${alpha}`).toBeGreaterThanOrEqual(3);
      expect(ratio(NEGATIVE, row), `${name} @ ${alpha}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps every content inset clear of the card’s own 2px ring', () => {
    const insets = [
      chrome.window.padding.x,
      chrome.window.padding.top,
      chrome.window.padding.bottom,
      chrome.textbox.padding.x,
      chrome.textbox.padding.top,
      chrome.textbox.padding.bottom,
    ];
    for (const inset of insets) expect(inset).toBeGreaterThanOrEqual(6);
    expect(TRACK).toHaveLength(3);
  });
});
