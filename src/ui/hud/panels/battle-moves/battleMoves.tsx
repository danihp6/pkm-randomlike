import type { CSSProperties, JSX } from 'preact';
import { MoveCategoryIcon, MoveTypeBadge, joinClasses } from '../../kit';
import type { BattleMovesIntent } from './mount';
import type { BattleMoveSlotView, BattleMovesView, Rect } from './view';
import './battleMoves.css';

export type BattleMovesProps = Readonly<{
  view: BattleMovesView;
  onIntent?: ((intent: BattleMovesIntent) => void) | undefined;
}>;

/** The intent a slot press sends: the index that slot's own view carries. */
export function slotPressIntent(slot: BattleMoveSlotView): BattleMovesIntent {
  return { type: 'move', moveIndex: slot.index };
}

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

/**
 * A label's style: the span sits inside the slot, which is itself the nearest
 * positioned ancestor, so its model rect is placed in the cell's own space.
 */
function labelStyle(slot: BattleMoveSlotView, rect: Rect): CSSProperties {
  return insetStyle(rect, slot.box);
}

function flag(value: boolean): string {
  return value ? 'true' : 'false';
}

/** One slot's press: the intent the card emits for it. */
export type MoveSlotProps = Readonly<{
  slot: BattleMoveSlotView;
  card: Rect;
  onPress: () => void;
}>;

/**
 * One move card: the type badge, the name, the category glyph and the three stat
 * lines, each painted at the box `cellTextBoxes` measured for it — never at a CSS grid
 * area, so the model's own rects are what the browser draws.
 */
export function MoveSlot(props: MoveSlotProps): JSX.Element {
  const { slot, card } = props;
  return (
    <button
      type="button"
      class={joinClasses(
        'battle-moves__slot',
        slot.selected && 'battle-moves__slot--selected',
        !slot.enabled && 'battle-moves__slot--marked',
      )}
      data-hud-move-slot={String(slot.index)}
      data-selected={flag(slot.selected)}
      data-enabled={flag(slot.enabled)}
      data-empty={flag(slot.empty)}
      disabled={slot.empty || !slot.enabled}
      style={insetStyle(slot.box, card)}
      onClick={props.onPress}
    >
      {slot.empty ? null : (
        <>
          <span class="battle-moves__type" style={labelStyle(slot, slot.typeBox)}>
            <MoveTypeBadge type={slot.type} />
          </span>
          <span class="battle-moves__name" style={labelStyle(slot, slot.boxes.name)}>
            {slot.name}
          </span>
          <span class="battle-moves__category" style={labelStyle(slot, slot.categoryBox)}>
            <MoveCategoryIcon category={slot.category} />
          </span>
          <span class="battle-moves__pp" style={labelStyle(slot, slot.boxes.pp)}>
            {slot.pp}
          </span>
          <span
            class={joinClasses('battle-moves__pwr', `battle-moves__stat--${slot.powerTone}`)}
            style={labelStyle(slot, slot.boxes.power)}
          >
            {slot.power}
          </span>
          <span
            class={joinClasses('battle-moves__acc', `battle-moves__stat--${slot.accuracyTone}`)}
            style={labelStyle(slot, slot.boxes.accuracy)}
          >
            {slot.accuracy}
          </span>
        </>
      )}
    </button>
  );
}

/** The card's class list: the layer, plus the compact modifier the stylesheet keys on. */
export function cardClass(compact: boolean): string {
  return joinClasses('battle-moves', compact && 'battle-moves--compact');
}

/**
 * The battle's move menu over the canvas (`D49`, frame `05 Battle HUD`). The layer
 * takes no pointer event and every control takes its own: the canvas's pads and
 * keys keep every other press. Each control answers with a `BattleMovesIntent`; the
 * scene maps it onto the call the canvas already made. The card floats above the
 * layer and describes the cell the cursor is on, so it takes no press of its own.
 */
export function BattleMoves(props: BattleMovesProps): JSX.Element {
  const { view } = props;
  const card = view.card;
  const emit = (intent: BattleMovesIntent): void => props.onIntent?.(intent);
  const info = view.info;

  return (
    <div
      class={cardClass(view.compact)}
      data-hud-panel="battle-moves"
      data-open={flag(view.open)}
      data-compact={flag(view.compact)}
      hidden={!view.open}
      style={cardStyle(card)}
    >
      {view.target === null ? null : (
        <span
          class="battle-moves__target"
          data-hud-move-target
          style={insetStyle(view.target.box, card)}
        >
          {view.target.label}
        </span>
      )}
      {view.slots.map((slot) => (
        <MoveSlot key={slot.index} slot={slot} card={card} onPress={() => emit(slotPressIntent(slot))} />
      ))}
      <button
        type="button"
        class="battle-moves__back"
        data-hud-move-back
        style={insetStyle(view.back.box, card)}
        onClick={() => emit({ type: 'back' })}
      >
        {view.back.label}
      </button>
      {view.mega === null ? null : (
        <button
          type="button"
          class="battle-moves__forme"
          data-hud-move-mega
          aria-pressed={view.mega.armed}
          style={insetStyle(view.mega.box, card)}
          onClick={() => emit({ type: 'mega' })}
        >
          {view.mega.label}
        </button>
      )}
      {view.gmax === null ? null : (
        <button
          type="button"
          class="battle-moves__forme"
          data-hud-move-gmax
          aria-pressed={view.gmax.armed}
          style={insetStyle(view.gmax.box, card)}
          onClick={() => emit({ type: 'gmax' })}
        >
          {view.gmax.label}
        </button>
      )}
      {info === null ? null : (
        <div class="battle-moves__desc" data-hud-move-card style={insetStyle(info.box, card)}>
          <span class="battle-moves__desc-head">
            <MoveTypeBadge type={info.type} />
            <span class="battle-moves__desc-title" data-hud-move-card-title>
              {info.title}
            </span>
            <span class="battle-moves__desc-category">
              <MoveCategoryIcon category={info.category} />
            </span>
            <span class="battle-moves__desc-pp" data-hud-move-card-pp>
              {info.pp}
            </span>
            <span class="battle-moves__desc-pwr" data-hud-move-card-pwr>
              {info.power}
            </span>
            <span class="battle-moves__desc-acc" data-hud-move-card-acc>
              {info.accuracy}
            </span>
          </span>
          <p class="battle-moves__desc-text" data-hud-move-desc>
            {info.text}
          </p>
        </div>
      )}
    </div>
  );
}
