import type { CSSProperties, JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { t } from '../../../../i18n';
import type { HudCommand } from '../../commands';
import { portraitBackground, type PortraitCrop } from '../../portrait';
import type { PartyPanelView, PartyRowView, Rect } from './view';
import { PARTY_PORTRAIT } from './view';
import './party.css';

/**
 * The card's pointer drag, one cell per mount: the row the pointer picked up and
 * the click a drop owes. `swallowed` is a ref cell on purpose — the click after a
 * drop lands on a handler built by the *next* paint, so the flag must outlive a
 * render, and `setFrom` repaints so `data-dragging` can follow the pointer.
 */
export type PartyDrag = Readonly<{
  /** The row the pointer went down on, or null. */
  from: number | null;
  /** True between a drop that moved a member and the click that follows it. */
  swallowed: { current: boolean };
  setFrom: (from: number | null) => void;
}>;

export type PartyPanelProps = Readonly<{
  view: PartyPanelView;
  onCommand?: ((command: HudCommand) => void) | undefined;
  /** A completed drag: the row picked up and the row it was dropped on. */
  onReorder?: ((from: number, to: number) => void) | undefined;
}>;

export type PartyCardProps = Readonly<{
  view: PartyPanelView;
  drag: PartyDrag;
  onCommand?: ((command: HudCommand) => void) | undefined;
  onReorder?: ((from: number, to: number) => void) | undefined;
}>;

/** The held badge's box, row-relative: the shipped item icon's own cell. */
const HELD_INSET = 27;
const HELD_SIZE = 24;

/** An absolutely positioned box from a panel-relative rect. */
function boxStyle(rect: Rect): CSSProperties {
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.w}px`,
    height: `${rect.h}px`,
  };
}

/** The same box, measured from a parent that already sits at `origin`. */
function innerStyle(rect: Rect, origin: Rect): CSSProperties {
  return {
    left: `${rect.x - origin.x}px`,
    top: `${rect.y - origin.y}px`,
    width: `${rect.w}px`,
    height: `${rect.h}px`,
  };
}

/** The portrait cell's inline scale, or no background at all when the atlas names no cell. */
function portraitImageStyle(portrait: PortraitCrop | null, box: number): CSSProperties | undefined {
  if (portrait === null) return undefined;
  return { ...portraitBackground(portrait, box) };
}

type PartyRowProps = Readonly<{
  row: PartyRowView;
  index: number;
  drag: PartyDrag;
  send: (command: HudCommand) => void;
  onReorder: ((from: number, to: number) => void) | undefined;
}>;

const PartyRow = (props: PartyRowProps): JSX.Element => {
  const { row, index, drag, send, onReorder } = props;
  const label = t('party.rowLabel', {
    name: row.name,
    level: row.level,
    status: row.statusLabel === null ? '' : `  ${row.statusLabel}`,
  });
  return (
    <button
      type="button"
      class={row.selected ? 'party__row party__row--selected' : 'party__row'}
      data-hud-party-member={row.memberId}
      data-hud-party-dark={row.dark ? 'true' : undefined}
      data-selected={row.selected ? 'true' : undefined}
      data-dragging={drag.from === index ? 'true' : undefined}
      aria-label={label}
      style={boxStyle(row.row)}
      onPointerDown={() => drag.setFrom(index)}
      onPointerUp={() => {
        const from = drag.from;
        drag.setFrom(null);
        if (from === null || from === index) return;
        drag.swallowed.current = true;
        onReorder?.(from, index);
      }}
      onPointerCancel={() => drag.setFrom(null)}
      onClick={() => {
        if (drag.swallowed.current) {
          drag.swallowed.current = false;
          return;
        }
        send({ type: 'member', memberId: row.memberId });
      }}
    >
      <span class="party__row-face">
        <span
          class={row.dark ? 'party__portrait party__portrait--dark' : 'party__portrait'}
          data-hud-party-portrait
          style={{
            ...innerStyle(row.portrait, row.row),
            ...portraitImageStyle(row.portraitImage, PARTY_PORTRAIT),
          }}
        />
        {row.heldItemName === null ? null : (
          <span
            class="party__held"
            title={row.heldItemName}
            aria-label={row.heldItemName}
            style={{
              left: `${HELD_INSET}px`,
              top: `${HELD_INSET}px`,
              width: `${HELD_SIZE}px`,
              height: `${HELD_SIZE}px`,
            }}
          >
            {row.heldItemName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span class="party__name">{row.name}</span>
        {row.statusLabel === null ? null : <span class="party__status">{row.statusLabel}</span>}
        <span
          class="party__hp"
          data-hud-party-hp
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.trunc(row.hpFraction * 100)}
          aria-label={row.hpText}
          title={row.hpText}
          style={innerStyle(row.hpBar, row.row)}
        >
          <span
            class="party__hp-fill"
            data-hud-party-hp-fill
            style={{ width: `${row.hpFraction * row.hpBar.w}px` }}
          />
        </span>
      </span>
    </button>
  );
};

/**
 * The party card's paint over one drag cell: the squad's level, the shared XP bar
 * and the Pokevial meter over six member rows, each one press away from taking the
 * lead and each one drop away from trading places with another. A pointer-up
 * outside every row drops the carried index, as a cancelled pointer does.
 */
export function PartyCard(props: PartyCardProps): JSX.Element {
  const { view, drag } = props;
  const handler = props.onCommand;
  const send = (command: HudCommand): void => handler?.(command);
  return (
    <div
      class="party"
      data-hud-panel="party"
      hidden={!view.open}
      style={boxStyle(view.box)}
      onPointerUp={() => drag.setFrom(null)}
      onPointerCancel={() => drag.setFrom(null)}
    >
      <div class="party__face">
        <span class="party__highlight" style={boxStyle(view.highlight)} />
        <button
          type="button"
          class="party__chip"
          data-hud-party="chip"
          aria-label={t('keybind.party')}
          style={boxStyle(view.chip.box)}
          onClick={() => send({ type: 'panel', panel: 'party' })}
        >
          {view.chip.letter}
        </button>
        <span class="party__level" data-hud-party="level" style={boxStyle(view.level.box)}>
          {view.level.text}
        </span>
        <span
          class="party__xp"
          data-hud-party="xp"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.trunc(view.xp.fraction * 100)}
          aria-label={view.xp.label}
          style={boxStyle(view.xp.box)}
        >
          <span class="party__xp-fill" style={{ width: `${view.xp.fraction * view.xp.box.w}px` }} />
        </span>
        <span
          class="party__vial"
          data-hud-party="vial"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={view.vial.max}
          aria-valuenow={view.vial.charges}
          aria-label={`${view.vial.text} ${view.vial.charges}/${view.vial.max}`}
          style={boxStyle(view.vial.box)}
        >
          <span
            class="party__vial-fill"
            data-step={String(view.vial.step)}
            style={{ width: `${view.vial.fill * view.vial.box.w}px` }}
          />
          <span class="party__vial-label">{view.vial.text}</span>
        </span>
        {view.rows.map((row, index) => (
          <PartyRow
            key={row.memberId}
            row={row}
            index={index}
            drag={drag}
            send={send}
            onReorder={props.onReorder}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * The party card (`D49`). It paints the view and answers in `HudCommand`s; the
 * scene owns the run, the panel record and the toggle. The drag cell lives here,
 * one per mount, and a completed drag is reported through `onReorder`.
 */
export function PartyPanel(props: PartyPanelProps): JSX.Element {
  const [from, setFrom] = useState<number | null>(null);
  const swallowed = useRef(false);
  const drag: PartyDrag = { from, swallowed, setFrom };
  return (
    <PartyCard view={props.view} drag={drag} onCommand={props.onCommand} onReorder={props.onReorder} />
  );
}
