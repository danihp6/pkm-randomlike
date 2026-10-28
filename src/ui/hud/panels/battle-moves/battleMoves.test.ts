import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BattleMoves, MoveSlot, cardClass, slotPressIntent, type MoveSlotProps } from './battleMoves';
import type { BattleMovesIntent } from './mount';
import { padMoveGridCells, type MoveGridCell } from '../../../moveGrid';
import {
  battleMovesView,
  type BattleMoveSlotView,
  type BattleMovesInput,
  type BattleMovesView,
  type Rect,
} from './view';

const CARD: Rect = { x: 276, y: 582, w: 728, h: 192 };

function slot(index: number, overrides: Partial<BattleMoveSlotView> = {}): BattleMoveSlotView {
  const rowY = 606 + Math.floor(index / 2) * 80;
  const box: Rect = { x: 360, y: rowY, w: 273, h: 72 };
  const nameBox: Rect = { x: box.x + 14, y: rowY + 16.5, w: box.w - 60, h: 13 };
  const categoryBox: Rect = { x: box.x + box.w - 14 - 24, y: rowY + 16.5, w: 24, h: 24 };
  return {
    index,
    empty: false,
    name: 'WATER GUN',
    type: 'water',
    category: 'Special',
    pp: 'PP 25/25',
    power: 'PWR 40',
    accuracy: 'ACC 100',
    powerTone: 'level',
    accuracyTone: 'level',
    enabled: true,
    selected: false,
    box,
    nameBox,
    categoryBox,
    boxes: {
      name: nameBox,
      category: categoryBox,
      pp: { x: box.x + 46, y: rowY + 29.5, w: 213, h: 13 },
      power: { x: box.x + 46, y: rowY + 42.5, w: 151, h: 13 },
      accuracy: { x: box.x + 205, y: rowY + 42.5, w: 68, h: 13 },
    },
    typeBox: { x: box.x + 14, y: rowY + 30.5, w: 24, h: 24 },
    ...overrides,
  };
}

/** The `<button>` a slot renders, as the props Preact will mount it with. */
function buttonProps(props: MoveSlotProps): Record<string, unknown> {
  const node = MoveSlot(props) as unknown as Readonly<{ props: Record<string, unknown> }>;
  return node.props;
}

/**
 * Every node of a vnode tree carrying `className` in its class list, at any depth. A
 * component vnode is answered by calling it, so a primitive's own span is walked too.
 */
function nodesWithClass(props: Record<string, unknown>, className: string): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry);
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    const node = value as Readonly<{ type?: unknown; props?: Record<string, unknown> }>;
    if (node.props === undefined) return;
    const classes = typeof node.props.class === 'string' ? node.props.class.split(' ') : [];
    if (classes.includes(className)) found.push(node.props);
    if (typeof node.type === 'function') {
      walk((node.type as (given: Record<string, unknown>) => unknown)(node.props));
      return;
    }
    walk(node.props.children);
  };
  walk(props.children);
  return found;
}

/** Every node of a vnode tree carrying the `key` prop, at any depth. */
function nodesWithProp(props: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry);
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    const node = value as Readonly<{ type?: unknown; props?: Record<string, unknown> }>;
    if (node.props === undefined) return;
    if (key in node.props) found.push(node.props);
    if (typeof node.type === 'function') {
      walk((node.type as (given: Record<string, unknown>) => unknown)(node.props));
      return;
    }
    walk(node.props.children);
  };
  walk(props.children);
  return found;
}

/** The inline style of the slot's one child carrying `className`, at any depth. */
function insideStyle(props: Record<string, unknown>, className: string): unknown {
  const nodes = nodesWithClass(props, className);
  return nodes.length === 0 ? undefined : nodes[0]!.style;
}

describe('the move slot button', () => {
  it('sends the move intent of its own slot when it is pressed', () => {
    const intents: BattleMovesIntent[] = [];
    const emit = (intent: BattleMovesIntent): void => {
      intents.push(intent);
    };
    const props = buttonProps({
      slot: slot(2),
      card: CARD,
      onPress: () => emit(slotPressIntent(slot(2))),
    });
    expect(props['data-hud-move-slot']).toBe('2');
    expect(props.disabled).toBe(false);
    expect(typeof props.onClick).toBe('function');
    (props.onClick as () => void)();
    expect(intents).toStrictEqual([{ type: 'move', moveIndex: 2 }]);
  });

  it('answers with each slot s own index', () => {
    const intents: BattleMovesIntent[] = [];
    for (const index of [0, 1, 2, 3]) {
      const props = buttonProps({
        slot: slot(index),
        card: CARD,
        onPress: () => intents.push(slotPressIntent(slot(index))),
      });
      (props.onClick as () => void)();
    }
    expect(intents.map((intent) => (intent.type === 'move' ? intent.moveIndex : -1))).toStrictEqual([
      0, 1, 2, 3,
    ]);
  });

  it('marks a slot it cannot pick disabled, and paints no interior when empty', () => {
    const marked = buttonProps({ slot: slot(1, { enabled: false }), card: CARD, onPress: () => {} });
    expect(marked.disabled).toBe(true);
    expect(marked['data-enabled']).toBe('false');

    const empty = buttonProps({
      slot: slot(3, { empty: true, enabled: false, name: '' }),
      card: CARD,
      onPress: () => {},
    });
    expect(empty.disabled).toBe(true);
    expect(empty['data-empty']).toBe('true');
    expect(empty['data-hud-move-slot']).toBe('3');
  });

  it('places the button at the slot s own page rect', () => {
    const props = buttonProps({ slot: slot(2), card: CARD, onPress: () => {} });
    expect(props.style).toStrictEqual({ left: '84px', top: '104px', width: '273px', height: '72px' });
  });

  it('paints the category glyph at the model s own rect, in the slot s space', () => {
    const props = buttonProps({ slot: slot(0), card: CARD, onPress: () => {} });
    expect(insideStyle(props, 'battle-moves__category')).toStrictEqual({
      left: '235px',
      top: '16.5px',
      width: '24px',
      height: '24px',
    });
  });

  it('paints the type badge at its own 24 px box', () => {
    const props = buttonProps({ slot: slot(0), card: CARD, onPress: () => {} });
    expect(insideStyle(props, 'battle-moves__type')).toStrictEqual({
      left: '14px',
      top: '30.5px',
      width: '24px',
      height: '24px',
    });
  });

  it('paints every label at its own model box, so the DOM cannot reflow them apart', () => {
    const props = buttonProps({ slot: slot(0), card: CARD, onPress: () => {} });
    expect(insideStyle(props, 'battle-moves__name')).toStrictEqual({
      left: '14px',
      top: '16.5px',
      width: '213px',
      height: '13px',
    });
    expect(insideStyle(props, 'battle-moves__pp')).toStrictEqual({
      left: '46px',
      top: '29.5px',
      width: '213px',
      height: '13px',
    });
    expect(insideStyle(props, 'battle-moves__pwr')).toStrictEqual({
      left: '46px',
      top: '42.5px',
      width: '151px',
      height: '13px',
    });
    expect(insideStyle(props, 'battle-moves__acc')).toStrictEqual({
      left: '205px',
      top: '42.5px',
      width: '68px',
      height: '13px',
    });
  });

  it('paints one atlas badge for the type and one glyph for the category, and no word', () => {
    const props = buttonProps({ slot: slot(0), card: CARD, onPress: () => {} });
    const type = nodesWithClass(props, 'kit-move-type');
    const category = nodesWithClass(props, 'kit-move-category');
    expect(type).toHaveLength(1);
    expect(category).toHaveLength(1);
    expect(type[0]!['aria-label']).toBe('water');
    expect(category[0]!['aria-label']).toBe('Special');
    expect(type[0]!.children).toBeUndefined();
    expect(category[0]!.children).toBeUndefined();
    expect(JSON.stringify(props.children)).not.toMatch(/PHYSICAL|SPECIAL|STATUS/);
  });

  it('paints neither icon on an empty slot', () => {
    const empty = buttonProps({
      slot: slot(3, { empty: true, enabled: false, name: '' }),
      card: CARD,
      onPress: () => {},
    });
    expect(nodesWithClass(empty, 'kit-move-type')).toHaveLength(0);
    expect(nodesWithClass(empty, 'kit-move-category')).toHaveLength(0);
  });
});

describe('the card', () => {
  it('takes its width class from the model, and says which one it is in the DOM', () => {
    expect(cardClass(false)).toBe('battle-moves');
    expect(cardClass(true)).toBe('battle-moves battle-moves--compact');
  });
});

const MOVE_CELL: MoveGridCell = {
  name: 'FLAMETHROWER',
  type: 'fire',
  category: 'Special',
  pp: 15,
  maxPp: 15,
  desc: 'A SHORT LINE.',
  power: 40,
  basePower: 40,
  accuracy: 100,
  baseAccuracy: 100,
  status: null,
  enabled: true,
};

const FOUR_MOVES: readonly MoveGridCell[] = [
  MOVE_CELL,
  { ...MOVE_CELL, name: 'AIR SLASH', type: 'flying', accuracy: 95, baseAccuracy: 95 },
  { ...MOVE_CELL, name: 'DRAGON CLAW', category: 'Physical' },
  { ...MOVE_CELL, name: 'EARTHQUAKE', type: 'ground' },
];

/** The card's own vnode, as the props Preact will mount it with. */
function cardProps(view: BattleMovesView): Record<string, unknown> {
  return (BattleMoves({ view }) as unknown as Readonly<{ props: Record<string, unknown> }>).props;
}

type ViewOverrides = Readonly<{
  open?: boolean;
  cells?: readonly MoveGridCell[];
  selected?: number;
  target?: string | null;
}>;

/** The move menu's input at one state, built the way the scene builds it. */
function inputOf(overrides: ViewOverrides = {}): BattleMovesInput {
  return {
    open: overrides.open ?? true,
    card: CARD,
    cells: padMoveGridCells(overrides.cells ?? [], 4),
    selected: overrides.selected ?? 0,
    info: null,
    mega: false,
    gmax: false,
    megaArmed: false,
    gmaxArmed: false,
    target: overrides.target ?? null,
  };
}

/** The move menu's view at one state, from the model itself. */
function viewOf(overrides: ViewOverrides = {}): BattleMovesView {
  return battleMovesView(inputOf(overrides));
}

describe('no cell carries a button', () => {
  it('paints no ⓘ node over a four-move grid', () => {
    const view = viewOf({ cells: FOUR_MOVES });
    const props = cardProps(view);
    expect(nodesWithProp(props, 'data-hud-move-info')).toHaveLength(0);
    expect(nodesWithClass(props, 'battle-moves__info')).toHaveLength(0);
    expect(view.slots.every((entry) => !('info' in entry))).toBe(true);
  });

  it('keeps the four slot buttons themselves, which still choose their move', () => {
    const view = viewOf({ cells: FOUR_MOVES });
    const slots = nodesWithProp(cardProps(view), 'data-hud-move-slot');
    expect(slots.map((entry) => entry['data-hud-move-slot'])).toStrictEqual(['0', '1', '2', '3']);
    expect(slots.every((entry) => typeof entry.onClick === 'function')).toBe(true);
  });
});

const TARGET_VIEW = viewOf();

describe('the target step s prompt row', () => {
  it('paints exactly one node, carrying the model s label', () => {
    const view = viewOf({ target: 'Pidgey' });
    const nodes = nodesWithProp(cardProps(view), 'data-hud-move-target');
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.class).toBe('battle-moves__target');
    expect(nodes[0]!['data-hud-move-target']).toBe(true);
    expect(nodes[0]!.children).toBe(view.target!.label);
    expect(nodes[0]!.style).toStrictEqual({
      left: '20px',
      top: '1px',
      width: '688px',
      height: '22px',
    });
  });

  it('paints none while the step is closed', () => {
    expect(TARGET_VIEW.target).toBeNull();
    expect(nodesWithProp(cardProps(TARGET_VIEW), 'data-hud-move-target')).toHaveLength(0);
  });
});

describe('the move card', () => {
  it('is one node at the model s box, painted in the layer s own space', () => {
    const view = viewOf({ cells: FOUR_MOVES, selected: 0 });
    const cards = nodesWithProp(cardProps(view), 'data-hud-move-card');
    expect(cards).toHaveLength(1);
    expect(cards[0]!.class).toBe('battle-moves__desc');
    expect(cards[0]!.style).toStrictEqual({
      left: '20px',
      top: '-168px',
      width: '688px',
      height: '160px',
    });
    expect(view.info!.box).toStrictEqual({ x: 296, y: 414, w: 688, h: 160 });
  });

  it('prints the cursor s move: the name, the three readouts and the text', () => {
    const view = viewOf({ cells: FOUR_MOVES, selected: 2 });
    const card = nodesWithProp(cardProps(view), 'data-hud-move-card')[0]!;
    const head: Record<string, unknown> = { children: card.children };
    const pick = (key: string): unknown => nodesWithProp(head, key)[0]!.children;
    expect(pick('data-hud-move-card-title')).toBe('DRAGON CLAW');
    expect(pick('data-hud-move-card-pp')).toBe(view.info!.pp);
    expect(pick('data-hud-move-card-pwr')).toBe(view.info!.power);
    expect(pick('data-hud-move-card-acc')).toBe(view.info!.accuracy);
    expect(pick('data-hud-move-desc')).toBe('A SHORT LINE.');
    expect(nodesWithProp(head, 'data-hud-move-card-title')).toHaveLength(1);
    expect(nodesWithProp(head, 'data-hud-move-desc')).toHaveLength(1);
  });

  it('paints the type badge and the category glyph, never the words', () => {
    const view = viewOf({ cells: FOUR_MOVES });
    const card = nodesWithProp(cardProps(view), 'data-hud-move-card')[0]!;
    const head: Record<string, unknown> = { children: card.children };
    const types = nodesWithClass(head, 'kit-move-type');
    const categories = nodesWithClass(head, 'kit-move-category');
    expect(types).toHaveLength(1);
    expect(types[0]!['aria-label']).toBe('fire');
    expect(categories).toHaveLength(1);
    expect(categories[0]!['aria-label']).toBe('Special');
    expect(nodesWithClass(head, 'kit-type')).toHaveLength(0);
    expect(JSON.stringify(head)).not.toMatch(/PHYSICAL|SPECIAL|STATUS/);
  });

  it('is not painted while the menu is closed, nor for an empty cell', () => {
    expect(nodesWithProp(cardProps(viewOf({ open: false })), 'data-hud-move-card')).toHaveLength(0);
    const one = viewOf({ cells: [MOVE_CELL], selected: 1 });
    expect(nodesWithProp(cardProps(one), 'data-hud-move-card')).toHaveLength(0);
  });
});

describe('battleMoves.css', () => {
  const CSS = readFileSync(fileURLToPath(new URL('./battleMoves.css', import.meta.url)), 'utf8');

  it('keeps the card out of the pointer s way', () => {
    const card = /\.battle-moves__desc\s*\{([^}]*)\}/.exec(CSS);
    expect(card).not.toBeNull();
    expect(card![1]).toContain('pointer-events: none;');
    expect(card![1]).toContain('overflow: hidden;');
  });

  it('lets the description scroll inside the 160 px card instead of growing it', () => {
    const text = /\.battle-moves__desc-text\s*\{([^}]*)\}/.exec(CSS);
    expect(text).not.toBeNull();
    expect(text![1]).toContain('overflow-y: auto;');
  });

  it('has no per-cell ⓘ left at all', () => {
    expect(CSS).not.toMatch(/\.battle-moves__info/);
    const focus = /\.battle-moves__slot:focus-visible[^{]*\{([^}]*)\}/.exec(CSS);
    expect(focus).not.toBeNull();
    expect(focus![1]).toContain('outline: 2px solid var(--hud-accent);');
  });

  it('keeps the layer overflow visible, so the card can paint above its own box', () => {
    const layer = /\.battle-moves\s*\{([^}]*)\}/.exec(CSS);
    expect(layer).not.toBeNull();
    expect(layer![1]).toContain('overflow: visible;');
  });
});
