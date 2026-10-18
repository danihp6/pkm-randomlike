import { STAT_IDS, getSpecies, type StatId, type Stats } from '../data/dex';
import { defaultHudLayout, parseHudLayout, type HudLayout } from '../data/hudLayout';
import { DEFAULT_KEYBINDS, sanitizeKeybinds, type Keybinds } from '../data/keybinds';
import { levelCapForMap } from '../data/maps';
import { isLocale, type Locale } from '../i18n';
import { MAP_EDGES, arrivalEdgeFor, isArrivalEdge, planMap, type MapEdge, type MapPlan } from './maps/plan';
import { floorForRoute } from './run/floors';
import type { AiLevel } from './battle/ai';
import type { FighterSnapshot, Gender, MoveSlot, StatusId } from './battle/fighter';
import type { BagCounts } from './run/battleLink';
import { POKEVIAL_MAX_CHARGES } from './run/heal';
import { normalizeNickname } from './run/nickname';
import { MAX_LEVEL, xpForLevel, type CatchLocation, type RunPokemon } from './run/progression';
import { dedupeMemberIds, emptyRunStats, type PcCatch, type RunState, type RunStats } from './run/state';

/** How fast the message box types text (consumed by the settings screen). */
export type TextSpeed = 'slow' | 'normal' | 'fast';

export type { AiLevel };

/** Player preferences that outlive a run. */
export type Settings = Readonly<{
  textSpeed: TextSpeed;
  /** Master volume, 0..1. */
  volume: number;
  /** Walk at running speed without holding the run key. */
  alwaysRun: boolean;
  /** Draw the route HUD panels without their window background (content only). */
  hudTransparent: boolean;
  /** Where the route HUD's panels sit and whether they are collapsed. */
  hudLayout: HudLayout;
  /** Which key presses confirm, cancel, move, open the party and open settings. */
  keybinds: Keybinds;
  /** New: drop or shorten the full-screen flashes a beat would play. */
  reducedFlash: boolean;
  /** How well the enemies fight (`D46`). */
  aiLevel: AiLevel;
  /** The language the game's text is drawn in (`D43`). */
  language: Locale;
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
export const SAVE_VERSION = 16;

/** The storage key. It carries no version: the version lives inside the JSON. */
export const SAVE_KEY = 'pokerandomlike.save';

export const DEFAULT_TEXT_SPEED: TextSpeed = 'normal';
export const DEFAULT_VOLUME = 0.8;
export const DEFAULT_ALWAYS_RUN = true;
export const DEFAULT_HUD_TRANSPARENT = false;
/**
 * The accessibility knob. Off is the shipped look, on drops or shortens every
 * full-screen flash a beat would play (`docs/design-spec.md` §10).
 */
export const DEFAULT_REDUCED_FLASH = false;
/**
 * The difficulty the enemies think at (`D46`). `normal` is the shipped game: a
 * wild picks a random move and a trainer thinks with its archetype's own flags.
 */
export const DEFAULT_AI_LEVEL: AiLevel = 'normal';
/**
 * The shipped language: the source table. The setting is defaulted from the
 * browser once, in `src/settings.ts`, and stored from there (`D43`).
 */
export const DEFAULT_LANGUAGE: Locale = 'en';

export function defaultSettings(): Settings {
  return {
    textSpeed: DEFAULT_TEXT_SPEED,
    volume: DEFAULT_VOLUME,
    alwaysRun: DEFAULT_ALWAYS_RUN,
    hudTransparent: DEFAULT_HUD_TRANSPARENT,
    hudLayout: defaultHudLayout(),
    keybinds: DEFAULT_KEYBINDS,
    reducedFlash: DEFAULT_REDUCED_FLASH,
    aiLevel: DEFAULT_AI_LEVEL,
    language: DEFAULT_LANGUAGE,
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
 * real door); `8` moves a v8 run onto the v9 schema, which turned the per-route
 * `captureUsed` boolean into the per-floor `capturedRooms` list; `9` moves a v9
 * run onto the v10 schema, which added the `pokevialCharges` counter (an old run
 * starts with a full vial); `10` moves a v10 run onto the v11 schema, which added
 * the PC-lock state (`entryDeparted`, `pcUnlocked`), an old run starting unlocked
 * only in its entry room; `11` moves a v11 settings onto the v12 schema, which
 * added the four HUD-panel keys (`party`/`bag`/`map`/`box`) and moved `settings`
 * off its old `O` default to `Tab` (the old `O` becomes the PC box key); `12`
 * moves a v12 run onto the v13 schema, which replaced the per-member XP with the
 * squad's single shared bar (recovered as the highest member's XP); `13` moves a
 * v13 run onto the v14 schema, which added the `money` counter (an old run starts
 * with none); `14` moves a v14 run onto the v15 schema, which added the optional
 * per-member `nickname` (a v14 run has none, so it shows species names); `15` moves
 * a v15 run onto the v16 schema, which replaced the floor-scoped `pcUnlocked` list
 * with the route-scoped `pcCatch` (an old run's list cannot be re-scoped — the room
 * it was caught in was never stored — so it starts with no pending catch).
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
  8: (document) => ({
    ...document,
    version: 9,
    run: isRecord(document.run) ? withCapturedRooms(document.run) : document.run,
  }),
  9: (document) => ({
    ...document,
    version: 10,
    run: isRecord(document.run) ? { ...document.run, pokevialCharges: POKEVIAL_MAX_CHARGES } : document.run,
  }),
  10: (document) => ({
    ...document,
    version: 11,
    run: isRecord(document.run)
      ? { ...document.run, entryDeparted: false, pcUnlocked: [] }
      : document.run,
  }),
  11: (document) => ({
    ...document,
    version: 12,
    // `sanitizeKeybinds` fills the four new panel actions from their defaults and,
    // because they are listed before `settings`, hands the old `O` to `box` while
    // `settings` falls back to `Tab`.
    settings: isRecord(document.settings)
      ? { ...document.settings, keybinds: sanitizeKeybinds(document.settings.keybinds) }
      : document.settings,
  }),
  12: (document) => ({
    ...document,
    version: 13,
    // The shared bar starts at the highest member's XP, so an old run keeps the
    // level of its best Pokémon and everyone else catches up from there.
    run: isRecord(document.run) ? { ...document.run, xp: highestMemberXp(document.run) } : document.run,
  }),
  13: (document) => ({
    ...document,
    version: 14,
    // The Poké Dollar economy: an old run has not beaten a trainer for money yet.
    run: isRecord(document.run) ? { money: 0, ...document.run } : document.run,
  }),
  // The nickname: a v14 run has none. The field is optional and the decoder leaves it
  // out, so an old run simply shows species names - nothing to add here.
  14: (document) => ({
    ...document,
    version: 15,
  }),
  // The floor-scoped catch list becomes the route-scoped catch: the room the old
  // list's member was caught in was never stored, so the new field starts empty.
  15: (document) => ({
    ...document,
    version: 16,
    run: isRecord(document.run) ? withPcCatch(document.run) : document.run,
  }),
};

/**
 * The `language` field added beside `alwaysRun` (`D43`) opens no step: it is read
 * per field in `parseSettings` (`isLocale(value.language) ? … : base.language`),
 * so a document written before it reads the source table. The schema version
 * stays 16, the `D22`/`D45`/`D46` precedent.
 */

/** The highest XP any member of a v12 run carried, or a level-1 bar. */
function highestMemberXp(run: Record<string, unknown>): number {
  let xp = 0;
  for (const list of [run.party, run.box]) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (!isRecord(entry)) continue;
      const memberXp = isNumber(entry.xp) && entry.xp >= 0 ? entry.xp : 0;
      const fighter = isRecord(entry.fighter) ? entry.fighter : {};
      const level = isInteger(fighter.level) && fighter.level >= 1 ? fighter.level : 1;
      xp = Math.max(xp, Math.max(memberXp, xpForLevel(level)));
    }
  }
  return xp > 0 ? xp : xpForLevel(1);
}

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
 * Turns a v8 run's per-route `captureUsed` boolean into the v9 `capturedRooms`
 * list: the room it stood in if the capture was spent, no room otherwise.
 */
function withCapturedRooms(run: Record<string, unknown>): Record<string, unknown> {
  if (!isInteger(run.routeInMap) || run.routeInMap < 0) return run;
  return { ...run, capturedRooms: run.captureUsed === true ? [run.routeInMap] : [] };
}

/**
 * Drops a v15 run's floor-scoped `pcUnlocked` list and writes the v16 `pcCatch`
 * field: the room a member of the old list was caught in was never stored, so
 * there is no window to reopen and the field starts null.
 */
function withPcCatch(run: Record<string, unknown>): Record<string, unknown> {
  const next = { ...run };
  delete next.pcUnlocked;
  next.pcCatch = null;
  return next;
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

/**
 * Reads the save slot; storage failures are a fresh save, never a crash.
 */
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

/**
 * The language the stored document carries, or null when the slot is empty, the
 * JSON is unreadable or the field is absent — never throws, so a blocked store
 * reads as "not chosen". It exists so the browser layer can tell "the player
 * chose `en`" from "nothing was ever chosen", which the decoded settings cannot
 * (`D43`).
 */
export function storedSettingsLanguage(storage: StorageLike | null): Locale | null {
  if (!storage) return null;
  let raw: string | null = null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || !isRecord(parsed.settings)) return null;
  const language = parsed.settings.language;
  return isLocale(language) ? language : null;
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
  const alwaysRun = typeof value.alwaysRun === 'boolean' ? value.alwaysRun : base.alwaysRun;
  const hudTransparent =
    typeof value.hudTransparent === 'boolean' ? value.hudTransparent : base.hudTransparent;
  const hudLayout = parseHudLayout(value.hudLayout);
  const keybinds = sanitizeKeybinds(value.keybinds);
  const reducedFlash =
    typeof value.reducedFlash === 'boolean' ? value.reducedFlash : base.reducedFlash;
  const aiLevel = value.aiLevel === 'hard' ? 'hard' : base.aiLevel;
  const language = isLocale(value.language) ? value.language : base.language;
  return {
    textSpeed,
    volume,
    alwaysRun,
    hudTransparent,
    hudLayout,
    keybinds,
    reducedFlash,
    aiLevel,
    language,
  };
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
  // A malformed nickname (a number, or text the sanitiser empties) drops the field,
  // never the member; a v14 document simply has none.
  const nickname = typeof value.nickname === 'string' ? normalizeNickname(value.nickname) : null;

  return {
    id: value.id,
    speciesId: value.speciesId,
    ...(nickname ? { nickname } : {}),
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
  const caughtAt = parseCatchLocation(value.caughtAt);
  return caughtAt ? { fighter, caughtAt } : { fighter };
}

/**
 * Reads the route's own catch: the room it was caught in and the member it is. A
 * malformed field (a bad room id or an empty member id) reads as no catch, so a
 * hand-edited or truncated document cannot strand the run.
 */
function parsePcCatch(value: unknown): PcCatch | null {
  if (!isRecord(value)) return null;
  if (!isInteger(value.roomInMap) || value.roomInMap < 0) return null;
  if (!isString(value.memberId) || value.memberId === '') return null;
  return { roomInMap: value.roomInMap, memberId: value.memberId };
}

/** Reads a caught member's location; anything malformed drops the field, not the member. */
function parseCatchLocation(value: unknown): CatchLocation | null {
  if (!isRecord(value)) return null;
  if (!isString(value.biomeId) || value.biomeId === '') return null;
  if (!isInteger(value.mapIndex) || value.mapIndex < 1) return null;
  if (!isInteger(value.routeInMap) || value.routeInMap < 0) return null;
  return { biomeId: value.biomeId, mapIndex: value.mapIndex, routeInMap: value.routeInMap };
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

/**
 * Reads the floor's spent-capture rooms. A v8 document carried the single
 * `captureUsed` boolean instead, so a truthy one maps onto the room it stood in.
 */
function parseCapturedRooms(
  value: unknown,
  legacyCaptureUsed: unknown,
  currentRoom: number,
): number[] {
  const rooms: number[] = [];
  if (Array.isArray(value)) {
    for (const id of value) {
      if (isInteger(id) && id >= 0 && !rooms.includes(id)) rooms.push(id);
    }
  }
  if (rooms.length === 0 && legacyCaptureUsed === true) rooms.push(currentRoom);
  return rooms;
}

function parseRun(value: unknown): RunState | null {
  if (!isRecord(value)) return null;
  if (!isString(value.seed) || value.seed === '') return null;
  if (value.mode !== 'finite' && value.mode !== 'infinite') return null;
  if (!isInteger(value.routeIndex) || value.routeIndex < 1) return null;

  const party = parseMembers(value.party);
  if (party.length === 0) return null;
  const box = parseMembers(value.box);
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

  const capturedRooms = parseCapturedRooms(value.capturedRooms, value.captureUsed, routeInMap);

  // The PC lock: a run away from the entry room has necessarily left it, so an
  // old save without the flag reads as departed; the route's own catch defaults
  // to none (nothing is swappable beyond the entry room's first visit).
  const entryDeparted = value.entryDeparted === true || routeInMap !== plan.entryRoom;
  // A v15 document's floor-scoped `pcUnlocked` list is ignored: it cannot be
  // re-scoped onto a room, so the catch window opens empty.
  const pcCatch = parsePcCatch(value.pcCatch);

  const pokevialCharges = isInteger(value.pokevialCharges)
    ? Math.max(0, Math.min(POKEVIAL_MAX_CHARGES, value.pokevialCharges))
    : POKEVIAL_MAX_CHARGES;

  // The shared bar: kept from the save when present, else recovered from the
  // highest member level so a hand-edited document never starts the squad lower
  // than the party it carries.
  const xp = isNumber(value.xp) && value.xp >= 0 ? value.xp : highestMemberXp(value);

  const money = isInteger(value.money) && value.money >= 0 ? value.money : 0;

  // A save written while member ids could collide (`grass:x,y` encounters all
  // entered the run as `wild`) is repaired here, so every later by-id lookup has
  // one member to find.
  return dedupeMemberIds({
    seed: value.seed,
    mode: value.mode,
    routeIndex: value.routeIndex,
    mapIndex,
    routeInMap,
    arrivalEdge,
    discoveredRooms,
    bossDefeated: value.bossDefeated === true,
    entryDeparted,
    pcCatch,
    levelCap: levelCapForMap(mapIndex),
    pokevialCharges,
    xp,
    party,
    box,
    bag,
    money,
    defeatedTrainers,
    pickedItems,
    capturedRooms,
    stats: parseRunStats(value.stats),
  });
}
