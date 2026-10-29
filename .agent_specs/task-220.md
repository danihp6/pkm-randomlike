# Spec: Task-220 — The board is an imported spec: one map, one extractor, one command, four checks

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** tooling + docs (no game code, no scene, no data table, no asset).
- **Role:** Dev.
- **Objective:** the board stops being a picture a task matches and becomes a **spec in the
  repo**. After this task the repository holds a hand-authored map of the board
  (`design/import.json`, 33 desktop frames), a **pure** extractor that turns a Figma REST file
  payload plus that map into screen specs, a token table and a board index
  (`scripts/design/importer.mjs`), a **command** that fetches and writes those four artifact
  families and can re-verify them without writing (`scripts/design/import.mjs`), and a
  **checker** that runs four deterministic checks on the committed `design/`
  (`scripts/design/check.mjs`). `docs/tech-decisions.md` gains `D57` and `design/README.md`
  documents the map, the command, the four checks and the one repair rule ("a frame that stops
  matching the code is fixed in Figma or deleted"). **No pixel diff is written or read by
  anything this task adds.**
- **Environment:** worktree `../wt-pkm-220`, branch `task-220`.
- **Dependencies:** none. This task reads `design/board.json`, `design/frames/**` and
  `design/tokens.json` exactly as they are committed on `main` today.

### Exclusive paths (single writer)

Create or modify **only** these. Nothing else in the repository is yours to change.

- `design/import.json` (new — hand-authored map, 33 entries)
- `scripts/design/importer.mjs` (new — pure extractor)
- `scripts/design/importer.test.mjs` (new — Vitest, discovered by `npm test`)
- `scripts/design/import.mjs` (new — the command)
- `scripts/design/check.mjs` (new — the four checks)
- `scripts/design/check.test.mjs` (new — Vitest, discovered by `npm test`)
- `scripts/design/fixtures/map.json` (new — fixture map, one screen)
- `scripts/design/fixtures/file.json` (new — fixture `GET /v1/files/:key?depth=3` payload)
- `scripts/design/fixtures/nodes.json` (new — fixture `GET /v1/files/:key?ids=…&depth=30` payload)
- `scripts/design/fixtures/images.json` (new — fixture `GET /v1/images/:key?…` payload)
- `scripts/design/fixtures/exports/02-options.png` (new — fixture bytes, not decoded)
- `scripts/design/fixtures/exports/m02-options.png` (new — fixture bytes, not decoded)
- `scripts/design/README.md` (modify — folder map, `AGENTS.md` folder-README rule)
- `design/README.md` (rewrite — the folder's contract)
- `docs/tech-decisions.md` (**append one new block, `D57`, at the end of the file only**)

**Claimed hot files:** `docs/tech-decisions.md` — **this task owns only the new `D57` block,
appended after `D56`**. Batch-mate Task-221 owns the `D49` and `D50` sentences in the same
document (see Coordination). Do not touch `D49`, `D50` or any other `D##`.

**Do not claim:** `package.json` (Task-221 owns it — so no `npm run` alias for the new
scripts), `scripts/design/export.mjs`, `scripts/design/frames.mjs`,
`scripts/design/tokens.mjs`, `design/board.json`, `design/tokens.json`, `design/frames/**`,
`design/fixtures/**`, `design/screens/**`, `.gitignore`, `TODO.md`, `CHANGELOG.md`.

### Inputs (read-only)

Beyond `AGENTS.md` itself, you may read only these:

- `docs/agent-spec-template.md`
- `docs/tech-decisions.md` (`D49`, `D50`, `D51` for the house style of a `D##`)
- `docs/hud-fidelity.md` §1, §2, §5, §6 (the board's measured facts, the frame → node map)
- `docs/hud-dom-proposal.md` §11 (the export recipe this task replaces)
- `design/README.md`, `design/board.json`, `design/tokens.json`, `design/frames/**`
- `scripts/design/export.mjs`, `scripts/design/frames.mjs`, `scripts/design/tokens.mjs`
- `package.json`, `vite.config.ts`
- `src/scenes/**` and `src/ui/**` — **only** to resolve the `scene`/`panel` paths the map and
  the `frame_without_component` check name; never to change them
- `.prettierignore`

## 🔒 Contract

Four Node ESM modules (`type: module` is set in `package.json`). They are `.mjs`, not
TypeScript: no `tsc`, no build step, nothing under `src/`.

### `scripts/design/importer.mjs` — pure

```js
/**
 * @param {FigmaFile} file   a `GET /v1/files/:key` payload: `{ name, lastModified, document }`
 * @param {ImportMap} map    the parsed contents of `design/import.json`
 * @returns {{ screens: ScreenSpec[], tokens: Tokens, board: BoardIndex, problems: Problem[] }}
 */
export function projectBoard(file, map);

/** The board's own lower-kebab: `'03 Route HUD'` → `'03-route-hud'`. */
export function slugOf(name);
```

- **Purity:** no `fetch`, no `node:fs`, no `node:path`, no `Date`, no `Math.random`, no
  `process`. Calling it twice with the same two arguments returns deeply equal values in the
  same key order. It reads no file and touches no clock.
- **Determinism:** reads no RNG. Object keys are inserted in the order written below;
  `screens` follows `map.screens` order; every array of nodes is in document order;
  `colours` is sorted ascending (`Array.prototype.sort()`, default comparison).
- `slugOf(name)` is `name.toLowerCase().replace(/·/g, '-').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')`
  — byte-identical to `scripts/design/frames.mjs:39-45`, which you must not change. **Copy the
  body, do not import it from `./frames.mjs`**: that module also exports the old 33-row frame
  table, Task-223 retires it, and the map's slug rule must outlive it.

#### Inputs the extractor accepts

A **node** may arrive in either shape and both must be supported through one normaliser:

- REST shape: `{ id, name, type, absoluteBoundingBox: { x, y, width, height }, fills, strokes,
  cornerRadius, characters, style: { fontFamily, fontSize }, children }`
- exporter shape: the same fields nested under `properties` (`{ id, name, type, properties:
  { x, y, width, height, fills, strokes, cornerRadius, characters, fontName, fontSize },
  children }`) — the fixtures use it, because `design/frames/<slug>.json` already does.

Frozen normaliser rules:

- `props(node) = node.properties ?? node`
- `x/y/width/height` = `props.absoluteBoundingBox` **or** `props.{x,y,width,height}` (in that
  order), default `0`, each rounded with `Math.round(v * 100) / 100`.
- `radius` = `props.cornerRadius ?? 0`.
- A **paint literal** is `` `#${hex}@${alpha}` `` where `hex` is `paint.color.{r,g,b}` mapped
  per channel with `Math.round(clamp01(c) * 255).toString(16).padStart(2, '0')` and `alpha` is
  `paint.opacity ?? paint.a ?? 1` (same normalisation as `scripts/design/tokens.mjs:21-36`).
  A paint with no numeric `color` contributes nothing. Only `type: 'SOLID'` paints count.
- `fill` / `stroke` of a box = the literal of the **first visible** SOLID paint in
  `fills` / `strokes`, else `null`.
- `fontName` = `props.fontName ?? props.style?.fontFamily ?? null`; `fontSize` =
  `props.fontSize ?? props.style?.fontSize ?? null`.

#### Shapes (freeze these key names and orders)

```js
/** One entry of `design/import.json`. */
{ slug, caption, panel, scene, mobile, states, snapshot }

/** What `projectBoard` returns per mapped desktop frame; the file written to design/screens/<slug>.json. */
{
  slug:        '02-options',
  caption:     '02 Options',
  nodeId:      '1:1557',
  viewport:    { width: 1280, height: 800 },
  mobile:      { slug: 'm02-options', nodeId: '8:3231' },   // or null
  states:      [],                                          // copied from the map
  boxes:       [ Box, ... ],                                // every non-TEXT node under the root, root excluded, document order
  text:        [ Text, ... ],                               // every TEXT node under the root, document order
  colours:     [ '#10161f@0.92', ... ],                     // every paint literal of boxes+text, distinct, ascending
  snapshot:    { file: 'design/exports/02-options.png' }    // import.mjs adds sha256 + bytes
}
Box  = { id, name, type, x, y, width, height, radius, fill, stroke }
Text = { id, name, characters, fontName, fontSize, x, y, width, height, fill }

/** Written to design/tokens.json. */
{ panel, row, accent, text, type, scale, panelWidth, gutter, panelWidthVariants,
  gutterVariants, safeArea, panelBounds, grid, palette, source, warnings }

/** Written to design/board.json. */
{ page: 'Page 1', frames: { [desktopSlug]: { name, panel, scene, desktop, mobile,
  exports: { [slug]: { nodeId }, [mobileSlug]: { nodeId } } } } }

Problem = { code: 'frame_missing' | 'mobile_missing' | 'variant_missing', slug, detail }
```

- `tokens` is derived **from the mapped viewports only** (each entry's desktop frame and its
  mobile twin) by the *same* measurement as `scripts/design/tokens.mjs:11-183` — panel/row
  fills, border, radii, the type scale with its boxes, panel width and gutter with their
  variants, panel bounds, grid pitch and offset, `safeArea` as the constant
  `{ top: 47, bottom: 810, source: 'docs/hud-fidelity.md §5, not drawn on the board' }`,
  and `text`/`accent` from that file's `ROLES` table. Two differences, both frozen:
  - `palette` is **complete**: every distinct `#rrggbb@alpha` the walk saw, sorted by `count`
    descending then `colour` ascending, each `{ colour, alpha, count }`. **No `top(24)`
    truncation** (this is what makes `colour_outside_tokens` true by construction).
  - `source` is `{ frames: <viewports walked>, textSizes: <distinct sizes> }`. **No date, no
    `generatedAt`, no `exportedAt`** anywhere in any generated artifact: the artifacts must be
    byte-identical when regenerated from the same Figma revision, or `--check` could never
    pass.
- `board.frames` has **no `task` key, no `files` key and no `generatedAt`**: node ids only.
  (`scripts/design/export.mjs` may still read an old `board.json`; it is not run by any gate
  and Task-223 retires it. Its shape is an input, never a target.)
- A `map.screens` entry whose `caption` matches no frame in `map.page` produces one
  `frame_missing` problem and is **omitted** from `screens`/`board`; a matching frame whose
  `mobile` twin is absent produces `mobile_missing` and that entry's `mobile` is `null`; a
  `states[]` value that is not a key of `board.frames` and not an `exports` key produces
  `variant_missing`. Problems are data — the extractor never prints and never throws.

### `scripts/design/import.mjs` — the command

```js
/**
 * @returns {Promise<{ code: 0|1|2, wrote: string[], drifted: string[], problems: Problem[] }>}
 */
export async function runImport({ root = process.cwd(), env = process.env,
  fetch = globalThis.fetch, check = false } = {});
```

`runImport` is callable from a test; the CLI tail is only

```js
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) { /* parse argv, run, process.exit(code) */ }
```

(see `scripts/hud/diff.mjs:637-642` for the pattern this repo uses; that file is read-only
for you and is deleted by a batch-mate).

**Behaviour, in this order — the order is part of the contract:**

1. `env.FIGMA_TOKEN` empty/missing → print `missing FIGMA_TOKEN` on stderr, **make no request**,
   `code: 2`. Then `env.FIGMA_FILE_KEY` the same way. Both missing names `FIGMA_TOKEN` first.
2. Read `<root>/design/import.json`. Parse failure or 0 screens → stderr, `code: 2`.
3. Requests, all with header `X-Figma-Token: <token>` on `api.figma.com` only:
   - `GET https://api.figma.com/v1/files/<fileKey>?depth=3` — the page/frame index.
   - `GET https://api.figma.com/v1/files/<fileKey>?ids=<comma-joined ids>&depth=30` — the
     subtrees, where `ids` is every mapped desktop node id **and** every mobile twin id, in
     map order. (Same endpoint as the first call: `depth=3` indexes, `ids`+`depth=30` walks.
     One endpoint, two calls.)
   - `GET https://api.figma.com/v1/images/<fileKey>?ids=<same ids>&format=png&scale=2` →
     `{ images: { [nodeId]: '<absolute url>' } }`, then one plain `fetch(url)` per image (no
     auth header, absolute URL, no `api.figma.com` prefix).
4. Resolve the page by `name === map.page`, take the frame ids from the index by name
   (a desktop frame by `caption`; its twin by `M <caption>`), and rebuild one file payload for
   the extractor:
   `document = { id: '0:0', name: <index.name>, type: 'DOCUMENT', children: [page] }`,
   `page = { id: <pageId>, name: map.page, type: 'CANVAS', children: [<full-depth nodes from the ids payload, index order>] }`
   (the ids payload is `{ err, nodes: { [id]: { document: <node> } } }`).
5. `projectBoard(file, map)`. Any `frame_missing`/`mobile_missing` → print each problem, write
   nothing, `code: 1`. `variant_missing` problems are printed and are **not** fatal.
6. Merge each screen's `snapshot`: `{ file: 'design/exports/<slug>.png', sha256:
   createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length }`.
7. Write, in this order, `JSON.stringify(value, null, 2) + '\n'` for JSON and the raw bytes for
   PNG:
   - `<root>/design/tokens.json`
   - `<root>/design/board.json`
   - `<root>/design/screens/<slug>.json` (desktop slugs only — 33)
   - `<root>/design/exports/<slug>.png` (desktop **and** mobile slugs — 66)
   `wrote` lists the same paths, relative to `<root>`, in that order. `mkdir` only
   `design/screens` and `design/exports`, only when writing.
8. `check: true` (`--check`): same fetches, same computation, **no write at all**. Compare each
   target file byte-for-byte with what is on disk; `drifted` lists every path that differs or is
   missing (relative to `<root>`, ascending); `code: drifted.length ? 1 : 0`. Print each
   drifted path. A missing artifact is drift, never "nothing to do".
9. Never creates `design/exports/` or `design/screens/*.json` when `--check` is set, and never
   touches `design/frames/**` or `design/fixtures/**`.

CLI: `node scripts/design/import.mjs [--check] [--root <dir>]`. Exit code = `code`.

### `scripts/design/check.mjs` — the four checks

```js
export const CHECK_NAMES = Object.freeze([
  'colour_outside_tokens', 'frame_without_component', 'snapshot_hash_mismatch', 'variant_missing',
]);

/**
 * @returns {{ code: 0|1, lines: string[],
 *   report: { colour_outside_tokens: string[], frame_without_component: string[],
 *             snapshot_hash_mismatch: string[], variant_missing: string[] } }}
 */
export function runCheck({ root = process.cwd() } = {});
```

- **No network, no token, no browser, no clock.** It reads `<root>/design/import.json`,
  `<root>/design/board.json`, `<root>/design/tokens.json`, and — when they exist —
  `<root>/design/screens/<slug>.json` and `<root>/design/exports/<slug>.png`.
- `lines` is **exactly four strings**, one per name in `CHECK_NAMES` order, each starting with
  its name: `` `colour_outside_tokens: <summary>` ``. Nothing else is printed; diagnostics go
  inside that one line.
- `code` is `1` only when a **fatal** check has at least one violation. `variant_missing` is
  report-only and never changes `code`.

Frozen semantics:

1. **`colour_outside_tokens`** — *fatal*. The token set is every `` `#rrggbb@alpha` `` that
   appears anywhere in `design/tokens.json`: each `palette[]` entry as `colour@alpha`, plus
   `panel.fill@panel.alpha`, `panel.border.colour@panel.border.alpha`, `row.fill.colour@row.fill.alpha`,
   `row.border.colour@row.border.alpha`, `accent@1`, and every `text.<role>@1`. For every mapped
   entry, if `design/screens/<slug>.json` exists, each string in its `colours` array must be in
   that set; a missing one is a violation `"<slug>: <literal>"`. With no `design/screens/*.json`
   at all the summary reads `0 screens (run the import)` and there are no violations. (At the
   end of this task the family does not exist yet: the line is green and says so. The predicate
   is exercised on fixtures by `importer.test.mjs` and `check.test.mjs`.)
2. **`frame_without_component`** — *fatal*. For every entry: (a) `scene` must exist on disk as a
   file or a directory; (b) `panel` must match `/^[a-z][a-z0-9-]*$/` and equal
   `design/board.json`'s `frames[slug].panel`; (c) the panel must have a component —
   `src/ui/hud/panels/<panel>/` exists, **or** a file `src/ui/<panel>Panel.ts` exists. One
   violation per broken rule, `"<slug>: scene <path> is missing"` /
   `"<slug>: panel does not match the board"` / `"<slug>: no component for panel <panel>"`.
   (This is what catches `03h-panels-rocket-slots`, whose committed board row still points at
   `src/scenes/rooms/casino.ts`: the map carries the corrected `src/ui/rocketPanel.ts`, so the
   row passes and the stale index is left to the operator's run. See Data.)
3. **`snapshot_hash_mismatch`** — *fatal for pairs that exist*. For every entry with
   `snapshot: true`: if **both** `design/screens/<slug>.json` and `design/exports/<slug>.png`
   exist, recompute the PNG's sha256 with `node:crypto` and compare it with the spec's
   `snapshot.sha256`; also require `spec.snapshot.file === 'design/exports/<slug>.png'`. A
   mismatch or a missing/extra key is a violation `"<slug>: 1 byte moved"`-style, naming the
   expected and found hash. If either file is absent the entry is *pending*: the summary reads
   `0 mismatched, <n> pending the import` and `code` stays `0`. (This is deliberate and
   frozen: the 33 specs and 66 PNGs only exist after the operator's REST run, which happens
   **after** the merge. The check is green before it and fatal after it.)
4. **`variant_missing`** — *report-only*. For every entry, each `states[]` value and its
   `mobile` slug must resolve to a frame: a key of `design/board.json.frames`, or a key of any
   `frames[*].exports`. Unresolved → one report line `"<slug>: <variant> has no frame"`, `code`
   unchanged.

CLI: `node scripts/design/check.mjs [--root <dir>]` — prints the four `lines`, exits `code`.

## 🧩 Data and configuration

### `design/import.json` (new, hand-authored, committed)

```json
{
  "fileKey": "nfyJ8Yerc6lL1BouvCAfd3",
  "page": "Page 1",
  "screens": [
    { "slug": "01-main-menu", "caption": "01 Main menu", "panel": "main-menu",
      "scene": "src/scenes/MainMenuScene.ts", "mobile": "m01-main-menu",
      "states": [], "snapshot": true }
  ]
}
```

- **Exactly 33 entries**, one per desktop frame of `design/board.json`, ordered by `slug`
  ascending. The 33 captions are `design/README.md`'s table rows, verbatim, middle dot
  (U+00B7) included.
- `caption` = the frame name exactly as drawn = `design/board.json`'s `frames[<slug>].name`.
- `panel` = `frames[<slug>].panel`; `mobile` = `"m" + slug` (all 33 frames have a mobile twin —
  `design/board.json` carries no `"mobile": null`); `states` = `[]` for all 33 this task (the
  board's variants are separate mapped screens, not state variants; the key exists so a future
  variant has a home and `variant_missing` can report it); `snapshot` = `true` for all 33.
- `scene` = `frames[<slug>].scene` **except** `03h-panels-rocket-slots`, which carries
  `"src/ui/rocketPanel.ts"`. Reason, verified on the tree: `design/board.json:229` still says
  `src/scenes/rooms/casino.ts`, that file does not exist, and `CHANGELOG.md:1602` records that
  `src/scenes/rooms/casino.ts` was `git mv`'d to `src/ui/rocketPanel.ts` by `[Task-117]`. The
  map is the hand-authored truth; the stale generated index is the operator's run to refresh.
- Formatting: run `npx prettier --write design/import.json` and commit its output
  (`design/import.json` is **not** in `.prettierignore`, unlike `design/board.json`).

### `design/screens/<slug>.json`, `design/exports/<slug>.png`, `design/tokens.json`, `design/board.json`

- Written by `import.mjs` **only**. **You commit none of them**: this task ships the command,
  the fixtures and the checks. The operator runs `node scripts/design/import.mjs` with the PAT
  after the merge and commits the four artifact families (66 PNGs ≈ 10 MB, 33 specs, the token
  table and the board index).
- Byte determinism is contractual: 2-space JSON, trailing newline, the key orders above,
  no timestamps, no floating-point reformatting beyond `Math.round(v * 100) / 100`.
- `design/tokens.json` keeps **every top-level key the committed file has today** — it is
  imported by `src/ui/hud/panels/notices/view.test.ts` and read by the CSS/chrome pipeline, so
  a key that disappears is a build break and out of scope. Only `palette` (complete) and
  `source` (no date) change.
- `design/frames/**`, `design/fixtures/**` and `design/screens/*.png|svg` stay exactly as they
  are: the old exporter's frames are still the `?hudFixture` source, and the PNGs are the
  reference Task-223 moves to `design/exports/`.

### `docs/tech-decisions.md` — `D57` (append at the end of the file)

Title: `## D57 — The board enters as a spec: one map, one extractor, one command, four checks *(decided)*`.
It must record, in this order: (1) the board is read and current (`lastModified
2026-10-21T18:23:44Z`, 66 frames, 33 desktop, **0 styles, 0 components**, so every colour is a
literal fill, file key `nfyJ8Yerc6lL1BouvCAfd3`); (2) the repo holds the map and the generated
specs, Figma imports one way; (3) **it amends `D49`'s measured gate**: geometry/colour
comparison against a raster is retired as a gate and replaced by these four checks, and
identity is read from the spec, not from a screenshot; (4) it **cites `D50`**: the rasters stay
in the repo as the board's own record and move to `design/exports/`; (5) the four checks, which
are fatal and which is report-only, and why `snapshot_hash_mismatch` is fatal only for pairs
that exist; (6) the operator's run is not the loop's: the command ships here, the artifacts land
after the merge; (7) the repair rule, verbatim: **"a frame that stops matching the code is
fixed in Figma or deleted"**. Cite `[Task-220]` and `[Task-223]` by name.

### `design/README.md` and `scripts/design/README.md`

- `design/README.md` is rewritten as the folder's contract and must contain, as headings or
  table rows: what the folder is now (`D57`); the `import.json` shape and that it is
  hand-authored; the command with its two env vars, its four artifact families and `--check`;
  the four checks in a table with a **fatal / report-only** column; the operator's run and that
  the loop never performs it; the repair rule quoted above; the frame → scene map (keep the 33
  rows); a note that `design/fixtures/<slug>.json` is the panel's copy for `?hudFixture`, **not**
  the spec. It must contain **no** reference to `scripts/hud/diff.mjs`, `npm run hud:diff` or
  `design/diff/` (they describe a gate `D57` retires; Task-221 deletes the harness).
- `scripts/design/README.md`: add one role line per new file (`importer.mjs`, `import.mjs`,
  `check.mjs`) in the existing bullet style, and rewrite line 4 so it no longer names
  `scripts/hud/diff.mjs` (`AGENTS.md` folder-README rule; that one line is also on Task-221's
  grep path).

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including `scripts/design/importer.test.mjs`
    and `scripts/design/check.test.mjs` (default Vitest discovery picks up `*.test.mjs`).
  - `npm run build` — `tsc --noEmit && vite build`; must be green (this task touches no `src/`).
  - `git diff --name-only main...task-220` audited against the exclusive paths above.
  - `npx prettier --check design/import.json design/README.md` (both are outside
    `.prettierignore`; `scripts/**` and `docs/tech-decisions.md` are ignored by it).
  - **Every criterion below is `[unit]`. This task owes no browser pass at all:** nothing it
    adds runs in the page. `node scripts/design/check.mjs` is a headless command, so the
    backlog entry's `[live]` tag for it is corrected to `[unit]` here.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` exits 0.
  - [ ] `[unit]` `npm test` exits 0, and `npx vitest run scripts/design/importer.test.mjs scripts/design/check.test.mjs` exits 0.
  - [ ] `[unit]` `node scripts/design/check.mjs` exits **0** on the tree as this task leaves it, and its stdout is exactly four lines starting `colour_outside_tokens:`, `frame_without_component:`, `snapshot_hash_mismatch:`, `variant_missing:` — once each, in that order. Measurement: `node scripts/design/check.mjs; echo "exit=$?"`, then `node scripts/design/check.mjs | wc -l` → `4`.
  - [ ] `[unit]` On the committed `design/`, `colour_outside_tokens` and `snapshot_hash_mismatch` report **zero violations** and say so (`0 screens (run the import)` / `0 mismatched, 33 pending the import`), because `design/screens/<slug>.json` and `design/exports/**` do not exist yet. Measurement: `node scripts/design/check.mjs | grep -c "0 screens (run the import)"` → `1`; `node scripts/design/check.mjs | grep -c "33 pending the import"` → `1`.
  - [ ] `[unit]` `frame_without_component` reports 0 violations for all 33 entries. Measurement: `node scripts/design/check.mjs | grep "^frame_without_component:"` shows `0` violations.
  - [ ] `[unit]` `node scripts/design/import.mjs` with no token makes **no request** and exits **2** naming the variable. Measurement: `env -u FIGMA_TOKEN -u FIGMA_FILE_KEY node scripts/design/import.mjs; echo "exit=$?"` → stderr contains `FIGMA_TOKEN`, no HTTP line, `exit=2`. The unit test asserts the injected `fetch` was called 0 times.
  - [ ] `[unit]` `design/import.json` parses to exactly 33 screens, ordered by slug, every `caption` equal to `design/board.json`'s `frames[<slug>].name` (byte equality, middle dot included), every `panel` equal to the board's, and every `mobile`/`states` slug resolving through `board.json` (`exports` keys count). Asserted by `importer.test.mjs`; measurement: `npx vitest run scripts/design/importer.test.mjs -t "shipped map"`.
  - [ ] `[unit]` `node -e "const m=require('./design/import.json');const s=m.screens.map(x=>x.slug);if(m.screens.length!==33||JSON.stringify(s)!==JSON.stringify([...s].sort()))process.exit(1);if(m.screens.some(x=>x.snapshot!==true||!Array.isArray(x.states)))process.exit(1);console.log('ok 33')"` prints `ok 33` and exits 0.
  - [ ] `[unit]` `projectBoard` over the fixtures returns exactly one screen, one board entry and a tokens table whose `palette` contains every literal in that screen's `colours`, and adding a colour to a fixture node makes it appear in `palette` (no truncation). Asserted by `importer.test.mjs`; measurement: `npx vitest run scripts/design/importer.test.mjs -t "fixtures"`.
  - [ ] `[unit]` An injected `fetch` writes the four artifact families under a temp root and `--check` exits 1 when one byte moves; a one-byte PNG edit is a `snapshot_hash_mismatch` violation, and a declared state with no frame is a report-only line that leaves the exit code at 0. Asserted by `check.test.mjs`; measurement: `npx vitest run scripts/design/check.test.mjs`.
  - [ ] `[unit]` `grep -n "hud/diff\|hud:diff\|design/diff" design/README.md scripts/design/README.md` prints nothing (exit 1).
  - [ ] `[unit]` `npx prettier --check design/import.json design/README.md` exits 0.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched: `git diff --name-only main...task-220` lists only the 15 paths above; in particular `package.json`, `design/board.json`, `design/tokens.json`, `design/frames/**`, `design/fixtures/**`, `design/screens/**`, `src/**` and `TODO.md` are absent.
  - [ ] `[unit]` `docs/tech-decisions.md` gained one block: `git diff main...task-220 -- docs/tech-decisions.md` shows only added lines at the end of the file, starting `## D57`, and no line inside `D49`, `D50` or `D51` is changed or deleted.

## 📣 Coordination

- **Task-221 (same batch) edits `docs/tech-decisions.md` too**, by section: it owns the `D49`
  "Identity is a test, not a look" paragraph and the `D50` "escape hatch" sentence, which name
  `hud:diff` / `scripts/hud/diff.mjs` and must stop doing so. **You own only the appended `D57`
  block.** Append it at the end of the file (after `D56`) so the two diffs never share a hunk.
- **Task-221's grep gate covers `scripts/design/README.md`.** Its criterion is
  `grep -r "hud/diff\|hud:diff" src scripts docs package.json` → nothing, and that folder README
  currently says ``the fixtures and `scripts/hud/diff.mjs` read``. Removing that reference is
  yours (the folder's README is yours under the `AGENTS.md` rule); Task-221 cannot do it.
- **`design/board.json` stays untouched and is partly stale.** Its `03h-panels-rocket-slots`
  row points at `src/scenes/rooms/casino.ts`, which does not exist. The map carries the correct
  `src/ui/rocketPanel.ts`; `check.mjs` validates the **map**, not the stale index. The
  operator's import rewrites `board.json` from the map and the Figma file.
- **Nothing here is `npm run`-able.** `package.json` belongs to Task-221 this batch, so both
  commands are invoked by path. A future task may add `design:import` / `design:check` aliases.
- **The operator's run is post-merge, and it is not yours.** Do not call Figma, do not set
  `FIGMA_TOKEN`, do not commit `design/screens/<slug>.json` or `design/exports/**`.
- **For Task-223 (next batch, unscheduled):** it moves `design/frames/<slug>.json` →
  `design/screens/<slug>.json` and `design/screens/<slug>.png|svg` → `design/exports/<slug>.png|svg`
  and reconciles the two JSON shapes (the exporter's geometry dump and this task's screen spec).
  `design/README.md` already names the destination paths, so the move is a rename plus a shape
  upgrade, not a redesign.
- **For the next batch:** `D57` fixes the check names (`colour_outside_tokens`,
  `frame_without_component`, `snapshot_hash_mismatch`, `variant_missing`) and the two
  invocation paths. `node scripts/design/check.mjs` is the only gate a screen task runs; a
  `[live]` that compares pixels is no longer a criterion.

## ⛔ Out of scope

- No `src/` change of any kind: no scene, no panel, no `TilesetConfig`, no test under `src/`.
- No `package.json` script, no dependency (`pngjs`/`pixelmatch` are Task-221's question, not
  yours — you decode no image, only hash bytes).
- Do not touch `scripts/design/export.mjs`, `frames.mjs` or `tokens.mjs`: the old exporter stays
  exactly as it is; `tokens.mjs`'s `top(24)` palette is *read* as evidence, never edited.
- Do not delete, move or rewrite `design/frames/**`, `design/fixtures/**`,
  `design/screens/**`, `design/board.json` or `design/tokens.json`.
- No pixel diff, no screenshot, no Chrome, no CDP, no Playwright: `D57` retires that method and
  this task writes nothing that compares pixels.
- No `TODO.md`, `CHANGELOG.md` or `.gitignore` edit (the `design/diff/` ignore line stays; it is
  the Orchestrator's).
- Do not "fix" `design/board.json`'s stale rocket row, and do not regenerate the dex, pack an
  atlas or touch a scene.
