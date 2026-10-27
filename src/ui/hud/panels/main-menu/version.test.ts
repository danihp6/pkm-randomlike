import { describe, expect, it } from 'vitest';
import pkg from '../../../../../package.json';
import { APP_VERSION, MENU_PHASE, menuVersionLabel } from './version';

describe('APP_VERSION', () => {
  it('is the version package.json carries, never a literal in the panel', () => {
    expect(APP_VERSION).toBe(pkg.version);
  });
});

describe('MENU_PHASE', () => {
  it('ships the phase TODO.md currently opens', () => {
    expect(MENU_PHASE).toBe(17);
  });
});

describe('menuVersionLabel', () => {
  it('prints the board’s own string for the board’s own two values', () => {
    expect(menuVersionLabel('0.7.0', 7)).toBe('v0.7.0 · PHASE 7');
  });

  it('defaults to this build’s version and phase', () => {
    expect(menuVersionLabel()).toBe(`v${APP_VERSION} · PHASE ${MENU_PHASE}`);
    expect(menuVersionLabel()).toBe('v0.0.0 · PHASE 17');
  });

  it('keeps the separator the frame draws: space, U+00B7, space', () => {
    const label = menuVersionLabel('1.2.3', 4);

    expect(label).toBe('v1.2.3 \u00b7 PHASE 4');
    expect(label).toContain(' \u00b7 ');
    expect(label).not.toContain('\u2014');
    expect(label).not.toContain('\u2022');
  });

  it('lowercases the v, uppercases PHASE and never adds a second one', () => {
    expect(menuVersionLabel('1.2.3', 4)).toMatch(/^v[^\s]+ · PHASE \d+$/);
    expect(menuVersionLabel('1.2.3', 4).match(/PHASE/g)).toHaveLength(1);
  });

  it('defaults each argument on its own', () => {
    expect(menuVersionLabel('1.2.3')).toBe(`v1.2.3 · PHASE ${MENU_PHASE}`);
  });
});
