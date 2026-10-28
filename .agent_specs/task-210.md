# Spec: Task-210 — The ranking is global: a DynamoDB table and the one endpoint that feeds it

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** infra (AWS CDK) + a pure client module + the stats panel's ranking mode.
- **Role:** Dev.
- **Objective:** after this task a finished run leaves the browser and a **global** monthly
  board exists. Three pieces, one seam each: (1) `infra/` gains a DynamoDB table and one small
  Lambda with a function URL that takes `POST` (a finished run's summary) and `GET` (the
  month's top players), deployed with the site and reachable at an endpoint the built site
  itself discovers from `/ranking.json`; (2) `src/net/ranking.ts` is the client — the payload's
  builder with its clamps, the rotating device id, the submit and the fetch, none of which ever
  throws into a scene; (3) the stats panel's `ranking` mode reads that global board while the
  device's own line stays marked, and falls back to the **local** record, labelled as such, when
  the network is unavailable. Today nothing leaves the browser: `infra/` deploys the static
  site only, and the panel's blurb reads `MONTHLY RECORD · THIS DEVICE.` because the store is
  `window.localStorage`.
- **Environment:** worktree `../wt-pkm-210`, branch `task-210`. Deploying is part of the task:
  `aws sts get-caller-identity` answers this account's user and `infra/node_modules` is
  installed.
- **Dependencies:** `[Task-181]` (merged: the run's history record and the single `endRun`
  seam it writes through) and `[Task-199]` (merged: `stats/records.ts`'s `historyWins` /
  `historyBestFloor` / `recordMonthKey` and `liveMainMenuView`'s records argument).

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**

- `infra/lib/site-stack.ts`
- `infra/lambda/ranking.mjs` *(new)*
- `infra/README.md`
- `src/net/ranking.ts` *(new)*
- `src/net/ranking.test.ts` *(new)*
- `src/net/README.md` *(new — the folder map AGENTS.md requires for a new code folder)*
- `src/ui/hud/panels/stats/view.ts`
- `src/ui/hud/panels/stats/view.test.ts`
- `src/ui/hud/panels/stats/README.md` (one role line per file / rule line if the map changes)
- `src/scenes/MainMenuScene.ts`
- `src/scenes/MainMenuScene.test.ts`
- `src/scenes/RouteScene.ts` (the submit call inside the shipped `endRun`, and nothing else)
- `src/i18n/en.ts`
- `src/i18n/es.ts`
- `docs/tech-decisions.md` (one new decision, **`D56`**)
- `docs/design-spec.md` — **only** §2's `**STATS**` sentence inside the main-menu bullet (the
  ranking is global, the totals stay local).
- `infra/bin/infra.ts`, `infra/package.json`, `package.json`, `vite.config.ts`,
  `infra/cdk.json`, `src/main.ts`, `src/ui/hud/state.ts` and every other scene are **not** this
  task's.

### Inputs (read-only)

- `infra/{bin/infra.ts,lib/{env,certificate-stack,cloudflare}.ts,lambda/*.mjs,cdk.json,tsconfig.json}`
  — the stack's existing shape: two stacks, `Code.fromAsset(join(__dirname,'..','lambda'))`,
  `Runtime.NODEJS_24_X`, a `CustomResource` provider, and `loadDotEnv` reading the repository
  root's untracked `.env`.
- `src/engine/run/history.ts` — `RunHistoryRecord` (`seed`, `mode`, `mapReached`, `won`,
  `playtimeMs`, `endedAt`, `species`), `RunEndLog`, `endRun`.
- `src/scenes/RouteScene.ts` — the shipped private `endRun(won)` (around 3873-3895): it is the
  run's single end seam and already stores the document once.
- `src/ui/hud/panels/stats/{view.ts,records.ts,README.md}` — `liveStatsView`, `rankingView`,
  `STATS_MODES`, `StatsRow`, `statsMonths`.
- `src/scenes/MainMenuScene.ts` — `statsView()`, `openStats()`, `handleStatsIntent`'s month
  branch (the two call sites that build and refresh the panel).
- `src/storage.ts` (`browserStorage()`) and `src/engine/save.ts`'s `StorageLike`.
- `src/i18n/{en.ts,es.ts}` — `stats.blurbRanking`, `stats.emptyMonth`, `stats.you`,
  `stats.colPlayer` already exist.
- `docs/tech-decisions.md` (D43, D49, D54 and the tail of the D-list) and
  `docs/design-spec.md` §2.
- `s3deploy`, `dynamodb`, `lambda`, `Duration`, `CfnOutput` from `aws-cdk-lib` (already a
  dependency of `infra/`).

## 🔒 Contract

### TypeScript (`src/net/ranking.ts`)

```ts
import type { StorageLike } from '../engine/save';
import type { RunHistoryRecord } from '../engine/run/history';
import type { RunMode } from '../engine/run/state';

/** Where the built site discovers its endpoint: a small file the deploy writes. */
export const RANKING_CONFIG_URL = 'ranking.json';
/** The clamps the client applies **and** the Lambda re-applies. Keep both pairs equal. */
export const RANKING_MAX_MAP_REACHED = 99;
export const RANKING_MAX_PLAYTIME_MS = 86_400_000;
/** The board's own size, one row per player of the month. */
export const RANKING_TOP_N = 10;
/** The storage key the rotating device id lives under (never inside the save document). */
export const RANKING_DEVICE_KEY = 'pokerandomlike.ranking.device';

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

export function clampMapReached(value: number): number;
export function clampPlaytimeMs(value: number): number;
export function buildRankingEntry(record: RunHistoryRecord, deviceId: string): RankingEntry;
export function rankingDeviceId(
  storage: StorageLike | null,
  random?: () => number,
): string;
export async function loadRankingEndpoint(fetcher?: typeof fetch): Promise<string | null>;
export async function submitRanking(
  entry: RankingEntry,
  endpoint: string | null,
  fetcher?: typeof fetch,
): Promise<boolean>;
export async function fetchRanking(
  month: string,
  endpoint: string | null,
  fetcher?: typeof fetch,
): Promise<RankingBoard | null>;
```

Frozen behaviour:

- `clampMapReached(v)` = `0` for a non-finite `v`, else `min(99, max(0, Math.trunc(v)))`.
  `clampPlaytimeMs(v)` = `0` for a non-finite `v`, else `min(86_400_000, max(0, Math.trunc(v)))`.
- `buildRankingEntry(record, deviceId)` returns an object with **exactly these seven keys**
  and nothing else: `seed` (the record's, unchanged), `mode`, `mapReached` (clamped), `won`,
  `playtimeMs` (clamped), `species` (`record.species.map((s) => s.speciesId)` — already sorted
  by id — **sliced to the first 6**), `deviceId`.
- `rankingDeviceId(storage, random = Math.random)`: returns the stored value when it matches
  `/^[A-Za-z0-9-]{8,40}$/`; otherwise mints `d-` + 12 lowercase hex characters from `random()`
  (four calls of six nibbles each, or any deterministic derivation — the test injects a
  sequence and pins the string), writes it through `storage?.setItem`, and returns it. A null
  storage still returns an id (minted, unstored).
- `loadRankingEndpoint(fetcher = fetch)`: `GET RANKING_CONFIG_URL`; returns
  `body.endpoint` when the body is a JSON object whose `endpoint` is a non-empty `http(s)`
  string, else `null`. Never throws.
- `submitRanking(entry, endpoint, fetcher = fetch)`: returns `false` for a `null`/empty
  endpoint without calling `fetcher`; otherwise `POST` with
  `headers: { 'content-type': 'application/json' }`, `body: JSON.stringify(entry)`, and returns
  `response.ok`. Any thrown error ⇒ `false`. **Never throws.**
- `fetchRanking(month, endpoint, fetcher = fetch)`: returns `null` for a `null` endpoint or a
  `month` that does not match `/^\d{4}-(0[1-9]|1[0-2])$/`; otherwise
  `GET ${endpoint}?month=${month}&limit=${RANKING_TOP_N}`, and returns
  `{ month, ownDeviceId: <the id the caller passes through the response or ''>, rows }` —
  **frozen simpler form:** the response's `month` (string) and `rows` (guarded: every entry has
  a string `deviceId` and numeric `runs`/`wins`/`bestFloor`, else the whole parse yields
  `null`), plus `ownDeviceId: ''`. The scene fills `ownDeviceId` from
  `rankingDeviceId(browserStorage())` before handing the board to the view.
- `src/net/**` imports **no** Phaser and no scene; it is plain TypeScript with an injectable
  `fetch`, and it never reads `window` itself (`browserStorage()` is the scene's/caller's job).
- **Determinism:** the module draws no `Rng` and reads no clock; the payload is a pure function
  of the record and the id. `month` is always supplied by the caller (`recordMonthKey`).

### TypeScript (`src/ui/hud/panels/stats/view.ts`)

```ts
export function liveStatsView(
  history: readonly RunHistoryRecord[],
  mode: StatsMode,
  monthKey: string | null,
  now: Date,
  global: RankingBoard | null = null,
): StatsView;
```

- The fifth argument is read **only** by `mode === 'ranking'`; the other four modes return
  exactly what they return today for a 4-argument call.
- `global === null` ⇒ `rankingView` is **unchanged**: one `you` row from the local history,
  `blurb: t('stats.blurbRanking')` (`MONTHLY RECORD · THIS DEVICE.`), `month` and its
  `canPrev`/`canNext` as today. A test asserts a 4-arg call deep-equals a 5-arg call with
  `null`.
- `global !== null` ⇒
  - `columns` stay `[t('stats.colPlayer'), t('stats.colRuns'), t('stats.colWins'), t('stats.colBestFloor')]`;
  - `rows` are the board's rows in the endpoint's own order, one per player, with
    `cells: [row.deviceId === global.ownDeviceId ? t('stats.you') : tag(row.deviceId), String(row.runs), String(row.wins), String(row.bestFloor)]`
    and `id: 'global-' + index`; `tag(id)` is `'#' + id.slice(-4).toUpperCase()`;
  - the device's own line is **appended last** (id `'you'`, the same four cells computed from
    the month's local history) when the board does not already hold it;
  - `blurb: t('stats.blurbRankingGlobal')` (`MONTHLY RANKING · EVERYONE.`);
  - `empty: t('stats.emptyMonth')` when there is neither a board row nor a local run for the
    month, else `null`;
  - `month` and its arrows are the shipped month model, unchanged (the board is per month, so
    stepping the month re-fetches — see the scene below).

### TypeScript (`src/scenes/MainMenuScene.ts`)

- A private field `private globalRanking: RankingBoard | null = null;` and a private
  `private rankingEndpoint: string | null | undefined;` (`undefined` = not asked yet).
- `openStats()` keeps its shipped body and then calls `this.loadGlobalRanking()`.
- `private loadGlobalRanking(): void` — one async chain, no timers, no `await` in
  `create`/`update`:
  1. if `rankingEndpoint === undefined`, `this.rankingEndpoint = await loadRankingEndpoint()`;
  2. if it is `null`, leave `globalRanking = null` and return;
  3. `const month = this.statsMonth`; `const board = await fetchRanking(month, this.rankingEndpoint)`;
  4. on a board, set `this.globalRanking = { ...board, month, ownDeviceId: rankingDeviceId(browserStorage()) }`
     and call `this.stats?.update(this.statsView())` **only** while `this.statsOpen` and
     `this.statsMonth === month`; on `null`, set `this.globalRanking = null` and repaint the same way.
- `statsView()` passes `this.globalRanking` as the fifth argument.
- The month step in `handleStatsIntent` clears `globalRanking` (the new month is not fetched
  yet) and calls `this.loadGlobalRanking()` after the repaint.
- `closeStats()` leaves `globalRanking` as it is; reopening re-fetches.

### TypeScript (`src/scenes/RouteScene.ts`)

- Inside the shipped private `endRun(won)` only: after the log is stored, when the call was the
  **first** end for this run (`log.ended === false` before), fire one submit — no `await`, no
  `throw`:
  ```ts
  void this.submitFinishedRun(record);
  ```
  where `record` is the record `endRun` just built (`next.history[0]`), and a new private
  `submitFinishedRun(record: RunHistoryRecord): Promise<void>` resolves the endpoint **once**
  (cached in a field) and calls
  `submitRanking(buildRankingEntry(record, rankingDeviceId(browserStorage())), endpoint)`,
  swallowing every failure. No other line of the scene changes — no run field, no rule, no draw.

### Data (`infra`)

`infra/lambda/ranking.mjs` — `export async function handler(event)` (the same ESM shape as
`cloudflare.mjs`), a function URL event (`event.requestContext.http.method`, `event.rawPath`,
`event.queryStringParameters`, `event.headers`, `event.body`, `event.isBase64Encoded`):

- `POST /` (any path, or `/ranking`): body is base64-decoded when `isBase64Encoded`; JSON
  parsed; validated and clamped:
  - `seed`: string, 1…64 chars → else **400** `{ error: 'seed' }`;
  - `mode`: `'finite' | 'infinite'` → else **400** `{ error: 'mode' }`;
  - `deviceId`: `^[A-Za-z0-9-]{8,40}$` → else **400** `{ error: 'deviceId' }`;
  - `mapReached`: number → `min(99, max(0, trunc))`, missing ⇒ 0;
  - `playtimeMs`: number → `min(86_400_000, max(0, trunc))`, missing ⇒ 0;
  - `won`: `=== true`;
  - `species`: array of ≤ 6 strings matching `^[a-z0-9-]{1,32}$`; anything else ⇒ `[]`.
  Item written to the table: `{ month: 'YYYY-MM' (UTC of the request instant),
  strike: String(strike).padStart(3,'0') + '#' + endedAt + '#' + deviceId,
  deviceId, seed, mode, playtimeMs, won, species, endedAt, expiresAt: <epoch seconds + 400 days> }`.
  Answers **200** `{ ok: true }`.
- `GET`: `month` (validated as `YYYY-MM`, default the current UTC month), `limit` (clamped
  1…10, default 10). A `QueryCommand` on `month`, `ScanIndexForward: false`, `Limit: 500`,
  folds the runs **by `deviceId`** into `{ deviceId, runs, wins, bestFloor }`, sorts by
  `bestFloor` desc, then `wins` desc, then `runs` desc, then `deviceId` asc, and answers
  **200** `{ month, rows: <top limit> }`.
- A burst guard: at most **30** requests per source per rolling minute (a module-level `Map` of
  `count`/`windowStart`, best-effort per warm container), beyond which **429**
  `{ error: 'rate' }`. The README says plainly that it is best-effort, not a guarantee.
- The two clamp constants are declared in this file under the names the criterion greps:
  `const MAX_MAP_REACHED = 99;` and `const MAX_PLAYTIME_MS = 86_400_000;` — the client's
  `RANKING_MAX_*` pair is their only other copy, and the two must stay equal.
- Every response carries `content-type: application/json` and
  `access-control-allow-origin` is the function URL's CORS config, not this code's.

`infra/README.md` gains: the third resource set in the "Two stacks, two regions" table's
contents cell (a DynamoDB table and a Lambda with a function URL in `PokeRandomLikeSite`), a
`## The ranking endpoint` section with the two operations, the clamps, the TTL, the on-demand
billing and the `RankingEndpoint` output, a `ranking.json` line in **Files**, and the honest
limit that a payload is client-authored and the burst guard is best-effort.

`infra/lib/site-stack.ts` gains, before the bucket deployment:

```ts
const rankingTable = new dynamodb.Table(this, 'RankingTable', {
  tableName: 'PokeRandomLikeRanking',
  partitionKey: { name: 'month', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'strike', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: RemovalPolicy.DESTROY,
  timeToLiveAttribute: 'expiresAt',
});

const rankingFunction = new lambda.Function(this, 'RankingFunction', {
  runtime: lambda.Runtime.NODEJS_24_X,
  handler: 'ranking.handler',
  code: lambda.Code.fromAsset(join(__dirname, '..', 'lambda')),
  timeout: Duration.seconds(10),
  memorySize: 256,
  environment: { RANKING_TABLE: rankingTable.tableName },
  description: 'PokeRandomLike monthly ranking: POST a finished run, GET the month top.',
});
rankingTable.grantReadWriteData(rankingFunction);

const rankingUrl = rankingFunction.addFunctionUrl({
  authType: lambda.FunctionUrlAuthType.NONE,
  cors: {
    allowedOrigins: [`https://${props.siteDomain}`, 'http://localhost:5175'],
    allowedMethods: [lambda.HttpMethod.GET, lambda.HttpMethod.POST],
    allowedHeaders: ['content-type'],
    maxAge: Duration.hours(1),
  },
});
```

and the site deployment's `sources` become **two** entries so `ranking.json` lands in the same
`prune: true` deployment (never a second one):

```ts
sources: [
  s3deploy.Source.asset(props.buildDir),
  s3deploy.Source.jsonData('ranking.json', { endpoint: rankingUrl.url }),
],
```

plus one output:

```ts
new CfnOutput(this, 'RankingEndpoint', {
  value: rankingUrl.url,
  description: 'The monthly ranking endpoint (POST a run, GET the month top).',
});
```

The handler's table name arrives through `process.env.RANKING_TABLE` (never hard-coded in the
`.mjs`). `infra/bin/infra.ts` does **not** change: the stack builds its own resources.

### Data (i18n)

`src/i18n/en.ts` + `src/i18n/es.ts` gain **exactly one** key each, in the `stats.*` block:

| key | `en` | `es` |
| --- | --- | --- |
| `stats.blurbRankingGlobal` | `MONTHLY RANKING · EVERYONE.` | `CLASIFICACIÓN MENSUAL · TODOS.` |

`stats.blurbRanking` (`MONTHLY RECORD · THIS DEVICE.`) keeps its English and Spanish strings and
is the **offline** blurb. No other key changes; the `i18n` parity test must stay green.

## 🧩 Data and configuration

| value | where | meaning |
| --- | --- | --- |
| table `PokeRandomLikeRanking` | `infra` | pk `month` (`YYYY-MM`), sk `strike` (`NNN#endedAt#deviceId`, lexicographic ⇒ floor descending) |
| `expiresAt` | item | DynamoDB TTL, 400 days, so a month's ledger dies on its own |
| `RANKING_TABLE` | Lambda env | the table name, set by the stack |
| `ranking.json` | built site | `{ "endpoint": "<function url>" }`, written by the deploy |
| `RANKING_MAX_MAP_REACHED = 99` | client **and** lambda | the clamp on both sides, equal by a grep criterion |
| `RANKING_MAX_PLAYTIME_MS = 86_400_000` | client **and** lambda | 24 h, the clamp on both sides |
| `RANKING_TOP_N = 10` | client | the board's size |
| 30 / minute / source | lambda | the best-effort burst guard |
| `#` + last 4 digits | `stats/view.ts` | another player's label; the own line prints `t('stats.you')` |

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `npm --prefix infra run build` — `tsc` over `infra/` (its `outDir` is the gitignored
    `infra/cdk.out/ts`); must be green.
  - `git diff --name-only main...task-210` — every path must be in the exclusive list above.
  - This task has **three** `[live]` criteria (a real deploy is part of it); the rest are
    `[unit]`.

- **Preconditions for the `[live]` criteria** (state them in the task report): `dist/` built,
  and `CLOUDFLARE_API_TOKEN` exported from the main checkout's **untracked** `.env`
  (`export CLOUDFLARE_API_TOKEN="$(grep -m1 '^CLOUDFLARE_API_TOKEN=' ../pkm-randomlike/.env | cut -d= -f2-)"`
  from the worktree) plus
  `export CDK_DEFAULT_ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"`.
  Deploy once, never in a loop: `npm run build && npm --prefix infra run deploy`. Nothing is
  committed from `.env`.

- **Acceptance criteria:**
  - [ ] `[unit]` `npm test` is green, and `src/net/ranking.test.ts` asserts: `buildRankingEntry`
        has exactly the seven keys `Object.keys(...).sort()` =
        `['deviceId','mapReached','mode','playtimeMs','seed','species','won']`; a record with
        `mapReached: 400`/`playtimeMs: -5`/`NaN` clamps to `99`/`0`/`0`; `species` is sliced to
        six; `rankingDeviceId` returns a stored valid id unchanged, mints `d-` + 12 hex from an
        injected `random` sequence, and mints a fresh one for junk; `submitRanking` returns
        `false` for a `null` endpoint **without calling** the injected fetcher, `false` when the
        fetcher rejects, `true` on `ok: true`; `fetchRanking` returns `null` for a `null`
        endpoint, a bad month, a 500 and a malformed body, and the rows on a good one.
  - [ ] `[unit]` `stats/view.test.ts` asserts the 4-argument and `null`-fifth-argument calls
        are deep-equal for every `STATS_MODE`, and that a `RankingBoard` with two rows (the
        second holding `ownDeviceId`) produces the board's order, the `t('stats.you')` cell on
        the own line, a `#XXXX` tag on the other, `blurb === t('stats.blurbRankingGlobal')`,
        and the own line appended last when the board omits it.
  - [ ] `[unit]` `MainMenuScene.test.ts` asserts `statsView()` hands `globalRanking` through
        (the dev-read pattern the scenes already use) and that a `null` board paints the local
        blurb.
  - [ ] `[unit]` `npm run build` **and** `npm --prefix infra run build` are green, and
        `git diff --name-only main...task-210` lists only the paths above.
  - [ ] `[unit]` the two clamp pairs are literally equal:
        `grep -n "RANKING_MAX_MAP_REACHED = 99" src/net/ranking.ts` and
        `grep -n "MAX_MAP_REACHED = 99" infra/lambda/ranking.mjs` each print one line, and the
        same for `RANKING_MAX_PLAYTIME_MS = 86_400_000` / `MAX_PLAYTIME_MS = 86_400_000`.
  - [ ] `[unit]` `grep -c "ranking.json" src/net/ranking.ts` ≥ 1 and
        `grep -c "Source.jsonData('ranking.json'" infra/lib/site-stack.ts` prints `1`, so the
        site discovers its endpoint at deploy time and no build-time env var is needed.
  - [ ] `[live]` **Deployed endpoint, measured with `curl`** from the task report's deploy:
        `EP` = the `RankingEndpoint` output
        (`aws cloudformation describe-stacks --stack-name PokeRandomLikeSite --region eu-west-1 --query "Stacks[0].Outputs[?OutputKey=='RankingEndpoint'].OutputValue" --output text`).
        `curl -s -o /dev/null -w '%{http_code}' "$EP?month=$(date -u +%Y-%m)"` prints `200`;
        a `POST` of
        `{"seed":"qa-210","mode":"finite","mapReached":3,"won":true,"playtimeMs":123456,"species":["pikachu"],"deviceId":"qa-device-0001"}`
        prints `200` and `{"ok":true}`; a second `GET` for that month returns
        `{"month":"…","rows":[{"deviceId":"qa-device-0001","runs":1,"wins":1,"bestFloor":3}]}`
        (more rows are fine as long as this one is present with those numbers); a `POST` with
        `"deviceId":"x"` prints `400`; and `curl -s "$EP?month=2026-13"` returns the current
        month's board (an invalid month falls back, it does not 500).
  - [ ] `[live]` **Two browser contexts, measured with the browser driver** at
        `https://pokerandomlike.herreteam.com/?hud=dom` after that deploy, viewport 1280×800:
        in a **fresh profile** open **STATS → RANKING**: the blurb reads `MONTHLY RANKING ·
        EVERYONE.` and a row labelled `#0001` shows `1`, `1`, `3`; the device's own line prints
        `TÚ`/`YOU` and its month's local counts. Then set the context **offline**, reload, open
        STATS → RANKING again: the blurb reads `MONTHLY RECORD · THIS DEVICE.`, the global
        `#0001` row is gone, and the panel still lists the device's own run — the local record
        is the fallback and the scene never throws (no unhandled rejection in the console).
  - [ ] `[live]` **A network failure is invisible to the player:** with the context offline,
        finish a run (the dev menu's floor teleport plus a losing battle is enough) and land on
        the run-over screen and the main menu: no error dialog, no frozen scene, and the run's
        record is in STATS as it was before this task. (The submit's failure is swallowed; the
        console may log nothing or one `console.warn`, never an unhandled rejection.)

## 📣 Coordination

- **For the Architect / Integration QA:** this task is the batch's only deployer and its only
  writer of `infra/**`, `src/net/**`, `src/i18n/{en,es}.ts`, `docs/tech-decisions.md` and
  `docs/design-spec.md` §2. It reads `src/scenes/RouteScene.ts`'s `endRun` seam and writes
  **one** call there; `[Task-212]` and `[Task-207]` touch no scene, and `[Task-201]` released
  `src/scenes/MainMenuScene.ts` to this task (the batch plan in Phase 17 records the trade).
  The deploy replaces the live stack, so Task QA runs the deploy **once** and Integration QA
  reuses its outputs instead of deploying again.
- **For the next batch:** `[Task-211]` (STATS and RANKING as two menu rows) opens the stats
  panel on its `ranking` mode and must reuse this seam — `statsMode = 'ranking'` plus
  `loadGlobalRanking()` — rather than adding a second fetch. `[Task-208]` wraps panels in a
  shell; the ranking rows are ordinary `StatsRow`s and need nothing from it. The table is
  keyed by month, so a future per-run board is a second sort key, not a second table.
- **For the human:** two readings this task freezes and the plan records as assumptions — the
  endpoint is discovered from `/ranking.json` (no build-time env var, so a plain
  `npm run build` keeps working), and another player's row is labelled `#` + the last four
  characters of its rotating device id, because the save carries no player name.
- **No `SAVE_VERSION` step:** the device id lives under its own storage key, **outside** the
  save document, and no run field is added. `src/engine/save.ts` is not touched.

## ⛔ Out of scope

- Accounts, authentication, a player name, or any per-device identity beyond the rotating id.
- A per-run global board, a Pokémon ranking, or pagination beyond the top 10.
- Anti-cheat beyond the clamps and the burst guard: the payload is client-authored and the
  README says so.
- The canvas HUD's stats screen, the main menu's own layout, and `[Task-211]`'s fifth row.
- Any change to `src/engine/**`, `package.json`, `vite.config.ts`, `src/main.ts` or
  `src/data/**`; any packer; any new npm dependency (the Lambda's DynamoDB client ships in the
  Node runtime).
