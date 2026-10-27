# Spec: Task-185 — The evolution band draws every row the model returns

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene (`src/scenes/panels/`) + pure view data (`src/ui/hud/panels/`)
  + docs.
- **Role:** Dev.
- **Objective:** The STATS tab's evolution band stops at nine rows while
  `evolutionGraph` returns ten for an Eevee (eight evolutions, the Eevee row itself
  and its `Gigantamax Eevee` row), so the tenth row — the G-Max information row the
  model already holds — is never drawn. After this task the band's row **pool** covers
  the model's longest graph with headroom (`EVO_MAX_ROWS = 11`), the band's **window**
  is the ten rows the 460 × 560 card can hold (`EVO_WINDOW_ROWS = 10`, ending exactly
  on the card's inner bottom edge), a family longer than the window scrolls one row at
  a time through a `<` / `>` pair on the band's title row exactly as the learnset band
  scrolls, and an Eevee's STATS tab draws all ten rows with the G-Max row last. The two
  mirrored constants (`HUD_DETAIL_EVO_MAX` in the scene, `EVO_MAX_ROWS` in the UI
  module) collapse into **one** exported constant the scene imports, so they can never
  drift again.
- **Environment:** worktree `../wt-pkm-185`, branch `task-185`.
- **Dependencies:** none. Every input this task reads already ships on `main`:
  `evolutionGraph` / `FamilyNode` (`src/ui/evolutionGraph.ts`), `memberDetail`'s
  `evolutions` (`src/ui/partyDetail.ts`), the scroll arithmetic
  (`src/ui/scroll.ts`), the chrome tokens (`src/data/ui/chrome.json`) and the panel
  module itself. No batch-mate produces anything this task reads.

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.** No
other task in the batch may claim the same path. Deleting a stray `.gitkeep` from a
directory this task populates is always allowed.

- `src/scenes/panels/detail.ts`
- `src/ui/hud/panels/detail/evolution.ts`
- `src/ui/hud/panels/detail/evolution.test.ts`
- `src/ui/hud/panels/detail/README.md` — **only** the two role lines of
  `evolution.ts` and `evolution.test.ts` (lines 14-15). No other line of that file.
- `docs/design-spec.md` — **§3 (`## 3. The party`, lines 65-256) only.** `§2` belongs
  to another task in this batch. Do not open, touch or reflow `§2`, and do not touch
  any other `docs/*.md`.

Do **not** create a new test file: every test lives in
`src/ui/hud/panels/detail/evolution.test.ts`, which already exists (and therefore
needs no new README role line).

### Inputs (read-only)

Files this task may read, and only these, beyond `AGENTS.md` itself.

- `docs/design-spec.md` (read §3; write only §3)
- `docs/agent-spec-template.md`
- `src/scenes/panels/detail.ts` (the file you edit — read all of it first)
- `src/ui/hud/panels/detail/{evolution.ts,evolution.test.ts}` (the files you edit)
- `src/ui/hud/panels/detail/{view.ts,view.test.ts,detailPanel.tsx,detail.css,index.ts,fixture.test.ts,README.md}`
  — read to confirm nothing else consumes the rows you are windowing
- `src/ui/evolutionGraph.ts`, `src/ui/evolutionGraph.test.ts`
- `src/ui/partyDetail.ts`, `src/ui/scroll.ts`, `src/ui/frlg.ts`, `src/ui/frlgFont.ts`
- `src/scenes/panels/hud.ts`, `src/scenes/panels/pc.ts`, `src/scenes/panels/types.ts`
- `src/data/ui/chrome.json`, `src/data/dex/**` (dex accessors only)
- `src/engine/run/{state.ts,progression.ts}`, `src/ui/partyDetail.test.ts` (the
  `createRunPokemon` / `createRun` fixture pattern, if you build a member)
- `src/i18n/en.ts` (read only; `detail.evolution`, `detail.evoLevel`,
  `detail.clickToEvolve` already exist — this task adds **no** i18n key)
- `src/scenes/RouteScene.ts` (read only, to confirm you do not need it)

## 🔒 Contract

The public surface other tasks will be written against in parallel. It is a
promise, not a suggestion.

### TypeScript

`src/ui/hud/panels/detail/evolution.ts` — the band's geometry and data, pure:

```ts
/** The pool: the most rows the band will ever take from the model (the model's longest graph plus one row of headroom). */
export const EVO_MAX_ROWS = 11;

/** The window: the rows the 460 × 560 card can hold, drawn at once. */
export const EVO_WINDOW_ROWS = 10;

export const EVO_ROW_H = 28; // unchanged
export const EVO_INDENT = 34; // unchanged
export const EVO_PORTRAIT = 26; // unchanged
export const EVO_PAD_X = 8; // unchanged
export const EVO_LEVEL_CHAR_W = 6; // unchanged
export const EVO_LEVEL_INSET = 12; // unchanged

export type EvolutionEdge = Readonly<{ fromRow: number; toRow: number; d: string }>;

/**
 * The graph's rows and edges at `width`, capped to `EVO_MAX_ROWS` (the pool) and then
 * windowed to `EVO_WINDOW_ROWS` rows starting at `top` (clamped into
 * `[0, maxTop]`). `row` and `y` are **window-relative**, so the first drawn row is
 * always `{ row: 0, y: 0 }`. `height` is the height of the rows it draws.
 */
export function evolutionView(
  nodes: readonly FamilyNode[],
  width: number,
  top?: number,
): Readonly<{
  height: number;
  rows: readonly DetailEvolutionRowView[];
  edges: readonly EvolutionEdge[];
}>;
```

- **The return shape does not change**: still exactly `{ height, rows, edges }`.
  `src/ui/hud/panels/detail/view.ts` calls it with two arguments and keeps working
  untouched; its `DetailEvolutionView.box.h` stays `rows.length * EVO_ROW_H`.
- `top` defaults to `0`; it is clamped with the shipped `clampScrollTop` and the
  ceiling is `maxScrollTop(capped.length, 1, EVO_WINDOW_ROWS)`, so a caller may pass
  any number. `top` is an offset in **rows** (one column), not pixels.
- Row `i` of a window keeps `id`, `name`, `depth`, `level` (the
  `evolutionRowNote(node)` string: `'Lv 16'` or a stone name), `current`, `ready`,
  `kind` and `x` (`EVO_PAD_X + EVO_INDENT * depth`, unchanged), and its `parent` is
  still the family-absolute index of the parent row (unchanged meaning), while `row`
  and `y` are window-relative.
- The elbow `d` string is unchanged: `edgePath` keeps its arithmetic, and an edge is
  emitted only when both endpoints are inside the window.
- **Determinism:** `evolutionView` reads **no RNG**, no clock, no DOM and no Phaser;
  it is a total function of `(nodes, width, top)`. It imports the shipped
  `maxScrollTop` / `clampScrollTop` / `visibleRange` from `src/ui/scroll.ts` (the
  learnset band's own helper module) and nothing else new.

`src/scenes/panels/detail.ts` — the scene half:

```ts
// module state, next to the other evolution state
let hudEvoScrollTop = 0;

// the two scroll arrows the band draws on its title row, built in buildDetailPanel()
let hudEvoPrev!: Phaser.GameObjects.BitmapText;
let hudEvoNext!: Phaser.GameObjects.BitmapText;

/** The last row the band's window may start at, or 0 when the whole family fits. */
function maxEvoScrollTop(host: RoutePanelHost): number;

/** The band's scroll arrow under a panel-local point, or null. */
function evoNavAt(point: { x: number; y: number }): 'prev' | 'next' | null;

/** Moves the band's window `deltaRows` rows (clamped) and redraws when it moved. */
function scrollEvolutions(host: RoutePanelHost, deltaRows: number): void;
```

- `maxEvoScrollTop(host)` returns
  `maxScrollTop(Math.min(family.length, EVO_MAX_ROWS), 1, EVO_WINDOW_ROWS)`, where
  `family` is `memberDetail(host.run(), member.fighter.id)?.evolutions ?? []` for
  `detailMember(host)`; `0` when no member is open.
- `scrollEvolutions` reuses `scrollByRows(hudEvoScrollTop, deltaRows, max)`, returns
  without a repaint when the offset did not move (exactly the shape of the shipped
  `scrollLearnset`), otherwise stores the offset and calls `refreshDetail(host)`.
- The scene **imports** `EVO_MAX_ROWS`, `EVO_WINDOW_ROWS`, `EVO_ROW_H` and the
  already-imported `levelColumnWidth` from `'../../ui/hud/panels/detail/evolution'`
  (line 15 of the file already imports `levelColumnWidth` from that exact path; widen
  that import). The local constants `HUD_DETAIL_EVO_MAX` and `HUD_DETAIL_EVO_ROW_H`
  **are deleted**. `HUD_DETAIL_EVO_INDENT`, `HUD_DETAIL_EVO_TITLE_TOP`,
  `HUD_DETAIL_EVO_TOP`, `HUD_DETAIL_EVO_PORTRAIT_SCALE` and the three colour
  constants stay exactly as they are.
- **The cell pool is the window.** `buildDetailPanel` allocates
  `EVO_WINDOW_ROWS` (10) cell entries in `hudDetailEvoCells` instead of
  `HUD_DETAIL_EVO_MAX` (9) — only ten rows can be on screen, so ten is the number of
  row objects, portraits, names and stones the band owns. `EVO_MAX_ROWS` (11) is the
  cap the pool is read from (`detail.evolutions.slice(0, EVO_MAX_ROWS)`), never the
  number of Phaser objects.
- **`refreshDetailEvolutions` becomes a windowed draw**, and this is the whole shape of
  it (names are the shipped ones; do not invent new ones):
  ```ts
  const family = stats ? detail.evolutions.slice(0, EVO_MAX_ROWS) : [];
  const maxTop = maxScrollTop(family.length, 1, EVO_WINDOW_ROWS);
  hudEvoScrollTop = clampScrollTop(hudEvoScrollTop, maxTop);
  const { start, end } = visibleRange(hudEvoScrollTop, 1, EVO_WINDOW_ROWS, family.length);
  const nodes = family.slice(start, end);
  ```
  `show` becomes `stats && nodes.length > 0`. Row `i` of `nodes` is laid out at
  `rowY(i)` — the **window index**, not `node.row` (which is family-absolute) — and
  the elbow loop uses `node.parent` only when
  `node.parent >= start && node.parent < end`, drawing to and from
  `rowY(node.parent - start)`. Everything else in the function (colours, `clampDrawnName`,
  the level column, `portraitFor`, the `ready`/`current` fills, `cell.rect`) keeps its
  exact arithmetic.
- **The arrow pair** is the band's scroll affordance, built in `buildDetailPanel`
  beside `hudDetailEvoHint` and pushed into the same `children` array: `hudEvoPrev` is
  the text `<` right-aligned at `right − 26` and `hudEvoNext` the text `>` right-aligned
  at `right`, both at `y + HUD_DETAIL_EVO_TITLE_TOP`, `size: 16`, `origin: [1, 0]`,
  tint `FRLG_INK`, `setVisible(false)` at build (the shipped learnset arrows at
  `detail.ts` 1598-1607 are the model to copy, and they use the same literal glyphs —
  no i18n key). `refreshDetailEvolutions` sets `showNav = stats && maxTop > 0`, sets
  both visible to `showNav`, sets the alpha of each to `1` when it can move and `0.35`
  at its end (`hudEvoScrollTop > 0` for `prev`, `< maxTop` for `next`), and — only when
  `showNav` — moves `hudDetailEvoHint` to `right − 34` so the hint and the arrows never
  overlap; with no overflow the hint keeps the shipped `right` and nothing on screen
  moves.
- **The arrow hit test** is `evoNavAt(point)`, a byte-for-byte copy of the shipped
  `learnNavAt` arithmetic (`detail.ts` 985-991): `text.visible && Math.abs(point.x −
  text.x) <= 16 && Math.abs(point.y − (text.y + 8)) <= 16`, tested on `hudEvoPrev` then
  `hudEvoNext`. It is called as the **first** thing inside the
  `hudDetailState.tab === 'stats'` branch of `handleDetailPointerDown` (line 1172),
  before `abilityInfoAt`, and it answers
  `scrollEvolutions(host, nav === 'prev' ? -1 : 1); return true;`.
- Everything else on `descriptor` (the `RoutePanelDescriptor` this module exports),
  every other exported function of the module, and the whole DOM (`?hud=dom`) channel
  are **unchanged**: no new `DetailIntent`, no new export, no signature change.
- **Determinism:** layout reads no `Rng` and no clock. `hudEvoScrollTop` is view state
  and is never persisted; it resets to `0` in `openMemberDetail`, in
  `descriptor.build` and in `closeDom`.
- Rules: no Phaser value import in `src/ui/`; the scene module keeps importing Phaser
  type-only.

### Data

- No JSON key, no balancing value, no `src/data/` file and no i18n key is introduced.
  `SAVE_VERSION` does not move.

## 🧩 Data and configuration

Nothing to add. The only numbers this task freezes are the two exported constants
above, and the geometry that derives them (all shipped values, listed here so nobody
has to re-derive them):

| Quantity | Value | Where it lives |
| --- | --- | --- |
| Card size | 460 × 560 | `HUD_DETAIL_W` / `HUD_DETAIL_H` (`src/scenes/panels/detail.ts` 132-140), `DETAIL_PANEL_W` / `DETAIL_PANEL_H` (`view.ts` 150-151) |
| Band top, card-relative | 272 | `HUD_DETAIL_EVO_TOP` (`detail.ts` 157) = `DETAIL_EVO_TOP` (`view.ts` 211) = title 250 + 22 |
| Title row, card-relative | 250 | `HUD_DETAIL_EVO_TITLE_TOP` / `DETAIL_EVO_TITLE_TOP` |
| Row pitch / row rect height | 28 / 26 | `EVO_ROW_H` / `EVO_ROW_H - 2` |
| Window's baked bottom border | 8 | `src/data/ui/chrome.json` → `window.padding.bottom` |
| Card inner bottom, card-relative | 552 | `560 − 8` |
| **Ten-row budget** | `272 + 10 × 28 = 552` ✓ | exactly the inner bottom |
| Eleven-row budget | `272 + 11 × 28 = 580` > 552 ✗ | 20 px past the card — why the window is ten, not eleven |

At the shipped 1280 × 800 viewport the card docks at **(108, 72)**: the right column is at
`1280 − 344 − 8 = 928`, the PC box one column to its left at `928 − 344 − 8 = 576`
(`boxLeft()`/`boxTop()`, `src/scenes/panels/pc.ts` 431-436), and the detail window one
`HUD_GAP` to the left of the box: `576 − 460 − 8 = 108`, `y = boxTop() = 72` — the same
rect `detailPanelBox` returns for the DOM card, which `dockDetailPanelOnce`
(`src/scenes/panels/hud.ts` 502) re-applies on the first open. So in absolute canvas
pixels: band top `72 + 272 = 344`, row *i* top `344 + 28i`, row 9 (the tenth row)
`596…622`, card inner bottom `624`, card bottom `632`.

## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim. A criterion that cannot be executed by someone who has not
read the rest of the spec is not a criterion.

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task
    edits/extends in `src/ui/hud/panels/detail/evolution.test.ts`. Record the suite
    count before and after (it must only grow by the tests you add; the two existing
    expectations that pin `9` are updated, not deleted).
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-185` audit against the exclusive paths list
    (plus `.agent_specs/task-185.md`, which the Orchestrator force-adds, and
    `TODO.md`/`CHANGELOG.md`, which only the Orchestrator touches).
  - The `[live]` criteria need one browser pass: `npm run dev`, headless Chromium over
    CDP at a 1280 × 800 viewport, DPR 1, reading the live canvas with
    `renderer.snapshotArea` + `getImageData` (never a screenshot). **Light pixel** below
    means a pixel whose **r, g and b are each ≥ 0x80**; that threshold is safe because
    the card is `#10161f` at alpha 0.72 over the map, so even a white map cell blends to
    `0.28 × 255 + 0.72 × 16 ≈ 83 = 0x53` and can never reach `0x80`, while ink
    (`#f8fafc`), muted (`#94a3b8`) and accent (`#7dd3fc`) all do.
  - **Live recipe to reach the screen** (deterministic, no play RNG):
    1. Open the game, start a run (MAIN MENU → the run/starter flow), let the route
       load, and take the **control reading** described in the first `[live]` criterion
       below with the starter as it is (its family is short, so row 9 is empty).
    2. Over CDP `Runtime.evaluate`, swap the first party member's body for an Eevee and
       reload — this is a save edit, not a game rule:
       ```js
       const k = 'pokerandomlike.save';
       const doc = JSON.parse(localStorage.getItem(k));
       const f = doc.run.party[0].fighter;
       f.speciesId = 'eevee'; f.name = 'Eevee'; delete f.nickname;
       localStorage.setItem(k, JSON.stringify(doc));
       location.reload();
       ```
       (The member's moves, level and IVs are irrelevant to this band; only
       `fighter.speciesId` feeds `memberDetail` → `evolutionGraph`.)
    3. After the reload the route is up; click the first party row (the PARTY window is
       the right-hand column, its rows start just under its header) so the member
       detail window opens. It opens on **STATS** (`CLOSED_DETAIL` carries
       `tab: 'stats'`) and docks at **(108, 72)**. Confirm it is the right member and
       the right tab before measuring: the header must read `Eevee` and the band's
       title row must read `EVOLUTION`. If the window is not at (108, 72) or the header
       is not `Eevee`, **stop and report it** — do not adapt the coordinates below.

- **Acceptance criteria:** every one is tagged **`[unit]`** (a headless command, a
  decoded asset, a pinned number — seconds and deterministic) or **`[live]`** (it only
  exists in the running game: layering, overlap, a band, a beat, a colour on screen).
  QA runs them all, but its browser budget goes to the `[live]` ones, so an untagged
  criterion is a spec bug. A `[live]` criterion states its **measurement** — what to
  read, on which layout, against which bound — so QA reproduces it instead of
  inventing one.
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` The declared tests exist and pass.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched (including no new
        test file and no line of `docs/design-spec.md` §2).
  - [ ] `[unit]` **The pool covers the model.** In `evolution.test.ts`:
        `EVO_MAX_ROWS === 11`, `EVO_WINDOW_ROWS === 10`, and the Eevee family the model
        returns **fills the window exactly**: `evolutionGraph('eevee', 20).length ===
        EVO_WINDOW_ROWS` (10). `evolutionView(evolutionGraph('eevee', 20), 420)` returns
        `rows.length === 10`, `height === 280`, `edges.length === 9`, and
        `rows[9]` is `{ id: 'eeveegmax', name: 'Gigantamax Eevee', level: 'Eeveite G',
        kind: 'gmax', depth: 1, parent: 0, row: 9, y: 252, current: false, ready: false }`
        — the G-Max row is **last**, and `rows.filter((row) => row.ready)` has length 8.
        **And the pool covers every family the dex can produce:** a sweep over
        `playableSpecies()` (`src/data/dex/species.ts` 84-86) computing
        `evolutionGraph(species.id, 100).length` reports a maximum of **10** (an Eevee)
        and `EVO_MAX_ROWS >= that maximum` — one row of headroom, no family outside the
        pool. Report the measured maximum in the task's summary; if the sweep finds a
        family **longer** than 11, stop and say so instead of raising the constant
        silently.
  - [ ] `[unit]` **The two constants agree because there is only one.**
        `evolution.test.ts` reads `src/scenes/panels/detail.ts` as text (the pattern
        already used by `src/data/dex/evolutions.test.ts:246` and
        `src/ui/hud/mount.test.ts`) and asserts: (a) it contains no declaration of
        `HUD_DETAIL_EVO_MAX` or `HUD_DETAIL_EVO_ROW_H`, and (b) it imports
        `EVO_MAX_ROWS`, `EVO_WINDOW_ROWS` and `EVO_ROW_H` from
        `'../../ui/hud/panels/detail/evolution'`. The test must also assert
        `EVO_MAX_ROWS > EVO_WINDOW_ROWS` so the pool is a real pool.
  - [ ] `[unit]` **The window scrolls and clamps.** With an eleven-node chain:
        `evolutionView(nodes, 420)` returns 10 rows, first `n0`, last `n9`, last
        `y === 252`; `evolutionView(nodes, 420, 1)` returns 10 rows, first `n1`, first
        `y === 0`, last `n10`; `evolutionView(nodes, 420, 5)` is deep-equal to
        `evolutionView(nodes, 420, 1)` (the offset is clamped by the function itself);
        `maxScrollTop(11, 1, EVO_WINDOW_ROWS) === 1` and `visibleRange(1, 1, 10, 11)`
        is `{ start: 1, end: 11 }`. With a **thirteen**-node chain the pool cap bites:
        `evolutionView(nodes13, 420, 1).rows.at(-1)!.id === 'n10'` and
        `maxScrollTop(Math.min(13, EVO_MAX_ROWS), 1, EVO_WINDOW_ROWS) === 1`.
        `evolutionView` still never mutates the family (the shipped `Object.freeze`
        test keeps passing).
  - [ ] `[unit]` **The band's window ends on the card's inner edge, and eleven would
        not fit.** In `evolution.test.ts`, with literals and a comment naming each
        origin: `272 + EVO_WINDOW_ROWS * EVO_ROW_H === 552` (== `560 − 8`, the card
        height minus `chrome.window.padding.bottom`), `552 <= 560 - 8` and
        `272 + 11 * EVO_ROW_H > 552` — i.e. ten is the largest window the card holds.
  - [ ] `[unit]` **No layout reads RNG.** `grep -n "Rng\|rng" src/ui/hud/panels/detail/evolution.ts`
        is empty, and `evolution.ts` imports only `../../../evolutionGraph`, the
        `./view` type and `../../../scroll`.
  - [ ] `[live]` **The G-Max row is drawn, and it is the tenth row.** From the live
        recipe, read the **same rectangle** twice with
        `renderer.snapshotArea(150, 596, 398, 24)` + `getImageData` (row 9's own rect,
        x from 150 — the portrait/name column starts at `192` — to the card's inner
        right edge at 548):
        (a) with the starter, before the swap → **0 light pixels** (any starter's family
        is shorter than nine rows — three for a Bulbasaur, six for a Charmander — so the
        band draws nothing at all in that rect, and an inert row fills no background);
        (b) with the Eevee, after the swap → **≥ 100 light pixels** (the name
        `Gigantamax Eevee`, its stone `Eeveite G` right-aligned at x ≈ 548 and the
        elbow at x 141-160, y ≈ 610). Report both counts. A count of 0 in (b) means the
        tenth row is still clipped; a non-zero count in (a) means the control rect is
        wrong, not that the fix works.
  - [ ] `[live]` **The band still fits its window.** On the same Eevee screen, read
        `renderer.snapshotArea(108, 624, 460, 8)` (the frame's bottom band, from the
        card's inner bottom 624 to its bottom edge 632) → **0 light pixels**: the tenth
        row's rect ends at y 622, two pixels above the inner edge, and no glyph, stone
        or elbow crosses it. Then read `renderer.snapshotArea(108, 72, 460, 560)` and
        record its light-pixel count as delivered (no bound — it is the evidence the
        card is where the recipe says). Also read `renderer.snapshotArea(108, 596, 460, 26)`
        and confirm its light pixels sit **inside** 596…622, i.e. the row spans exactly
        one 28 px pitch starting at `344 + 9 × 28`.

## 📣 Coordination

Facts another role needs to know, and the shape of them. Anything another task
depends on that is not in the Contract above.

- **For the Architect:** the plan's "both constants move together" is resolved by
  removing the duplicate rather than by pinning two numbers: `HUD_DETAIL_EVO_MAX` is
  deleted and the scene imports `EVO_MAX_ROWS`, so there is nothing left to keep in
  step. The plan's single "pool" splits into two frozen numbers, and that split is the
  substance of the fix: `EVO_MAX_ROWS = 11` is the **pool** (how many rows the band
  will ever take from the model), `EVO_WINDOW_ROWS = 10` is the **window** (what the
  460 × 560 card holds: `272 + 10 × 28 = 552 = 560 − 8`). A pool of eleven with a
  window of ten is what makes the eleventh row scrollable instead of clipped.
- **For the batch-mates that hold `src/scenes/RouteScene.ts`:** this task does **not**
  touch `RouteScene.ts`. The wheel hook at line 1269 stays learnset-only; the evo
  band's scroll is a click on its own `<` / `>` pair, hit-tested inside
  `src/scenes/panels/detail.ts` by the same 16 px box arithmetic `learnNavAt` uses.
  No line of `RouteScene.ts` moves, so no path collides.
- **For Integration QA:** `docs/design-spec.md` is held by this task by section —
  **§3 only**. `§2` is **not** part of this batch (`[Task-181]` is blocked), so the
  combined document must read §2 untouched and §3 with exactly the one added clause
  described below.
- **For the next batch:** `EVO_MAX_ROWS` (11) and `EVO_WINDOW_ROWS` (10) are frozen
  exported names. A family that ever exceeds eleven rows needs a bigger **pool**
  (`EVO_MAX_ROWS`), not a smaller font and not a bigger `EVO_WINDOW_ROWS` — the window
  is geometry, not policy. The band's `<` / `>` pair is the affordance that keeps that
  legal.
- **For the docs pass:** `docs/design-spec.md` §3 gets **one** added clause, in the
  evolution paragraph right after "…each showing its sprite and the level it evolves
  at." (line 81), and nothing else in §3 changes:
  > The band draws **ten** rows at a time — the tallest family is exactly ten, an
  > Eevee's (its eight evolutions, the Eevee row itself and its Gigantamax row) — and
  > its window ends on the card's own inner bottom edge; a family longer than that
  > scrolls a row at a time through a `<` / `>` pair on the band's title row, drawn
  > only when there is more than the window holds, and the band's pool keeps
  > **eleven** rows so a future forme has a cell without another layout pass.

## ⛔ Out of scope

- **The DOM card's band gets no scroll control.** `evolutionView` windows itself, so
  `?hud=dom` shows the first ten rows and never overflows the card — that is all this
  task owes it. `view.ts`, `detailPanel.tsx`, `detail.css`, `mount.tsx` and
  `index.ts` are **not** edited: no `top` plumbed through `DetailPanelUi`, no arrow
  pair in the Preact card.
- **No wheel, no drag, no keyboard** for the evolution band: the wheel lives in
  `RouteScene.ts` (another task's path) and the band's rows are click targets, so the
  `<` / `>` pair is the whole affordance.
- **The panel does not grow.** `HUD_DETAIL_H` / `DETAIL_PANEL_H` stay 560, the card
  stays 460 × 560, `HUD_DETAIL_EVO_TOP` stays 272 and the row pitch stays 28. Do not
  shrink the font, the portrait or the indent to make eleven rows fit.
- **No change to `src/ui/evolutionGraph.ts`**: the model already returns the G-Max row
  last; the band was the limit.
- **No new tween, no animation, no scroll indicator, no persisted scroll offset**, and
  no `SAVE_VERSION` step.
- **No fixture work**: `design/fixtures/03m-panels-pokemon-moves.json` carries a
  six-row family and stays green untouched; do not add a ten-row fixture.
- **No refactor of the band's draw code into `evolution.ts`.** The canvas band keeps
  its own `refreshDetailEvolutions` arithmetic (portraits at `nodeX + 13`, elbows at
  `+13` / `−2`, names at `nodeX + 30`); only the **window** (`visibleRange`), the
  **ceiling** (`maxScrollTop`) and the **step** (`scrollByRows`) are shared with the
  pure module.
