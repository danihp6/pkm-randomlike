import { describe, expect, it } from 'vitest';
import { hudRequested } from '../mount';
import { normaliseSlug, parseHudFlags } from './flags';

const SEARCHES: readonly string[] = [
  '',
  '?',
  '??',
  '?hud',
  '?hud=dom',
  '?hud=DOM',
  '?hud=phaser',
  '?hud=domx',
  '?hudx=dom',
  '?a=1&hud=dom',
  '?a=1&hud=dom&b=2',
  '?hudFixture',
  '?hudFixture=',
  '?hudFixture=02-options',
  '?HUDFIXTURE=02-OPTIONS',
  '?HudFixture=02-Options',
  '?hudFixture= 02-options ',
  '?hudFixture=../x',
  '?hudFixture=a b',
  '?hudFixture=a/b',
  '?hudFixture=-lead',
  '?hudFixture=%E2%9C%93',
  '?hud=dom&hudFixture=02-options',
  '?a=1&hudFixture=03b-panels-row-view&hud=dom',
];

describe('parseHudFlags', () => {
  it('delegates ?hud=dom to hudRequested on every case', () => {
    for (const search of SEARCHES) {
      expect(parseHudFlags(search).dom, search).toBe(hudRequested(search));
    }
  });

  it('reads and normalises ?hudFixture=<slug>', () => {
    for (const search of [
      '?hudFixture=02-options',
      '?HUDFIXTURE=02-OPTIONS',
      '?HudFixture=02-Options',
      '?hudFixture= 02-options ',
    ]) {
      expect(parseHudFlags(search), search).toEqual({ dom: false, fixture: '02-options' });
    }
  });

  it('reads the two flags together, in either order', () => {
    expect(parseHudFlags('?hud=dom&hudFixture=02-options')).toEqual({
      dom: true,
      fixture: '02-options',
    });
    expect(parseHudFlags('?a=1&hudFixture=02-options&hud=dom')).toEqual({
      dom: true,
      fixture: '02-options',
    });
  });

  it('is inert for an empty, malformed or absent slug', () => {
    for (const search of [
      '?hudFixture',
      '?hudFixture=',
      '?hudFixture=../x',
      '?hudFixture=a b',
      '?hudFixture=a/b',
    ]) {
      expect(parseHudFlags(search), search).toEqual({ dom: false, fixture: null });
    }
  });

  it('reads no fixture without the DOM HUD, and vice versa', () => {
    expect(parseHudFlags('?hud=dom')).toEqual({ dom: true, fixture: null });
    expect(parseHudFlags('?hud=phaser')).toEqual({ dom: false, fixture: null });
    expect(parseHudFlags('')).toEqual({ dom: false, fixture: null });
  });

  it('never throws on any search', () => {
    for (const search of SEARCHES) {
      expect(() => parseHudFlags(search), search).not.toThrow();
    }
  });
});

describe('normaliseSlug', () => {
  it('accepts the board frame slugs', () => {
    for (const value of [
      '02-options',
      '03b-panels-row-view',
      'm03-route-hud',
      'a',
      '0',
      '02--options',
      'a'.repeat(64),
    ]) {
      expect(normaliseSlug(value), value).toBe(value);
    }
  });

  it('trims and lowercases before validating', () => {
    expect(normaliseSlug('  02-Options  ')).toBe('02-options');
    expect(normaliseSlug('03B-PANELS-ROW-VIEW')).toBe('03b-panels-row-view');
  });

  it('rejects everything outside lower-kebab', () => {
    for (const value of [
      '',
      '   ',
      '../x',
      'a b',
      'a/b',
      'a_b',
      '-lead',
      'a.'.repeat(2),
      'á',
      'a'.repeat(65),
      'x'.repeat(70),
    ]) {
      expect(normaliseSlug(value), value).toBeNull();
    }
  });
});
