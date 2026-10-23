import type { JSX } from 'preact';
import { VOLUME_STEPS } from '../../../settingsScreen';
import type { HudCommand } from '../../commands';
import { Bar, Panel, PrimaryButton, Row } from '../../kit';
import { OPTIONS_NARROW_QUERY, type OptionsRowView, type OptionsView } from './view';
import './options.css';

export type OptionsPanelProps = Readonly<{
  view: OptionsView;
  /** Every control answers with the same command a key or pad press produces. */
  onCommand?: ((command: HudCommand) => void) | undefined;
}>;

/** The board's phone column replaces the two cards with one narrow card (frame `m02-options`). */
function compactViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(OPTIONS_NARROW_QUERY).matches;
}

function flatRows(view: OptionsView): readonly OptionsRowView[] {
  const rows: OptionsRowView[] = [];
  for (const group of view.groups) rows.push(...group.rows);
  return rows;
}

/** The keycap widths the board draws: 52 px, 60 px for a three-letter key and 68 px for a longer one. */
function keycapClass(value: string): string {
  if (value.length >= 5) return 'options__keycap options__keycap--wide';
  if (value.length >= 3) return 'options__keycap options__keycap--medium';
  return 'options__keycap';
}

/** The presses that walk the selection from the drawn row to `target`, in order. */
function walkCommands(
  rows: readonly OptionsRowView[],
  selected: string | null,
  target: string,
): readonly HudCommand[] {
  const to = rows.findIndex((row) => row.id === target);
  if (to < 0) return [];
  const found = selected === null ? 0 : rows.findIndex((row) => row.id === selected);
  const from = found < 0 ? 0 : found;
  const delta = to - from;
  const action = delta >= 0 ? 'down' : 'up';
  const commands: HudCommand[] = [];
  for (let i = 0; i < Math.abs(delta); i += 1) commands.push({ type: 'press', action });
  return commands;
}

function stepCommands(count: number, action: 'left' | 'right'): readonly HudCommand[] {
  const commands: HudCommand[] = [];
  for (let i = 0; i < count; i += 1) commands.push({ type: 'press', action });
  return commands;
}

function rowClass(row: OptionsRowView, selected: boolean): string {
  return [
    'options__row',
    `options__row--${row.kind}`,
    selected ? 'options__row--selected' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

type RowProps = Readonly<{
  row: OptionsRowView;
  selected: boolean;
  onSelect: () => void;
  send: (commands: readonly HudCommand[]) => void;
}>;

function OptionRow(props: RowProps): JSX.Element {
  const { row, selected, onSelect, send } = props;
  const step = (action: 'left' | 'right'): void => {
    onSelect();
    send([{ type: 'press', action }]);
  };

  const onSliderDown = (event: PointerEvent): void => {
    event.stopPropagation();
    const track = event.currentTarget as HTMLElement;
    if (track === null || typeof track.getBoundingClientRect !== 'function') return;
    onSelect();
    const target = (clientX: number): number => {
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return 0;
      const fraction = (clientX - rect.left) / rect.width;
      return Math.max(0, Math.min(VOLUME_STEPS, Math.round(fraction * VOLUME_STEPS)));
    };
    let last = Math.round((row.fraction ?? 0) * VOLUME_STEPS);
    const apply = (clientX: number): void => {
      const next = target(clientX);
      const delta = next - last;
      if (delta === 0) return;
      last = next;
      send(stepCommands(Math.abs(delta), delta > 0 ? 'right' : 'left'));
    };
    apply(event.clientX);
    const move = (moveEvent: PointerEvent): void => apply(moveEvent.clientX);
    const up = (): void => window.removeEventListener('pointermove', move);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  };

  const controls = (): JSX.Element => {
    if (row.kind === 'slider') {
      return (
        <>
          <span class="options__value">{row.value}</span>
          <span class="options__slider" onPointerDown={onSliderDown}>
            <Bar fraction={row.fraction ?? 0} label={row.label} />
            <span
              class="options__knob"
              style={{
                left: `calc(var(--options-track-width) * ${row.fraction ?? 0} - var(--options-knob) / 2)`,
              }}
            />
          </span>
        </>
      );
    }
    if (row.kind === 'toggle') {
      return (
        <>
          <span class="options__value">{row.value}</span>
          <span
            class="options__toggle"
            role="switch"
            aria-checked={row.on === true}
            aria-label={row.label}
            onClick={(event) => {
              event.stopPropagation();
              onSelect();
              send([{ type: 'press', action: 'right' }]);
            }}
          >
            <span class="options__toggle-knob" />
          </span>
        </>
      );
    }
    if (row.kind === 'keybind') {
      return <span class={keycapClass(row.value)}>{row.value}</span>;
    }
    return (
      <>
        <span class="options__value">{row.value}</span>
        <button
          type="button"
          class="options__step"
          data-hud-step="prev"
          aria-label={row.label}
          onClick={(event) => {
            event.stopPropagation();
            step('left');
          }}
        >
          {'<'}
        </button>
        <button
          type="button"
          class="options__step"
          data-hud-step="next"
          onClick={(event) => {
            event.stopPropagation();
            step('right');
          }}
        >
          {'>'}
        </button>
      </>
    );
  };

  return (
    <div
      class="options__slot"
      data-hud-row={row.id}
      data-selected={selected ? 'true' : undefined}
      onClick={onSelect}
    >
      <Row class={rowClass(row, selected)} selected={selected}>
        {selected ? <span class="options__bar" /> : null}
        <span class="options__label">{row.label}</span>
        {controls()}
      </Row>
    </div>
  );
}

export function OptionsPanel(props: OptionsPanelProps): JSX.Element {
  const { view } = props;
  const compact = compactViewport();
  const rows = flatRows(view);
  const handler = props.onCommand;

  const send = (commands: readonly HudCommand[]): void => {
    if (handler === undefined) return;
    for (const command of commands) handler(command);
  };

  const select = (id: string): void => send(walkCommands(rows, view.selected, id));

  const group = (id: OptionsView['groups'][number]['id']): OptionsView['groups'][number] | null =>
    view.groups.find((entry) => entry.id === id) ?? null;

  const gameplay = group('gameplay');
  const keybinds = group('keybinds');

  const card = (entry: OptionsView['groups'][number], withActions: boolean): JSX.Element => (
    <div class={`options__group options__group--${entry.id}`} data-hud-group={entry.id}>
      <Panel class={`options__card options__card--${entry.id}`}>
        {entry.title === '' ? null : <h2 class="options__group-title">{entry.title}</h2>}
        <div class="options__rows">
          {entry.rows.map((row) => (
            <OptionRow
              key={row.id}
              row={row}
              selected={row.id === view.selected}
              onSelect={() => select(row.id)}
              send={send}
            />
          ))}
        </div>
        {withActions ? (
          <div class="options__actions">
            <span class="options__action options__action--back" data-hud-action="back">
              <PrimaryButton onPress={() => send([{ type: 'press', action: 'cancel' }])}>
                {view.back}
              </PrimaryButton>
            </span>
            {view.reset === null ? null : (
              <span class="options__action options__action--reset" data-hud-action="reset">
                <PrimaryButton onPress={() => undefined}>{view.reset}</PrimaryButton>
              </span>
            )}
          </div>
        ) : null}
      </Panel>
    </div>
  );

  return (
    <div class="options" data-hud-panel="options">
      <div class="options__stage">
        <header class="options__head">
          <h1 class="options__title">{view.title}</h1>
          {view.subtitle === '' ? null : <p class="options__subtitle">{view.subtitle}</p>}
        </header>
        {gameplay === null ? null : card(gameplay, true)}
        {compact || keybinds === null || keybinds.rows.length === 0
          ? null
          : card(keybinds, false)}
        {view.footer === '' ? null : <p class="options__footer">{view.footer}</p>}
      </div>
    </div>
  );
}
