# Spec: Task-250 — The mini-boss reward's item rows are wired to its spec (`03f-panels-reward-item`)

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** HUD panel (Preact over the `#hud` layer) — DOM only: no engine rule,
  no Phaser scene, no data table, no asset.
- **Role:** Dev.
- **Objective:** after this task the frame `03f Panels · reward item` is **measured** instead of
  `pending`: a new adapter `src/ui/hud/specGap.views/rewards-item.ts` builds the mini-boss
  reward card's `PanelView` from `design/fixtures/03f-panels-reward-item.json` at 1280×800 and
  **claims the card**: the panel, its highlight and its three rows are the board's own rects to
  the pixel, and all nine lines the card prints are the board's — the first fully-claiming row
  of this wave. It also claims the two rects the card lands on that the board draws as **text
  nodes** (the ✕ and the title, `gapFor` compares boxes to boxes) as strings only, and records
  the one box it cannot claim (`item icon n`, an atlas cell with no rect in the view model) in
  the adapter's doc comment and in a new test. No game behaviour and no pixel of the route
  changes.
- **Environment:** worktree `../wt-pkm-250`, branch `task-250`.
- **Dependencies:** none. The adapter contract (`src/ui/hud/specGap.views/README.md`,
  `src/ui/hud/specGap.ts`, `src/ui/hud/specGap.walk.test.ts`) and the precedents
  `src/ui/hud/specGap.views/main-menu.ts` (a claiming adapter) and `.../bag.ts` (the claim
  helper) are already merged.

### The measured facts this task is built on (verify them, then write them down)

- The frame is `03f Panels · reward item` (`design/screens/03f-panels-reward-item.json`, caption
  exactly `03f Panels · reward item`, `design/board.json` node `6:1447`), viewport **1280×800**,
  and it carries **10 boxes, 9 text nodes and 10 colours**. Its panel is **`rewards`**
  (`design/import.json`'s `panel` column; the scene module is `src/scenes/panels/rewards.ts`,
  the Preact card `src/ui/hud/panels/rewards/`).
- **This frame is the shipped card.** Measured, on the frame's own boxes: `reward panel`
  `360, 196, 560, 342` (radius 11), `panel highlight` `372, 208, 536, 1`, and `row 1`, `row 2`,
  `row 3` — each `520 × 76` at `380, 274`, `380, 358`, `380, 442`, i.e. an **84 px** pitch —
  plus three `24 × 24` `item icon 1…3` at `394, 288`, `394, 372`, `394, 456` (14 px inside each
  row's top and left). Its text nodes are `panel title` `MINI-BOSS REWARD` (`380, 212, 460, 30`),
  `close` `×` (`876, 206, 24, 24`), `choose line` `Choose one.` (`380, 240, 400, 20`), and
  `item name 1…3` / `item desc 1…3` — `Charcoal` / `Powers up Fire-type moves.`,
  `Hard Stone` / `Powers up Rock-type moves.`, `Miracle Seed` / `Powers up Grass-type moves.`
- **The shipped card lands on every one of those rects.** `rewardsPanelBox({ width: 1280, height:
  800 })` = `{ x: 360, y: 196, w: 560, h: 342 }` — **dx 0, dy 0, dw 0, dh 0** against
  `reward panel` (`panels/rewards/view.test.ts` line 81 pins it, and `panels/rewards/view.ts`'s
  own comment names the board's `560 × 342` card at `(360,196)`). `view.highlight` is
  panel-relative `12, 12, 536, 1` → `372, 208, 536, 1`. The rows are panel-relative
  `20, 78 + 84i, 520, 76` → `380, 274 / 358 / 442, 520, 76`. So **five boxes are claimable and
  every delta is 0**: this is the one row of Batch 109 that does not record a geometry delta.
- **Two more landed rects cannot be boxes, because the board draws them as text.**
  `view.close.box` is panel-relative `516, 10, 24, 24` → `876, 206, 24, 24`, exactly the
  `close` text node; `view.title.box` (`REWARDS_TITLE`) is `20, 16, 460, 30` → `380, 212, 460,
  30`, exactly `panel title`; `view.choose.box` → `380, 240, 400, 20`, exactly `choose line`.
  `gapFor` compares `view.boxes` against `spec.boxes` only, so declaring any of the three as a
  box reports a `missing` gap no behaviour could close. They enter as the strings `×`,
  `MINI-BOSS REWARD` and `Choose one.` and their rects are recorded in the table.
- **The fixture is the frame's own three items.**
  `design/fixtures/03f-panels-reward-item.json` carries `screen: 'rewards'`, a `state` that is
  the empty six-key `HudState` (`party: []`, `bag: []`, `money: null`, `route: null`,
  `battle: null`, `notice: null` — the rewards view reads none of it), and **one** block,
  `item` (this fixture carries no `pokemon` block — that is `03g`'s file): `title:
  'MINI-BOSS REWARD'`, `choose: 'Choose one.'`, `armed: -1`, `open: true`, and three rows —
  `index 0` `itemId: 'charcoal'` `iconFrame: 108` `label: 'Charcoal'` `description: 'Powers up
  Fire-type moves.'`; `index 1` `hardstone` `309` `Hard Stone` `Powers up Rock-type moves.`;
  `index 2` `miracleseed` `463` `Miracle Seed` `Powers up Grass-type moves.`
- **The copy is the board's, all nine lines of it.** The card prints `view.title.text` =
  `MINI-BOSS REWARD`, `view.choose.text` = `Choose one.`, `view.close.label` = `×`
  (`REWARDS_CLOSE_LABEL`, a literal in `panels/rewards/view.ts`; `panels/rewards/fixture.test.ts`
  line 149 already proves it is the frame's own character) and, per row, `label` then
  `description`. `gapFor` folds case, so every one of them is the board's line.
- **The one box the card cannot claim is its icon.** The board's `item icon n` is a `24 × 24`
  rect; the view's `RewardRowView.icon` is a **CSS atlas cell** (`{ url, size, x, y }`, the
  `background-position` pair) and the panel positions it in the stylesheet, so the view carries
  no icon rect to compare and no name to give it (`panels/rewards/README.md` rule 1).
- **This frame and `03g` are one card on two row sets.** `03g` draws the same `reward panel`,
  `panel highlight` and `row 1…3` and no `item icon` at all, with `option label 1…3` instead of
  `item name` / `item desc`; `[Task-251]` measures that frame. Neither task claims the other's
  frame, and the two adapters are two files with two slugs.

### Exclusive paths (single writer)

- `src/ui/hud/specGap.views/rewards-item.ts` — new.
- `src/ui/hud/panels/rewards/specGap.item.test.ts` — new.
- `src/ui/hud/panels/rewards/README.md` — **two new lines** in its `## Layout` list and nothing
  else in that file. One is this task's own map line for `specGap.item.test.ts`; the other is
  `[Task-251]`'s line for `specGap.pokemon.test.ts`, which that task may not write because this
  batch gives the rewards README **one owner**. Both lines are frozen below in **Coordination**
  and are to be inserted verbatim, in that order, directly after the `fixture.test.ts` line.

**Nothing outside this list.** In particular, these two are **the Orchestrator's at merge, not
yours** — do not touch them, and do not "fix" the red they cause:

- `src/ui/hud/specGap.walk.test.ts` — its `PENDING` line for `03f-panels-reward-item`
  (`'rewards, one choice; no view builder is wired'`) is deleted at merge. While it is still
  there the walker **fails on purpose**: its case
  `accounts for every screen: mapped, or a named reason` reports
  `screens both mapped and pending: 03f-panels-reward-item`. That single red is the expected
  state of your branch.
- `docs/hud-fidelity.md` — its `03f-panels-reward-item` row in `The spec gap, measured (D57)`
  flips from `pending` to `wired` at merge, in the same push.

Also do not touch `design/**`, `design/source/**`, `src/ui/hud/specGap.ts`,
`specGap.views/{rewards-pokemon,shop-buy,shop-sell,bag,compress,map,pc,hud,detail,notices,
main-menu,battle-hp}.ts`, `src/ui/hud/panels/rewards/view.ts`, `rewardsPanel.tsx`,
`rewards.css`, `mount.tsx`, `index.ts`, `view.test.ts`, `fixture.test.ts`,
`src/ui/rewards.ts`, `src/ui/hud/panels/{shop,party,pc,bag,map,hud}/**`, `src/i18n/**`,
`src/scenes/**`, `src/engine/**` or `package.json`.

### Inputs (read-only)

- `AGENTS.md`, `docs/agent-spec-template.md`, `docs/hud-fidelity.md` (§5 "Panel geometry" and
  the `The spec gap, measured (D57)` table), `design/README.md`, `docs/maps-spec.md` §7
  (the mini-boss reward card).
- `design/screens/03f-panels-reward-item.json` and `design/exports/03f-panels-reward-item.png` —
  frame **`03f Panels · reward item`**, 1280×800.
- `design/fixtures/03f-panels-reward-item.json` — the `state` above and the single `item` block.
- `src/ui/hud/panels/rewards/` — the whole folder, especially `view.ts` (`rewardsPanelBox`,
  `rewardsPanelView`, `rewardsRowBand`, `RewardsInput`, `RewardsPanelView`, `RewardRowView`,
  `RewardsIcon`, `Rect`, `Viewport`, `REWARDS_CLOSE_LABEL` and the `REWARDS_*` mirror
  constants), `fixture.test.ts` (the fixture → `RewardsInput` mapping and the frame comparison
  this adapter must not duplicate) and the `README.md`.
- `src/ui/hud/specGap.views/bag.ts` — the `at()` + `claim()` + string-fold idiom this adapter
  follows; `specGap.views/main-menu.ts` — the same shape with a claimed box list.
- `src/ui/hud/specGap.ts`, `src/ui/hud/specGap.test.ts`, `src/ui/hud/specGap.walk.test.ts`,
  `src/ui/hud/specGap.views/README.md`, `src/ui/hud/panels/pc/specGap.test.ts`.
- `src/i18n/en.ts` — read **only** for `reward.title` and `reward.choose`, to quote them (they
  are `MINI-BOSS REWARD` and `Choose one.`; the fixture already carries both).

## 🔒 Contract

`src/ui/hud/specGap.views/rewards-item.ts` exports exactly two names:

```ts
export const slug = '03f-panels-reward-item';
export function buildView(spec: ScreenSpec): PanelView;
```

- `buildView` imports `design/fixtures/03f-panels-reward-item.json` as a module default and
  builds the card exactly as the scene module does:

  ```ts
  const DESKTOP = { width: 1280, height: 800 };
  const view = rewardsPanelView(inputFrom(FIXTURE.item), DESKTOP);
  ```

  with `inputFrom` declared in this task's own file, in the shape the panel's `fixture.test.ts`
  uses but simpler, because **no box and no string depends on the icon**:

  ```ts
  type ItemRow = Readonly<{
    index: number;
    kind: 'item';
    itemId: string;
    iconFrame: number;
    label: string;
    description: string;
  }>;
  type ItemBlock = Readonly<{
    title: string;
    choose: string;
    armed: number;
    open: boolean;
    rows: readonly ItemRow[];
  }>;
  const FIXTURE = rewardsFixture as unknown as Readonly<{ item: ItemBlock }>;

  function inputFrom(block: ItemBlock): RewardsInput {
    return {
      title: block.title,
      choose: block.choose,
      rows: block.rows.map((row) => ({
        index: row.index,
        kind: 'item' as const,
        label: row.label,
        description: row.description,
        icon: null,
        armed: false,
        box: { x: 0, y: 0, w: 0, h: 0 },
      })),
      armed: block.armed,
      open: block.open,
    };
  }
  ```

  `rewardsPanelView` writes every row's `box` and `armed` itself, so the values handed in are
  placeholders; `icon: null` is the same stub precedent `specGap.views/bag.ts` sets with
  `NO_ICON` (an atlas URL is a runtime concern).
- **Boxes:** the **five** the card draws at the board's own rects, each claimed only when the
  shipped rect is within `GAP_TOLERANCE` of the frame's box of that name, the way
  `specGap.views/bag.ts`'s `claim()` does, so a card that drifts off the board stops claiming
  instead of passing silently:

  | name (the frame's) | shipped | frame | delta |
  | --- | --- | --- | --- |
  | `reward panel` | `view.box` = `360, 196, 560, 342` | `360, 196, 560, 342` | 0 |
  | `panel highlight` | `at(view.box, view.highlight)` = `372, 208, 536, 1` | `372, 208, 536, 1` | 0 |
  | `row 1` | `at(view.box, view.rows[0].box)` = `380, 274, 520, 76` | `380, 274, 520, 76` | 0 |
  | `row 2` | `at(view.box, view.rows[1].box)` = `380, 358, 520, 76` | `380, 358, 520, 76` | 0 |
  | `row 3` | `at(view.box, view.rows[2].box)` = `380, 442, 520, 76` | `380, 442, 520, 76` | 0 |

  `at(origin, rect)` is `{ x: origin.x + rect.x, y: origin.y + rect.y, w: rect.w, h: rect.h }`.
  A row's box name is `row ${row.index + 1}` — the frame's own names are `row 1`, `row 2`,
  `row 3` and the fixture's indices are `0, 1, 2`, so the two agree by construction; a renamed
  box is a `missing` gap, not a typo (`specGap.views/README.md` rule 3). Do **not** declare a
  box for `close`, `panel title` or `choose line` (text nodes), nor for `item icon 1…3` (the
  view carries no icon rect).
- **Strings:** exactly these **nine**, in this order — the title, the choose line, the ✕, then
  each row's label followed by its description:

  ```ts
  const printed = [
    view.title.text,
    view.choose.text,
    view.close.label,
    ...view.rows.flatMap((row) => [row.label, row.description]),
  ].filter((line) => line !== '');
  // ['MINI-BOSS REWARD', 'Choose one.', '×', 'Charcoal', 'Powers up Fire-type moves.',
  //  'Hard Stone', 'Powers up Rock-type moves.', 'Miracle Seed', 'Powers up Grass-type moves.']
  ```

  Claim a string only when `gapFor`'s own fold (trim + upper-case) makes it the board's, so a
  copy fix stays a claim. All nine are the frame's own text, so all nine are kept; the list is
  still written as a filter, not as a literal, so a future copy drift leaves the board's set
  instead of passing silently.
- **Colours:** `[]`. The card's fills, strokes and the armed row's accent wash are
  `rewards.css`'s tokens; the view model carries no colour literal.
- **Determinism:** reads no `Rng`, no clock, no DOM and no store. `rewardsPanelView` is pure and
  the fixture is a module constant.
- You may read `spec` only as a **structural selector** — is this box name in the frame at
  all, is this line the board's text. Never filter strings or colours by the spec's content
  beyond that.

### The table the doc comment carries

Put these numbers in a doc comment above `buildView`, in the shape
`specGap.views/main-menu.ts` uses:

| frame box | frame rect | shipped | why it is (or is not) claimed |
| --- | --- | --- | --- |
| `reward panel` | `360, 196, 560, 342` | `view.box` = the same | **claimed**, delta 0: the card *is* the board's card |
| `panel highlight` | `372, 208, 536, 1` | `view.highlight` → the same | **claimed**: 12 px inside the card's top edge (`REWARDS_HIGHLIGHT_INSET`, a module-private constant of `panels/rewards/view.ts` — do not import it) |
| `row 1`, `row 2`, `row 3` | `380, 274 / 358 / 442, 520, 76` | `view.rows[i].box` → the same | **claimed**: `REWARDS_ROW_TOP` 78 and an 84 px pitch (`REWARDS_ROW_H` 76 + `REWARDS_ROW_GAP` 8) |
| `item icon 1…3` | `394, 288 / 372 / 456, 24, 24` | — | the view's `row.icon` is a CSS atlas cell (`{ url, size, x, y }`), not a rect, and `rewards.css` places it; there is no box to name |
| `close` (text node) | `876, 206, 24, 24` | `view.close.box` → `876, 206, 24, 24` | a **text node**, not a box: the rect matches to the pixel, and declaring it would report `missing`; claimed as the string `×` |
| `panel title` (text node) | `380, 212, 460, 30` | `view.title.box` → the same | a text node: claimed as the string `MINI-BOSS REWARD` |
| `choose line` (text node) | `380, 240, 400, 20` | `view.choose.box` → the same | a text node: claimed as the string `Choose one.` |
| `route screenshot`, `scrim` | `0, 0, 1280, 800` | — | the frame's painted scene and its dimming layer: a floating card paints no scrim (`D45`) |

And the copy it prints: the nine lines above, each the board's own after `gapFor`'s fold. The
live card of this panel offers **six** rows (three items then three unidentified Pokémon,
`src/ui/rewards.ts`'s `rewardRows`), and the panel clips them into the board's three slots
(`rewardsRowBand`, `panels/rewards/README.md` rule 4); the fixture's three item rows are the
board's own, so the first three slots are what this comparison measures.

## 🧩 Data and configuration

None. No new key, no new default, no run field, no save version step. The fixture is
read-only — **do not add a `pokemon` block or a fourth row to
`design/fixtures/03f-panels-reward-item.json`** — and `src/i18n/**` is not this task's path.

## 🧪 Test and Validation Plan (for QA)

- **Method:** run from the task's worktree. `npm test` — Vitest, headless.
  `npm run build` — `tsc --noEmit && vite build`.
  `git diff --name-only main...task-250` — audit against the exclusive paths.
  One `[live]` pass, in the browser, below.
- **Acceptance criteria:**
  - [ ] `[unit]` `npx vitest run src/ui/hud/panels/rewards/specGap.item.test.ts` is green. It
    asserts: `slug === '03f-panels-reward-item'` and `SPEC.slug` the same; `SPEC.boxes` has
    **10** entries, `SPEC.text` **9** and `SPEC.colours` **10**; `buildView(SPEC)`
    deep-equals (`toStrictEqual`) the five boxes
    `[{ name: 'reward panel', x: 360, y: 196, w: 560, h: 342 }, { name: 'panel highlight',
    x: 372, y: 208, w: 536, h: 1 }, { name: 'row 1', x: 380, y: 274, w: 520, h: 76 },
    { name: 'row 2', x: 380, y: 358, w: 520, h: 76 }, { name: 'row 3', x: 380, y: 442,
    w: 520, h: 76 }]` and the nine strings
    `['MINI-BOSS REWARD', 'Choose one.', '×', 'Charcoal', 'Powers up Fire-type moves.',
    'Hard Stone', 'Powers up Rock-type moves.', 'Miracle Seed', 'Powers up Grass-type moves.']`
    with `colours: []`; `gapFor(buildView(SPEC), SPEC)` is
    `{ missing: [], moved: [], strings: [], colours: [] }`; `buildView(SPEC)` twice
    deep-equals itself.
  - [ ] `[unit]` The same file pins the **premise**: `rewardsPanelBox({ width: 1280, height: 800
    })` is `{ x: 360, y: 196, w: 560, h: 342 }` — equal to the frame's `reward panel`,
    `{ x: 360, y: 196, width: 560, height: 342 }`, so every delta is `0` — and the frame's
    `panel highlight` is `{ x: 372, y: 208, width: 536, height: 1 }`, its `row 1`, `row 2` and
    `row 3` are `{ x: 380, y: 274 | 358 | 442, width: 520, height: 76 }`, and the shipped
    `view.rows[i].box` is `{ x: 20, y: 78 | 162 | 246, w: 520, h: 76 }`, which the card's own
    origin turns into the frame's rects.
  - [ ] `[unit]` The same file pins the two landed-but-unclaimable rects and the unclaimable
    box: the frame's `close` is a **text node** at `876, 206, 24, 24` and
    `view.close.box` at `360 + 516, 196 + 10` is `876, 206, 24, 24`; the frame's `panel title`
    is a text node at `380, 212, 460, 30` and `view.title.box` lands on it; the frame's
    `choose line` is a text node at `380, 240, 400, 20` and `view.choose.box` lands on it;
    `SPEC.boxes` carries **no** box named `close`, `panel title` or `choose line`, so none of
    the three may be claimed as a box; the frame's `item icon 1` is a box at `394, 288, 24, 24`
    and the view's `rows[0].icon` is `null` (a `RewardRowView` carries `{ url, size, x, y }`,
    never a rect), so `buildView(SPEC).boxes` carries **no** `item icon` name.
  - [ ] `[unit]` The same file pins the copy: the frame's `item name 1…3` characters are the
    fixture's three `label`s in order and its `item desc 1…3` their three `description`s;
    `view.close.label` is `×` and `textOf('close')` is the same character;
    `view.title.text` is `MINI-BOSS REWARD` and `view.choose.text` is `Choose one.`, both the
    frame's own text.
  - [ ] `[unit]` `npm test` fails **only** in `src/ui/hud/specGap.walk.test.ts` → `accounts
    for every screen: mapped, or a named reason`, with the message
    `screens both mapped and pending: 03f-panels-reward-item`. That red is the Orchestrator's
    `PENDING` flip at merge. No other test fails — quote the summary line in the report.
  - [ ] `[unit]` `npm run build` exits 0.
  - [ ] `[unit]` `git diff --name-only main...task-250` lists exactly
    `src/ui/hud/specGap.views/rewards-item.ts`,
    `src/ui/hud/panels/rewards/specGap.item.test.ts` and
    `src/ui/hud/panels/rewards/README.md`. Nothing under `design/`, `src/scenes/`,
    `src/engine/`, `src/i18n/` or `.agent_specs/`.
  - [ ] `[unit]` `git diff` shows no change to `src/ui/hud/specGap.walk.test.ts`, to
    `docs/hud-fidelity.md`, to `design/fixtures/03f-panels-reward-item.json`, to
    `src/ui/hud/panels/rewards/fixture.test.ts`, or to any file of
    `src/ui/hud/panels/rewards/` other than the README's **two added lines**; and no file of
    `src/ui/hud/panels/shop/` at all.
  - [ ] `[live]` At **1280×800**, on a floor whose **mini-boss** leaf rolled (`50 %` per floor,
    `docs/maps-spec.md` §5's O-M4 — start runs until the map card shows the mini-boss room),
    walk into that room and win the battle; the reward card opens on the win. Measured over CDP
    with `getBoundingClientRect()` and `textContent`:
    `document.querySelector('[data-hud-panel="rewards"]')` is exactly `360, 196, 560, 342`
    with `data-layout="card"` (the board's `reward panel` to the pixel — this is the batch's one
    exact match), `[data-hud-rewards="title"]`'s text is `MINI-BOSS REWARD`,
    `[data-hud-reward-row="0"]` is `380, 274, 520, 76` and `[data-hud-reward-row="1"]` is
    `380, 358, 520, 76`. If `[data-hud-panel="rewards"]` reads `0, 0, 0, 0`, the card is hidden
    (`data-open="false"`, the route paused underneath) and the read is taken again once the
    card is on screen. No mini-boss within five runs is reported as such with the runs tried;
    the card's rects are already pinned by the `[unit]` premise.
- **A `[live]` that compares pixels is not a criterion** (`D57`).

## 📣 Coordination

- **For the Orchestrator:** at merge, delete `'03f-panels-reward-item'` from the `PENDING` map
  in `src/ui/hud/specGap.walk.test.ts` **and** flip the `03f-panels-reward-item` row of
  `docs/hud-fidelity.md`'s `The spec gap, measured (D57)` table to `wired` — one push. The
  row's counts (**10 / 9 / 10**) stay as they are: they count the **frame**, not this
  comparison.
- **For the batch (the README collision, recorded the same way in all four specs):** `03f` and
  `03g` hang on **one** shipped panel, `src/ui/hud/panels/rewards/`, so the batch cannot give
  both tasks `specGap.test.ts` **and** the folder's `README.md`. Resolution: the test file is
  named for the frame (`specGap.item.test.ts` here, `specGap.pokemon.test.ts` in
  `[Task-251]`) and the README belongs to the **lower ID**, this task, which adds **both** map
  lines and is the only writer of that file. `[Task-251]` adds no README line and does not
  touch it. The two lines, verbatim, each inserted after the existing `fixture.test.ts` line,
  in this order:

  ```
  - `specGap.item.test.ts` — the `03f Panels · reward item` frame measured through `specGap.views/rewards-item.ts`: the card, its highlight and its three rows claimed at the board's own rects with a zero delta, the nine strings it claims and the one icon box the view model cannot name, headless.
  - `specGap.pokemon.test.ts` — the `03g Panels · reward pokemon` frame measured through `specGap.views/rewards-pokemon.ts`: the same card and the same three rows, the six `STAT · Nature` strings it claims, and the Pokémon rows' label-only view, headless.
  ```

  The second line names a file `[Task-251]` creates in the same wave: if that task is dropped
  between the cut and the merge, this line goes with it — the Orchestrator owns that check on
  the combined tree.
- **For `[Task-251]` and the next batch:** this frame and `03g` are the **same** card — the
  same `reward panel`, `panel highlight` and `row 1…3` rects — and they differ only in their
  rows and their text (`item icon`/`item name`/`item desc` here, `option label` there). Each
  adapter claims only its own frame's names. `panels/rewards/fixture.test.ts` already compares
  the model against `design/source/03f-panels-reward-item.json`; the new adapter compares it
  against `design/screens/03f-panels-reward-item.json` — the spec the walker reads — and must
  not restate that test.
- **Do not** put a test file inside `src/ui/hud/specGap.views/`: the walker globs
  `./specGap.views/*.ts` and treats **every** module there as an adapter, so a `*.test.ts`
  beside an adapter registers an adapter with an `undefined` slug and breaks the walker.

## ⛔ Out of scope

- Giving the view model an icon rect so `item icon 1…3` becomes claimable, or moving the icon in
  `rewards.css`: a view/paint change above this measurement.
- Claiming `close`, `panel title` or `choose line` as boxes: they are the board's **text
  nodes** and a box claim on them is a `missing` gap, not a measurement.
- The live card's six-row offer and the band's clip/scroll (`rewardsRowBand`,
  `panels/rewards/README.md` rule 4), the two-step arm/commit, the drop targets and the
  `commitRun` path: the scene module's, untouched.
- The `03g` frame and its three `option label`s, the phone twins (`m03f`, `m03g`), the painted
  `route screenshot` and `scrim`.
- Touching `specGap.ts`, the walker, `docs/hud-fidelity.md`, `design/**` or `design/source/**`,
  or any test other than the one this task adds.
- New dependencies, refactors of `bag.ts` / `main-menu.ts`, prettier sweeps of unrelated files.
