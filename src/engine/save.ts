import { STAT_IDS, getSpecies, type StatId, type Stats } from '../data/dex';
import { defaultHudLayout, parseHudLayout, type HudLayout } from '../data/hudLayout';
import { DEFAULT_KEYBINDS, sanitizeKeybinds, type Keybinds } from '../data/keybinds';
import { levelCapForMap } from '../data/maps';
import { MAP_EDGES, arrivalEdgeFor, isArrivalEdge, planMap, type MapEdge, type MapPlan } from './maps/plan';
import { floorForRoute } from './run/floors';
import { isTilesetPreference, type TilesetPreference } from '../data/tilesets/ids';
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
  /** Which tileset every route renders with: `auto` is the biome's own (D10). */
  tileset: TilesetPreference;
  /** Walk at running speed without holding the run key. */
  alwaysRun: boolean;
  /** Where the route HUD's panels sit and whether they are collapsed. */
  hudLayout: HudLayout;
  /** Which key presses confirm, cancel, move, open the party and open settings. */
  keybinds: Keybinds;
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
export const SAVE_VERSION = 8;

/** The storage key. It carries no version: the version lives inside the JSON. */
export const SAVE_KEY = 'pokerandomlike.save';

export const DEFAULT_TEXT_SPEED: TextSpeed = 'normal';
export const DEFAULT_VOLUME = 0.8;
export const DEFAULT_TILESET: TilesetPreference = 'auto';
export const DEFAULT_ALWAYS_RUN = true;

export function defaultSettings(): Settings {
  return {
    textSpeed: DEFAULT_TEXT_SPEED,
    volume: DEFAULT_VOLUME,
    tileset: DEFAULT_TILESET,
    alwaysRun: DEFAULT_ALWAYS_RUN,
    hudLayout: defaultHudLayout(),
    keybinds: DEFAULT_KEYBINDS,
  };
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
 * onto the v2 schema, which added the run summary counters; `2` moves a v2
 * document onto the v3 schema, which added the tileset preference; `3` moves a
 * v3 document onto the v4 schema, which added the keybinds; `4` moves a v4
 * document onto the v5 schema, whose defaults switched confirm/cancel to
 * `E`/`Q` (a field that can also be defaulted, so it is reset rather than
 * required); `5` moves a v5 run onto the v6 schema, which added the map position
 * (`mapIndex`, `routeInMap`) and the discovery set, recovered from the global
 * `routeIndex`; `6` moves a v6 run onto the v7 schema, which added the per-map
 * `bossDefeated` flag; `7` moves a v7 run onto the v8 schema, which added the
 * room's `arrivalEdge` (recovered from the plan, so an old run still spawns at a
 * real door). Later changes add the next step, e.g.
 * `8: (doc) => ({ ...doc, version: 9, changed })`.
 */
export const SAVE_MIGRATIONS: Migrations = {
  1: (document) => ({
    ...document,
    version: 2,
    run: isRecord(document.run)
      ? { ...document.run, stats: { catches: 0, casualties: 0 } }
      : document.run,
  }),
  2: (document) => ({
    ...document,
    version: 3,
    settings: isRecord(document.settings)
      ? { ...document.settings, tileset: DEFAULT_TILESET }
      : document.settings,
  }),
  3: (document) => ({
    ...document,
    version: 4,
    settings: isRecord(document.settings)
      ? { ...document.settings, keybinds: DEFAULT_KEYBINDS }
      : document.settings,
  }),
  4: (document) => ({
    ...document,
    version: 5,
    settings: isRecord(document.settings)
      ? { ...document.settings, keybinds: DEFAULT_KEYBINDS }
      : document.settings,
  }),
  5: (document) => ({
    ...document,
    version: 6,
    run: isRecord(document.run) ? withFloorState(document.run) : document.run,
  }),
  6: (document) => ({
    ...document,
    version: 7,
    run: isRecord(document.run) ? { bossDefeated: false, ...document.run } : document.run,
  }),
  7: (document) => ({
    ...document,
    version: 8,
    run: isRecord(document.run) ? withArrivalEdge(document.run) : document.run,
  }),
};

/**
 * Adds the arrival edge a v7 run lacks: the door `arrivalEdgeFor` derives for the
 * room it stands in, so an old run still spawns at a real door of that room.
 */
function withArrivalEdge(run: Record<string, unknown>): Record<string, unknown> {
  if (!isString(run.seed) || !isInteger(run.mapIndex) || run.mapIndex < 1) return run;
  if (!isInteger(run.routeInMap) || run.routeInMap < 0) return run;
  const plan = planMap(run.seed, run.mapIndex);
  if (run.routeInMap >= plan.rooms.length) return run;
  return { ...run, arrivalEdge: arrivalEdgeFor(plan, run.routeInMap) };
}

/**
 * Adds the map-position fields a v5 run lacks: the floor and room its global
 * `routeIndex` resolves to through the plan chain, and every room up to it as
 * discovered (the old run walked the chain linearly, so it had entered them all).
 */
function withFloorState(run: Record<string, unknown>): Record<string, unknown> {
  if (!isString(run.seed) || !isInteger(run.routeIndex) || run.routeIndex < 1) return run;
  const position = floorForRoute(run.seed, run.routeIndex);
  return {
    ...run,
    mapIndex: position.mapIndex,
    routeInMap: position.roomInMap,
    discoveredRooms: Array.from({ length: position.roomInMap + 1 }, (_, id) => id),
  };
}

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
  const tileset = isTilesetPreference(value.tileset) ? value.tileset : base.tileset;
  const alwaysRun = typeof value.alwaysRun === 'boolean' ? value.alwaysRun : base.alwaysRun;
  const hudLayout = parseHudLayout(value.hudLayout);
  const keybinds = sanitizeKeybinds(value.keybinds);
  return { textSpeed, volume, tileset, alwaysRun, hudLayout, keybinds };
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
  const shiny = value.shiny === true;

  return {
    id: value.id,
    speciesId: value.speciesId,
    level: Math.min(MAX_LEVEL, value.level),
    nature: value.nature,
    ability: value.ability,
    gender,
    shiny,
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

/** Keeps the non-negative integer room ids, deduped, and always includes the current room. */
function parseDiscoveredRooms(value: unknown, currentRoom: number): number[] {
  const rooms: number[] = [];
  if (Array.isArray(value)) {
    for (const id of value) {
      if (isInteger(id) && id >= 0 && !rooms.includes(id)) rooms.push(id);
    }
  }
  if (!rooms.includes(currentRoom)) rooms.push(currentRoom);
  return rooms;
}

/**
 * Reads a run's arrival edge: a known edge that is a real door of the room, else
 * the plan-derived arrival, so a hand-edited document cannot spawn the player on a
 * wall.
 */
function readArrivalEdge(value: unknown, plan: MapPlan, roomId: number): MapEdge {
  const edge = MAP_EDGES.find((candidate) => candidate === value);
  return edge && isArrivalEdge(plan, roomId, edge) ? edge : arrivalEdgeFor(plan, roomId);
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

  // The map position and the discovery set are recomputed from the global route
  // index when the save lacks them, so a hand-edited document cannot strand the
  // run between floors or hide the room it stands in.
  const position = floorForRoute(value.seed, value.routeIndex);
  const mapIndex = isInteger(value.mapIndex) && value.mapIndex >= 1 ? value.mapIndex : position.mapIndex;
  const plan = planMap(value.seed, mapIndex);
  const rawRoom =
    isInteger(value.routeInMap) && value.routeInMap >= 0 ? value.routeInMap : position.roomInMap;
  // Clamp into the plan so a hand-edited save cannot point at a room that does
  // not exist (`RoomView` would throw building it).
  const routeInMap = Math.min(rawRoom, plan.rooms.length - 1);
  const discoveredRooms = parseDiscoveredRooms(value.discoveredRooms, routeInMap);
  const arrivalEdge = readArrivalEdge(value.arrivalEdge, plan, routeInMap);

  const defeatedTrainers = Array.isArray(value.defeatedTrainers)
    ? value.defeatedTrainers.filter((id): id is string => isString(id))
    : [];

  const pickedItems = Array.isArray(value.pickedItems)
    ? value.pickedItems.filter((id): id is string => isString(id))
    : [];

  return {
    seed: value.seed,
    mode: value.mode,
    routeIndex: value.routeIndex,
    mapIndex,
    routeInMap,
    arrivalEdge,
    discoveredRooms,
    bossDefeated: value.bossDefeated === true,
    levelCap: levelCapForMap(mapIndex),
    party,
    box: parseMembers(value.box),
    bag,
    defeatedTrainers,
    pickedItems,
    captureUsed: value.captureUsed === true,
    stats: parseRunStats(value.stats),
  };
}
