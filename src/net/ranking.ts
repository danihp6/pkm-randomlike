import type { RunHistoryRecord } from '../engine/run/history';
import type { RunMode } from '../engine/run/state';
import type { StorageLike } from '../engine/save';

/**
 * The monthly ranking's client (`D56`): the finished run's payload and its clamps,
 * the rotating device id that keeps it anonymous, and the endpoint's two calls.
 *
 * It is plain TypeScript — no Phaser, no scene and no `window` read — so every
 * function is headless and the `fetch` is injectable. Nothing here throws into a
 * caller: a missing endpoint, an offline browser or a malformed answer all read as
 * `null`/`false`, because a finished run must never meet an error dialog.
 */

/** Where the built site discovers its endpoint: a small file the deploy writes. */
export const RANKING_CONFIG_URL = 'ranking.json';
/** The clamps the client applies **and** the Lambda re-applies. Keep both pairs equal. */
export const RANKING_MAX_MAP_REACHED = 99;
export const RANKING_MAX_PLAYTIME_MS = 86_400_000;
/** The board's own size, one row per player of the month. */
export const RANKING_TOP_N = 10;
/** The storage key the rotating device id lives under (never inside the save document). */
export const RANKING_DEVICE_KEY = 'pokerandomlike.ranking.device';

/** The six species of a run the payload carries; the record's list is sorted by id. */
const PAYLOAD_SPECIES = 6;
/** The four draws the rotating id's twelve hex digits are minted from. */
const DEVICE_ID_PARTS = 4;
const DEVICE_ID_PATTERN = /^[A-Za-z0-9-]{8,40}$/;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const HTTP_URL_PATTERN = /^https?:\/\/\S+$/i;

export type RankingEntry = Readonly<{
  seed: string;
  mode: RunMode;
  mapReached: number;
  won: boolean;
  playtimeMs: number;
  species: readonly string[];
  deviceId: string;
}>;

/** One player's month, as the endpoint aggregates it. */
export type RankingRow = Readonly<{
  deviceId: string;
  runs: number;
  wins: number;
  bestFloor: number;
}>;

export type RankingBoard = Readonly<{
  /** `YYYY-MM` (UTC) the rows belong to — the request's own month. */
  month: string;
  /** The caller's own rotating id, so the view can mark its line. */
  ownDeviceId: string;
  /** At most `RANKING_TOP_N`, already ordered by the endpoint. */
  rows: readonly RankingRow[];
}>;

/** A floor as the endpoint accepts it: a whole number of 0 … 99. */
export function clampMapReached(value: number): number {
  return clampInteger(value, RANKING_MAX_MAP_REACHED);
}

/** A playtime as the endpoint accepts it: a whole number of 0 … 24 h. */
export function clampPlaytimeMs(value: number): number {
  return clampInteger(value, RANKING_MAX_PLAYTIME_MS);
}

function clampInteger(value: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, Math.trunc(value)));
}

/** The payload of one finished run: its identity, its figures and its six species. */
export function buildRankingEntry(record: RunHistoryRecord, deviceId: string): RankingEntry {
  return {
    seed: record.seed,
    mode: record.mode,
    mapReached: clampMapReached(record.mapReached),
    won: record.won,
    playtimeMs: clampPlaytimeMs(record.playtimeMs),
    species: record.species.slice(0, PAYLOAD_SPECIES).map((entry) => entry.speciesId),
    deviceId,
  };
}

/**
 * The device's rotating id: the stored one while it is well formed, else a fresh
 * `d-` + twelve hex. `random` is injectable so the mint is a pure read in a test.
 */
export function rankingDeviceId(
  storage: StorageLike | null,
  random: () => number = Math.random,
): string {
  let stored: string | null = null;
  try {
    stored = storage?.getItem(RANKING_DEVICE_KEY) ?? null;
  } catch {
    stored = null;
  }
  if (stored !== null && DEVICE_ID_PATTERN.test(stored)) return stored;

  const minted = mintDeviceId(random);
  try {
    storage?.setItem(RANKING_DEVICE_KEY, minted);
  } catch {
    // A storage that refuses the write still answers an id: the line is anonymous.
  }
  return minted;
}

function mintDeviceId(random: () => number): string {
  let id = 'd-';
  for (let part = 0; part < DEVICE_ID_PARTS; part += 1) {
    id += hexTriplet(random());
  }
  return id;
}

/** Three lowercase hex digits from one draw in `[0, 1)`; anything else reads as zero. */
function hexTriplet(draw: number): string {
  const value = typeof draw === 'number' && Number.isFinite(draw) ? draw : 0;
  const scaled = Math.floor(Math.min(Math.max(value, 0), 1) * 0x1000);
  return Math.min(scaled, 0xfff).toString(16).padStart(3, '0');
}

/** The endpoint the deploy wrote into `ranking.json`, or null when it is not there. */
export async function loadRankingEndpoint(fetcher: typeof fetch = fetch): Promise<string | null> {
  try {
    const response = await fetcher(RANKING_CONFIG_URL);
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
    const endpoint = (body as Record<string, unknown>).endpoint;
    return typeof endpoint === 'string' && HTTP_URL_PATTERN.test(endpoint) ? endpoint : null;
  } catch {
    return null;
  }
}

/** One POST of a finished run; false whenever the browser could not deliver it. */
export async function submitRanking(
  entry: RankingEntry,
  endpoint: string | null,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (endpoint === null || endpoint === '') return false;
  try {
    const response = await fetcher(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(entry),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** One month's board, or null when the endpoint is absent or its answer unreadable. */
export async function fetchRanking(
  month: string,
  endpoint: string | null,
  fetcher: typeof fetch = fetch,
): Promise<RankingBoard | null> {
  if (endpoint === null || endpoint === '' || !MONTH_PATTERN.test(month)) return null;
  try {
    const response = await fetcher(`${endpoint}?month=${month}&limit=${RANKING_TOP_N}`);
    if (!response.ok) return null;
    const body: unknown = await response.json();
    return parseBoard(body);
  } catch {
    return null;
  }
}

/** The endpoint's answer, guarded: one unreadable row rejects the whole board. */
function parseBoard(body: unknown): RankingBoard | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const { month, rows } = body as Record<string, unknown>;
  if (typeof month !== 'string' || month === '') return null;
  if (!Array.isArray(rows)) return null;

  const parsed: RankingRow[] = [];
  for (const entry of rows) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return null;
    const row = entry as Record<string, unknown>;
    if (typeof row.deviceId !== 'string') return null;
    if (!isNumber(row.runs) || !isNumber(row.wins) || !isNumber(row.bestFloor)) return null;
    parsed.push({ deviceId: row.deviceId, runs: row.runs, wins: row.wins, bestFloor: row.bestFloor });
  }
  return { month, ownDeviceId: '', rows: parsed };
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
