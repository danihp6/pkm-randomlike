import { describe, expect, it } from 'vitest';
import itemFrame from '../../../../../design/frames/03f-panels-reward-item.json';
import pokemonFrame from '../../../../../design/frames/03g-panels-reward-pokemon.json';
import itemMobileFrame from '../../../../../design/frames/m03f-panels-reward-item.json';
import pokemonMobileFrame from '../../../../../design/frames/m03g-panels-reward-pokemon.json';
import itemFixture from '../../../../../design/fixtures/03f-panels-reward-item.json';
import pokemonFixture from '../../../../../design/fixtures/03g-panels-reward-pokemon.json';
import itemIcons from '../../../../data/anil/item-icons.json';
import { getNature } from '../../../../data/dex/natures';
import { itemIconFrame } from '../../../../data/itemIcons';
import { t } from '../../../../i18n';
import { isHudState } from '../../fixtures';
import {
  REWARDS_SHEET_HANDLE,
  rewardsPanelView,
  type Rect,
  type RewardRowView,
  type RewardsIcon,
  type RewardsInput,
  type RewardsPanelView,
} from './index';

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

type Node = Readonly<{
  name?: string;
  type?: string;
  properties?: Readonly<{
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    characters?: string;
  }>;
  children?: readonly Node[];
}>;

type Frame = Readonly<{ slug: string; geometry: readonly Node[]; text: readonly Node[] }>;

function nodesOf(tree: readonly Node[]): readonly Node[] {
  const out: Node[] = [];
  const walk = (node: Node): void => {
    out.push(node);
    for (const child of node.children ?? []) walk(child);
  };
  for (const node of tree) walk(node);
  return out;
}

function named(frame: Frame, tree: 'geometry' | 'text', name: string, at = 0): Node | null {
  return nodesOf(frame[tree]).filter((node) => node.name === name)[at] ?? null;
}

/** The frame's own rect for a node; a missing node fails loudly with -1s. */
function rectOf(frame: Frame, name: string, at = 0): Rect {
  const properties = named(frame, 'geometry', name, at)?.properties ?? {};
  return {
    x: properties.x ?? -1,
    y: properties.y ?? -1,
    w: properties.width ?? -1,
    h: properties.height ?? -1,
  };
}

function textOf(frame: Frame, name: string, at = 0): string {
  return named(frame, 'text', name, at)?.properties?.characters ?? '';
}

/** A panel-relative rect as the page shows it. */
function absolute(rect: Rect, panel: RewardsPanelView): Rect {
  return { x: panel.box.x + rect.x, y: panel.box.y + rect.y, w: rect.w, h: rect.h };
}

/** The atlas cell an item's frame becomes: `background-position: -x px -y px`. */
function iconCell(frame: number): RewardsIcon {
  return {
    url: 'atlas.png',
    size: itemIcons.size,
    x: (frame % itemIcons.cols) * itemIcons.size,
    y: Math.floor(frame / itemIcons.cols) * itemIcons.size,
  };
}

function rowView(
  index: number,
  kind: 'item' | 'pokemon',
  label: string,
  description: string,
  icon: RewardsIcon | null,
): RewardRowView {
  return { index, kind, label, description, icon, armed: false, box: { x: 0, y: 0, w: 0, h: 0 } };
}

function input(
  block: Readonly<{ title: string; choose: string; armed: number; open: boolean }>,
  rows: readonly RewardRowView[],
): RewardsInput {
  return { title: block.title, choose: block.choose, rows, armed: block.armed, open: block.open };
}

describe('design/fixtures/03f-panels-reward-item.json', () => {
  const fixture = itemFixture;
  const frame: Frame = itemFrame as Frame;

  const rows: readonly RewardRowView[] = fixture.item.rows.map((row) =>
    rowView(row.index, 'item', row.label, row.description, iconCell(row.iconFrame)),
  );
  const desktop = rewardsPanelView(input(fixture.item, rows), DESKTOP);
  const phone = rewardsPanelView(input(fixture.item, rows), PHONE);

  it('carries a snapshot state that passes isHudState unchanged', () => {
    expect(isHudState(fixture.state)).toBe(true);
    expect(Object.keys(fixture.state)).toEqual(['party', 'bag', 'money', 'route', 'battle', 'notice']);
  });

  it('pins the frame’s three items, their descriptions and their icons', () => {
    expect(fixture.item.rows.map((row) => row.label)).toEqual([
      textOf(frame, 'item name 1'),
      textOf(frame, 'item name 2'),
      textOf(frame, 'item name 3'),
    ]);
    expect(fixture.item.rows.map((row) => row.description)).toEqual([
      textOf(frame, 'item desc 1'),
      textOf(frame, 'item desc 2'),
      textOf(frame, 'item desc 3'),
    ]);
    expect(fixture.item.rows.map((row) => itemIconFrame(row.itemId))).toEqual(
      fixture.item.rows.map((row) => row.iconFrame),
    );
    expect(desktop.rows.map((row) => row.icon)).toEqual(
      fixture.item.rows.map((row) => iconCell(row.iconFrame)),
    );
    expect(desktop.rows.map((row) => absolute(row.box, desktop))).toEqual([
      rectOf(frame, 'row 1'),
      rectOf(frame, 'row 2'),
      rectOf(frame, 'row 3'),
    ]);
  });

  it('paints the desktop card’s own rects, title, choose line and close', () => {
    expect(desktop.box).toEqual(rectOf(frame, 'reward panel'));
    expect(absolute(desktop.highlight, desktop)).toEqual(rectOf(frame, 'panel highlight'));
    expect(absolute(desktop.title.box, desktop)).toEqual(rectOf(frame, 'panel title'));
    expect(absolute(desktop.choose.box, desktop)).toEqual(rectOf(frame, 'choose line'));
    expect(absolute(desktop.close.box, desktop)).toEqual(rectOf(frame, 'close'));
    expect(desktop.title.text).toBe(textOf(frame, 'panel title'));
    expect(desktop.choose.text).toBe(textOf(frame, 'choose line'));
    expect(desktop.close.label).toBe(textOf(frame, 'close'));
  });

  it('opens with nothing armed and keeps every row unarmed', () => {
    expect(fixture.item.armed).toBe(-1);
    expect(desktop.rows.every((row) => !row.armed)).toBe(true);
    expect(desktop.open).toBe(true);
  });

  it('paints the phone sheet the mobile frame measures', () => {
    const mobile: Frame = itemMobileFrame as Frame;
    const sheet = rectOf(mobile, 'm sheet');
    expect(phone.box).toEqual(sheet);
    expect(absolute(phone.title.box, phone)).toEqual(rectOf(mobile, 'board title'));
    expect(absolute(phone.choose.box, phone)).toEqual(rectOf(mobile, 'board subtitle'));
    expect(absolute(phone.close.box, phone)).toEqual(rectOf(mobile, 'm close'));
    expect(phone.rows.map((row) => absolute(row.box, phone))).toEqual([
      rectOf(mobile, 'm row POTION'),
      rectOf(mobile, 'm row FULL HEAL'),
      rectOf(mobile, 'm row 3'),
    ]);
    const handle = rectOf(mobile, 'm handle');
    expect({ w: REWARDS_SHEET_HANDLE.w, h: REWARDS_SHEET_HANDLE.h }).toEqual({
      w: handle.w,
      h: handle.h,
    });
    expect(sheet.x + Math.round((sheet.w - REWARDS_SHEET_HANDLE.w) / 2)).toBe(handle.x);
    expect(sheet.y + REWARDS_SHEET_HANDLE.y).toBe(handle.y);
  });
});

describe('design/fixtures/03g-panels-reward-pokemon.json', () => {
  const fixture = pokemonFixture;
  const frame: Frame = pokemonFrame as Frame;

  /** The five stats a reward row may headline; HP never is one (`src/ui/rewards.ts`). */
  const STAT_KEYS: Readonly<Record<string, Parameters<typeof t>[0]>> = {
    atk: 'detail.stat.atk',
    def: 'detail.stat.def',
    spa: 'detail.stat.spa',
    spd: 'detail.stat.spd',
    spe: 'detail.stat.spe',
  };

  /** The model's own label: the headline stat's name, ` · `, then the nature's. */
  const labelOf = (row: (typeof fixture.pokemon.rows)[number]): string =>
    `${t(STAT_KEYS[row.topStat] ?? 'detail.stat.atk')} · ${getNature(row.nature)?.name ?? row.nature}`;

  const rows: readonly RewardRowView[] = fixture.pokemon.rows.map((row) =>
    rowView(row.index, 'pokemon', labelOf(row), '', null),
  );
  const desktop = rewardsPanelView(input(fixture.pokemon, rows), DESKTOP);
  const phone = rewardsPanelView(input(fixture.pokemon, rows), PHONE);

  it('carries a snapshot state that passes isHudState unchanged', () => {
    expect(isHudState(fixture.state)).toBe(true);
    expect(Object.keys(fixture.state)).toEqual(['party', 'bag', 'money', 'route', 'battle', 'notice']);
  });

  it('pins the frame’s three STAT · Nature labels, in order', () => {
    expect(fixture.pokemon.rows.map(labelOf)).toEqual([
      textOf(frame, 'option label 1'),
      textOf(frame, 'option label 2'),
      textOf(frame, 'option label 3'),
    ]);
    expect(fixture.pokemon.rows.map((row) => row.label)).toEqual([
      textOf(frame, 'option label 1'),
      textOf(frame, 'option label 2'),
      textOf(frame, 'option label 3'),
    ]);
    expect(desktop.rows.map((row) => row.label)).toEqual([
      'ATTACK · Adamant',
      'SP. ATK · Modest',
      'SPEED · Jolly',
    ]);
  });

  it('paints a Pokémon row’s label only: no icon, no description', () => {
    for (const row of desktop.rows) {
      expect(row.icon).toBeNull();
      expect(row.description).toBe('');
    }
    const leaky = rewardsPanelView(
      input(
        fixture.pokemon,
        rows.map((row) => ({ ...row, icon: iconCell(108), description: 'leak' })),
      ),
      DESKTOP,
    );
    expect(leaky.rows.every((row) => row.icon === null && row.description === '')).toBe(true);
  });

  it('paints the same card as the item block, with its rows on the board’s slots', () => {
    expect(desktop.box).toEqual(rectOf(frame, 'reward panel'));
    expect(absolute(desktop.close.box, desktop)).toEqual(rectOf(frame, 'close'));
    expect(desktop.close.label).toBe(textOf(frame, 'close'));
    expect(desktop.rows.map((row) => absolute(row.box, desktop))).toEqual([
      rectOf(frame, 'row 1'),
      rectOf(frame, 'row 2'),
      rectOf(frame, 'row 3'),
    ]);
    // The two blocks are one panel: the Pokémon rows sit on the item sheet's own
    // slots (the `m03g` frame draws a tighter variant the contract does not take).
    expect(rectOf(pokemonMobileFrame as Frame, 'm sheet')).toEqual(
      rectOf(itemMobileFrame as Frame, 'm sheet'),
    );
    expect(phone.rows.map((row) => absolute(row.box, phone))).toEqual([
      rectOf(itemMobileFrame as Frame, 'm row POTION'),
      rectOf(itemMobileFrame as Frame, 'm row FULL HEAL'),
      rectOf(itemMobileFrame as Frame, 'm row 3'),
    ]);
  });

  it('opens with nothing armed', () => {
    expect(fixture.pokemon.armed).toBe(-1);
    expect(desktop.rows.every((row) => !row.armed)).toBe(true);
  });
});
