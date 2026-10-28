import { describe, expect, it } from 'vitest';
import type { MemberDetail } from '../../../partyDetail';
import {
  DETAIL_CONTENT_LEFT,
  DETAIL_CONTENT_TOP,
  DETAIL_EVO_TOP,
  DETAIL_INFO_ROW,
  DETAIL_INFO_TOP,
  DETAIL_MOVE_GRID_H,
  DETAIL_PANEL_H,
  DETAIL_PANEL_W,
  DETAIL_POOL_COLS,
  DETAIL_POOL_ROWS,
  DETAIL_POOL_TOP,
  DETAIL_SEARCH_TOP,
  DETAIL_STAT_ROW,
  DETAIL_TAB_H,
  DETAIL_TABS_TOP,
  detailPanelBox,
  detailPanelView,
  initialDetailPanelUi,
  type DetailMoveSlotView,
  type DetailPanelUi,
  type DetailPoolRow,
  type DetailStatView,
  type Rect,
} from './view';

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

function move(moveId: string, power = 90) {
  return {
    moveId,
    name: moveId.toUpperCase(),
    type: 'fire',
    category: 'Special' as const,
    pp: 15,
    maxPp: 15,
    desc: `${moveId} burns.`,
    power,
    basePower: power,
    accuracy: 100,
    baseAccuracy: 100,
    status: null,
  };
}

function detailOf(overrides: Partial<MemberDetail> = {}): MemberDetail {
  return {
    id: 'm1',
    speciesId: 'charizard',
    name: 'CHARIZARD',
    nickname: null,
    level: 36,
    types: ['fire', 'flying'],
    nature: 'adamant',
    ability: 'Blaze',
    abilityDesc: 'Powers up Fire-type moves.',
    hp: 98,
    maxHp: 112,
    status: null,
    statusLabel: null,
    heldItemName: null,
    stats: { hp: 112, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 },
    moves: [move('flamethrower'), move('airslash', 75), move('dragonclaw', 80), move('earthquake', 100)],
    caughtLabel: null,
    evolutions: [],
    ...overrides,
  };
}

function uiOf(overrides: Partial<DetailPanelUi> = {}): DetailPanelUi {
  return { ...initialDetailPanelUi(), ...overrides };
}

function poolOf(count: number): DetailPoolRow[] {
  return Array.from({ length: count }, (_, index) => ({
    moveId: `m${index}`,
    name: `MOVE ${index}`,
    type: 'grass',
    source: `Lv ${index + 1}`,
    enabled: true,
  }));
}

/** A panel-relative rect as the viewport coordinates the board printed it at. */
function absolute(rect: Rect, view: Readonly<{ box: Rect }>): Rect {
  return { x: view.box.x + rect.x, y: view.box.y + rect.y, w: rect.w, h: rect.h };
}

function statOf(view: ReturnType<typeof detailPanelView>, stat: DetailStatView['stat']): DetailStatView {
  const row = view.stats.find((entry) => entry.stat === stat);
  if (row === undefined) throw new Error(`no ${stat} row`);
  return row;
}

function slotOf(view: ReturnType<typeof detailPanelView>, index: number): DetailMoveSlotView {
  const slot = view.moves[index];
  if (slot === undefined) throw new Error(`no slot ${index}`);
  return slot;
}

describe('the mirrored constants', () => {
  it('equal the Phaser values they copy', () => {
    expect(DETAIL_PANEL_W).toBe(460);
    expect(DETAIL_PANEL_H).toBe(560);
    expect(DETAIL_TABS_TOP).toBe(72);
    expect(DETAIL_TAB_H).toBe(26);
    expect(DETAIL_CONTENT_TOP).toBe(108);
    expect(DETAIL_STAT_ROW).toBe(26);
    expect(DETAIL_INFO_ROW).toBe(22);
    expect(DETAIL_MOVE_GRID_H).toBe(188);
    expect(DETAIL_POOL_ROWS).toBe(2);
    expect(DETAIL_POOL_COLS).toBe(2);
    expect(DETAIL_CONTENT_LEFT).toBe(30);
    expect(DETAIL_INFO_TOP).toBe(194);
    expect(DETAIL_SEARCH_TOP).toBe(288);
    expect(DETAIL_POOL_TOP).toBe(320);
    expect(DETAIL_EVO_TOP).toBe(272);
  });
});

describe('detailPanelBox', () => {
  it('docks the shipped 460 x 560 card one gap left of the PC box', () => {
    expect(detailPanelBox(DESKTOP)).toEqual({ x: 108, y: 72, w: 460, h: 560 });
  });

  it('clamps onto a phone screen at the 374 px card', () => {
    expect(detailPanelBox(PHONE)).toEqual({ x: 8, y: 72, w: 374, h: 560 });
  });
});

describe('initialDetailPanelUi', () => {
  it('opens on the STATS tab with no cursor, no page and no pin', () => {
    expect(initialDetailPanelUi()).toEqual({
      tab: 'stats',
      cursor: -1,
      page: 0,
      poolCursor: -1,
      info: null,
      abilityInfo: false,
      grab: null,
      nickname: null,
    });
  });
});

describe('detailPanelView', () => {
  it('lays the two tabs out at the shipped pitch', () => {
    const desktop = detailPanelView(detailOf(), [], uiOf(), DESKTOP);
    expect(desktop.tabs.map((tab) => tab.tab)).toEqual(['stats', 'moves']);
    expect(desktop.tabs[0].label).toBe('STATS');
    expect(desktop.tabs[1].label).toBe('MOVES');
    expect(absolute(desktop.tabs[0].box, desktop)).toEqual({ x: 128, y: 144, w: 208, h: 26 });
    expect(absolute(desktop.tabs[1].box, desktop)).toEqual({ x: 340, y: 144, w: 208, h: 26 });
    expect(desktop.tabs[1].box.x - (desktop.tabs[0].box.x + desktop.tabs[0].box.w)).toBe(4);

    const phone = detailPanelView(detailOf(), [], uiOf(), PHONE);
    expect(absolute(phone.tabs[0].box, phone)).toEqual({ x: 20, y: 144, w: 173, h: 26 });
    expect(absolute(phone.tabs[1].box, phone)).toEqual({ x: 197, y: 144, w: 173, h: 26 });
  });

  it('lays the six stats in two columns of three with the value inset 12 px', () => {
    const desktop = detailPanelView(detailOf(), [], uiOf(), DESKTOP);
    expect(desktop.stats).toHaveLength(6);
    expect(desktop.stats.map((row) => row.stat)).toEqual(['hp', 'atk', 'def', 'spa', 'spd', 'spe']);
    desktop.stats.forEach((row, i) => {
      expect(absolute(row.box, desktop).y).toBe(180 + 26 * (i % 3));
      expect(absolute(row.box, desktop).x).toBe(i < 3 ? 128 : 338);
      expect(row.valueBox.x + row.valueBox.w).toBe((i < 3 ? 128 : 338) + 210 - 12 - desktop.box.x);
    });
    expect(desktop.stats.map((row) => row.label)).toEqual([
      'HP',
      'ATTACK',
      'DEFENSE',
      'SP. ATK',
      'SP. DEF',
      'SPEED',
    ]);
    expect(statOf(desktop, 'hp').value).toBe('98/112');
    expect(statOf(desktop, 'atk').value).toBe('84');

    const phone = detailPanelView(detailOf(), [], uiOf(), PHONE);
    phone.stats.forEach((row, i) => {
      expect(absolute(row.box, phone).x).toBe(i < 3 ? 20 : 195);
      expect(absolute(row.box, phone).y).toBe(180 + 26 * (i % 3));
      expect(row.valueBox.x + row.valueBox.w).toBe((i < 3 ? 20 : 195) + 175 - 12 - phone.box.x);
    });
  });

  it('tints the stat an adamant nature raises and the one it lowers', () => {
    const view = detailPanelView(detailOf(), [], uiOf(), DESKTOP);
    expect(statOf(view, 'atk').effect).toBe('up');
    expect(statOf(view, 'spa').effect).toBe('down');
    expect(statOf(view, 'def').effect).toBe('neutral');
    expect(statOf(view, 'hp').effect).toBe('neutral');
  });

  it('lays the four move cells out through the shared grid arithmetic', () => {
    const desktop = detailPanelView(detailOf(), [], uiOf({ tab: 'moves' }), DESKTOP);
    expect(desktop.moves).toHaveLength(4);
    expect(desktop.moves.map((slot) => absolute(slot.box, desktop))).toEqual([
      { x: 128, y: 188, w: 202, h: 70 },
      { x: 338, y: 188, w: 202, h: 70 },
      { x: 128, y: 266, w: 202, h: 70 },
      { x: 338, y: 266, w: 202, h: 70 },
    ]);
    desktop.moves.forEach((slot) => {
      expect(slot.info).toEqual({ x: slot.box.w - 36, y: 8, w: 22, h: 22 });
      expect(slot.enabled).toBe(true);
    });

    const phone = detailPanelView(detailOf(), [], uiOf({ tab: 'moves' }), PHONE);
    expect(phone.moves.map((slot) => absolute(slot.box, phone))).toEqual([
      { x: 28, y: 188, w: 159, h: 70 },
      { x: 195, y: 188, w: 159, h: 70 },
      { x: 28, y: 266, w: 159, h: 70 },
      { x: 195, y: 266, w: 159, h: 70 },
    ]);
  });

  it('gives each move cell its two atlas squares and the three lines beside them', () => {
    const desktop = detailPanelView(detailOf(), [], uiOf({ tab: 'moves' }), DESKTOP);
    for (const slot of desktop.moves) {
      expect(slot.typeBox).toEqual({ x: slot.box.x + 10, y: slot.box.y + 10, w: 24, h: 24 });
      expect(slot.categoryBox).toEqual({ x: slot.box.x + 10, y: slot.box.y + 36, w: 24, h: 24 });
      expect(slot.nameBox).toEqual({
        x: slot.box.x + 44,
        y: slot.box.y + 8,
        w: 116,
        h: 13,
      });
      expect(slot.ppBox).toEqual({
        x: slot.box.x + 44,
        y: slot.box.y + 24,
        w: 144,
        h: 13,
      });
      expect(slot.statsBox).toEqual({
        x: slot.box.x + 44,
        y: slot.box.y + 38,
        w: 144,
        h: 13,
      });
    }

    const phone = detailPanelView(detailOf(), [], uiOf({ tab: 'moves' }), PHONE);
    for (const slot of phone.moves) {
      expect(slot.nameBox.w).toBe(73);
      expect(slot.ppBox.w).toBe(101);
      expect(slot.statsBox.w).toBe(101);
    }
  });

  it('keeps the two icons and the three text lines inside the cell, clear of the ⓘ', () => {
    const inside = (inner: Rect, outer: Rect): boolean =>
      inner.x >= outer.x - 0.5 &&
      inner.y >= outer.y - 0.5 &&
      inner.x + inner.w <= outer.x + outer.w + 0.5 &&
      inner.y + inner.h <= outer.y + outer.h + 0.5;
    const overlaps = (a: Rect, b: Rect): boolean =>
      Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) &&
      Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y);

    for (const viewport of [DESKTOP, PHONE]) {
      const view = detailPanelView(detailOf(), [], uiOf({ tab: 'moves' }), viewport);
      for (const slot of view.moves) {
        const info = { ...slot.info, x: slot.box.x + slot.info.x, y: slot.box.y + slot.info.y };
        for (const box of [slot.typeBox, slot.categoryBox, slot.nameBox, slot.ppBox, slot.statsBox]) {
          expect(inside(box, slot.box)).toBe(true);
        }
        expect(slot.categoryBox.y).toBe(slot.typeBox.y + 26);
        expect(slot.nameBox.x).toBe(slot.typeBox.x + 34);
        expect(slot.ppBox.y).toBe(slot.nameBox.y + 16);
        expect(slot.statsBox.y).toBe(slot.ppBox.y + 14);
        // The icons sit in the cell's own left column, well left of every text line.
        for (const icon of [slot.typeBox, slot.categoryBox]) {
          expect(overlaps(icon, info)).toBe(false);
          expect(icon.x + icon.w).toBeLessThanOrEqual(slot.nameBox.x);
        }
        expect(overlaps(slot.nameBox, info)).toBe(false);
        expect(overlaps(slot.statsBox, info)).toBe(false);
      }
    }
  });

  it('gives an empty slot the same five boxes, collapsed to no width', () => {
    const view = detailPanelView(
      detailOf({ moves: [move('flamethrower'), move('airslash', 75)] }),
      [],
      uiOf({ tab: 'moves' }),
      DESKTOP,
    );
    const empty = slotOf(view, 2);
    for (const box of [empty.typeBox, empty.categoryBox, empty.nameBox, empty.ppBox, empty.statsBox]) {
      expect(box.w).toBe(0);
    }
    expect(empty.typeBox.y).toBe(empty.box.y + 10);
  });

  it('pads a short moveset with empty slots and marks the cursor', () => {
    const view = detailPanelView(
      detailOf({ moves: [move('flamethrower'), move('airslash', 75)] }),
      [],
      uiOf({ tab: 'moves', cursor: 1 }),
      DESKTOP,
    );
    expect(view.moves).toHaveLength(4);
    expect(view.moves.map((slot) => slot.moveId)).toEqual(['flamethrower', 'airslash', null, null]);
    expect(view.moves.map((slot) => slot.selected)).toEqual([false, true, false, false]);
    expect(view.moves.map((slot) => slot.enabled)).toEqual([true, true, false, false]);
    expect(slotOf(view, 2).pp).toBe('');
  });

  it('prints the move cells as the frame does', () => {
    const view = detailPanelView(detailOf(), [], uiOf({ tab: 'moves' }), DESKTOP);
    expect(view.moves.map((slot) => slot.name)).toEqual([
      'FLAMETHROWER',
      'AIRSLASH',
      'DRAGONCLAW',
      'EARTHQUAKE',
    ]);
    expect(slotOf(view, 0).pp).toBe('PP 15/15');
    expect(slotOf(view, 0).power).toBe('PWR 90');
    expect(slotOf(view, 0).accuracy).toBe('ACC 100');
    expect(slotOf(view, 1).power).toBe('PWR 75');
  });

  it('shows the learnset window two rows at a time and clamps its page', () => {
    const pool = poolOf(6);
    const first = detailPanelView(detailOf(), pool, uiOf({ tab: 'moves' }), DESKTOP);
    expect(first.pool.map((row) => row.moveId)).toEqual(['m0', 'm1', 'm2', 'm3']);
    expect(first.pool.map((row) => row.index)).toEqual([0, 1, 2, 3]);
    expect(first.pool.map((row) => absolute(row.box, first))).toEqual([
      { x: 128, y: 416, w: 202, h: 96 },
      { x: 338, y: 416, w: 202, h: 96 },
      { x: 128, y: 520, w: 202, h: 96 },
      { x: 338, y: 520, w: 202, h: 96 },
    ]);

    const last = detailPanelView(detailOf(), pool, uiOf({ tab: 'moves', page: 99 }), DESKTOP);
    expect(last.pool.map((row) => row.moveId)).toEqual(['m2', 'm3', 'm4', 'm5']);

    const before = detailPanelView(detailOf(), pool, uiOf({ tab: 'moves', page: -5 }), DESKTOP);
    expect(before.pool.map((row) => row.moveId)).toEqual(['m0', 'm1', 'm2', 'm3']);

    const cursor = detailPanelView(detailOf(), pool, uiOf({ tab: 'moves', poolCursor: 99 }), DESKTOP);
    expect(cursor.pool.map((row) => row.selected)).toEqual([false, false, false, true]);
  });

  it('clamps the move cursor to the moveset', () => {
    const empty = detailPanelView(
      detailOf({ moves: [] }),
      [],
      uiOf({ tab: 'moves', cursor: 3 }),
      DESKTOP,
    );
    expect(empty.moves).toEqual([]);
    expect(empty.emptyMoves).toBe('no moves');

    const short = detailPanelView(
      detailOf({ moves: [move('ember')] }),
      [],
      uiOf({ tab: 'moves', cursor: 9 }),
      DESKTOP,
    );
    expect(short.moves.map((slot) => slot.selected)).toEqual([true, false, false, false]);
  });

  it('prints the header and the info lines as the panel does', () => {
    const view = detailPanelView(detailOf(), [], uiOf(), DESKTOP);
    expect(view.name).toBe('CHARIZARD');
    expect(view.level).toBe('Lv36');
    expect(view.statusLabel).toBeNull();
    expect(view.nature).toBe('NATURE  Adamant');
    expect(view.ability).toBe('ABILITY  Blaze');
    expect(view.held).toBe('HELD  none');
    expect(view.caught).toBe('CAUGHT  starter');
    expect(view.abilityDesc).toBe('Powers up Fire-type moves.');
    expect(view.types.map((entry) => entry.type)).toEqual(['fire', 'flying']);
    expect(view.hints).toEqual({ name: 'click to name', evolve: 'click to evolve' });
    expect(view.nickname).toEqual({
      value: '',
      placeholder: 'click to name',
      editing: false,
      box: { x: 192, y: 36, w: 248, h: 22 },
    });
    expect(view.search.placeholder).toBe('search moves...');
    expect(view.search.value).toBe('');
    expect(absolute(view.search.box, view)).toEqual({ x: 128, y: 360, w: 342, h: 24 });
  });

  it('renders the caught line and a held item when the member has them', () => {
    const view = detailPanelView(
      detailOf({
        caughtLabel: 'Deep Forest · Map 1 · Route 2',
        heldItemName: 'Leftovers',
        nickname: 'Sparky',
      }),
      [],
      uiOf(),
      DESKTOP,
    );
    expect(view.caught).toBe('CAUGHT  Deep Forest · Map 1 · Route 2');
    expect(view.held).toBe('HELD  Leftovers');
    expect(view.nickname.value).toBe('Sparky');
  });

  it('keeps the evolution graph off the MOVES tab and hands the STATS tab its box', () => {
    const nodes = [
      {
        id: 'a',
        name: 'A',
        note: null,
        depth: 0,
        row: 0,
        level: null,
        parent: null,
        current: true,
        ready: false,
        kind: 'species' as const,
      },
      {
        id: 'b',
        name: 'B',
        note: null,
        depth: 1,
        row: 1,
        level: 16,
        parent: 0,
        current: false,
        ready: true,
        kind: 'species' as const,
      },
    ];
    const stats = detailPanelView(detailOf({ evolutions: nodes }), [], uiOf(), DESKTOP);
    expect(stats.evolution).not.toBeNull();
    expect(stats.evolution?.title).toBe('EVOLUTION');
    expect(stats.evolution?.empty).toBe('no evolution');
    expect(stats.evolution?.rows).toHaveLength(2);
    expect(stats.evolution?.edges).toHaveLength(1);
    expect(stats.evolution?.box).toEqual({ x: 20, y: 272, w: 420, h: 56 });

    const moves = detailPanelView(detailOf({ evolutions: nodes }), [], uiOf({ tab: 'moves' }), DESKTOP);
    expect(moves.evolution).toBeNull();
    expect(detailPanelView(detailOf(), [], uiOf(), DESKTOP).evolution).toBeNull();
  });

  it('shows the ability info only when the member has a description', () => {
    const withDesc = detailPanelView(detailOf(), [], uiOf(), DESKTOP);
    expect(withDesc.abilityInfo?.pinned).toBe(false);
    const pinned = detailPanelView(detailOf(), [], uiOf({ abilityInfo: true }), DESKTOP);
    expect(pinned.abilityInfo?.pinned).toBe(true);
    const none = detailPanelView(detailOf({ abilityDesc: null }), [], uiOf(), DESKTOP);
    expect(none.abilityInfo).toBeNull();
  });

  it('prints one ability when the member carries one only (`Task-154`)', () => {
    const view = detailPanelView(detailOf(), [], uiOf(), DESKTOP);
    expect(view.ability).toBe('ABILITY  Blaze');
    expect(view.ability2).toBeNull();
  });

  it('joins a second ability onto the same line, and keeps it alone on the view', () => {
    const view = detailPanelView(
      detailOf({ ability: 'Dark Matter', ability2: 'Levitate' }),
      [],
      uiOf(),
      DESKTOP,
    );
    expect(view.ability).toBe('ABILITY  Dark Matter / Levitate');
    expect(view.ability2).toBe('Levitate');
    expect(view.abilityDesc).toBe('Powers up Fire-type moves.');
  });

  it('gives an empty view no second ability at all', () => {
    const view = detailPanelView(null, [], uiOf(), DESKTOP);
    expect(view.ability2).toBeNull();
  });

  it('closes on a null member with empty lists', () => {
    const view = detailPanelView(null, poolOf(4), uiOf({ tab: 'moves' }), DESKTOP);
    expect(view.open).toBe(false);
    expect(view.box).toEqual({ x: 108, y: 72, w: 460, h: 560 });
    expect(view.types).toEqual([]);
    expect(view.tabs).toEqual([]);
    expect(view.stats).toEqual([]);
    expect(view.moves).toEqual([]);
    expect(view.pool).toEqual([]);
    expect(view.evolution).toBeNull();
    expect(view.abilityInfo).toBeNull();
    expect(view.emptyMoves).toBeNull();
    expect(view.emptyPool).toBeNull();
  });

  it('is pure: the same arguments give the same view and nothing is mutated', () => {
    const detail = Object.freeze(detailOf());
    const pool = Object.freeze(poolOf(6));
    const ui = Object.freeze(uiOf({ tab: 'moves', cursor: 1, page: 1, poolCursor: 2 }));
    const first = detailPanelView(detail, pool, ui, DESKTOP);
    const second = detailPanelView(detail, pool, ui, DESKTOP);
    expect(second).toEqual(first);
    expect(detail.moves).toHaveLength(4);
    expect(pool).toHaveLength(6);
    expect(ui.page).toBe(1);
  });

  it('never throws on a cursor state from nowhere', () => {
    const ui = uiOf({
      tab: 'moves',
      cursor: Number.NaN,
      page: Number.POSITIVE_INFINITY,
      poolCursor: -12,
      info: 99,
    });
    expect(() => detailPanelView(detailOf(), poolOf(3), ui, DESKTOP)).not.toThrow();
    const view = detailPanelView(detailOf(), poolOf(3), ui, DESKTOP);
    expect(view.moves).toHaveLength(4);
    expect(view.moves[0].selected).toBe(true);
    expect(view.pool).toHaveLength(3);
    expect(view.pool[0].selected).toBe(true);
  });
});
