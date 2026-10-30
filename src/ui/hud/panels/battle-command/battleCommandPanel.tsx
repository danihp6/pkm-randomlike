import type { CSSProperties, JSX } from 'preact';
import { joinClasses } from '../../kit';
import type { BattleCommandIntent } from './mount';
import type { BattleCommandRowView, BattleCommandView, Rect } from './view';
import './battleCommand.css';

export type BattleCommandPanelProps = Readonly<{
  view: BattleCommandView;
  onIntent?: ((intent: BattleCommandIntent) => void) | undefined;
}>;

/** The card in viewport coordinates: the layer is `fixed`, so the model's page rects are its own. */
function cardStyle(rect: Rect): CSSProperties {
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.w}px`,
    height: `${rect.h}px`,
  };
}

/** A rect inside the card: the model measures in page coordinates, the card's children in its own. */
function insetStyle(rect: Rect, card: Rect): CSSProperties {
  return {
    left: `${rect.x - card.x}px`,
    top: `${rect.y - card.y}px`,
    width: `${rect.w}px`,
    height: `${rect.h}px`,
  };
}

function flag(value: boolean): string {
  return value ? 'true' : 'false';
}

type BattleCommandRowProps = Readonly<{
  row: BattleCommandRowView;
  /** The row's position in the card: the index the intent carries. */
  index: number;
  card: Rect;
  onIntent?: ((intent: BattleCommandIntent) => void) | undefined;
}>;

/**
 * One command row: the board's `menu tab` skin at the box the model measured for
 * it. A dimmed row stays a live button — the canvas's own cells stay reachable and
 * let `confirm` refuse them — so the card never sets `disabled`.
 */
function BattleCommandRow(props: BattleCommandRowProps): JSX.Element {
  const { row, index, card } = props;
  return (
    <button
      type="button"
      class={joinClasses(
        'battle-command__row',
        row.selected && 'battle-command__row--selected',
        !row.enabled && 'battle-command__row--disabled',
      )}
      data-hud-command={row.id}
      data-hud-command-box
      data-selected={flag(row.selected)}
      data-enabled={flag(row.enabled)}
      aria-disabled={!row.enabled}
      aria-pressed={row.selected}
      style={insetStyle(row.box, card)}
      onPointerEnter={() => props.onIntent?.({ type: 'hover', index })}
      onClick={() => props.onIntent?.({ type: 'press', index })}
    >
      <span class="battle-command__label">{row.label}</span>
    </button>
  );
}

/** The card's class list: the layer, plus the compact modifier the stylesheet keys on. */
function cardClass(compact: boolean): string {
  return joinClasses('battle-command', compact && 'battle-command--compact');
}

/**
 * The battle's FIGHT / BAG / SWITCH / RUN window over the canvas (`D49`, frame
 * `05 Battle HUD`). The layer takes no pointer event and every control takes its
 * own, so the canvas's pads and keys keep every other press. Each control answers
 * with a `BattleCommandIntent`; the scene maps it onto the call the canvas made.
 */
export function BattleCommandPanel(props: BattleCommandPanelProps): JSX.Element {
  const { view } = props;
  const card = view.card;
  return (
    <div
      class={cardClass(view.compact)}
      data-hud-panel="battle-command"
      data-open={flag(view.open)}
      data-compact={flag(view.compact)}
      hidden={!view.open}
      style={cardStyle(card)}
    >
      {view.rows.map((row, index) => (
        <BattleCommandRow key={row.id} row={row} index={index} card={card} onIntent={props.onIntent} />
      ))}
    </div>
  );
}
