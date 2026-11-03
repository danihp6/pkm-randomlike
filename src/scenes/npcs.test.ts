import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => {
  class Scene {
    constructor(_key?: string) {}
  }
  return {
    default: {
      Scene,
      Scenes: { Events: { SHUTDOWN: 'shutdown' } },
      Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
      Input: { Keyboard: { KeyCodes: {} } },
    },
  };
});

import { SPECIAL_NPCS, specialNpcRow } from '../data/npcs';
import { OVERWORLD_SPRITE_KEYS, overworldSpriteFrame } from '../data/overworldSprites';
import type { PlacedNpc } from '../engine/region/npcs';
import { setLocale, t } from '../i18n';
import { npcCardView, npcFrameOf } from './npcs';

/**
 * The settlement people's draw and copy (`docs/region-spec.md` §7.7). The scene
 * module is Phaser-side, so this file mocks the library the way
 * `MainMenuScene.test.ts` does and proves the pure half: the frame a body draws and
 * the card text `openNpcPanel` prints.
 */

afterEach(() => {
  setLocale('en');
});

/** A placed row standing on a fixed tile, the shape `nodeNpcs` emits. */
function placedOf(rowId: string, facing: PlacedNpc['facing'] = 'S'): PlacedNpc {
  const row = specialNpcRow(rowId)!;
  return {
    id: `npc-city:1-0`,
    nodeKey: 'city:1',
    index: 0,
    kind: 'special',
    rowId: row.id,
    spriteKey: row.spriteKey,
    nameKey: row.nameKey,
    lineKey: row.greetingKey,
    choiceId: row.choices?.[0]?.id ?? null,
    tile: { x: 4, y: 7 },
    facing,
  };
}

/** The generic shape: the `PASSERBY` title, a tier line and no choice of its own. */
function passerby(): PlacedNpc {
  return {
    id: 'npc-town:1-0',
    nodeKey: 'town:1',
    index: 0,
    kind: 'generic',
    rowId: 'merchant',
    spriteKey: 'merchant',
    nameKey: 'npc.generic.name',
    lineKey: 'npc.generic.tier1.1',
    choiceId: null,
    tile: { x: 34, y: 26 },
    facing: 'S',
  };
}

describe('npcFrameOf', () => {
  it('reads the resting frame of the facing, the down pose when it faces south', () => {
    const placed = placedOf('medic', 'S');
    expect(npcFrameOf(placed)).toBe(overworldSpriteFrame(placed.spriteKey, 'down'));
    expect(npcFrameOf(placed)).toBe(overworldSpriteFrame('medic', 'down'));
    expect(npcFrameOf(placedOf('medic', 'N'))).toBe(overworldSpriteFrame('medic', 'up'));
    expect(npcFrameOf(placedOf('medic', 'W'))).toBe(overworldSpriteFrame('medic', 'side'));
    expect(npcFrameOf(placedOf('medic', 'E'))).toBe(overworldSpriteFrame('medic', 'side'));
  });

  it('answers a frame for every sprite key the sixteen specials name', () => {
    for (const row of SPECIAL_NPCS) {
      expect(OVERWORLD_SPRITE_KEYS, row.id).toContain(row.spriteKey);
      expect(npcFrameOf(placedOf(row.id)), row.id).not.toBeNull();
    }
  });
});

describe('npcCardView', () => {
  it('prints the row the card belongs to, with its own choices localised', () => {
    const view = npcCardView(placedOf('iv-judge'), false);
    expect(view.title).toBe(t('npc.iv.name'));
    expect(view.paragraph).toBe(t('npc.iv.greeting'));
    expect(view.choices).toEqual([{ id: 'reroll', label: t('npc.iv.reroll') }]);
  });

  it('prints the spent card as the used line, with no choice at all', () => {
    const view = npcCardView(placedOf('iv-judge'), true);
    expect(view.title).toBe(t('npc.iv.name'));
    expect(view.paragraph).toBe(t('npc.used'));
    expect(view.choices).toEqual([]);
  });

  it('offers a generic its line and LEAVE only', () => {
    const view = npcCardView(passerby(), false);
    expect(view.title).toBe(t('npc.generic.name'));
    expect(view.paragraph).toBe(t('npc.generic.tier1.1'));
    expect(view.choices).toEqual([]);
  });

  it('resolves the copy in the caller’s locale', () => {
    setLocale('es');
    const view = npcCardView(placedOf('medic'), false);
    expect(view.title).toBe('MÉDICO');
    expect(view.paragraph).toBe(t('npc.medic.greeting'));
    expect(view.choices).toEqual([{ id: 'heal', label: 'CURAR' }]);
    expect(npcCardView(passerby(), true).paragraph).toBe(t('npc.used'));
  });
});
