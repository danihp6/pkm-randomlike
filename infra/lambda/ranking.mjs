import { DynamoDBClient, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';

/**
 * The monthly ranking endpoint (`D56`): one function URL behind the site's
 * `ranking.json`. `POST` writes a finished run into the month's ledger, `GET`
 * folds that month's runs per device and answers its top ten.
 *
 * The payload is client-authored, so every field is validated and clamped here as
 * well as in the browser; the burst guard is best-effort per warm container, not a
 * guarantee. The clamps' only other copy lives in `src/net/ranking.ts`.
 */

const client = new DynamoDBClient({});

const MAX_MAP_REACHED = 99;
const MAX_PLAYTIME_MS = 86_400_000;

const TOP_N = 10;
const SCAN_LIMIT = 500;
const BURST_LIMIT = 30;
const BURST_WINDOW_MS = 60_000;
const BURST_SOURCES = 1_000;
const TTL_SECONDS = 400 * 86_400;

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DEVICE_PATTERN = /^[A-Za-z0-9-]{8,40}$/;
const SPECIES_PATTERN = /^[a-z0-9-]{1,32}$/;

/** Rolling per-source counters, kept in the container's memory: best effort. */
const bursts = new Map();

export async function handler(event) {
  const request = httpRequest(event);

  if (overBurst(request.source, Date.now())) {
    return answer(429, { error: 'rate' });
  }
  if (request.method === 'POST') return post(request);
  if (request.method === 'GET') return get(request);
  return answer(405, { error: 'method' });
}

function httpRequest(event) {
  const http = event?.requestContext?.http ?? {};
  const method = String(http.method ?? event?.requestContext?.httpMethod ?? 'GET').toUpperCase();
  const source = http.sourceIp ?? event?.requestContext?.identity?.sourceIp ?? 'unknown';
  const query = event?.queryStringParameters ?? {};
  return { method, source, query, event };
}

/** True while this source has spent its window; the caller answers 429. */
function overBurst(source, now) {
  if (bursts.size > BURST_SOURCES) {
    for (const [key, value] of bursts) {
      if (now - value.windowStart >= BURST_WINDOW_MS) bursts.delete(key);
    }
  }
  const entry = bursts.get(source);
  if (entry === undefined || now - entry.windowStart >= BURST_WINDOW_MS) {
    bursts.set(source, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > BURST_LIMIT;
}

async function post(request) {
  const body = parseBody(request.event);
  if (body === null) return answer(400, { error: 'body' });

  const seed = body.seed;
  if (typeof seed !== 'string' || seed.length < 1 || seed.length > 64) {
    return answer(400, { error: 'seed' });
  }
  const mode = body.mode;
  if (mode !== 'finite' && mode !== 'infinite') return answer(400, { error: 'mode' });
  const deviceId = body.deviceId;
  if (typeof deviceId !== 'string' || !DEVICE_PATTERN.test(deviceId)) {
    return answer(400, { error: 'deviceId' });
  }

  const mapReached = clamp(body.mapReached, MAX_MAP_REACHED);
  const playtimeMs = clamp(body.playtimeMs, MAX_PLAYTIME_MS);
  const won = body.won === true;
  const species = speciesOf(body.species);
  const endedAt = new Date().toISOString();
  const month = endedAt.slice(0, 7);
  const strike = `${String(mapReached).padStart(3, '0')}#${endedAt}#${deviceId}`;
  const expiresAt = Math.floor(Date.now() / 1000) + TTL_SECONDS;

  try {
    await client.send(
      new PutItemCommand({
        TableName: tableName(),
        Item: {
          month: { S: month },
          strike: { S: strike },
          deviceId: { S: deviceId },
          seed: { S: seed },
          mode: { S: mode },
          playtimeMs: { N: String(playtimeMs) },
          won: { BOOL: won },
          species: { L: species.map((name) => ({ S: name })) },
          endedAt: { S: endedAt },
          expiresAt: { N: String(expiresAt) },
        },
      }),
    );
  } catch (error) {
    console.warn(`ranking: the run could not be stored (${error.message})`);
    return answer(500, { error: 'store' });
  }

  return answer(200, { ok: true });
}

async function get(request) {
  const month = monthOf(request.query.month);
  const limit = clampLimit(request.query.limit);

  let items = [];
  try {
    const result = await client.send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: '#month = :month',
        ExpressionAttributeNames: { '#month': 'month' },
        ExpressionAttributeValues: { ':month': { S: month } },
        ScanIndexForward: false,
        Limit: SCAN_LIMIT,
      }),
    );
    items = result.Items ?? [];
  } catch (error) {
    console.warn(`ranking: the month could not be read (${error.message})`);
    return answer(500, { error: 'read' });
  }

  return answer(200, { month, rows: foldRuns(items).slice(0, limit) });
}

/** The month's runs folded per player, deepest floor first. */
function foldRuns(items) {
  const players = new Map();
  for (const item of items) {
    const deviceId = item.deviceId?.S;
    if (typeof deviceId !== 'string') continue;
    const floor = floorOf(item.strike?.S);
    const player = players.get(deviceId) ?? { deviceId, runs: 0, wins: 0, bestFloor: 0 };
    player.runs += 1;
    if (item.won?.BOOL === true) player.wins += 1;
    player.bestFloor = Math.max(player.bestFloor, floor);
    players.set(deviceId, player);
  }
  return [...players.values()].sort(
    (a, b) =>
      b.bestFloor - a.bestFloor ||
      b.wins - a.wins ||
      b.runs - a.runs ||
      (a.deviceId < b.deviceId ? -1 : a.deviceId > b.deviceId ? 1 : 0),
  );
}

/** The floor a strike carries: its padded first segment, `050#…`. */
function floorOf(strike) {
  if (typeof strike !== 'string') return 0;
  const floor = Number.parseInt(strike.slice(0, 3), 10);
  return Number.isFinite(floor) ? Math.min(MAX_MAP_REACHED, Math.max(0, floor)) : 0;
}

/** A JSON body, base64-decoded when the function URL says so; null when unreadable. */
function parseBody(event) {
  const raw = event?.body;
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const text = event.isBase64Encoded === true ? Buffer.from(raw, 'base64').toString('utf8') : raw;
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** A whole number of 0 … max; anything the payload does not carry counts as zero. */
function clamp(value, max) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, Math.trunc(value)));
}

/** At most six species ids; a list carrying anything else counts as none. */
function speciesOf(value) {
  if (!Array.isArray(value)) return [];
  for (const name of value) {
    if (typeof name !== 'string' || !SPECIES_PATTERN.test(name)) return [];
  }
  return value.slice(0, 6);
}

/** The requested month, or the current UTC month when it is missing or invalid. */
function monthOf(value) {
  return typeof value === 'string' && MONTH_PATTERN.test(value) ? value : currentMonth();
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

/** The board's size: one digit more than nine is still ten. */
function clampLimit(value) {
  const limit = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(limit)) return TOP_N;
  return Math.min(TOP_N, Math.max(1, limit));
}

function tableName() {
  return process.env.RANKING_TABLE;
}

function answer(statusCode, payload) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  };
}
