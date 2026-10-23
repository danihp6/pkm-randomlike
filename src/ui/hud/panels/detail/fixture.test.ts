import { describe, expect, it } from 'vitest';
import fixture from '../../../../../design/fixtures/03m-panels-pokemon-moves.json';
import type { MemberDetail } from '../../../partyDetail';
import { isHudState } from '../../fixtures';
import { detailPanelView, type DetailPanelUi, type DetailPoolRow } from './view';

/**
 * The `03m Panels · pokemon moves` frame as data: the panel builds headlessly from
 * the fixture's own copy of the member, the learnset band and the cursor state, so
 * the strings the board prints are pinned without a dex read or a scene.
 */
type FixtureFile = Readonly<{
  slug: string;
  state: unknown;
  detail: MemberDetail;
  pool: readonly DetailPoolRow[];
  ui: DetailPanelUi;
}>;

const FIXTURE = fixture as unknown as FixtureFile;
const DESKTOP = { width: 1280, height: 800 };

describe('the 03m fixture', () => {
  it('carries the frame slug and a HudState that validates unchanged', () => {
    expect(FIXTURE.slug).toBe('03m-panels-pokemon-moves');
    expect(isHudState(FIXTURE.state)).toBe(true);
  });

  it('opens the MOVES tab on slot 0 with nothing pinned', () => {
    expect(FIXTURE.ui).toEqual({
      tab: 'moves',
      cursor: 0,
      page: 0,
      poolCursor: 0,
      info: null,
      abilityInfo: false,
      grab: null,
      nickname: null,
    });
    const view = detailPanelView(FIXTURE.detail, FIXTURE.pool, FIXTURE.ui, DESKTOP);
    expect(view.open).toBe(true);
    expect(view.tabs.find((tab) => tab.active)?.tab).toBe('moves');
    expect(view.moves[0].selected).toBe(true);
  });

  it('reproduces the frame header and its four move cards', () => {
    const view = detailPanelView(FIXTURE.detail, FIXTURE.pool, FIXTURE.ui, DESKTOP);
    expect(view.name).toBe('CHARIZARD');
    expect(view.level).toBe('Lv36');
    expect(view.moves.map((slot) => slot.name)).toEqual([
      'FLAMETHROWER',
      'AIR SLASH',
      'DRAGON CLAW',
      'EARTHQUAKE',
    ]);
    expect(view.moves.map((slot) => `${slot.pp} ${slot.power} ${slot.accuracy}`)).toEqual([
      'PP 15/15 PWR 90 ACC 100',
      'PP 15/15 PWR 75 ACC 95',
      'PP 10/10 PWR 80 ACC 100',
      'PP 10/10 PWR 100 ACC 100',
    ]);
    expect(view.moves.every((slot) => slot.enabled)).toBe(true);
  });

  it('reproduces the frame learnset band', () => {
    const view = detailPanelView(FIXTURE.detail, FIXTURE.pool, FIXTURE.ui, DESKTOP);
    expect(view.pool.map((row) => row.name).slice(0, 2)).toEqual(['RAZOR LEAF', 'LEECH SEED']);
    expect(view.pool.map((row) => row.source).slice(0, 2)).toEqual(['Lv 12', 'Lv 15']);
    expect(view.pool).toHaveLength(4);
    expect(view.emptyPool).toBeNull();
  });

  it('paints the header, the stats and the nature tint the frame prints', () => {
    const view = detailPanelView(FIXTURE.detail, FIXTURE.pool, FIXTURE.ui, DESKTOP);
    expect(view.nature).toBe('NATURE  Adamant');
    expect(view.ability).toBe('ABILITY  Blaze');
    expect(view.held).toBe('HELD  none');
    expect(view.caught).toBe('CAUGHT  starter');
    expect(view.stats.find((row) => row.stat === 'atk')?.effect).toBe('up');
    expect(view.stats.find((row) => row.stat === 'spa')?.effect).toBe('down');
  });

  it('pins the pasted family graph with the current row on charizard', () => {
    const statsTab: DetailPanelUi = { ...FIXTURE.ui, tab: 'stats' };
    const view = detailPanelView(FIXTURE.detail, FIXTURE.pool, statsTab, DESKTOP);
    expect(view.evolution?.rows.map((row) => row.id)).toEqual([
      'charmander',
      'charmeleon',
      'charizard',
      'charizardmegax',
      'charizardmegay',
      'charizardgmax',
    ]);
    expect(view.evolution?.rows.filter((row) => row.current).map((row) => row.id)).toEqual([
      'charizard',
    ]);
    expect(view.evolution?.edges.map((edge) => edge.d)).toEqual([
      'M 34 14 H 25 V 42 H 42',
      'M 68 42 H 59 V 70 H 76',
      'M 102 70 H 93 V 98 H 110',
      'M 102 70 H 93 V 126 H 110',
      'M 102 70 H 93 V 154 H 110',
    ]);
    expect(view.evolution?.box).toEqual({ x: 20, y: 272, w: 420, h: 168 });
  });
});
