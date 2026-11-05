import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

import { NPC_ROWS, SPECIAL_NPCS, specialNpcRow } from '../data/npcs';
import { OVERWORLD_SPRITE_KEYS, overworldSpriteFrame } from '../data/overworldSprites';
import { POI_KINDS } from '../engine/region/content';
import { npcUsed, type PlacedNpc } from '../engine/region/npcs';
import { createRun, createRunPokemon, type RunState } from '../engine/run';
import { setLocale, t } from '../i18n';
import {
  markNpcVisit,
  npcCardView,
  npcCounterOf,
  npcFrameOf,
  npcStaysOpen,
  poiCounterOf,
} from './npcs';


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

/**
 * The two **counters** the region places but nothing opened (`docs/region-spec.md`
 * §7.7 and §7.8, `Task-305`): which person opens the slot machine and which zone
 * opens the trade card. Both are pure lookups, so each scene only routes — and that
 * route is pinned off the two sources the way `BattleScene.test.ts` pins its seams.
 */

/** One method body off a scene's source: from its signature to its closing brace. */
function methodBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf('\n  }\n', start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

const CITY_SOURCE = readFileSync(fileURLToPath(new URL('./CityScene.ts', import.meta.url)), 'utf8');
const ROUTE_SOURCE = readFileSync(fileURLToPath(new URL('./RouteScene.ts', import.meta.url)), 'utf8');

describe('npcCounterOf', () => {
  it('answers the machine for the Team Rocket row', () => {
    expect(npcCounterOf('rocket')).toBe('rocket');
  });

  it('answers the generic card for every other row the table holds', () => {
    for (const row of NPC_ROWS) {
      if (row.id === 'rocket') continue;
      expect(npcCounterOf(row.id), row.id).toBe('card');
    }
  });

  it('answers the card for an id no table holds, so a stale save reads as one', () => {
    expect(npcCounterOf('')).toBe('card');
    expect(npcCounterOf('no-such-row')).toBe('card');
  });
});

describe('poiCounterOf', () => {
  it('answers the trade card for the trade kind', () => {
    expect(poiCounterOf('trade')).toBe('trade');
  });

  it('answers nothing for the other eight kinds, which stay drawn and inert', () => {
    const others = POI_KINDS.filter((kind) => kind !== 'trade');
    expect(others).toHaveLength(8);
    for (const kind of others) expect(poiCounterOf(kind), kind).toBeNull();
  });
});

describe('the settlement counter’s route', () => {
  it('opens the machine for the row npcCounterOf names a counter, and no card', () => {
    const body = methodBody(CITY_SOURCE, '  private openPerson(placed: PlacedNpc): void {');
    expect(body).toContain("if (npcCounterOf(placed.rowId) === 'rocket') {");
    expect(body).toContain('this.openMachine(placed);');
    expect(body.indexOf('this.openMachine(placed);')).toBeLessThan(
      body.indexOf('this.openNpcCard(placed);'),
    );
  });

  it('reaches that branch from the interact key, a landed step and the dev talk', () => {
    expect(CITY_SOURCE.match(/this\.openPerson\(/g)).toHaveLength(3);
    expect(CITY_SOURCE).not.toContain('this.openNpcCard(npc)');
  });

  it('hands the machine the scene’s live run and the tile the player faces', () => {
    const body = methodBody(CITY_SOURCE, '  private rocketHost(): RocketHost {');
    expect(body).toContain('get run(): RunState {');
    expect(body).toContain('return scene.run;');
    expect(body).toContain('entryTile: () => {');
    expect(CITY_SOURCE).toContain('openRocket(this.rocketHost(), placed.tile);');
  });

  it('marks the visit when the machine’s window closes, through the row’s own rule', () => {
    const body = methodBody(CITY_SOURCE, '  private closePanel(): void {');
    expect(body).toContain('if (placement !== null) this.markVisit(placement);');
    const mark = methodBody(CITY_SOURCE, '  private markVisit(placed: PlacedNpc): void {');
    expect(mark).toContain('markNpcVisit(this.run, placed)');
    expect(CITY_SOURCE).not.toContain('markNpcUsed(');
  });
});

describe('the route counter’s route', () => {  it('opens the trade card only for the trade kind, inside the zone', () => {
    const body = methodBody(ROUTE_SOURCE, '  private openPoiCounter(tile: Tile): void {');
    expect(body).toContain("poiCounterOf(poi.kind) !== 'trade'");
    expect(body).toContain('inPoiRect(poiRect(this.route), tile)');
    expect(body).toContain('openTradeCard(this.panelHost);');
  });

  it('answers the interact key off the faced tile, after the ground items', () => {
    const body = methodBody(ROUTE_SOURCE, '  private tryInteract(): void {');
    expect(body).toContain('this.openPoiCounter(ahead);');
    expect(body.indexOf('this.collectItemAt(ahead)')).toBeLessThan(
      body.indexOf('this.openPoiCounter(ahead)'),
    );
    expect(ROUTE_SOURCE.match(/openTradeCard\(/g)).toHaveLength(1);
  });
});

/**
 * Who answers again (`docs/region-spec.md` §7.7). A row the data marks `repeatable`
 * is never written into the run's marks, so its card keeps its own line and its
 * counter reopens — the merchant's Mart and the Rocket grunt's machine.
 */

/** A fresh run with one starter: the run the visit marks are written on. */
function baseRun(): RunState {
  return createRun({
    seed: 'task-305',
    starter: createRunPokemon({
      id: 'starter',
      speciesId: 'charmander',
      level: 5,
      moves: ['scratch'],
    }),
  });
}

describe('npcStaysOpen', () => {
  it('answers true for exactly the two rows the table marks repeatable', () => {
    const open = NPC_ROWS.filter((row) => npcStaysOpen(row.id)).map((row) => row.id);
    expect(open).toEqual(['merchant', 'rocket']);
    expect(open.every((id) => specialNpcRow(id)?.repeatable === true)).toBe(true);
  });

  it('answers false for every other row and for an id no table holds', () => {
    const closed = NPC_ROWS.filter((row) => !npcStaysOpen(row.id));
    expect(closed).toHaveLength(NPC_ROWS.length - 2);
    for (const row of closed) expect(npcStaysOpen(row.id), row.id).toBe(false);
    expect(npcStaysOpen('no-such-row')).toBe(false);
  });
});

describe('markNpcVisit', () => {
  it('leaves a repeatable row open, so its card prints its own line again', () => {
    const placed = placedOf('merchant');
    const run = markNpcVisit(baseRun(), placed);
    expect(npcUsed(run, placed)).toBe(false);
    const view = npcCardView(placed, npcUsed(run, placed));
    expect(view.paragraph).toBe(t('npc.merchant.greeting'));
    expect(view.paragraph).not.toBe(t('npc.used'));
  });

  it('writes the mark on a one-shot row, so its card prints npc.used', () => {
    const placed = placedOf('iv-judge');
    const run = markNpcVisit(baseRun(), placed);
    expect(npcUsed(run, placed)).toBe(true);
    expect(npcCardView(placed, npcUsed(run, placed)).paragraph).toBe(t('npc.used'));
  });

  it('leaves the run alone for a repeatable row, so nothing is written on a visit', () => {
    const run = baseRun();
    expect(markNpcVisit(run, placedOf('rocket'))).toBe(run);
    expect(markNpcVisit(run, placedOf('medic'))).not.toBe(run);
  });
});
