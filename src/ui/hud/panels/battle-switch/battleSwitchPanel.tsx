import type { CSSProperties, JSX } from 'preact';
import { t } from '../../../../i18n';
import { joinClasses } from '../../kit';
import type { BattleSwitchIntent } from './mount';
import type { BattleSwitchView, Rect, SwitchRowView } from './view';
import './battleSwitch.css';

export type BattleSwitchProps = Readonly<{
  view: BattleSwitchView;
  onIntent?: ((intent: BattleSwitchIntent) => void) | undefined;
}>;

/** The intent a row press sends: the index that row's own view carries. */
export function rowPressIntent(row: SwitchRowView): BattleSwitchIntent {
  return { type: 'switch', index: row.index };
}

/** The card in viewport coordinates: the layer is `fixed`, so the model's page rect is its own. */
function cardStyle(rect: Rect): CSSProperties {
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.w}px`,
    height: `${rect.h}px`,
  };
}

/** A rect inside a parent that already sits at `origin`: the row, its track, its portrait. */
function innerStyle(rect: Rect, origin: Rect): CSSProperties {
  return {
    left: `${rect.x - origin.x}px`,
    top: `${rect.y - origin.y}px`,
    width: `${rect.w}px`,
    height: `${rect.h}px`,
  };
}

function flag(value: boolean): string {
  return value ? 'true' : 'false';
}

/** One member's row: the portrait cell, the fitted line, the track and the mark. */
function switchRow(row: SwitchRowView, card: Rect, onPress: () => void): JSX.Element {
  const status = row.statusLabel === null ? '' : `  ${row.statusLabel}`;
  return (
    <button
      key={row.index}
      type="button"
      class={joinClasses(
        'battle-switch__row',
        row.selected && 'battle-switch__row--selected',
        row.field && 'battle-switch__row--field',
        !row.enabled && 'battle-switch__row--marked',
      )}
      data-hud-switch-row={String(row.index)}
      data-selected={flag(row.selected)}
      data-enabled={flag(row.enabled)}
      data-field={flag(row.field)}
      disabled={!row.enabled}
      aria-label={t('party.rowLabel', { name: row.name, level: row.level, status })}
      title={row.hpText}
      style={innerStyle(row.row, card)}
      onClick={onPress}
    >
      <span
        class="battle-switch__portrait"
        data-hud-switch-portrait
        style={innerStyle(row.portrait, row.row)}
      />
      <span
        class="battle-switch__label"
        data-hud-switch-label
        style={innerStyle(row.label.box, row.row)}
      >
        {row.label.text}
      </span>
      {row.hp === null ? null : (
        <span class="battle-switch__hp" data-hud-switch-hp style={innerStyle(row.hp.track, row.row)}>
          <span
            class="battle-switch__hp-area"
            data-hud-switch-hp-area
            style={innerStyle(row.hp.area, row.hp.track)}
          >
            <span
              class={joinClasses('battle-switch__hp-fill', `battle-switch__hp-fill--${row.hp.tone}`)}
              data-hud-switch-hp-fill
              style={{ width: `${row.hp.fill.w}px` }}
            />
          </span>
        </span>
      )}
      {row.status === null ? null : (
        <span
          class="battle-switch__status"
          data-hud-switch-status
          style={innerStyle(row.status.box, row.row)}
        >
          {row.statusLabel}
        </span>
      )}
    </button>
  );
}

/**
 * The battle's SWITCH window over the canvas (`D49`, frame `05d Battle · pokemon`). Its
 * card is the menu box the scene already laid out, so the six rows land on the canvas's
 * own rectangles: one row per member, its portrait cell, its fitted line, its HP track
 * and fill, its status mark and the ◀ control. Each control answers with a
 * `BattleSwitchIntent`; the scene maps it onto the call the canvas already made, so a
 * press is one switch and the send-out beat stays the scene's.
 */
export function BattleSwitchPanel(props: BattleSwitchProps): JSX.Element {
  const { view } = props;
  const emit = (intent: BattleSwitchIntent): void => props.onIntent?.(intent);

  return (
    <div
      class="battle-switch"
      data-hud-panel="battle-switch"
      data-open={flag(view.open)}
      hidden={!view.open}
      style={cardStyle(view.card)}
    >
      {view.rows.map((row) => switchRow(row, view.card, () => emit(rowPressIntent(row))))}
      <button
        type="button"
        class="battle-switch__back"
        data-hud-switch-back
        aria-label={t('battle.command.switch')}
        style={innerStyle(view.back.box, view.card)}
        onClick={() => emit({ type: 'back' })}
      >
        {view.back.label}
      </button>
    </div>
  );
}
