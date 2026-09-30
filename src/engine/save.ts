import { STAT_IDS, getSpecies, type StatId, type Stats } from '../data/dex';
import { levelCapForRoute } from '../data/run';
import type { FighterSnapshot, Gender, MoveSlot, StatusId } from './battle/fighter';
import type { BagCounts } from './run/battleLink';
import { MAX_LEVEL, type RunPokemon } from './run/progression';
import { emptyRunStats, type RunState, type RunStats } from './run/state';

/** How fast the message box types text (consumed by the settings screen). */
export type TextSpeed = 'slow' | 'normal' | 'fast';

/** Player preferences that outlive a run. */
export type Settings = Readonly<{
  textSpeed: TextSpeed;
  /** Master volume, 0..1. */
  volume: number;
}>;

/**
 * The whole on-disk document: the settings and the run in progress. `run` is
 * null between runs (a fresh boot, or after a loss), so the settings are the
 * one thing that always survives (D5: a lost run carries over nothing).
 */
export type SaveDocument = Readonly<{
  version: number;
  settings: Settings;
  run: RunState | null;
}>;

/** The minimal slice of the Web Storage API the save needs, so it is testable. */
export type StorageLike = Readonly<{
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}>;

/** The schema version of the current build. Bump it and add a migration in step. */
export const SAVE_VERSION = 2;

/** The storage key. It carries no version: the version lives inside the JSON. */
export const SAVE_KEY = 'pokerandomlike.save';

export const DEFAULT_TEXT_SPEED: TextSpeed = 'normal';
export const DEFAULT_VOLUME = 0.8;

export function defaultSettings(): Settings {
  return { textSpeed: DEFAULT_TEXT_SPEED, volume: DEFAULT_VOLUME };
}

/** A save with nothing in it: default settings and no run. */
export function emptySave(): SaveDocument {
  return { version: SAVE_VERSION, settings: defaultSettings(), run: null };
}

/**
 * One schema upgrade. Index `n` turns a version-`n` document into version
 * `n + 1`; the migration only has to touch what changed, because the decoder
 * validates and defaults every field afterwards.
 */
export type Migration = (document: Record<string, unknown>) => Record<string, unknown>;

/** The upgrade steps, keyed by the version they read. Empty while v1 is current. */
export type Migrations = Readonly<Record<number, Migration | undefined>>;

/**
 * The migration path, keyed by the version each step reads. `1` moves a v1 run
 * onto the v2 schema, which added the run summary counters; later changes add
 * the next step, e.g. `2: (doc) => ({ ...doc, version: 3, changed })`.
 */
export const SAVE_MIGRATIONS: Migrations = {
  1: (document) => ({
    ...document,
    version: 2,
    run: isRecord(document.run)
      ? { ...document.run, stats: { catches: 0, casualties: 0 } }
      : document.run,
  }),
};

/** Runs a document through the upgrade steps between two versions. */
export function migrateDocument(
  document: Record<string, unknown>,
  from: number,
  to: number,
  migrations: Migrations = SAVE_MIGRATIONS,
): Record<string, unknown> | null {
  let current = document;
  for (let version = from; version < to; version++) {
    const step = migrations[version];
    if (!step) return null;
    current = step(current);
  }
  return current;
}

/** Writes the version the current build understands, whatever the input carried. */
export function encodeSave(document: SaveDocument): string {
  return JSON.stringify({
    version: SAVE_VERSION,
    settings: document.settings,
    run: document.run,
  });
}

/**
 * Reads a document from JSON: migrates it to the current schema, validates it
 * and falls back to defaults, field by field. It never throws, because a save
 * is user-editable and may be truncated mid-write. A document from a *newer*
 * build keeps its settings but drops the run, since we cannot read it.
 */
export function decodeSave(
  raw: string | null,
  migrations: Migrations = SAVE_MIGRATIONS,
): SaveDocument {
  if (raw === null) return emptySave();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptySave();
  }
  if (!isRecord(parsed)) return emptySave();

  // A document with no `version` predates the envelope: it is the first (v0)
  // format and has to earn its way up through the migration path.
  let version: number;
  if (parsed.version === undefined) version = 0;
  else if (isInteger(parsed.version) && parsed.version >= 0) version = parsed.version;
  else return emptySave();

  let document: Record<string, unknown> | null = null;
  if (version === SAVE_VERSION) document = parsed;
  else if (version < SAVE_VERSION) document = migrateDocument(parsed, version, SAVE_VERSION, migrations);

  // Settings are read per-field, so they can be salvaged even from a document we
  // cannot migrate (an older build's leftover, or a newer build's downgrade).
  // The run is only read from a document this build actually understands.
  const source = document ?? parsed;
  return {
    version: SAVE_VERSION,
    settings: parseSettings(source.settings),
    run: document ? parseRun(document.run) : null,
  };
}

/** Reads the save slot; storage failures are a fresh save, never a crash. */
export function loadSave(
  storage: StorageLike | null,
  migrations: Migrations = SAVE_MIGRATIONS,
): SaveDocument {
  if (!storage) return emptySave();
  let raw: string | null = null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return emptySave();
  }
  return decodeSave(raw, migrations);
}

/** Writes the save slot; a blocked or full store is silent, never fatal. */
export function storeSave(storage: StorageLike | null, document: SaveDocument): void {
  if (!storage) return;
  try {
    storage.setItem(SAVE_KEY, encodeSave(document));
  } catch {
    return;
  }
}

/** Replaces the run in progress, keeping the settings that are already stored. */
export function storeRun(storage: StorageLike | null, run: RunState): SaveDocument {
  const document: SaveDocument = { ...loadSave(storage), run };
  storeSave(storage, document);
  return document;
}

/** Forgets the run in progress (a loss, a win, or a fresh start), keeping settings. */
export function clearRun(storage: StorageLike | null): SaveDocument {
  const document: SaveDocument = { ...loadSave(storage), run: null };
  storeSave(storage, document);
  return document;
}

/** Replaces the settings, keeping the run in progress. */
export function storeSettings(storage: StorageLike | null, settings: Settings): SaveDocument {
  const document: SaveDocument = { ...loadSave(storage), settings };
  storeSave(storage, document);
  return document;
}

const TEXT_SPEEDS: readonly TextSpeed[] = ['slow', 'normal', 'fast'];
const GENDERS: readonly Gender[] = ['male', 'female', 'genderless'];
const STATUS_IDS: readonly StatusId[] = ['brn', 'psn', 'tox', 'par', 'slp', 'frz'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return isNumber(value) && Number.isInteger(value);
}

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function parseSettings(value: unknown): Settings {
  const base = defaultSettings();
  if (!isRecord(value)) return base;
  const textSpeed = TEXT_SPEEDS.includes(value.textSpeed as TextSpeed)
    ? (value.textSpeed as TextSpeed)
    : base.textSpeed;
  const volume = isNumber(value.volume) ? clampVolume(value.volume) : base.volume;
  return { textSpeed, volume };
}

function parseStats(value: unknown): Stats | null {
  if (!isRecord(value)) return null;
  const stats = {} as Record<StatId, number>;
  for (const stat of STAT_IDS) {
    const raw = value[stat];
    if (!isNumber(raw)) return null;
    stats[stat] = raw;
  }
  return stats;
}

function parseMoveSlot(value: unknown): MoveSlot | null {
  if (!isRecord(value)) return null;
  if (!isString(value.moveId) || value.moveId === '') return null;
  if (!isInteger(value.pp) || value.pp < 0) return null;
  if (!isInteger(value.maxPp) || value.maxPp < 0) return null;
  return { moveId: value.moveId, pp: value.pp, maxPp: value.maxPp };
}

function parseFighter(value: unknown): FighterSnapshot | null {
  if (!isRecord(value)) return null;
  if (!isString(value.id) || value.id === '') return null;
  if (!isString(value.speciesId) || value.speciesId === '') return null;
  // A species that the current dex no longer knows would crash `restoreFighter`,
  // so it drops the member here instead (a hand-edited or stale save).
  if (!getSpecies(value.speciesId)) return null;
  if (!isInteger(value.level) || value.level < 1) return null;
  if (!isString(value.nature) || !isString(value.ability)) return null;
  if (!isNumber(value.hp) || value.hp < 0) return null;
  if (!isNumber(value.statusCounter) || value.statusCounter < 0) return null;

  const ivs = parseStats(value.ivs);
  const evs = parseStats(value.evs);
  if (!ivs || !evs) return null;

  if (!Array.isArray(value.moves)) return null;
  const moves: MoveSlot[] = [];
  for (const entry of value.moves) {
    const slot = parseMoveSlot(entry);
    if (!slot) return null;
    moves.push(slot);
  }
  if (moves.length === 0) return null;

  let status: StatusId | null = null;
  if (value.status !== null) {
    if (!isString(value.status) || !STATUS_IDS.includes(value.status as StatusId)) return null;
    status = value.status as StatusId;
  }

  let heldItem: string | null = null;
  if (value.heldItem !== null) {
    if (!isString(value.heldItem)) return null;
    heldItem = value.heldItem;
  }

  const gender = GENDERS.includes(value.gender as Gender) ? (value.gender as Gender) : 'genderless';

  return {
    id: value.id,
    speciesId: value.speciesId,
    level: Math.min(MAX_LEVEL, value.level),
    nature: value.nature,
    ability: value.ability,
    gender,
    heldItem,
    ivs,
    evs,
    moves,
    hp: value.hp,
    status,
    statusCounter: value.statusCounter,
  };
}

function parsePokemon(value: unknown): RunPokemon | null {
  if (!isRecord(value)) return null;
  const fighter = parseFighter(value.fighter);
  if (!fighter) return null;
  if (!isNumber(value.xp) || value.xp < 0) return null;
  return { fighter, xp: value.xp };
}

/** Keeps the members that parse; a malformed one is dropped, not fatal. */
function parseMembers(value: unknown): RunPokemon[] {
  if (!Array.isArray(value)) return [];
  const members: RunPokemon[] = [];
  for (const entry of value) {
    const member = parsePokemon(entry);
    if (member) members.push(member);
  }
  return members;
}

function parseBag(value: unknown): BagCounts[] | null {  if (!Array.isArray(value)) return null;
  const bag: BagCounts[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || !isString(entry.itemId) || entry.itemId === '') return null;
    if (!isInteger(entry.count) || entry.count < 0) return null;
    bag.push({ itemId: entry.itemId, count: entry.count });
  }
  return bag;
}

function parseRunStats(value: unknown): RunStats {
  if (!isRecord(value)) return emptyRunStats();
  const catches = isInteger(value.catches) && value.catches >= 0 ? value.catches : 0;
  const casualties = isInteger(value.casualties) && value.casualties >= 0 ? value.casualties : 0;
  return { catches, casualties };
}

function parseRun(value: unknown): RunState | null {
  if (!isRecord(value)) return null;
  if (!isString(value.seed) || value.seed === '') return null;
  if (value.mode !== 'finite' && value.mode !== 'infinite') return null;
  if (!isInteger(value.routeIndex) || value.routeIndex < 1) return null;

  const party = parseMembers(value.party);
  if (party.length === 0) return null;
  const bag = parseBag(value.bag);
  if (!bag) return null;

  const defeatedTrainers = Array.isArray(value.defeatedTrainers)
    ? value.defeatedTrainers.filter((id): id is string => isString(id))
    : [];

  return {
    seed: value.seed,
    mode: value.mode,
    routeIndex: value.routeIndex,
    levelCap: levelCapForRoute(value.routeIndex),
    party,
    box: parseMembers(value.box),
    bag,
    defeatedTrainers,
    captureUsed: value.captureUsed === true,
    stats: parseRunStats(value.stats),
  };
}
