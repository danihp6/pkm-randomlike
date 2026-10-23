import { describe, expect, it } from 'vitest';
import { t } from '../../../../i18n';
import type { HudPartyRow, HudRoute, HudState } from '../../state';
import {
  PARTY_COLUMN,
  PARTY_HEADER_H,
  PARTY_HP_BAR,
  PARTY_HP_BAR_H,
  PARTY_HP_FILL_RATIO,
  PARTY_PAD_BOTTOM,
  PARTY_PAD_TOP,
  PARTY_PAD_X,
  PARTY_PANEL_H,
  PARTY_PANEL_W,
  PARTY_PORTRAIT,
  PARTY_PORTRAIT_X,
  PARTY_ROW,
  PARTY_ROWS,
  PARTY_VIAL_H,
  PARTY_VIAL_W,
  PARTY_VIAL_Y,
  PARTY_XP_H,
  PARTY_XP_INSET,
  PARTY_XP_Y,
  initialPartyPanelUi,
  partyPanelBox,
  partyPanelView,
} from './view';

const DESKTOP = { width: 1280, height: 800 } as const;
const PHONE = { width: 390, height: 844 } as const;

function member(id: string, overrides: Partial<HudPartyRow> = {}): HudPartyRow {
  return {
    id,
    speciesId: 'pikachu',
    name: id.toUpperCase(),
    level: 12,
    hp: 20,
    maxHp: 40,
    status: null,
    statusLabel: null,
    heldItem: null,
    heldItemName: null,
    shiny: false,
    hpFraction: 0.5,
    ...overrides,
  };
}

const ROUTE: HudRoute = {
  mode: 'finite',
  mapIndex: 1,
  routeInMap: 0,
  routeIndex: 3,
  biomeId: 'forest',
  biomeName: 'Forest',
  levelCap: 20,
  squadLevel: 12,
  xp: 480,
  xpFraction: 0.5,
  pokevialCharges: 2,
  pokevialMax: 3,
  bossDefeated: false,
  entryDeparted: true,
  discoveredRooms: [0, 1],
  mission: null,
  missionsCompleted: 0,
  stats: { catches: 1, casualties: 0 },
};

function hudState(party: readonly HudPartyRow[], route: HudRoute | null = ROUTE): HudState {
  return { party, bag: [], money: 120, route, battle: null, notice: null };
}

describe('partyPanelBox', () => {
  it('docks at the right-hand column of the shipped HUD', () => {
    expect(partyPanelBox(DESKTOP)).toEqual({ x: 928, y: 8, w: 250, h: 406 });
  });

  it('keeps the same 250 px card on a phone', () => {
    expect(partyPanelBox(PHONE)).toEqual({ x: 38, y: 8, w: 250, h: 406 });
  });
});

describe('partyPanelView', () => {
  it('draws the shipped header: chip, level line, XP bar and vial', () => {
    const view = partyPanelView(hudState([member('a'), member('b')]), initialPartyPanelUi(), DESKTOP);
    expect(view.open).toBe(true);
    expect(view.box).toEqual({ x: 928, y: 8, w: 250, h: 406 });
    expect(view.chip).toEqual({ letter: 'P', box: { x: 0, y: 0, w: 26, h: 26 } });
    expect(view.highlight).toEqual({ x: 12, y: 12, w: 226, h: 1 });
    expect(view.level.box).toEqual({ x: 32, y: 16, w: 186, h: 20 });
    expect(view.xp.box).toEqual({ x: 32, y: 38, w: 186, h: 8 });
    expect(view.vial.box).toEqual({ x: 75, y: 54, w: 100, h: 20 });
    expect(view.level.text).toBe(t('hud.level', { level: 12 }));
    expect(view.xp.text).toBe(t('hud.xp', { xp: 480 }));
    expect(view.vial.text).toBe(t('hud.vial'));
  });

  it('lays the rows out from the header at the 52 px pitch', () => {
    const view = partyPanelView(hudState([member('a'), member('b')]), initialPartyPanelUi(), DESKTOP);
    expect(view.rows).toHaveLength(2);
    expect(view.rows[0]!.row).toEqual({ x: 20, y: 82, w: 210, h: 48 });
    expect(view.rows[0]!.portrait).toEqual({ x: 22, y: 86, w: 45, h: 45 });
    expect(view.rows[0]!.hpBar).toEqual({ x: 76, y: 110, w: 154, h: 16 });
    expect(view.rows[1]!.row.y).toBe(134);
    expect(view.rows[1]!.portrait.y).toBe(138);
    expect(view.rows[1]!.hpBar.y).toBe(162);
  });

  it('gives the bars the shipped fills', () => {
    const view = partyPanelView(hudState([member('a')]), initialPartyPanelUi(), DESKTOP);
    const [row] = view.rows;
    expect(view.xp.fraction * view.xp.box.w).toBe(93);
    expect(view.vial.fill).toBeCloseTo(2 / 3, 6);
    expect(view.vial.fill * view.vial.box.w).toBeCloseTo(66.666, 2);
    expect(row!.hpFraction * PARTY_HP_FILL_RATIO * row!.hpBar.w).toBeCloseTo(55.15, 6);
  });

  it('carries the row data the card prints', () => {
    const view = partyPanelView(
      hudState([
        member('a', {
          name: 'SPARKY',
          level: 9,
          hp: 11,
          maxHp: 44,
          hpFraction: 0.25,
          status: 'par',
          statusLabel: 'PAR',
          heldItem: 'oran-berry',
          heldItemName: 'Oran Berry',
        }),
      ]),
      initialPartyPanelUi(),
      DESKTOP,
    );
    const [row] = view.rows;
    expect(row).toMatchObject({
      memberId: 'a',
      name: 'SPARKY',
      level: 9,
      hpFraction: 0.25,
      statusLabel: 'PAR',
      heldItemName: 'Oran Berry',
      selected: true,
    });
    expect(row!.hpText).toBe(t('detail.hp', { hp: 11, max: 44 }));
  });

  it('draws at most six rows and clamps the cursor to the party', () => {
    const seven = Array.from({ length: PARTY_ROWS + 1 }, (_, i) => member(`m${i}`));
    const view = partyPanelView(hudState(seven), { cursor: 4 }, DESKTOP);
    expect(view.rows).toHaveLength(PARTY_ROWS);
    expect(view.rows.map((row) => row.memberId)).toEqual(['m0', 'm1', 'm2', 'm3', 'm4', 'm5']);
    expect(view.rows.filter((row) => row.selected).map((row) => row.memberId)).toEqual(['m4']);
    const last = partyPanelView(hudState(seven), { cursor: 99 }, DESKTOP);
    expect(last.rows.filter((row) => row.selected).map((row) => row.memberId)).toEqual(['m5']);
    const below = partyPanelView(hudState(seven), { cursor: -3 }, DESKTOP);
    expect(below.rows.filter((row) => row.selected).map((row) => row.memberId)).toEqual(['m0']);
  });

  it('draws no row and selects nothing for an empty party', () => {
    const view = partyPanelView(hudState([]), initialPartyPanelUi(), DESKTOP);
    expect(view.rows).toEqual([]);
  });

  it('leaves the header empty without a route', () => {
    const view = partyPanelView(hudState([member('a')], null), initialPartyPanelUi(), DESKTOP);
    expect(view.level.text).toBe('');
    expect(view.xp.fraction).toBe(0);
    expect(view.xp.text).toBe('');
    expect(view.vial.charges).toBe(0);
    expect(view.vial.fill).toBe(0);
  });

  it('is pure: the same input deep-equals, and nothing is mutated', () => {
    const state = hudState([member('a'), member('b')]);
    const before = JSON.stringify(state);
    const first = partyPanelView(state, { cursor: 1 }, DESKTOP);
    const second = partyPanelView(state, { cursor: 1 }, DESKTOP);
    expect(second).toEqual(first);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('the mirrored Phaser constants', () => {
  it('keep their shipped values', () => {
    expect(PARTY_PANEL_W).toBe(250);
    expect(PARTY_PAD_X).toBe(20);
    expect(PARTY_PAD_TOP).toBe(16);
    expect(PARTY_PAD_BOTTOM).toBe(12);
    expect(PARTY_HEADER_H).toBe(82);
    expect(PARTY_ROW).toBe(52);
    expect(PARTY_ROWS).toBe(6);
    expect(PARTY_COLUMN).toBe(56);
    expect(PARTY_PORTRAIT).toBe(45);
    expect(PARTY_PORTRAIT_X).toBe(44);
    expect(PARTY_XP_INSET).toBe(12);
    expect(PARTY_XP_H).toBe(8);
    expect(PARTY_XP_Y).toBe(38);
    expect(PARTY_VIAL_W).toBe(100);
    expect(PARTY_VIAL_H).toBe(20);
    expect(PARTY_VIAL_Y).toBe(54);
    expect(PARTY_PANEL_H).toBe(406);
    expect(PARTY_HP_BAR).toBe(154);
    expect(PARTY_HP_BAR_H).toBe(16);
    expect(PARTY_HP_FILL_RATIO).toBeCloseTo(110.3 / 154, 12);
  });

  it('derive the panel height from the header, the rows and the pad', () => {
    expect(PARTY_HEADER_H + PARTY_ROWS * PARTY_ROW + PARTY_PAD_BOTTOM).toBe(PARTY_PANEL_H);
    expect(PARTY_PAD_X * 2 + PARTY_COLUMN + PARTY_HP_BAR).toBe(PARTY_PANEL_W);
    expect((PARTY_PANEL_W - (PARTY_PAD_X + PARTY_XP_INSET) * 2) * 1).toBe(186);
  });
});

describe('initialPartyPanelUi', () => {
  it('starts on the first row', () => {
    expect(initialPartyPanelUi()).toEqual({ cursor: 0 });
  });
});
