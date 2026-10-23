import { describe, expect, it } from 'vitest';
import { MoveSlot, slotPressIntent, type MoveSlotProps } from './battleMoves';
import type { BattleMovesIntent } from './mount';
import type { BattleMoveSlotView, Rect } from './view';

const CARD: Rect = { x: 276, y: 582, w: 728, h: 192 };

function slot(index: number, overrides: Partial<BattleMoveSlotView> = {}): BattleMoveSlotView {
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
    box: { x: 360, y: 606 + Math.floor(index / 2) * 80, w: 273, h: 72 },
    info: { x: 597, y: 614 + Math.floor(index / 2) * 80, w: 22, h: 22 },
    ...overrides,
  };
}

/** The `<button>` a slot renders, as the props Preact will mount it with. */
function buttonProps(props: MoveSlotProps): Record<string, unknown> {
  const node = MoveSlot(props) as unknown as Readonly<{ props: Record<string, unknown> }>;
  return node.props;
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
});
