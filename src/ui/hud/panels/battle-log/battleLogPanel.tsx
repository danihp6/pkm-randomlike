import type { CSSProperties, JSX } from 'preact';
import { joinClasses } from '../../kit';
import { compactCard } from '../battle-moves/view';
import { battleLogBoard, battleLogLayout, type BattleLogView, type Rect } from './view';
import './battleLog.css';

export type BattleLogProps = Readonly<{
  view: BattleLogView;
  /**
   * The preview's board choice: under 600 px it draws the phone card (`m05b`) instead
   * of the desktop box. A live view carries its card and reads the width class from it.
   */
  narrow: boolean;
}>;

/** A rect inside the card: the board measures in page coordinates, the lines are relative. */
function innerStyle(rect: Rect, origin: Rect): CSSProperties {
  return {
    left: `${rect.x - origin.x}px`,
    top: `${rect.y - origin.y}px`,
    width: `${rect.w}px`,
    height: `${rect.h}px`,
  };
}

/** A rect in viewport coordinates: the layer is `fixed`, so the board's rect is its own. */
function rectStyle(rect: Rect): CSSProperties {
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.w}px`,
    height: `${rect.h}px`,
  };
}

/** The board's 1 px highlight, 12 px inside the card's top edge. */
const HIGHLIGHT_INSET = 12;
const HIGHLIGHT_H = 1;

function flag(value: boolean): string {
  return value ? 'true' : 'false';
}

/**
 * The battle's message box over the canvas (`D49`, frames `05b`/`m05b Battle · message`):
 * the card at the battle's menu box, its highlight, and up to two lines — the message in
 * primary ink and the effect line in the frame's red. Presentation only: no listener,
 * no clock, no battle state; the scene pushes the line the typewriter is revealing and
 * this paints it. The live box is the menu card (`view.card`), so a menu opening swaps
 * the lines for the rows without resizing or moving the window; without a card the
 * fixture preview paints the measured board.
 */
export function BattleLogPanel(props: BattleLogProps): JSX.Element {
  const { view } = props;
  const card = view.card ?? null;
  const narrow = card === null ? props.narrow : compactCard(card);
  const board =
    card === null ? battleLogBoard(narrow ? 'narrow' : 'desktop') : battleLogLayout(card, narrow);
  const highlight: Rect = {
    x: HIGHLIGHT_INSET,
    y: HIGHLIGHT_INSET,
    w: Math.max(0, board.box.w - HIGHLIGHT_INSET * 2),
    h: HIGHLIGHT_H,
  };
  const line1 = view.lines[0];
  const line2 = view.lines[1];

  return (
    <div
      class={joinClasses('battle-log', props.narrow && 'battle-log--narrow')}
      data-hud-battle-log
      data-visible={flag(view.visible)}
      hidden={!view.visible}
      style={rectStyle(board.box)}
    >
      <span class="battle-log__highlight" data-hud-battle-log-highlight style={rectStyle(highlight)} />
      {line1 === undefined ? null : (
        <p
          class={joinClasses('battle-log__line', `battle-log__line--${line1.tone}`)}
          data-hud-battle-log-line="1"
          style={innerStyle(board.line1, board.box)}
        >
          {line1.text}
        </p>
      )}
      {line2 === undefined ? null : (
        <p
          class={joinClasses('battle-log__line', `battle-log__line--${line2.tone}`)}
          data-hud-battle-log-line="2"
          style={innerStyle(board.line2, board.box)}
        >
          {line2.text}
        </p>
      )}
    </div>
  );
}
