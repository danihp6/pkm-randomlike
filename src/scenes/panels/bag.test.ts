import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => {
  class Scene {}
  class Container {}
  class Rectangle {}
  class Image {}
  class BitmapText {}
  class Text {}
  return {
    default: {
      Scene,
      Container,
      GameObjects: { Container, Rectangle, Image, BitmapText, Text },
      Scenes: { Events: { SHUTDOWN: 'shutdown', RESUME: 'resume' } },
      Input: { Keyboard: { KeyCodes: {} } },
    },
  };
});

vi.mock('../BootScene', () => ({
  PANEL_ICON_KEYS: { bag: 'route:icon-bag' },
  PANEL_ICON_SIZE: 24,
  SHOP_COUNTER_TEXTURE_KEY: 'route:shop-counter',
}));

import { getItem } from '../../data/items';
import { candyTreat } from '../../engine/run/items';
import type { RunState } from '../../engine/run/state';
import { DEFAULT_LOCALE, setLocale, t } from '../../i18n';
import { itemText } from '../../i18n/content';
import { statLabel } from '../../ui/partyDetail';
import { bagInfoFor } from './bag';
import type { RoutePanelHost } from './types';

type HostInput = Readonly<{ seed: string; discoveredCandy: readonly string[] }>;

function hostOf(input: HostInput): RoutePanelHost {
  const run = {
    seed: input.seed,
    discoveredCandy: input.discoveredCandy,
  } as unknown as RunState;
  return { run: () => run } as unknown as RoutePanelHost;
}

const HOST = hostOf({ seed: 'seam-seed', discoveredCandy: [] });

function linesOf(text: string): readonly string[] {
  return text.split('\n');
}

afterEach(() => setLocale(DEFAULT_LOCALE));

describe('bagInfoFor', () => {
  it('prints the item English name over the localised body', () => {
    setLocale('es');
    const lines = linesOf(bagInfoFor(HOST, 'pokeball'));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('Poke Ball');
    expect(lines[1]).toBe('Dispositivo para capturar Pokémon salvajes.');
    expect(lines[1]).toBe(itemText('pokeball'));
  });

  it('falls back to the catalogue English line for an id the table does not carry', () => {
    setLocale('es');
    const lines = linesOf(bagInfoFor(HOST, 'leftovers'));
    expect(lines[0]).toBe('Leftovers');
    expect(lines[1]).toBe(getItem('leftovers')!.shortDesc);
    expect(lines[1]).toBe('Holder restores a little HP every turn.');
  });

  it('reads the catalogue body under en', () => {
    setLocale('en');
    const lines = linesOf(bagInfoFor(HOST, 'pokeball'));
    expect(lines[0]).toBe('Poke Ball');
    expect(lines[1]).toBe('A device for catching wild Pokémon.');
    expect(lines[1]).toBe(getItem('pokeball')!.shortDesc);
    expect(linesOf(bagInfoFor(HOST, 'potion'))[1]).toBe(getItem('potion')!.shortDesc);
  });

  it('keeps the discovered candy treat in place of the catalogue line', () => {
    setLocale('es');
    const host = hostOf({ seed: 'seam-seed', discoveredCandy: ['red'] });
    const treat = candyTreat('seam-seed', 'red');
    const delta = treat.delta > 0 ? '+1' : '-1';
    const lines = linesOf(bagInfoFor(host, 'candyred'));
    expect(lines[0]).toBe('Red Candy');
    expect(lines[1]).toBe(t('hud.candyKnown', { stat: statLabel(treat.stat), delta }));
    expect(lines[1]).not.toBe(itemText('candyred'));
  });

  it('draws the title only for an id the catalogue does not know', () => {
    const lines = linesOf(bagInfoFor(HOST, 'nonsense'));
    expect(lines[0]).toBe('nonsense');
    expect(lines[1]).toBe('');
  });
});
