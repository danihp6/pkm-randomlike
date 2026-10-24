import type { CSSProperties, JSX } from 'preact';
import { joinClasses } from '../../kit';
import { battleLogBoard, type BattleLogView, type Rect } from './view';
import './battleLog.css';

export type BattleLogProps = Readonly<{
  view: BattleLogView;
  /** Under 600 px the panel draws the phone card (`m05b`) instead of the desktop box. */
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
 * the card at the board's own box, its highlight, and up to two lines — the message in
 * primary ink and the effect line in the frame's red. Presentation only: no listener,
 * no clock, no battle state; the scene pushes the line the typewriter is revealing and
 * this paints it.
 */
export function BattleLogPanel(props: BattleLogProps): JSX.Element {
  const { view } = props;
  const board = battleLogBoard(props.narrow ? 'narrow' : 'desktop');
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
