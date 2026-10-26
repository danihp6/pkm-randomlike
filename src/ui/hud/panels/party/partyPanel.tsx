import type { CSSProperties, JSX } from 'preact';
import { t } from '../../../../i18n';
import type { HudCommand } from '../../commands';
import type { PartyPanelView, PartyRowView, Rect } from './view';
import { PARTY_HP_FILL_RATIO } from './view';
import './party.css';

export type PartyPanelProps = Readonly<{
  view: PartyPanelView;
  onCommand?: ((command: HudCommand) => void) | undefined;
}>;

/** The Pokevial's one fill step per charge, the shipped `HUD_VIAL_FILL_COLORS`. */
const VIAL_STEPS = 3;
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

function vialStep(charges: number): number {
  return Math.min(VIAL_STEPS, Math.max(1, Math.trunc(charges)));
}

function PartyRow(
  props: Readonly<{ row: PartyRowView; send: (command: HudCommand) => void }>,
): JSX.Element {
  const { row, send } = props;
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
      aria-label={label}
      style={boxStyle(row.row)}
      onClick={() => send({ type: 'member', memberId: row.memberId })}
    >
      <span class="party__row-face">
        <span
          class={row.dark ? 'party__portrait party__portrait--dark' : 'party__portrait'}
          data-hud-party-portrait
          style={innerStyle(row.portrait, row.row)}
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
            style={{ width: `${row.hpFraction * PARTY_HP_FILL_RATIO * row.hpBar.w}px` }}
          />
        </span>
      </span>
    </button>
  );
}

/**
 * The party card: the squad's level, the shared XP bar and the Pokevial meter over
 * six member rows, each one press away from taking the lead. It paints the view and
 * answers in `HudCommand`s; the scene owns the run, the panel record and the toggle.
 */
export function PartyPanel(props: PartyPanelProps): JSX.Element {
  const { view } = props;
  const handler = props.onCommand;
  const send = (command: HudCommand): void => handler?.(command);
  return (
    <div class="party" data-hud-panel="party" hidden={!view.open} style={boxStyle(view.box)}>
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
        <span class="party__xp-text">{view.xp.text}</span>
        <span
          class="party__xp"
          data-hud-party="xp"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.trunc(view.xp.fraction * 100)}
          aria-label={view.xp.text}
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
            data-step={view.vial.charges <= 0 ? 0 : vialStep(view.vial.charges)}
            style={{ width: `${view.vial.fill * view.vial.box.w}px` }}
          />
          <span class="party__vial-label">{view.vial.text}</span>
        </span>
        {view.rows.map((row) => (
          <PartyRow key={row.memberId} row={row} send={send} />
        ))}
      </div>
    </div>
  );
}
