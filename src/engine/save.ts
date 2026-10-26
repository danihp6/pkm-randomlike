import { STAT_IDS, getMove, getSpecies, type StatId, type Stats } from '../data/dex';
import { defaultHudLayout, parseHudLayout, type HudLayout } from '../data/hudLayout';
import { DEFAULT_KEYBINDS, sanitizeKeybinds, type Keybinds } from '../data/keybinds';
import { levelCapForMap } from '../data/maps';
import { getMission } from '../data/missions';
import { ROOM_BATTLEFIELDS } from '../data/battlefields';
import { isLocale, type Locale } from '../i18n';
import {
  MAP_EDGES,
  arrivalEdgeFor,
  isArrivalEdge,
  planMap,
  type MapEdge,
  type MapPlan,
} from './maps/plan';
import { floorForRoute } from './run/floors';
import type { AiLevel } from './battle/ai';
import { normalizeAbilityId, type FighterSnapshot, type Gender, type MoveSlot, type StatusId } from './battle/fighter';
import type { BagCounts } from './run/battleLink';
import { POKEVIAL_MAX_CHARGES } from './run/heal';
import type { RunHistoryRecord, RunSpeciesRecord } from './run/history';
import type { MissionProgress } from './run/missions';
import { emptyModifiers, type RunModifiers } from './run/modifiers';
import { normalizeNickname } from './run/nickname';
import { MAX_LEVEL, xpForLevel, type CatchLocation, type RunPokemon } from './run/progression';
import { dedupeMemberIds, emptyRunStats, type RunState, type RunStats } from './run/state';

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
 * The whole on-disk document: the settings, the run in progress and the record of
 * the runs that already ended. `run` is null between runs (a fresh boot, or after
 * a loss), so the settings are the one thing that always survives (D5: a lost run
 * carries over nothing); `history` is a record the run-over screen reads, never a
 * save a run is restored from.
 */
export type SaveDocument = Readonly<{
  version: number;
  settings: Settings;
  run: RunState | null;
  /** The last finished runs, newest first (`src/engine/run/history.ts`). */
  history: readonly RunHistoryRecord[];
}>;

/** The minimal slice of the Web Storage API the save needs, so it is testable. */
export type StorageLike = Readonly<{
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}>;

/** The schema version of the current build. Bump it and add a migration in step. */
export const SAVE_VERSION = 25;

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

/** A save with nothing in it: default settings, no run and no finished runs. */
export function emptySave(): SaveDocument {
  return { version: SAVE_VERSION, settings: defaultSettings(), run: null, history: [] };
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
 * the PC-lock state (the floor-scoped list of the members swappable in the entry
 * room), an old run starting unlocked only in its entry room; `11` moves a v11
 * settings onto the v12 schema, which
 * added the four HUD-panel keys (`party`/`bag`/`map`/`box`) and moved `settings`
 * off its old `O` default to `Tab` (the old `O` becomes the PC box key); `12`
 * moves a v12 run onto the v13 schema, which replaced the per-member XP with the
 * squad's single shared bar (recovered as the highest member's XP); `13` moves a
 * v13 run onto the v14 schema, which added the `money` counter (an old run starts
 * with none); `14` moves a v14 run onto the v15 schema, which added the optional
 * per-member `nickname` (a v14 run has none, so it shows species names); `15` moves
 * a v15 run onto the v16 schema, which replaced the floor-scoped PC lock list with
 * the route-scoped rule (an old run's list cannot be re-scoped — the room it was
 * caught in was never stored — so it starts with no pending catch); `16` moves
 * a v16 run onto the v17 schema, which added the `rip` list of the fallen (an old
 * run's dead were never stored, so it starts empty); `17` moves a v17 run onto the
 * v18 schema, which added the `caughtSpecies` record of every successful catch (an
 * old run's catches were never stored, so it starts empty); `18` moves a v18 run
 * onto the v19 schema, which added the floor mission and its three counters (an old
 * run starts with none and a clean floor); `19` moves a v19 run onto the v20 schema,
 * which added the two optional member words a special NPC writes (`taughtMoves`,
 * `secondAbility`), an old run starting with neither because the decoder leaves an
 * absent optional field out (the `14` nickname precedent); `20` moves a v20 run onto
 * the v21 schema, which added the run's `modifiers` record (the exorcist's curse, the
 * weather man's forced sky and the magician's narrowed wild type), an old run
 * starting with the empty record because it never carried one; `21` moves a v21 run
 * onto the v22 schema, which added the optional per-member `battlesUsed` counter, an
 * old run and an old member starting with none because the decoder leaves the absent
 * field out (the `14` nickname precedent); `22` moves a v22 run onto the v23 schema,
 * which added the coloured candy (`Task-103`) — the run's `discoveredCandy` list
 * starts **empty** and the members' optional `statTreats` need no write at all,
 * because the decoder leaves an absent one out, so an old run gets **no treats on
 * any member and an empty discovered set**; `23` moves a v23 document onto the v24
 * schema, which added the **run-history store** (`Task-152`) — an old save never
 * recorded the runs that already ended, so its history starts **empty**; `24` moves
 * a v24 run onto the v25 schema, which added the **dark Pokémon** (`Task-154`) —
 * every member an old run stored starts not-dark, and the decoder drops the `false`
 * on the next write.
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
    run: isRecord(document.run)
      ? { ...document.run, pokevialCharges: POKEVIAL_MAX_CHARGES }
      : document.run,
  }),
  10: (document) => ({
    ...document,
    version: 11,
    run: isRecord(document.run) ? { ...document.run, pcUnlocked: [] } : document.run,
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
  // The floor-scoped PC lock list retires: the room the old list's member was caught
  // in was never stored, so there is no window to reopen and nothing to carry over.
  15: (document) => ({
    ...document,
    version: 16,
    run: isRecord(document.run) ? withoutPcUnlocked(document.run) : document.run,
  }),
  // The RIP list: a v16 run lost members it never recorded, so the list starts
  // empty - the dead of an old save are not reconstructed.
  16: (document) => ({
    ...document,
    version: 17,
    run: isRecord(document.run) ? { rip: [], ...document.run } : document.run,
  }),
  // The caught-species record: a v17 run never stored it, so an old run starts with
  // an empty list - the lines it caught before are not reconstructed.
  17: (document) => ({
    ...document,
    version: 18,
    run: isRecord(document.run) ? { caughtSpecies: [], ...document.run } : document.run,
  }),
  // The floor mission: a v18 run never carried one, so it starts with none, a zero
  // counter and a clean floor; `advanceMap` gives it a mission on the next floor.
  18: (document) => ({
    ...document,
    version: 19,
    run: isRecord(document.run)
      ? { mission: null, missionsCompleted: 0, hpLost: 0, floorCasualties: 0, ...document.run }
      : document.run,
  }),
  // The NPC member edits: both new member words are optional and the decoder defaults
  // an absent one to none, so a v19 run needs no field written here (the `14`
  // nickname precedent).
  19: (document) => ({
    ...document,
    version: 20,
  }),
  // The NPC modifiers: a v20 run never carried one, so the record starts empty and
  // the next exorcist, weather man or magician writes it.
  20: (document) => ({
    ...document,
    version: 21,
    run: isRecord(document.run) ? { ...document.run, modifiers: emptyModifiers() } : document.run,
  }),
  // The per-member usage counter: optional, and the decoder defaults an absent one to
  // none, so a v21 run needs no field written here (the `14` nickname precedent).
  21: (document) => ({
    ...document,
    version: 22,
  }),
  // The coloured candy: the run's discovered set starts empty, and the members'
  // optional treats need no write (the `14` nickname precedent).
  22: (document) => ({
    ...document,
    version: 23,
    run: isRecord(document.run) ? { ...document.run, discoveredCandy: [] } : document.run,
  }),
  // The run history: an old save has no record of the runs that already ended,
  // so the store starts empty and only the next finished run fills it.
  23: (document) => ({
    ...document,
    version: 24,
    history: [],
  }),
  // The dark Pokémon (`Task-154`): a v24 run predates the flag, so every stored
  // member starts not-dark; the decoder drops the `false` on the next write.
  24: (document) => ({
    ...document,
    version: 25,
    run: isRecord(document.run) ? withDarkFlag(document.run) : document.run,
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
 * Drops a v15 run's floor-scoped PC lock list: the room a member of it was caught
 * in was never stored, so there is no window to reopen and no field to write.
 */
function withoutPcUnlocked(run: Record<string, unknown>): Record<string, unknown> {
  const next = { ...run };
  delete next.pcUnlocked;
  return next;
}

/** Writes `dark: false` on every member a v24 run stored (party, box and rip). */
function withDarkFlag(run: Record<string, unknown>): Record<string, unknown> {
  const mark = (list: unknown): unknown =>
    Array.isArray(list)
      ? list.map((entry) => (isRecord(entry) ? { dark: false, ...entry } : entry))
      : list;
  return { ...run, party: mark(run.party), box: mark(run.box), rip: mark(run.rip) };
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
    history: document.history,
  });
}

/**
 * Reads a document from JSON: migrates it to the current schema, validates it
 * and falls back to defaults, field by field. It never throws, because a save
 * is user-editable and may be truncated mid-write. A document from a *newer*
 * build keeps its settings but drops the run, since we cannot read it.
 */
export function decodeSave(raw: string | null, migrations: Migrations = SAVE_MIGRATIONS): SaveDocument {
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
  // The run and the history are only read from a document this build actually
  // understands, so a newer build's shapes never reach the run-over screen.
  const source = document ?? parsed;
  return {
    version: SAVE_VERSION,
    settings: parseSettings(source.settings),
    run: document ? parseRun(document.run) : null,
    history: document ? parseHistory(document.history) : [],
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
  const reducedFlash = typeof value.reducedFlash === 'boolean' ? value.reducedFlash : base.reducedFlash;
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
  const statTreats = parseStatTreats(value.statTreats);
  // A second ability is optional additive data (`Task-153`): a non-empty string
  // whose normalised id differs from the primary survives, anything else drops
  // the field and stays tolerant — never the member.
  const secondAbility = typeof value.secondAbility === 'string' ? value.secondAbility.trim() : '';

  return {
    id: value.id,
    speciesId: value.speciesId,
    ...(nickname ? { nickname } : {}),
    level: Math.min(MAX_LEVEL, value.level),
    nature: value.nature,
    ability: value.ability,
    ...(secondAbility !== '' && normalizeAbilityId(secondAbility) !== normalizeAbilityId(value.ability)
      ? { secondAbility }
      : {}),
    gender,
    shiny,
    heldItem,
    ivs,
    evs,
    moves,
    hp: value.hp,
    status,
    statusCounter: value.statusCounter,
    ...(statTreats ? { statTreats } : {}),
  };
}

/**
 * Reads a member's permanent stat treats (`Task-103`): only a known `StatId` key
 * with a non-zero integer value survives, a key that reaches 0 is dropped, and an
 * empty or malformed record reads as none — so a pre-Task-103 document and a
 * hand-edited one both decode to no treats.
 */
function parseStatTreats(value: unknown): Readonly<Partial<Record<StatId, number>>> | null {
  if (!isRecord(value)) return null;
  const treats: Partial<Record<StatId, number>> = {};
  let treated = false;
  for (const stat of STAT_IDS) {
    const raw = value[stat];
    if (!isInteger(raw) || raw === 0) continue;
    treats[stat] = raw;
    treated = true;
  }
  return treated ? treats : null;
}

/**
 * Reads the candy colours the run has tried (`Task-103`): every non-empty string,
 * deduped, in the order the run tried them. A colour the catalogue no longer
 * carries is harmless: only a catalogue row can start a use.
 */
function parseCandyColours(value: unknown): string[] {
  const colours: string[] = [];
  if (!Array.isArray(value)) return colours;
  for (const colour of value) {
    if (isString(colour) && colour !== '' && !colours.includes(colour)) colours.push(colour);
  }
  return colours;
}

/**
 * Reads the moves a tutor taught a member: the ids `getMove` resolves, deduped, in
 * order. An absent or malformed value reads as none, so an old run and a
 * hand-edited document both start with an empty band.
 */
function parseTaughtMoves(value: unknown): string[] {
  const moves: string[] = [];
  if (!Array.isArray(value)) return moves;
  for (const id of value) {
    if (!isString(id) || id === '') continue;
    const move = getMove(id);
    if (!move || moves.includes(move.id)) continue;
    moves.push(move.id);
  }
  return moves;
}

function parsePokemon(value: unknown): RunPokemon | null {
  if (!isRecord(value)) return null;
  const fighter = parseFighter(value.fighter);
  if (!fighter) return null;
  const caughtAt = parseCatchLocation(value.caughtAt);
  const taughtMoves = parseTaughtMoves(value.taughtMoves);
  const secondAbility =
    isString(value.secondAbility) && value.secondAbility !== '' ? value.secondAbility : null;
  // The usage counter is written only when it carries something, so a save round trip
  // stays byte-stable and a v21 document decodes to none.
  const battlesUsed =
    isInteger(value.battlesUsed) && value.battlesUsed > 0 ? value.battlesUsed : null;
  // Each optional word is written only when it carries something, so a v21 round trip
  // stays byte-stable and a v20 document decodes to none. The dark mark (`Task-154`)
  // is only ever written when true, the `shiny` precedent.
  return {
    fighter,
    ...(caughtAt ? { caughtAt } : {}),
    ...(taughtMoves.length > 0 ? { taughtMoves } : {}),
    ...(secondAbility !== null ? { secondAbility } : {}),
    ...(battlesUsed !== null ? { battlesUsed } : {}),
    ...(value.dark === true ? { dark: true } : {}),
  };
}

/**
 * Reads the floor's mission: a row id the table still carries, a non-negative
 * integer progress and a boolean completed. Anything else reads as no mission, so a
 * hand-edited document cannot hang the HUD on a row that does not exist.
 */
function parseMission(value: unknown): MissionProgress | null {
  if (!isRecord(value)) return null;
  if (!isString(value.id) || getMission(value.id) === undefined) return null;
  if (!isInteger(value.progress) || value.progress < 0) return null;
  if (typeof value.completed !== 'boolean') return null;
  return { id: value.id, progress: value.progress, completed: value.completed };
}

/**
 * Reads the run's NPC modifiers. `curse` only when it is exactly `true`; `nextWildType`
 * only when it is a non-empty string; a `forcedField` only when its `id` names a
 * `ROOM_BATTLEFIELDS` row and its `floorsLeft` is an integer of at least one (the
 * `parseMission` precedent: a row the table no longer carries is dropped). Anything
 * else reads as the empty record, so a hand-edited document cannot start a battle
 * under a condition the table does not know.
 */
function parseModifiers(value: unknown): RunModifiers {
  if (!isRecord(value)) return emptyModifiers();
  const curse = value.curse === true;
  const forcedField = parseForcedField(value.forcedField);
  const nextWildType =
    isString(value.nextWildType) && value.nextWildType !== '' ? value.nextWildType : null;
  return { curse, forcedField, nextWildType };
}

function parseForcedField(value: unknown): RunModifiers['forcedField'] {
  if (!isRecord(value)) return null;
  if (!isString(value.id) || value.id === '') return null;
  if (!isInteger(value.floorsLeft) || value.floorsLeft < 1) return null;
  if (!ROOM_BATTLEFIELDS.some((row) => row.id === value.id)) return null;
  return { id: value.id, floorsLeft: value.floorsLeft };
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

function parseBag(value: unknown): BagCounts[] | null {
  if (!Array.isArray(value)) return null;
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
 * Keeps the non-empty species ids of the caught record, deduped, in the order the
 * run caught them first.
 */
function parseCaughtSpecies(value: unknown): string[] {
  const species: string[] = [];
  if (Array.isArray(value)) {
    for (const id of value) {
      if (isString(id) && id !== '' && !species.includes(id)) species.push(id);
    }
  }
  return species;
}

/**
 * Reads the floor's spent-capture rooms. A v8 document carried the single
 * `captureUsed` boolean instead, so a truthy one maps onto the room it stood in.
 */
function parseCapturedRooms(value: unknown, legacyCaptureUsed: unknown, currentRoom: number): number[] {
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

  const caughtSpecies = parseCaughtSpecies(value.caughtSpecies);
  const discoveredCandy = parseCandyColours(value.discoveredCandy);

  const pickedItems = Array.isArray(value.pickedItems)
    ? value.pickedItems.filter((id): id is string => isString(id))
    : [];

  const capturedRooms = parseCapturedRooms(value.capturedRooms, value.captureUsed, routeInMap);

  // The retired PC-lock fields (`Task-179`) read as nothing: a document that still
  // carries them decodes exactly like one that does not, and neither is written back.

  const pokevialCharges = isInteger(value.pokevialCharges)
    ? Math.max(0, Math.min(POKEVIAL_MAX_CHARGES, value.pokevialCharges))
    : POKEVIAL_MAX_CHARGES;

  // The shared bar: kept from the save when present, else recovered from the
  // highest member level so a hand-edited document never starts the squad lower
  // than the party it carries.
  const xp = isNumber(value.xp) && value.xp >= 0 ? value.xp : highestMemberXp(value);

  const money = isInteger(value.money) && value.money >= 0 ? value.money : 0;

  const stats = parseRunStats(value.stats);
  const missionsCompleted =
    isInteger(value.missionsCompleted) && value.missionsCompleted >= 0 ? value.missionsCompleted : 0;
  const hpLost = isInteger(value.hpLost) && value.hpLost >= 0 ? value.hpLost : 0;
  // Clamped to the run's own casualty count, so a hand-edited document cannot make a
  // floor look casualty-free.
  const floorCasualties = Math.min(
    isInteger(value.floorCasualties) && value.floorCasualties >= 0 ? value.floorCasualties : 0,
    stats.casualties,
  );

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
    levelCap: levelCapForMap(mapIndex),
    pokevialCharges,
    xp,
    party,
    box,
    rip: parseMembers(value.rip),
    bag,
    money,
    defeatedTrainers,
    caughtSpecies,
    discoveredCandy,
    pickedItems,
    capturedRooms,
    mission: parseMission(value.mission),
    missionsCompleted,
    hpLost,
    floorCasualties,
    modifiers: parseModifiers(value.modifiers),
    stats,
  });
}

/**
 * Reads the run-history store (`Task-152`): the last finished runs, newest first.
 * A non-array reads as the empty store, and a row that is not a record with every
 * required primitive field is **dropped**, never repaired — the store is the
 * record of what happened, so a half-read row would draw a lie — while the rest
 * of the document, and the run in progress, survive untouched (`run` never
 * depends on this field).
 */
function parseHistory(value: unknown): readonly RunHistoryRecord[] {
  const history: RunHistoryRecord[] = [];
  if (!Array.isArray(value)) return history;
  for (const entry of value) {
    const record = parseHistoryRecord(entry);
    if (record) history.push(record);
  }
  return history;
}

function parseHistoryRecord(value: unknown): RunHistoryRecord | null {
  if (!isRecord(value)) return null;
  if (!isString(value.seed) || value.seed === '') return null;
  if (value.mode !== 'finite' && value.mode !== 'infinite') return null;
  if (!isInteger(value.mapReached) || value.mapReached < 0) return null;
  if (!isInteger(value.catches) || value.catches < 0) return null;
  if (!isInteger(value.casualties) || value.casualties < 0) return null;
  if (!isNumber(value.playtimeMs) || value.playtimeMs < 0) return null;
  if (typeof value.won !== 'boolean') return null;
  if (!isString(value.endedAt) || value.endedAt === '') return null;
  return {
    seed: value.seed,
    mode: value.mode,
    mapReached: value.mapReached,
    catches: value.catches,
    casualties: value.casualties,
    playtimeMs: value.playtimeMs,
    won: value.won,
    endedAt: value.endedAt,
    // A record's species rows are a summary: a malformed list costs the rows it
    // cannot read, never the run (`species: []` is a legal record).
    species: parseSpeciesRecords(value.species),
  };
}

function parseSpeciesRecords(value: unknown): readonly RunSpeciesRecord[] {
  const rows: RunSpeciesRecord[] = [];
  if (!Array.isArray(value)) return rows;
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    if (!isString(entry.speciesId) || entry.speciesId === '') continue;
    if (!isInteger(entry.kos) || entry.kos < 0) continue;
    if (!isNumber(entry.damage) || entry.damage < 0) continue;
    rows.push({ speciesId: entry.speciesId, kos: entry.kos, damage: entry.damage });
  }
  return rows;
}
