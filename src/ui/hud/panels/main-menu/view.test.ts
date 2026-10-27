import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getBiome } from '../../../../data/biomes';
import { biomeForMap } from '../../../../engine/maps/plan';
import { createRun, createRunPokemon, type RunPokemon, type RunState } from '../../../../engine/run';
import { t } from '../../../../i18n';
import { partyRows } from '../../../partyScreen';
import { runPositionLabel } from '../../../runSummary';
import { portraitCrop } from '../../portrait';
import {
  MAIN_MENU_ACTIONS,
  MAIN_MENU_BOARD,
  MAIN_MENU_BOARD_NARROW,
  MAIN_MENU_FOOTER_NARROW,
  liveMainMenuView,
  type Rect,
} from './view';

const MAIN_MENU_CSS = readFileSync(fileURLToPath(new URL('./main-menu.css', import.meta.url)), 'utf8');

const SEED = 'pkm-145';

function member(id: string, speciesId: string, nickname?: string): RunPokemon {
  return createRunPokemon({
    id,
    speciesId,
    level: 12,
    moves: ['tackle'],
    ...(nickname === undefined ? {} : { nickname }),
  });
}

/** A run standing on map 3 with the four members the mobile frame names. */
function savedRun(): RunState {
  const party = [
    member('charmander-1', 'charmander'),
    member('pikachu-2', 'pikachu'),
    member('bulbasaur-3', 'bulbasaur'),
    member('gastly-4', 'gastly'),
  ];
  return { ...createRun({ seed: SEED, starter: party[0]! }), mapIndex: 3, party };
}

describe('liveMainMenuView', () => {
  it('draws the four navigable rows, in board order, with the run’s position', () => {
    const run = savedRun();
    const view = liveMainMenuView(run, 0);

    expect(view.rows.map((row) => row.id)).toEqual(['continue', 'new', 'options', 'stats']);
    expect(view.rows.map((row) => row.id)).toEqual([...MAIN_MENU_ACTIONS]);
    expect(view.rows.every((row) => row.enabled)).toBe(true);
    expect(view.rows.map((row) => row.label)).toEqual([
      t('menu.continue'),
      t('menu.new'),
      t('menu.options'),
      t('menu.stats'),
    ]);
    expect(view.rows[0]!.value).toBe(runPositionLabel(run));
    expect(view.rows[0]!.value).toContain(getBiome(biomeForMap(run.seed, run.mapIndex)).name);
    expect(view.rows.slice(1).map((row) => row.value)).toEqual(['', '', '']);
    expect(view.title).toBe(t('menu.title'));
    expect(view.stats).toEqual([]);
    expect(view.version).toBeNull();
  });

  it('pushes the STATS row with and without a run', () => {
    for (const run of [savedRun(), null]) {
      const rows = liveMainMenuView(run, 0).rows;

      expect(rows.at(-1)).toEqual({
        id: 'stats',
        label: t('menu.stats'),
        value: '',
        enabled: true,
      });
    }
  });

  it('carries one portrait per party member, in party order', () => {
    const run = savedRun();
    const view = liveMainMenuView(run, 0);

    expect(view.portraits.length).toBe(run.party.length);
    expect(view.portraits.map((portrait) => portrait.memberId)).toEqual(
      partyRows(run).map((row) => row.id),
    );
    expect(view.portraits.map((portrait) => portrait.name)).toEqual(
      partyRows(run).map((row) => row.name),
    );
    expect(view.portraits[0]!.name).toBe('Charmander');
  });

  it('resolves each party member’s own atlas cell', () => {
    const run = savedRun();
    const rows = partyRows(run);
    const portraits = liveMainMenuView(run, 0).portraits;

    expect(portraits.map((portrait) => portrait.portrait)).toEqual(
      rows.map((row) => portraitCrop(row.speciesId, row.shiny)),
    );
    for (const portrait of portraits) expect(portrait.portrait).not.toBeNull();
    const cells = portraits.map((portrait) => {
      const crop = portrait.portrait!;
      return crop.row * crop.cols + crop.col;
    });
    expect(new Set(cells).size).toBe(4);
    expect(portraits.some((portrait) => portrait.portrait!.row > 0)).toBe(true);
  });

  it('drops the CONTINUE row and every portrait without a run', () => {
    const view = liveMainMenuView(null, 0);

    expect(view.rows.map((row) => row.id)).toEqual(['new', 'options', 'stats']);
    expect(view.rows.some((row) => row.id === 'continue')).toBe(false);
    expect(view.portraits).toEqual([]);
    expect(view.stats).toEqual([]);
    expect(view.selected).toBe('new');
  });

  it('follows the cursor and clamps it onto the last row', () => {
    const run = savedRun();

    expect(liveMainMenuView(run, 0).selected).toBe('continue');
    expect(liveMainMenuView(run, 1).selected).toBe('new');
    expect(liveMainMenuView(run, 2).selected).toBe('options');
    expect(liveMainMenuView(run, 3).selected).toBe('stats');
    expect(liveMainMenuView(run, 9).selected).toBe('stats');
    expect(liveMainMenuView(run, -4).selected).toBe('continue');
    expect(liveMainMenuView(null, 0).selected).toBe('new');
    expect(liveMainMenuView(null, 2).selected).toBe('stats');
    expect(liveMainMenuView(null, 9).selected).toBe('stats');
  });

  it('is pure: the same input is deep-equal and JSON round-trips unchanged', () => {
    const run = savedRun();
    const first = liveMainMenuView(run, 1);
    const second = liveMainMenuView(run, 1);

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });
});

/** The gap between two rects: positive on the axis that separates them, negative when they overlap. */
function gap(a: Rect, b: Rect): number {
  const dx = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w));
  const dy = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h));
  return Math.max(dx, dy);
}

/** The declarations of a selector's rule, read out of the stylesheet's text. */
function declarations(css: string, selector: string): Map<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  const out = new Map<string, string>();
  if (found === null) return out;
  for (const line of found[1]!.split(';')) {
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    out.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }
  return out;
}

const COMPACT_CSS = MAIN_MENU_CSS.slice(MAIN_MENU_CSS.indexOf('@media (max-width: 600px)'));

describe('MAIN_MENU_FOOTER_NARROW', () => {
  const ids = ['wins', 'elite', 'monthly'] as const;

  it('puts two blocks on the first row and the monthly figure under them', () => {
    expect(Object.keys(MAIN_MENU_FOOTER_NARROW)).toEqual([...ids]);
    expect(MAIN_MENU_FOOTER_NARROW.wins.y).toBe(MAIN_MENU_BOARD_NARROW.footer.labelY);
    expect(MAIN_MENU_FOOTER_NARROW.elite.y).toBe(MAIN_MENU_FOOTER_NARROW.wins.y);
    expect(MAIN_MENU_FOOTER_NARROW.monthly.y).toBeGreaterThan(MAIN_MENU_FOOTER_NARROW.wins.y);
    expect(MAIN_MENU_FOOTER_NARROW.monthly.y).toBeGreaterThanOrEqual(
      MAIN_MENU_FOOTER_NARROW.wins.y + MAIN_MENU_FOOTER_NARROW.wins.h,
    );
  });

  it('keeps every pair of blocks apart by at least the kit’s 8 px gutter', () => {
    const pairs: [Rect, Rect][] = [];
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        pairs.push([MAIN_MENU_FOOTER_NARROW[ids[i]!], MAIN_MENU_FOOTER_NARROW[ids[j]!]]);
      }
    }

    expect(pairs).toHaveLength(3);
    for (const [first, second] of pairs) expect(gap(first, second)).toBeGreaterThanOrEqual(8);
  });

  it('fits the three blocks inside the 390 px column', () => {
    expect(MAIN_MENU_FOOTER_NARROW.wins.x).toBe(16);
    expect(MAIN_MENU_FOOTER_NARROW.monthly.x).toBe(16);
    for (const id of ids) {
      const rect = MAIN_MENU_FOOTER_NARROW[id];
      expect(rect.w).toBeGreaterThanOrEqual(160);
      expect(rect.x).toBeGreaterThanOrEqual(16);
      expect(rect.x + rect.w).toBeLessThanOrEqual(390 - 16);
      expect(rect.y + rect.h).toBeLessThan(844);
    }
  });

  it('is what the compact block of the stylesheet draws', () => {
    for (const id of ids) {
      const rule = declarations(COMPACT_CSS, `.main-menu__stat[data-hud-main-menu-stat='${id}']`);
      const shared = declarations(COMPACT_CSS, '.main-menu__stat');
      const rect = MAIN_MENU_FOOTER_NARROW[id];

      expect(rule.get('left') ?? shared.get('left')).toBe(`${rect.x}px`);
      expect(rule.get('top') ?? shared.get('top')).toBe(`${rect.y}px`);
      expect(sharp(rule.get('width') ?? shared.get('width'))).toBe(rect.w);
      expect(sharp(rule.get('height') ?? shared.get('height'))).toBe(rect.h);
    }
  });

  it('leaves the desktop footer on the frame’s own columns', () => {
    const desktopCss = MAIN_MENU_CSS.slice(0, MAIN_MENU_CSS.indexOf('@media (max-width: 600px)'));

    expect([...MAIN_MENU_BOARD.footer.columns]).toEqual([96, 240, 724]);
    expect(MAIN_MENU_BOARD.footer.labelY).toBe(616);
    expect(declarations(desktopCss, '.main-menu__stat').get('top')).toBe('616px');
  });
});

function sharp(value: string | undefined): number {
  return Number.parseFloat(value ?? '');
}
