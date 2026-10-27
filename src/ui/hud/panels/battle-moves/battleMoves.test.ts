import { describe, expect, it } from 'vitest';
import {
  MoveSlot,
  cardClass,
  infoEnterIntent,
  infoLeaveIntent,
  slotPressIntent,
  type MoveSlotProps,
} from './battleMoves';
import type { BattleMovesIntent } from './mount';
import type { BattleMoveSlotView, Rect } from './view';

const CARD: Rect = { x: 276, y: 582, w: 728, h: 192 };

function slot(index: number, overrides: Partial<BattleMoveSlotView> = {}): BattleMoveSlotView {
  const rowY = 606 + Math.floor(index / 2) * 80;
  const box: Rect = { x: 360, y: rowY, w: 273, h: 72 };
  const info: Rect = { x: box.x + box.w - 36, y: rowY + 8, w: 22, h: 22 };
  const nameBox: Rect = { x: box.x + 14, y: rowY + 16.5, w: 96, h: 13 };
  const categoryBox: Rect = { x: info.x - 8 - 48, y: rowY + 16.5, w: 48, h: 13 };
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
      pp: { x: box.x + 70, y: rowY + 29.5, w: 151, h: 13 },
      power: { x: box.x + 70, y: rowY + 42.5, w: 95, h: 13 },
      accuracy: { x: box.x + 205, y: rowY + 42.5, w: 68, h: 13 },
    },
    typeBox: { x: box.x + 14, y: rowY + 37.5, w: 42, h: 10 },
    info,
    ...overrides,
  };
}

/** The `<button>` a slot renders, as the props Preact will mount it with. */
function buttonProps(props: MoveSlotProps): Record<string, unknown> {
  const node = MoveSlot(props) as unknown as Readonly<{ props: Record<string, unknown> }>;
  return node.props;
}

/** The inline style of the slot's one child carrying `className`, at any depth. */
function insideStyle(props: Record<string, unknown>, className: string): unknown {
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      for (const entry of value) {
        const found = walk(entry);
        if (found !== undefined) return found;
      }
      return undefined;
    }
    if (typeof value !== 'object' || value === null) return undefined;
    const node = value as Readonly<{ props?: Record<string, unknown> }>;
    if (node.props === undefined) return undefined;
    const classes = typeof node.props.class === 'string' ? node.props.class.split(' ') : [];
    if (classes.includes(className)) return node.props.style;
    return walk(node.props.children);
  };
  return walk(props.children);
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
      slot: slot(3, { empty: true, enabled: false, name: '', info: null }),
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

  it('paints the category column at the model s own rect, in the slot s space', () => {
    const props = buttonProps({ slot: slot(0), card: CARD, onPress: () => {} });
    expect(insideStyle(props, 'battle-moves__category')).toStrictEqual({
      left: '181px',
      top: '16.5px',
      width: '48px',
      height: '13px',
    });
  });

  it('paints every label at its own model box, so the DOM cannot reflow them apart', () => {
    const props = buttonProps({ slot: slot(0), card: CARD, onPress: () => {} });
    expect(insideStyle(props, 'battle-moves__name')).toStrictEqual({
      left: '14px',
      top: '16.5px',
      width: '96px',
      height: '13px',
    });
    expect(insideStyle(props, 'battle-moves__pp')).toStrictEqual({
      left: '70px',
      top: '29.5px',
      width: '151px',
      height: '13px',
    });
    expect(insideStyle(props, 'battle-moves__pwr')).toStrictEqual({
      left: '70px',
      top: '42.5px',
      width: '95px',
      height: '13px',
    });
    expect(insideStyle(props, 'battle-moves__acc')).toStrictEqual({
      left: '205px',
      top: '42.5px',
      width: '68px',
      height: '13px',
    });
    expect(insideStyle(props, 'battle-moves__type')).toStrictEqual({
      left: '14px',
      top: '37.5px',
      width: '42px',
      height: '10px',
    });
  });
});

describe('the card', () => {
  it('takes its width class from the model, and says which one it is in the DOM', () => {
    expect(cardClass(false)).toBe('battle-moves');
    expect(cardClass(true)).toBe('battle-moves battle-moves--compact');
  });
});

describe('the ⓘ hover', () => {
  it('asks for its own slot on enter and drops it on leave', () => {
    expect(infoEnterIntent(slot(2))).toStrictEqual({ type: 'info', moveIndex: 2 });
    expect(infoLeaveIntent()).toStrictEqual({ type: 'info', moveIndex: null });
  });
});
