import type { Settings } from '../../../../engine/save';
import { t } from '../../../../i18n';
import {
  isStepRow,
  settingValue,
  settingsRowLabel,
  settingsRows,
  type SettingsRow,
  type SettingsRowId,
} from '../../../settingsScreen';

/** One row the panel draws. `fraction`/`on` are null for the kinds that do not use them. */
export type OptionsRowView = Readonly<{
  id: string;
  kind: 'step' | 'slider' | 'toggle' | 'keybind';
  label: string;
  /** The printed value exactly as the board writes it: 'NORMAL', '70%', 'OFF', 'ENGLISH', 'A'. */
  value: string;
  /** A slider's fill, 0…1; null for every other kind. */
  fraction: number | null;
  /** A toggle's state; null for every other kind. */
  on: boolean | null;
}>;

export type OptionsGroupView = Readonly<{
  id: 'gameplay' | 'keybinds';
  title: string;
  rows: readonly OptionsRowView[];
}>;

export type OptionsView = Readonly<{
  title: string;
  subtitle: string;
  footer: string;
  back: string;
  /** The reset control's label; null renders no reset control at all. */
  reset: string | null;
  /** The id of the row drawn selected, or null when none is. */
  selected: string | null;
  /** Always [gameplay, keybinds] in this order; a group with no rows is still present. */
  groups: readonly OptionsGroupView[];
}>;

/** The slug this task's fixture and preview answer to. */
export const OPTIONS_SLUG = '02-options' as const;

const SLIDER_IDS: readonly string[] = ['volume'];
const TOGGLE_IDS: readonly string[] = ['alwaysRun', 'hudTransparent', 'reducedFlash'];

function rowKind(row: SettingsRow): OptionsRowView['kind'] {
  if (!isStepRow(row)) return 'keybind';
  const id = row.id as SettingsRowId;
  if (SLIDER_IDS.includes(id)) return 'slider';
  if (TOGGLE_IDS.includes(id)) return 'toggle';
  return 'step';
}

function toggleState(settings: Settings, id: SettingsRowId): boolean | null {
  switch (id) {
    case 'alwaysRun':
      return settings.alwaysRun;
    case 'hudTransparent':
      return settings.hudTransparent;
    case 'reducedFlash':
      return settings.reducedFlash;
    default:
      return null;
  }
}

/** The shipped screen: `settingsRows(touch)` and `settingValue`, localised as they are drawn. */
export function liveOptionsView(
  settings: Settings,
  touch: boolean,
  index: number,
  capturing: boolean,
): OptionsView {
  const rows = settingsRows(touch);
  const current = index >= 0 && index < rows.length ? rows[index] : undefined;
  const selected = current === undefined ? null : current.id;
  const gameplay: OptionsRowView[] = [];
  const keybinds: OptionsRowView[] = [];

  for (const row of rows) {
    const kind = rowKind(row);
    const listening = capturing && selected === row.id && kind === 'keybind';
    const view: OptionsRowView = {
      id: row.id,
      kind,
      label: settingsRowLabel(row),
      value: listening ? t('settings.pressKey') : settingValue(settings, row.id),
      fraction: kind === 'slider' ? settings.volume : null,
      on: kind === 'toggle' ? toggleState(settings, row.id as SettingsRowId) : null,
    };
    if (kind === 'keybind') keybinds.push(view);
    else gameplay.push(view);
  }

  return {
    title: t('settings.title'),
    subtitle: t('settings.subtitle'),
    footer: t('settings.footer'),
    back: t('settings.back'),
    reset: null,
    selected,
    groups: [
      { id: 'gameplay', title: t('settings.group.gameplay'), rows: gameplay },
      { id: 'keybinds', title: t('settings.group.keybinds'), rows: keybinds },
    ],
  };
}

type PlainRecord = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isKind(value: unknown): value is OptionsRowView['kind'] {
  return value === 'step' || value === 'slider' || value === 'toggle' || value === 'keybind';
}

function fixtureRow(value: unknown): OptionsRowView | null {
  if (!isPlainObject(value)) return null;
  const { id, label, value: printed, kind, fraction, on } = value;
  if (!isString(id) || id.length === 0) return null;
  if (!isString(label) || !isString(printed) || !isKind(kind)) return null;
  if (kind === 'slider') {
    if (typeof fraction !== 'number' || !(fraction >= 0 && fraction <= 1)) return null;
    if (on !== null) return null;
  } else if (fraction !== null) {
    return null;
  }
  if (kind === 'toggle') {
    if (typeof on !== 'boolean') return null;
  } else if (on !== null) {
    return null;
  }
  return {
    id,
    kind,
    label,
    value: printed,
    fraction: kind === 'slider' ? fraction : null,
    on: kind === 'toggle' ? on : null,
  };
}

function fixtureGroup(value: unknown, id: OptionsGroupView['id']): OptionsGroupView | null {
  if (!isPlainObject(value)) return null;
  if (value.id !== id || !isString(value.title) || !Array.isArray(value.rows)) return null;
  const rows: OptionsRowView[] = [];
  for (const entry of value.rows) {
    const row = fixtureRow(entry);
    if (row === null) return null;
    rows.push(row);
  }
  return { id, title: value.title, rows };
}

/**
 * The frame's own content, or null when the payload is not one this panel can draw.
 * A fixture file is `{ slug, state, panel }`; the view is the `panel` block inside it.
 */
export function fixtureOptionsView(payload: unknown): OptionsView | null {
  if (!isPlainObject(payload)) return null;
  const block = Object.prototype.hasOwnProperty.call(payload, 'panel') ? payload.panel : payload;
  if (!isPlainObject(block)) return null;
  const { title, subtitle, footer, back, reset, selected, groups } = block;
  if (!isString(title) || !isString(subtitle) || !isString(footer) || !isString(back)) return null;
  if (reset !== null && !isString(reset)) return null;
  if (selected !== null && !isString(selected)) return null;
  if (!Array.isArray(groups) || groups.length !== 2) return null;
  const gameplay = fixtureGroup(groups[0], 'gameplay');
  const keybinds = fixtureGroup(groups[1], 'keybinds');
  if (gameplay === null || keybinds === null) return null;
  return { title, subtitle, footer, back, reset, selected, groups: [gameplay, keybinds] };
}
