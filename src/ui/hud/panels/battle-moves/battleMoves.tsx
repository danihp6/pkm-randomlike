import type { CSSProperties, JSX } from 'preact';
import { useState } from 'preact/hooks';
import { TypeBadge, joinClasses } from '../../kit';
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

function flag(value: boolean): string {
  return value ? 'true' : 'false';
}

/** One slot's press: the intent the card emits for it. */
export type MoveSlotProps = Readonly<{
  slot: BattleMoveSlotView;
  card: Rect;
  onPress: () => void;
}>;

/** One move card: the type chip, the name, the category and the three stat lines. */
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
          <TypeBadge type={slot.type} />
          <span class="battle-moves__name">{slot.name}</span>
          <span class="battle-moves__category">{slot.category}</span>
          <span class="battle-moves__pp">{slot.pp}</span>
          <span class={joinClasses('battle-moves__pwr', `battle-moves__stat--${slot.powerTone}`)}>
            {slot.power}
          </span>
          <span class={joinClasses('battle-moves__acc', `battle-moves__stat--${slot.accuracyTone}`)}>
            {slot.accuracy}
          </span>
        </>
      )}
    </button>
  );
}

/**
 * The battle's move menu over the canvas (`D49`, frame `05 Battle HUD`). The layer
 * takes no pointer event and every control takes its own: the canvas's pads and
 * keys keep every other press. Each control answers with a `BattleMovesIntent`; the
 * scene maps it onto the call the canvas already made.
 */
export function BattleMoves(props: BattleMovesProps): JSX.Element {
  const { view } = props;
  const card = view.card;
  const emit = (intent: BattleMovesIntent): void => props.onIntent?.(intent);
  // The ⓘ is a toggle: the view carries the open card, not the slot it belongs to,
  // so the press that opened it is the press that closes it.
  const [opened, setOpened] = useState<number | null>(null);
  const pinned = view.info === null ? null : opened;

  const pressInfo = (index: number): void => {
    const next = pinned === index ? null : index;
    setOpened(next);
    emit({ type: 'info', moveIndex: next });
  };

  return (
    <div
      class="battle-moves"
      data-hud-panel="battle-moves"
      data-open={flag(view.open)}
      hidden={!view.open}
      style={cardStyle(card)}
    >
      {view.slots.map((slot) => (
        <MoveSlot key={slot.index} slot={slot} card={card} onPress={() => emit(slotPressIntent(slot))} />
      ))}
      {view.slots.map((slot) =>
        slot.info === null ? null : (
          <button
            key={`info-${slot.index}`}
            type="button"
            class={joinClasses(
              'battle-moves__info',
              pinned === slot.index && 'battle-moves__info--active',
            )}
            data-hud-move-info={String(slot.index)}
            style={insetStyle(slot.info, card)}
            onClick={() => pressInfo(slot.index)}
          >
            i
          </button>
        ),
      )}
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
      {view.info === null ? null : (
        <div class="battle-moves__desc" style={insetStyle(view.info.box, card)}>
          <span class="battle-moves__desc-head">
            <TypeBadge type={view.info.type} />
            <span class="battle-moves__desc-title">{view.info.title}</span>
            <span class="battle-moves__desc-category">{view.info.category}</span>
          </span>
          <p class="battle-moves__desc-text" data-hud-move-desc>
            {view.info.text}
          </p>
        </div>
      )}
    </div>
  );
}
