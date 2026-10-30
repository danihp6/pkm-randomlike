import { describe, expect, it, vi } from 'vitest';
import { FIELD_ICONS } from '../../../../data/fieldIcons';
import { BattleFieldPanel } from './battleField';
import { battleFieldView, type BattleFieldInput, type FieldChipView, type Viewport } from './view';

// The layer holds no state, so the panel is read as the vnode tree it builds; the
// hooks answer their initial value and never re-render.
vi.mock('preact/hooks', () => ({
  useState: <T>(initial: T): [T, (next: T) => void] => [initial, () => {}],
  useEffect: (): void => {},
}));

const DESKTOP: Viewport = { width: 1280, height: 800 };

/** Every node of a vnode tree whose props carry `attribute`, at any depth. A component
 * vnode is answered by calling it, so the layer's own spans are walked too. */
function nodesWith(
  value: unknown,
  attribute: string,
  found: Record<string, unknown>[] = [],
): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    for (const entry of value) nodesWith(entry, attribute, found);
    return found;
  }
  if (typeof value !== 'object' || value === null) return found;
  const node = value as Readonly<{ type?: unknown; props?: Record<string, unknown> }>;
  if (node.props === undefined) return found;
  if (attribute in node.props) found.push(node.props);
  if (typeof node.type === 'function') {
    nodesWith((node.type as (given: Record<string, unknown>) => unknown)(node.props), attribute, found);
    return found;
  }
  return nodesWith(node.props.children, attribute, found);
}

/** The props of every node carrying `className` in its `class` attribute. */
function classProps(tree: unknown, className: string): Record<string, unknown>[] {
  return nodesWith(tree, 'class').filter((props) => props.class === className);
}

function inputOf(overrides: Partial<BattleFieldInput> = {}): BattleFieldInput {
  return {
    viewport: DESKTOP,
    doubles: { enemy: false, player: false },
    weather: null,
    weatherTurns: 0,
    terrain: null,
    terrainTurns: 0,
    ...overrides,
  };
}

function bothUp(): readonly FieldChipView[] {
  return battleFieldView(
    inputOf({ weather: 'sun', weatherTurns: 5, terrain: 'grassy', terrainTurns: 3 }),
  ).chips;
}

describe('BattleFieldPanel', () => {
  it('paints the layer the scene mounts into', () => {
    const tree = BattleFieldPanel({ view: battleFieldView(inputOf()) }) as unknown;
    const roots = nodesWith(tree, 'data-hud-panel');

    expect(roots).toHaveLength(1);
    expect(roots[0]!['data-hud-panel']).toBe('battle-field');
    expect(roots[0]!.class).toBe('battle-field');
  });

  it('paints one chip per condition, the terrain first', () => {
    const view = battleFieldView(
      inputOf({ weather: 'sun', weatherTurns: 5, terrain: 'grassy', terrainTurns: 3 }),
    );
    const chips = nodesWith(BattleFieldPanel({ view }) as unknown, 'data-hud-field');

    expect(chips.map((chip) => chip['data-hud-field'])).toStrictEqual(['grassy', 'sun']);
    expect(chips.map((chip) => chip['data-hud-field-kind'])).toStrictEqual(['terrain', 'weather']);
    expect(chips.map((chip) => chip.role)).toStrictEqual(['img', 'img']);
    expect(chips.map((chip) => chip['aria-label'])).toStrictEqual(view.chips.map((chip) => chip.label));
    expect(chips.map((chip) => chip.style)).toStrictEqual(
      view.chips.map((chip) => ({
        left: `${chip.box.x}px`,
        top: `${chip.box.y}px`,
        width: `${chip.box.w}px`,
        height: `${chip.box.h}px`,
      })),
    );
    expect(chips.map((chip) => chip.class)).toStrictEqual(['battle-field__chip', 'battle-field__chip']);
  });

  it('draws each chip s own glyph, filled, on the 24-unit square', () => {
    const chips = bothUp();
    const tree = BattleFieldPanel({
      view: battleFieldView(
        inputOf({ weather: 'sun', weatherTurns: 5, terrain: 'grassy', terrainTurns: 3 }),
      ),
    }) as unknown;
    const icons = nodesWith(tree, 'data-hud-field-icon');

    expect(icons).toHaveLength(2);
    expect(icons.map((icon) => icon.viewBox)).toStrictEqual(['0 0 24 24', '0 0 24 24']);
    expect(icons.map((icon) => icon['aria-hidden'])).toStrictEqual(['true', 'true']);
    expect(icons.map((icon) => icon.focusable)).toStrictEqual(['false', 'false']);
    for (const [index, icon] of icons.entries()) {
      const path = icon.children as Readonly<{ props: Record<string, unknown> }>;
      expect(path.props.d).toBe(FIELD_ICONS[chips[index]!.id].path);
      expect(path.props.fill).toBe('currentColor');
      expect(icon.preserveAspectRatio).toBeUndefined();
    }
  });

  it('paints the remaining turns as the chip s own numeral, hidden from the name', () => {
    const turns = classProps(
      BattleFieldPanel({
        view: battleFieldView(
          inputOf({ weather: 'sun', weatherTurns: 5, terrain: 'grassy', terrainTurns: 3 }),
        ),
      }) as unknown,
      'battle-field__turn',
    );

    expect(turns.map((props) => props.children)).toStrictEqual(['3', '5']);
    expect(turns.every((props) => props['aria-hidden'] === 'true')).toBe(true);
    expect(turns.every((props) => props['data-hud-field-turn'] !== undefined)).toBe(true);
  });

  it('keeps the root and paints no chip under a clear sky', () => {
    const tree = BattleFieldPanel({ view: battleFieldView(inputOf()) }) as unknown;

    expect(nodesWith(tree, 'data-hud-panel')).toHaveLength(1);
    expect(nodesWith(tree, 'data-hud-field')).toStrictEqual([]);
    expect(classProps(tree, 'battle-field__chip')).toStrictEqual([]);
    expect(nodesWith(tree, 'data-hud-field-icon')).toStrictEqual([]);
  });
});
