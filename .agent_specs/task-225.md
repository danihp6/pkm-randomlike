# Spec: Task-225 — The import also runs from the committed snapshot

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** tooling (Node ESM scripts under `scripts/design/`, plus two READMEs).
- **Role:** Dev.
- **Objective:** `node scripts/design/import.mjs` gains a second, **offline** mode
  (`--from <framesDir>`) that rebuilds the Figma REST payload from the committed
  `design/frames/<slug>.json` dumps and the committed `design/screens/<slug>.png`
  rasters, then runs the **same** `projectBoard` projection and writes the **same**
  artifact families. With a rate-limited PAT (measured `2026-10-29`: `figma 429`,
  `Retry-After: 390498`) the board's artifacts can still be produced and verified:
  the REST path stays the default for a fresh board, the offline path is how the repo
  proves its committed board without a request, and neither path needs `FIGMA_TOKEN`
  to **verify**.
- **Environment:** worktree `../wt-pkm-225`, branch `task-225`. Work only there.
  `node_modules` is gitignored and absent in a fresh worktree: run
  `npm ci --prefer-offline --no-audit --no-fund` once before the gates.
- **Dependencies (already merged on `main`):**
  - Task-220 — `scripts/design/importer.mjs` (`projectBoard`, `slugOf`),
    `scripts/design/import.mjs`, `scripts/design/check.mjs`, `design/import.json`,
    `design/frames/**`, `design/screens/**`, both READMEs, `D57`.
  - Task-221 — `scripts/hud/diff.mjs` deleted, `hud:diff` gone; **no pixel diff is
    written or read anywhere in this task either**.

### Exclusive paths (single writer)

Exactly these, and nothing else:

- `scripts/design/importer.mjs`
- `scripts/design/importer.test.mjs`
- `scripts/design/import.mjs`
- `scripts/design/import.test.mjs` (**new** file; the exit codes and `--check` of the
  command have no test today and the criteria below need one)
- `scripts/design/fixtures/frames/02-options.json` (**new**)
- `scripts/design/fixtures/frames/m02-options.json` (**new**)
- `scripts/design/fixtures/screens/02-options.png` (**new**)
- `scripts/design/fixtures/screens/m02-options.png` (**new**)
- `scripts/design/README.md`
- `design/README.md`

**Do not touch** `design/tokens.json`, `design/board.json`, `design/frames/**`,
`design/screens/**`, `design/exports/**`, `design/import.json`,
`scripts/design/check.mjs`, `package.json`, `TODO.md`, `CHANGELOG.md`, or any
`src/**`. The four generated families under `design/` stay the operator's: this task
only writes them under a `--root` the caller names.

### Inputs (read-only)

- `design/import.json` — the hand-authored map (33 desktop frames, `page: "Page 1"`).
- `design/frames/<slug>.json` and `design/frames/m<slug>.json` — 66 dumps, each
  `{ slug, nodeId, depth, exportedAt, geometry: [root], text: [root] }`.
- `design/screens/<slug>.png` and `design/screens/m<slug>.png` — 66 rasters.
- `scripts/design/check.mjs` — the four headless checks this task must keep green.
- `scripts/design/fixtures/file.json`, `nodes.json`, `images.json`, `map.json`,
  `exports/02-options.png`, `exports/m02-options.png` — the REST fixture.
- `docs/tech-decisions.md` `D57` (the board enters as a spec) and
  `docs/hud-fidelity.md` §5 (the safe area the tokens cite).
- This task touches **no** routed screen or HUD panel, so no `design/screens/<slug>.json`
  + `design/exports/<slug>.png` pair is a mandatory input here: those artifacts do not
  exist yet (`[Task-223]`/`[Task-224]` are `[!]` behind them). The frame dumps are the
  read-only spec for this work.

## 🔒 Contract

### TypeScript / JavaScript surface

`scripts/design/importer.mjs` keeps every current export (`projectBoard`, `slugOf`)
byte-for-byte compatible and adds **one** pure builder:

```js
/**
 * @param {object[]} frames  parsed `design/frames/*.json` dumps
 *        (`{ slug, nodeId, exportedAt, geometry: [root], text: [root] }`)
 * @param {{ page?: string, name?: string }} [options]
 * @returns {{
 *   file: { name: string, lastModified: string|null, document: object },
 *   problems: { code: string, slug: string, detail: string }[]
 * }}
 */
export function buildFileFromFrames(frames, { page = 'Page 1', name = 'pkm-randomlike' } = {});
```

Rules, all of them testable:

1. **Input order is irrelevant.** The builder sorts its inputs by `slug` before doing
   anything, so the same set of dumps always yields the same payload and the same
   `problems` order.
2. **The payload is in REST shape** — exactly what `projectBoard` already consumes:
   `{ name, lastModified, document: { id: '0:0', name, type: 'DOCUMENT', children:
   [ { id: '0:1', name: page, type: 'CANVAS', children: frames } ] } }`.
3. **Caption and node are the dump's root**: `children[i]` is `geometry[0]`, and its
   `name` is the caption `projectBoard` matches against `map.screens[].caption`
   (middle dot included, e.g. `01b Main menu · no save`). The mobile twin's dump
   already carries `M <caption>` as its name, so it needs no special case.
4. **The text is merged back by node id.** The exporter splits each frame in two trees:
   `geometry` keeps boxes and paints, `text` keeps the same tree with `characters`,
   `fontName` and `fontSize` on its `TEXT` nodes. For every node of `geometry[0]`,
   find the node with the same `id` in `text[0]` and copy those three keys into that
   node's `properties` **when the text node has them**. A node no text node names keeps
   whatever it has. The merge must not add, drop or reorder any other key: the merged
   node is `{ ...geometryNode, properties: { ...geometryProperties, ...textKeys } }`,
   with `characters`, `fontName`, `fontSize` appended in that order.
5. **A duplicated caption is fatal and names it.** Two inputs whose root `name` is equal
   push `{ code: 'frame_duplicated', slug, detail: caption }` (the slug of the second
   one in sorted order), and the first one is the node that stays in the payload.
6. **`lastModified` is committed data, never a clock.** It is the greatest
   `exportedAt` string across the inputs (`null` when none carries one), so two runs
   over the same dumps produce the same bytes. No `Date.now()`, no `fs`, no `fetch` in
   the builder.

`scripts/design/import.mjs` keeps its exported entry point and gains one option:

```js
export async function runImport({
  root = process.cwd(),   // where design/import.json and the artifacts live
  env = process.env,
  fetch = globalThis.fetch,
  check = false,
  from = null,            // null → REST (unchanged); a directory → offline
} = {});                  // returns { code: 0|1|2, wrote: string[], drifted: string[], problems: object[] }
```

Offline mode (`from` is a string), in this order:

1. **Reads no environment variable at all** — not `FIGMA_TOKEN`, not
   `FIGMA_FILE_KEY` — and makes no request. `env` is ignored on this path.
2. Reads and parses `<root>/design/import.json` (a missing or unparsable map is
   `code: 2` and names the file, as today).
3. Reads every `*.json` in `<from>` (sorted by file name) and calls
   `buildFileFromFrames`.
4. Calls `projectBoard(payload, map)` — the **same** function the REST path uses.
5. Any problem with `code` in `frame_missing`, `mobile_missing` or `frame_duplicated`
   is **fatal**: one line per problem to stderr in the existing vocabulary
   `<code> <slug>: <detail>`, `code: 1`, **nothing written**.
6. Snapshots: for each projected screen, read its desktop raster from
   `<from>/../screens/<slug>.png` and set
   `screen.snapshot = { file: 'design/exports/<slug>.png', sha256, bytes }`, hashing
   **the bytes that will be written**. A missing raster is `code: 2` and names the path.
7. Artifacts, in this order and in the same shape as the REST path: `design/tokens.json`,
   `design/board.json`, `design/screens/<slug>.json` (33), `design/exports/<slug>.png`
   (33, the desktop rasters copied byte for byte). The mobile rasters are **not**
   copied: offline mode owns the 33 desktop pairs the four checks read, and the
   operator's REST run remains the source of the 66 (see Coordination).
8. `check: true` computes the same artifacts and **writes nothing**: it compares each
   one against `<root>` and returns `code: 1` listing every path that is different or
   missing on stdout, `code: 0` when all of them match. `wrote` is empty in this mode.

REST mode (`from === null`) is unchanged: same env checks, same three requests, same
problems, same writes, same `--check`.

CLI: `node scripts/design/import.mjs [--root <dir>] [--from <dir>] [--check]`, both
paths resolved with `path.resolve(...)` against the **current working directory**
(`--from design/frames` with cwd = the repo reads the repo's committed dumps even when
`--root` is a temp copy). Exit codes unchanged: `0` clean, `1` drift or a fatal
problem, `2` a missing variable/unreadable map/missing raster.

**Determinism:** no RNG anywhere, no clock, no network on the offline path; the same
`<root>` inputs plus the same `--from` dumps always produce the same bytes.

### Data

No new data file, no key, no default in `src/data/`. The only new committed data are
the four test fixtures above.

## 🧩 Data and configuration

- **Offline fixtures** (`scripts/design/fixtures/`), derived mechanically from
  `nodes.json` so the REST and the offline payloads describe the **same** board:
  - `frames/02-options.json` = the `1:1557` subtree in exporter shape: `geometry` is
    that tree with `characters`/`fontName`/`fontSize` removed from its `TEXT`
    properties, `text` is the same tree with those three keys present on its `TEXT`
    nodes (values taken verbatim from `nodes.json`), plus
    `{ slug: '02-options', nodeId: '1:1557' }` and an `exportedAt` equal to the one
    `fixtures/file.json` carries, so the fixture is self-consistent.
  - `frames/m02-options.json` = the same for `8:3231` with `slug: 'm02-options'`.
  - `screens/02-options.png` and `screens/m02-options.png` = byte copies of
    `fixtures/exports/02-options.png` and `fixtures/exports/m02-options.png`.
- No `package.json` alias: the command is invoked by path, like today.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - In the worktree: `npm ci --prefer-offline --no-audit --no-fund` once.
  - `npm test` — Vitest, headless; must be green, including the tests this task adds
    (`scripts/design/*.test.mjs` are collected by the default include today).
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-225` audited against the exclusive paths list.
  - This task's `[live]` is a **command measurement, not a browser pass**: it is tagged
    `[live]` because it only exists on the real committed 66-frame board, and it needs
    no dev server. No browser, no canvas, no screenshot, no pixel comparison (`D57`).

- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` is clean and `npm test` is green.
  - [ ] `[unit]` `git diff --name-only main...task-225` lists only the eleven exclusive
    paths above (the four new fixtures included), and `design/tokens.json`,
    `design/board.json` and `design/import.json` are byte-identical to `main`.
  - [ ] `[unit]` `node scripts/design/check.mjs` on the worktree's committed `design/`
    still exits **0** and still prints `colour_outside_tokens: 0 screens (run the
    import)` and `snapshot_hash_mismatch: 0 mismatched, 33 pending the import`: the
    generated families were not committed.
  - [ ] `[unit]` **Fixtures agree:** `projectBoard(buildFileFromFrames([frames/02-options,
    frames/m02-options]).file, fixtures/map.json)` deep-equals
    `projectBoard(fixturePayload(), fixtures/map.json)` on **`screens` and `tokens`**
    (`JSON.stringify` equality both ways), with `problems` empty.
  - [ ] `[unit]` **Missing caption is fatal and named:** a map entry whose caption no
    dump carries makes `runImport({ from, root: tmp, env: {} })` return `code: 1`, write
    nothing into `tmp`, and put the exact caption on stderr.
  - [ ] `[unit]` **Duplicated caption is fatal and named:** two dumps whose root names are
    equal make the run return `code: 1` with `frame_duplicated` and the caption in the
    message, and nothing is written.
  - [ ] `[unit]` **No token needed:** `runImport({ from, root: tmp, env: {} })` returns
    `code: 0` with `FIGMA_TOKEN` and `FIGMA_FILE_KEY` unset, and `wrote` lists
    `tokens.json`, `board.json`, one spec and one export.
  - [ ] `[unit]` **`--check --from`:** after a clean write into `tmp`, a second
    `runImport({ from, root: tmp, check: true, env: {} })` returns `code: 0` with an
    empty `drifted`; after changing **one byte** of `tmp/design/screens/02-options.json`
    (or of `tmp/design/tokens.json`) it returns `code: 1` and `drifted` contains that
    path, and the file is not repaired.
  - [ ] `[unit]` **Counts:** an offline run over the real 66 dumps into a temp `--root`
    writes exactly **33** `*.json` under `design/screens/` and exactly **33** `*.png`
    under `design/exports/`, and the two REST-mode tests of the current
    `importer.test.mjs` still pass unchanged (the REST path did not move).
  - [ ] `[live]` **The committed board verifies with no PAT.** With cwd = the worktree,
    build a temp root as the worktree's `design/` + `src/` copied under `$(mktemp -d)`
    (`node_modules` excluded, `scripts/` not needed), then run
    `node scripts/design/import.mjs --root "$TMP" --from design/frames` with
    `FIGMA_TOKEN` and `FIGMA_FILE_KEY` **unset**. Measurement, in this order:
    exit code **0**; `find "$TMP/design/screens" -name '*.json' | wc -l` = **33**;
    `find "$TMP/design/exports" -name '*.png' | wc -l` = **33**;
    `node scripts/design/check.mjs --root "$TMP"` exits **0** and prints exactly four
    lines, whose four names — `colour_outside_tokens`, `frame_without_component`,
    `snapshot_hash_mismatch`, `variant_missing` — appear once each, with
    `snapshot_hash_mismatch` reading `0 mismatched, 0 pending the import`. QA records
    the four lines and the two counts verbatim in its report.

- **A `[live]` that compares pixels is not a criterion** (`D57`).

## 📣 Coordination

- **For the Architect:** this closes the loop `[Task-223]` and `[Task-224]` are blocked
  on — the artifacts they need can now be produced offline with no PAT, so both rows
  can be freed once this merges (a plan change, not this task's edit).
- **For the next batch:** offline mode writes the **33 desktop** exports (the pinned
  measurement) and leaves the mobile rasters in `design/screens/`; the operator's REST
  run stays the only source of the 66-export set the old README describes.
- **For `[Task-223]`:** the rename must move `design/frames/` → `design/screens/` and
  `design/screens/*.png|svg` → `design/exports/*.png|svg`, which means this task's
  `--from` default in every doc example changes with it; the flag itself does not.
- The committed `design/tokens.json` and `design/board.json` are still the old
  exporter's on `main`; the offline run rewrites them in the new shape only under a
  `--root`, and never in the worktree.

## ⛔ Out of scope

- The rename (`[Task-223]`) and the spec-gap measurement (`[Task-224]`).
- Committing any generated artifact to `main`, and any write outside a `--root`.
- A `package.json` alias, a CI job, or any use of `FIGMA_TOKEN` in a task or a test.
- The mobile exports (see Coordination), the SVG rasters, and the old exporter
  (`export.mjs`, `frames.mjs`, `tokens.mjs`).
- `check.mjs`'s checks, `projectBoard`'s output shape, and any pixel comparison.
- Any change under `src/**` (no scene, no panel, nothing to run in a browser).
