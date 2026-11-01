# Spec: Task-245 — The compressed HUD is wired to its spec (`03c-panels-compress`)

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** HUD panel (Preact over the `#hud` layer) — DOM only: no engine rule,
  no Phaser scene, no data table, no asset.
- **Role:** Dev.
- **Objective:** after this task the frame `03c Panels · compress` is **measured** instead
  of `pending`: a new adapter `src/ui/hud/specGap.views/compress.ts` builds the compressed
  state — the strip the five collapsed cards leave behind — at 1280×800, claims the four
  chip letters the board and the strip agree on, claims no box because the badges are 26 px
  at docks the board does not use, and writes the rest down as measured numbers in the
  adapter's doc comment and in a new test: the board's five chips 12 px inside the
  `03 Route HUD` cards' corners against the strip's four flush at `defaultHudDock`, and the
  fifth chip (`key stats`, the detail card's) that the shipped strip has no badge for. No
  game behaviour and no pixel of the route changes.
- **Environment:** worktree `../wt-pkm-245`, branch `task-245`.
- **Dependencies:** none. The adapter contract (`src/ui/hud/specGap.views/README.md`,
  `specGap.ts`, `specGap.walk.test.ts`) and the precedents
  `src/ui/hud/specGap.views/notices.ts`, `.../hud.ts` and `.../detail.ts` are already
  merged.

### The measured facts this task is built on (verify them, then write them down)

- The frame is `03c Panels · compress` (`design/board.json`, node `2:466`), **6 boxes,
  5 strings, 5 colours**, viewport 1280×800. Its boxes are `route screenshot`
  `(0, 0, 1280, 800)` and **five chips and nothing else** — no card is drawn at all:

  | frame box | rect | letter | fill / stroke |
  | --- | --- | --- | --- |
  | `key bag` | `36, 36, 24, 24` | `I` | `#0b1017@0.5` / `#7dd3fc@0.55` |
  | `key map` | `942.59, 36, 29.18, 24` | `M` | `#0b1017@0.5` / `#7dd3fc@0.55` |
  | `key party` | `940, 320, 26, 26` | `P` | `#0b1017@0.5` / `#7dd3fc@0.55` |
  | `key pc` | `36, 360, 24, 24` | `C` | `#ffffff@0.06` / `#ffffff@0.16` |
  | `key stats` | `460, 100, 24, 24` | `S` | `#ffffff@0.06` / `#ffffff@0.16` |

  Each sits **12 px inside** a card corner the `03 Route HUD` frame draws: `bag panel`
  `24, 24`, `map panel` `928, 24`, `party panel` `928, 308`, `pc panel` `24, 348`, and the
  detail card's `448, 88` (`03m`'s measured card).
- **A collapsed card paints nothing of its own, chip included** (`docs/hud-fidelity.md`
  §5, "A panel's chip and its compressed state"): the strip's edge chip **is** the
  compressed form, so the compressed state is `stripView`'s, not the card's. That is why
  this row's panel (`party`) has no view of its own to build here.
- **There is no fixture, and none is needed.** `design/fixtures/03c-panels-compress.json`
  does not exist: `docs/hud-fidelity.md`'s measured table records this frame as `not
  framed` — "the compressed state lives in the saved layout, not in a `HudState`" — and
  `stripView` takes panel records and keybinds, never a `HudState`. Do **not** add a
  fixture; that path is not this task's.
- **The shipped strip draws four badges, not five.** `STRIP_CHIP_ORDER` is
  `['header', 'box', 'party', 'bag']` — there is **no chip for the detail card**
  (`panels/detail/README.md` rule 8: it is the one panel with no strip badge) — and each
  is `STRIP_CHIP_SIZE` = **26 × 26** with its panel's initial (`STRIP_CHIP_LETTERS`:
  `header` `M`, `box` `C`, `party` `P`, `bag` `I`).
- **Where a wide window puts them:** at the panel's own dock (`defaultHudDock`,
  `src/scenes/panels/hud.ts`), which at 1280×800 — `hudColumnLeft` = 1280 − 344 − 8 = 928,
  `HUD_TOP` 8, `HUD_CHIP_PITCH` 34 — is `header (8, 8)`, `party (928, 8)`, `bag (928, 42)`,
  `box (928, 76)`. The board's chips are at other corners and inset by 12 px, so **no box
  is claimable**: the deltas (shipped minus frame, in x and y) are `+892, +6` (bag),
  `−934.59, −28` (map), `−12, −312` (party) and `+892, −284` (pc) — before the sizes are
  compared: the board's chips are 24, 29.18, 26 and 24 wide against the strip's 26.
- **The party card's own chip is the same control**: `partyPanelView(...).chip` is
  `{ letter: 'P', box: { x: 0, y: 0, w: 26, h: 26 } }`, panel-relative, and its card docks
  at `(928, 8)` (`partyPanelBox({ width: 1280, height: 800 })`), i.e. the same rect the
  strip draws. The board's `key party` is `(940, 320, 26, 26)`: dy **−312**.
- **No colour is claimable.** The board's chips carry two fills; the strip's badge paints
  from `hud.css`'s tokens and `StripChip` carries no colour field at all (it has `id`,
  `letter`, `label`, `box`, `dx`, `dy`, `collapsed`).

### Exclusive paths (single writer)

- `src/ui/hud/specGap.views/compress.ts` — new.
- `src/ui/hud/panels/party/specGap.test.ts` — new.
- `src/ui/hud/panels/party/README.md` — **one new line** in its `## Layout` list, and
  nothing else in that file: the folder's title line names the frame its *paint* came from
  (frame `03b` draws the party group) and stays as it is.

**Nothing outside this list.** In particular, these two are **the Orchestrator's at
merge, not yours** — do not touch them, and do not "fix" the red they cause:

- `src/ui/hud/specGap.walk.test.ts` — its `PENDING` line for `03c-panels-compress`
  (`'the collapsed state; no view builder is wired'`) is deleted at merge. While it is
  still there the walker **fails on purpose**: its case
  `accounts for every screen: mapped, or a named reason` reports
  `screens both mapped and pending: 03c-panels-compress`. That single red is the expected
  state of your branch.
- `docs/hud-fidelity.md` — its `03c-panels-compress` row in `The spec gap, measured (D57)`
  flips from `pending` to `wired` at merge, in the same push.

Also do not touch `design/**`, `src/ui/hud/specGap.ts`, `specGap.views/notices.ts`,
`specGap.views/hud.ts`, `specGap.views/detail.ts`, `src/ui/hud/panels/party/view.ts`,
`partyPanel.tsx`, `party.css`, `src/ui/hud/panels/hud/**`, `src/scenes/**`,
`src/engine/**` or `package.json`.

### Inputs (read-only)

- `AGENTS.md`, `docs/agent-spec-template.md`, `docs/hud-fidelity.md` (§5 "Chips" and "A
  panel's chip and its compressed state", the measured table's `03c` row, and the
  `The spec gap, measured (D57)` table), `design/README.md`.
- `design/screens/03c-panels-compress.json` and `design/exports/03c-panels-compress.png` —
  frame **`03c Panels · compress`**, 1280×800.
- `src/ui/hud/panels/party/` — the whole folder, especially `view.ts` (`partyPanelBox`,
  `partyPanelView`, `PartyPanelView`, `PartyPanelUi`) and the `README.md`.
- `src/ui/hud/panels/hud/view.ts` — **read only**: `stripView`, `StripInput`, `StripSlot`,
  `StripChip`, `StripView`, `STRIP_CHIP_ORDER`, `STRIP_CHIP_LETTERS`, `STRIP_CHIP_SIZE`,
  `STRIP_NARROW`, `STRIP_PHONE_SLOTS` (the module's barrel, `src/ui/hud/panels/hud/index.ts`,
  re-exports them all).
- `src/scenes/panels/hud.ts` — read **only** for `defaultHudDock`, `hudColumnLeft`,
  `HUD_PANEL_MARGIN` and `HUD_TOP`, to derive the four docks at 1280×800.
- `src/data/keybinds.ts` (`DEFAULT_KEYBINDS`, the constant table) and
  `src/data/hudLayout.ts` (`HudPanelId`, `defaultHudLayout` — a fresh save opens only
  PARTY).
- `src/ui/hud/specGap.ts`, `src/ui/hud/specGap.test.ts`,
  `src/ui/hud/specGap.walk.test.ts`, `src/ui/hud/specGap.views/README.md`,
  `src/ui/hud/specGap.views/notices.ts`, `src/ui/hud/specGap.views/hud.ts`,
  `src/ui/hud/panels/hud/specGap.test.ts`.

## 🔒 Contract

`src/ui/hud/specGap.views/compress.ts` exports exactly two names:

```ts
export const slug = '03c-panels-compress';
export function buildView(spec: ScreenSpec): PanelView;
```

- `buildView` builds the compressed state exactly as the route scene builds it — every
  card collapsed, no saved offset:

  ```ts
  const DESKTOP = { width: 1280, height: 800 };
  const SLOTS: readonly StripSlot[] = [
    { id: 'header', x: 8, y: 8, dx: 0, dy: 0, collapsed: true },
    { id: 'box', x: 928, y: 76, dx: 0, dy: 0, collapsed: true },
    { id: 'bag', x: 928, y: 42, dx: 0, dy: 0, collapsed: true },
    { id: 'party', x: 928, y: 8, dx: 0, dy: 0, collapsed: true },
  ];
  const strip = stripView({ open: true, slots: SLOTS, keybinds: DEFAULT_KEYBINDS }, DESKTOP);
  ```

  The four docks are `defaultHudDock`'s own arithmetic at 1280×800, written down so the
  adapter has no host to ask; say so in the comment.
- **The chip names.** The frame names a card's own chip `key <panel>`, so a chip's box
  carries the board's name for its card:

  ```ts
  const CHIP_BOX_NAMES: Readonly<Record<StripChipId, string>> = {
    header: 'key map',
    box: 'key pc',
    party: 'key party',
    bag: 'key bag',
  };
  ```

  `specGap.views/hud.ts` keeps the same four pairs but does not export them, and that file
  is not this task's path: declare the table here and say in the comment that it is
  deliberately the same mapping, not a second rule.
- **Boxes:** `[]`. Claim a chip's box only when it is within `GAP_TOLERANCE` of the frame's
  box of that name, the way `specGap.views/detail.ts`'s `cardClaim` does, so a badge that
  ever lands on a board chip becomes a claim instead of a silent pass. At these docks all
  four are far outside the tolerance (the deltas above), so the claim is empty.
- **Strings:** exactly the four letters the strip prints, in `STRIP_CHIP_ORDER` — with
  `header` `M`, `box` `C`, `party` `P`, `bag` `I` the claim is `['M', 'C', 'P', 'I']` —
  and only those the frame's text tree carries (its `key letter map/bag/party/pc` nodes).
  The board's fifth letter, `S`, is **not** emitted: no shipped chip prints it.
- **Colours:** `[]`. The badge's fills and border are `hud.css`'s tokens and
  `StripChip` carries no colour.
- **Determinism:** reads no `Rng`, no clock, no DOM, no store and no scene. `stripView` is
  pure and `DEFAULT_KEYBINDS` is a constant table.
- You may read `spec` only as a **structural selector** — is this box name in the frame, is
  this letter the board's text. Never filter strings or colours by the spec's content
  beyond that.

### The table the doc comment carries

| frame box | frame rect | shipped (1280×800) | why not claimed |
| --- | --- | --- | --- |
| `key bag` | `36, 36, 24, 24` | `bag` chip at `defaultHudDock` = `928, 42, 26, 26` | dx +892, dy +6, dw +2, dh +2: the strip paints 26 px at the card's dock, the board 24 px inset 12 px inside a corner the shipped card does not use |
| `key map` | `942.59, 36, 29.18, 24` | `header` chip at `8, 8, 26, 26` | dx −934.59, dy −28, dw −3.18, dh +2 |
| `key party` | `940, 320, 26, 26` | `party` chip at `928, 8, 26, 26` (and `partyPanelView(...).chip` at the card's own corner, the same rect) | dy −312: the board docks the party card low and right, the shipped rail stacks it at the top; the 26 px size is the one thing the two agree on |
| `key pc` | `36, 360, 24, 24` | `box` chip at `928, 76, 26, 26` | dx +892, dy −284, dw +2, dh +2 |
| `key stats` | `460, 100, 24, 24` | — | **no shipped chip**: the strip's four ids are `header`/`box`/`party`/`bag`, and the detail card is the one panel with no badge (`panels/detail/README.md` rule 8) |
| `route screenshot` | `0, 0, 1280, 800` | — | the frame's painted scene |

And the two fills the board paints (`#0b1017@0.5` + `#7dd3fc@0.55` on bag/map/party,
`#ffffff@0.06` + `#ffffff@0.16` on pc/stats) are the stylesheet's business: the strip's chip
view has no colour and no "active" field.

## 🧩 Data and configuration

None. No new key, no new default, no run field, no layout field, no save version step —
`HudLayout` and `defaultHudLayout` are read, never written. **Do not create
`design/fixtures/03c-panels-compress.json`**: this state is the saved layout, not a
`HudState`, and the fixture folder is not this task's path.

## 🧪 Test and Validation Plan (for QA)

- **Method:** run from the task's worktree. `npm test` — Vitest, headless.
  `npm run build` — `tsc --noEmit && vite build`.
  `git diff --name-only main...task-245` — audit against the exclusive paths.
  One `[live]` pass, in the browser, below.
- **Acceptance criteria:**
  - [ ] `[unit]` `npx vitest run src/ui/hud/panels/party/specGap.test.ts` is green. It
    asserts: `slug === '03c-panels-compress'` and `SPEC.slug` the same; the spec carries
    **6 boxes, 5 text nodes and 5 colours**; `buildView(SPEC)` deep-equals
    `{ boxes: [], strings: ['M', 'C', 'P', 'I'], colours: [] }`;
    `gapIsEmpty(gapFor(buildView(SPEC), SPEC))` is `true`; `buildView(SPEC)` twice
    deep-equals itself.
  - [ ] `[unit]` The same file pins the **premise**: the frame's five chips and their rects
    are the table above (`key bag` `36, 36, 24, 24`; `key map` `942.59, 36, 29.18, 24`;
    `key party` `940, 320, 26, 26`; `key pc` `36, 360, 24, 24`; `key stats`
    `460, 100, 24, 24`) and its five letters are `I, M, P, C, S`; `STRIP_CHIP_ORDER`
    has exactly four ids; `stripView` with the four slots above yields four chips of
    `26 × 26` at `8, 8` / `928, 8` / `928, 42` / `928, 76`; and none of the four is within
    `GAP_TOLERANCE` of its board chip on any axis, which is why the box claim is empty.
  - [ ] `[unit]` The same file pins what the shipped strip cannot draw: the frame's
    `key stats` has no counterpart — `STRIP_CHIP_ORDER` lists no `detail`/`stats` chip —
    and `partyPanelView(fixtureOrEmptyState, { cursor: 0 }, { width: 1280, height: 800 })
    .chip` is `{ letter: 'P', box: { x: 0, y: 0, w: 26, h: 26 } }` at the card's corner
    `(928, 8)`, i.e. 312 px above the board's `key party`.
  - [ ] `[unit]` `npm test` fails **only** in `src/ui/hud/specGap.walk.test.ts` → `accounts
    for every screen: mapped, or a named reason`, with the message
    `screens both mapped and pending: 03c-panels-compress`. That red is the
    Orchestrator's `PENDING` flip at merge. No other test fails — quote the summary line
    in the report.
  - [ ] `[unit]` `npm run build` exits 0.
  - [ ] `[unit]` `git diff --name-only main...task-245` lists exactly
    `src/ui/hud/specGap.views/compress.ts`, `src/ui/hud/panels/party/specGap.test.ts` and
    `src/ui/hud/panels/party/README.md`. Nothing under `design/`, `src/scenes/`,
    `src/engine/`, `src/data/` or `.agent_specs/`.
  - [ ] `[unit]` `git diff` shows no change to `src/ui/hud/specGap.walk.test.ts`, to
    `docs/hud-fidelity.md`, to `design/fixtures/**`, or to any file of
    `src/ui/hud/panels/party/` other than the README's **one added line**.
  - [ ] `[live]` At **1280×800**, after NEW RUN → a starter → the first route, measured over
    CDP with `getBoundingClientRect()` and `document.querySelectorAll`: a fresh save opens
    only PARTY (`defaultHudLayout`), so the strip already draws three badges —
    `[data-hud-strip-chip="header"]` at `8, 8`, `[data-hud-strip-chip="bag"]` at `928, 42`,
    `[data-hud-strip-chip="box"]` at `928, 76`, each `26 × 26`. Press `P` to collapse the
    party card: a fourth badge appears at `928, 8`, the total is
    `document.querySelectorAll('[data-hud-strip-chip]').length === 4`, and no badge's
    `[data-hud-strip-letter]` reads `S`.
- **A `[live]` that compares pixels is not a criterion** (`D57`).

## 📣 Coordination

- **For the Orchestrator:** at merge, delete `'03c-panels-compress'` from the `PENDING` map
  in `src/ui/hud/specGap.walk.test.ts` **and** flip the `03c-panels-compress` row of
  `docs/hud-fidelity.md`'s `The spec gap, measured (D57)` table to `wired` — one push. The
  row's counts (6 / 5 / 5) stay as they are. This is the one row of the batch with **no
  fixture**: the measured table's `not framed` note stands and no file is added.
- **For the next batch:** `specGap.views/hud.ts` (Task-241) keeps a private
  `CHIP_BOX_NAMES` table with the same four pairs; if a third adapter ever needs it, that is
  the moment to export it from `panels/hud` — not this task, whose path is its own adapter.
  The strip's fourth letter and the board's fifth (`S`, the detail card's) stay apart until
  a frame draws a detail-card badge the card can paint.
- **Do not** put a test file inside `src/ui/hud/specGap.views/`: the walker globs
  `./specGap.views/*.ts` and treats **every** module there as an adapter, so a `*.test.ts`
  beside an adapter registers an adapter with an `undefined` slug and breaks the walker.

## ⛔ Out of scope

- Moving any card's dock or the strip's 26 px badge, insetting the chip 12 px inside the
  card, or giving the strip a fifth chip for the detail card: each is a `D49`-level
  geometry decision above this measurement.
- The board's two chip fills and any "active" state: the strip's chip has neither, and
  `hud.css` is not this task's path.
- The party card's own geometry, header, rows, portrait and Pokevial — that card is drawn
  open in frame `03b`, not here.
- The phone rail (`m03c-panels-compress`, `STRIP_PHONE_SLOTS`): `design/screens/` carries
  the desktop frames only.
- Touching `stripView`, `defaultHudDock`, `defaultHudLayout`, `specGap.ts`, the walker,
  `docs/hud-fidelity.md`, `design/**` or any test other than the one this task adds.
- New dependencies, refactors of `notices.ts`/`hud.ts`/`detail.ts`, prettier sweeps of
  unrelated files.
