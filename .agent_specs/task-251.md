# Spec: Task-251 — The mini-boss reward's Pokémon rows are wired to its spec (`03g-panels-reward-pokemon`)

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** HUD panel (Preact over the `#hud` layer) — DOM only: no engine rule,
  no Phaser scene, no data table, no asset.
- **Role:** Dev.
- **Objective:** after this task the frame `03g Panels · reward pokemon` is **measured**
  instead of `pending`: a new adapter `src/ui/hud/specGap.views/rewards-pokemon.ts` builds the
  mini-boss reward card's `PanelView` from `design/fixtures/03g-panels-reward-pokemon.json` at
  1280×800 and **claims the card** — the panel, its highlight and its three rows are the
  board's own rects to the pixel — with the **six** lines the card prints, three of them the
  `STAT · Nature` labels of the unidentified offers. It records the two landed rects the board
  draws as **text nodes** (the ✕ and the title, which `gapFor` cannot compare as boxes) and the
  label-only rule a Pokémon row obeys, in the adapter's doc comment and in a new test. No game
  behaviour and no pixel of the route changes.
- **Environment:** worktree `../wt-pkm-251`, branch `task-251`.
- **Dependencies:** none. The adapter contract (`src/ui/hud/specGap.views/README.md`,
  `src/ui/hud/specGap.ts`, `src/ui/hud/specGap.walk.test.ts`) and the precedents
  `src/ui/hud/specGap.views/main-menu.ts` (a claiming adapter) and `.../pc.ts` (a claimed
  string list) are already merged.

### The measured facts this task is built on (verify them, then write them down)

- The frame is `03g Panels · reward pokemon` (`design/screens/03g-panels-reward-pokemon.json`,
  caption exactly `03g Panels · reward pokemon`, `design/board.json` node `6:1468`), viewport
  **1280×800**, and it carries **7 boxes, 6 text nodes and 10 colours**. Its panel is
  **`rewards`** (`design/import.json`'s `panel` column; the scene module is
  `src/scenes/panels/rewards.ts`, the Preact card `src/ui/hud/panels/rewards/`).
- **This frame is the shipped card, on its other three rows.** Measured, on the frame's own
  boxes: `reward panel` `360, 196, 560, 342` (radius 11), `panel highlight`
  `372, 208, 536, 1`, and `row 1`, `row 2`, `row 3` — each `520 × 76` at `380, 274`,
  `380, 358`, `380, 442`, i.e. an **84 px** pitch — plus `route screenshot` and `scrim` at
  `0, 0, 1280, 800`. **This frame draws no icon box at all** (`03f` drew three `item icon`), so
  the card's label-only Pokémon row is unpainted here as it is in the panel.
  Its text nodes are `panel title` `MINI-BOSS REWARD` (`380, 212, 460, 30`), `close` `×`
  (`876, 206, 24, 24`), `choose line` `Choose one.` (`380, 240, 400, 20`) and
  `option label 1…3` — `ATTACK · Adamant` (`396, 304, 480, 24`),
  `SP. ATK · Modest` (`396, 388, 480, 24`), `SPEED · Jolly` (`396, 472, 480, 24`).
- **The shipped card lands on every one of those rects.** `rewardsPanelBox({ width: 1280, height:
  800 })` = `{ x: 360, y: 196, w: 560, h: 342 }` — **dx 0, dy 0, dw 0, dh 0** against
  `reward panel` (`panels/rewards/view.test.ts` line 81 pins it). `view.highlight` is
  panel-relative `12, 12, 536, 1` → `372, 208, 536, 1`. The rows are panel-relative
  `20, 78 + 84i, 520, 76` → `380, 274 / 358 / 442, 520, 76`. So **five boxes are claimable and
  every delta is 0**.
- **Two more landed rects cannot be boxes, because the board draws them as text.**
  `view.close.box` is panel-relative `516, 10, 24, 24` → `876, 206, 24, 24`, exactly the
  `close` text node; `view.title.box` (`REWARDS_TITLE`) is `20, 16, 460, 30` → `380, 212, 460,
  30`, exactly `panel title`; `view.choose.box` → `380, 240, 400, 20`, exactly `choose line`.
  `gapFor` compares `view.boxes` against `spec.boxes` only, so declaring any of the three as a
  box reports a `missing` gap no behaviour could close. They enter as the strings `×`,
  `MINI-BOSS REWARD` and `Choose one.` and their rects are recorded in the table.
- **The fixture is the frame's own three labels.**
  `design/fixtures/03g-panels-reward-pokemon.json` carries `screen: 'rewards'`, a `state` that
  is the empty six-key `HudState` (`party: []`, `bag: []`, `money: null`, `route: null`,
  `battle: null`, `notice: null` — the rewards view reads none of it), and **one** block,
  `pokemon` (this fixture carries no `item` block — that is `03f`'s file): `title:
  'MINI-BOSS REWARD'`, `choose: 'Choose one.'`, `armed: -1`, `open: true`, and three rows —
  `index 0` `kind: 'pokemon'` `topStat: 'atk'` `nature: 'adamant'` `label: 'ATTACK · Adamant'`;
  `index 1` `spa` `modest` `SP. ATK · Modest`; `index 2` `spe` `jolly` `SPEED · Jolly`. The
  `label` is the model's own string: `panels/rewards/fixture.test.ts` recomputes it as
  `t('detail.stat.<stat>') · getNature(nature).name` and proves it equals both the fixture's
  `label` and the frame's `option label n`. This adapter therefore prints `row.label` — it does
  not recompute it, and it does not restate that test.
- **A Pokémon row prints its label and nothing else.** `rewardsPanelView` forces
  `description: ''` and `icon: null` on a `kind: 'pokemon'` row (`panels/rewards/README.md`
  rule 2: an unidentified option may leak neither a name, an icon nor a description), so the
  row's contribution to the string list is one line. `gapFor` drops empty lines, so the six
  strings are the title, the choose line, the ✕ and the three labels.
- **This frame and `03f` are one card on two row sets.** `03f` draws the same `reward panel`,
  `panel highlight` and `row 1…3` with three item rows, three `item icon` boxes and
  `item name` / `item desc` text; `[Task-250]` measures it. Neither task claims the other's
  frame, and the two adapters are two files with two slugs.

### Exclusive paths (single writer)

- `src/ui/hud/specGap.views/rewards-pokemon.ts` — new.
- `src/ui/hud/panels/rewards/specGap.pokemon.test.ts` — new.

**Nothing outside this list.** In particular, these two are **the Orchestrator's at merge, not
yours** — do not touch them, and do not "fix" the red they cause:

- `src/ui/hud/specGap.walk.test.ts` — its `PENDING` line for `03g-panels-reward-pokemon`
  (`'rewards, the other choice; no view builder is wired'`) is deleted at merge. While it is
  still there the walker **fails on purpose**: its case
  `accounts for every screen: mapped, or a named reason` reports
  `screens both mapped and pending: 03g-panels-reward-pokemon`. That single red is the expected
  state of your branch.
- `docs/hud-fidelity.md` — its `03g-panels-reward-pokemon` row in `The spec gap, measured
  (D57)` flips from `pending` to `wired` at merge, in the same push.

**And `src/ui/hud/panels/rewards/README.md` is not yours.** `03f` and `03g` hang on one shipped
panel, so this batch gives that folder's README **one** owner: `[Task-250]`, which writes both
map lines — this task's `specGap.pokemon.test.ts` line included. Do not add, reorder or reword a
line there; QA checks the file is byte-identical to `main`.

Also do not touch `design/**`, `design/source/**`, `src/ui/hud/specGap.ts`,
`specGap.views/{rewards-item,shop-buy,shop-sell,bag,compress,map,pc,hud,detail,notices,
main-menu,battle-hp}.ts`, `src/ui/hud/panels/rewards/view.ts`, `rewardsPanel.tsx`,
`rewards.css`, `mount.tsx`, `index.ts`, `view.test.ts`, `fixture.test.ts`,
`specGap.item.test.ts`, `src/ui/rewards.ts`, `src/ui/hud/panels/{shop,party,pc,bag,map,hud}/**`,
`src/i18n/**`, `src/scenes/**`, `src/engine/**` or `package.json`.

### Inputs (read-only)

- `AGENTS.md`, `docs/agent-spec-template.md`, `docs/hud-fidelity.md` (§5 "Panel geometry" and
  the `The spec gap, measured (D57)` table), `design/README.md`, `docs/maps-spec.md` §7
  (the mini-boss reward card).
- `design/screens/03g-panels-reward-pokemon.json` and
  `design/exports/03g-panels-reward-pokemon.png` — frame
  **`03g Panels · reward pokemon`**, 1280×800.
- `design/fixtures/03g-panels-reward-pokemon.json` — the `state` above and the single
  `pokemon` block.
- `src/ui/hud/panels/rewards/` — the whole folder, especially `view.ts` (`rewardsPanelBox`,
  `rewardsPanelView`, `rewardsRowBand`, `RewardsInput`, `RewardsPanelView`, `RewardRowView`,
  `Rect`, `Viewport`, `REWARDS_CLOSE_LABEL` and the `REWARDS_*` mirror constants),
  `fixture.test.ts` (the `STAT · Nature` label proof and the frame comparison this adapter must
  not duplicate) and the `README.md`.
- `src/ui/hud/specGap.views/bag.ts` — the `at()` + `claim()` + string-fold idiom this adapter
  follows; `specGap.views/main-menu.ts` — the same shape with a claimed box list;
  `specGap.views/pc.ts` — a claimed string list built from a fixture's own labels.
- `src/ui/hud/specGap.ts`, `src/ui/hud/specGap.test.ts`, `src/ui/hud/specGap.walk.test.ts`,
  `src/ui/hud/specGap.views/README.md`, `src/ui/hud/panels/pc/specGap.test.ts`.
- `src/i18n/en.ts` — read **only** for `reward.title` and `reward.choose`, to quote them (they
  are `MINI-BOSS REWARD` and `Choose one.`; the fixture already carries both).

## 🔒 Contract

`src/ui/hud/specGap.views/rewards-pokemon.ts` exports exactly two names:

```ts
export const slug = '03g-panels-reward-pokemon';
export function buildView(spec: ScreenSpec): PanelView;
```

- `buildView` imports `design/fixtures/03g-panels-reward-pokemon.json` as a module default and
  builds the card exactly as the scene module does:

  ```ts
  const DESKTOP = { width: 1280, height: 800 };
  const view = rewardsPanelView(inputFrom(FIXTURE.pokemon), DESKTOP);
  ```

  with `inputFrom` declared in this task's own file, in the shape the panel's `fixture.test.ts`
  uses but simpler, because a Pokémon row carries no icon and no description:

  ```ts
  type PokemonRow = Readonly<{
    index: number;
    kind: 'pokemon';
    topStat: string;
    nature: string;
    label: string;
  }>;
  type PokemonBlock = Readonly<{
    title: string;
    choose: string;
    armed: number;
    open: boolean;
    rows: readonly PokemonRow[];
  }>;
  const FIXTURE = rewardsFixture as unknown as Readonly<{ pokemon: PokemonBlock }>;

  function inputFrom(block: PokemonBlock): RewardsInput {
    return {
      title: block.title,
      choose: block.choose,
      rows: block.rows.map((row) => ({
        index: row.index,
        kind: 'pokemon' as const,
        label: row.label,
        description: '',
        icon: null,
        armed: false,
        box: { x: 0, y: 0, w: 0, h: 0 },
      })),
      armed: block.armed,
      open: block.open,
    };
  }
  ```

  `rewardsPanelView` writes every row's `box` and `armed` itself, and it forces
  `description: ''` / `icon: null` on a `kind: 'pokemon'` row again, so the values handed in are
  placeholders for those two fields only. `topStat` and `nature` are **not** read: the label is
  the model's own string and the fixture already carries it.
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
  box for `close`, `panel title` or `choose line` (text nodes), and do not invent an icon box
  this frame does not draw.
- **Strings:** exactly these **six**, in this order — the title, the choose line, the ✕, then
  each row's label:

  ```ts
  const printed = [
    view.title.text,
    view.choose.text,
    view.close.label,
    ...view.rows.flatMap((row) => [row.label, row.description]),
  ].filter((line) => line !== '');
  // ['MINI-BOSS REWARD', 'Choose one.', '×', 'ATTACK · Adamant', 'SP. ATK · Modest',
  //  'SPEED · Jolly']
  ```

  Claim a string only when `gapFor`'s own fold (trim + upper-case) makes it the board's, so a
  copy fix stays a claim. All six are the frame's own text, so all six are kept; the list is
  still written as a filter, not as a literal, so a future copy drift leaves the board's set
  instead of passing silently. `row.description` is `''` on every row and is dropped by the
  `line !== ''` filter, which is the label-only rule made visible.
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
| `close` (text node) | `876, 206, 24, 24` | `view.close.box` → `876, 206, 24, 24` | a **text node**, not a box: the rect matches to the pixel, and declaring it would report `missing`; claimed as the string `×` |
| `panel title` (text node) | `380, 212, 460, 30` | `view.title.box` → the same | a text node: claimed as the string `MINI-BOSS REWARD` |
| `choose line` (text node) | `380, 240, 400, 20` | `view.choose.box` → the same | a text node: claimed as the string `Choose one.` |
| `option label 1…3` (text nodes) | `396, 304 / 388 / 472, 480, 24` | `view.rows[i].label` | text nodes: claimed as the three `STAT · Nature` strings; the card's label sits at the row's own inset, which no text-node rect is compared against |
| `route screenshot`, `scrim` | `0, 0, 1280, 800` | — | the frame's painted scene and its dimming layer: a floating card paints no scrim (`D45`) |

And the reason there is **no icon row** in this table at all: `03g` draws no `item icon` box,
because a Pokémon offer may leak nothing but its label (`panels/rewards/README.md` rule 2). The
live card of this panel offers **six** rows (three items then three unidentified Pokémon,
`src/ui/rewards.ts`'s `rewardRows`) and the panel clips them into the board's three slots
(`rewardsRowBand`); the fixture's three Pokémon rows are the board's own last three, so the
comparison measures the card on its Pokémon half.

## 🧩 Data and configuration

None. No new key, no new default, no run field, no save version step. The fixture is
read-only — **do not add an `item` block or a fourth row to
`design/fixtures/03g-panels-reward-pokemon.json`** — and `src/i18n/**` is not this task's path.

## 🧪 Test and Validation Plan (for QA)

- **Method:** run from the task's worktree. `npm test` — Vitest, headless.
  `npm run build` — `tsc --noEmit && vite build`.
  `git diff --name-only main...task-251` — audit against the exclusive paths.
  One `[live]` pass, in the browser, below.
- **Acceptance criteria:**
  - [ ] `[unit]` `npx vitest run src/ui/hud/panels/rewards/specGap.pokemon.test.ts` is green. It
    asserts: `slug === '03g-panels-reward-pokemon'` and `SPEC.slug` the same; `SPEC.boxes` has
    **7** entries, `SPEC.text` **6** and `SPEC.colours` **10**; `buildView(SPEC)` deep-equals
    (`toStrictEqual`) the five boxes
    `[{ name: 'reward panel', x: 360, y: 196, w: 560, h: 342 }, { name: 'panel highlight',
    x: 372, y: 208, w: 536, h: 1 }, { name: 'row 1', x: 380, y: 274, w: 520, h: 76 },
    { name: 'row 2', x: 380, y: 358, w: 520, h: 76 }, { name: 'row 3', x: 380, y: 442,
    w: 520, h: 76 }]` and the six strings
    `['MINI-BOSS REWARD', 'Choose one.', '×', 'ATTACK · Adamant', 'SP. ATK · Modest',
    'SPEED · Jolly']` with `colours: []`; `gapFor(buildView(SPEC), SPEC)` is
    `{ missing: [], moved: [], strings: [], colours: [] }`; `buildView(SPEC)` twice
    deep-equals itself.
  - [ ] `[unit]` The same file pins the **premise**: `rewardsPanelBox({ width: 1280, height: 800
    })` is `{ x: 360, y: 196, w: 560, h: 342 }` — equal to the frame's `reward panel`,
    `{ x: 360, y: 196, width: 560, height: 342 }`, so every delta is `0` — and the frame's
    `panel highlight` is `{ x: 372, y: 208, width: 536, height: 1 }`, its `row 1`, `row 2` and
    `row 3` are `{ x: 380, y: 274 | 358 | 442, width: 520, height: 76 }`, and the shipped
    `view.rows[i].box` is `{ x: 20, y: 78 | 162 | 246, w: 520, h: 76 }`, which the card's own
    origin turns into the frame's rects.
  - [ ] `[unit]` The same file pins the label-only rule and the three unclaimable boxes: every
    `view.rows[i]` has `description === ''` and `icon === null`, so `buildView(SPEC).strings`
    carries **six** lines and no empty one; the frame's `close` is a **text node** at
    `876, 206, 24, 24` and `view.close.box` at `360 + 516, 196 + 10` is `876, 206, 24, 24`;
    the frame's `panel title` is a text node at `380, 212, 460, 30` and `view.title.box` lands
    on it; the frame's `choose line` is a text node at `380, 240, 400, 20` and
    `view.choose.box` lands on it; `SPEC.boxes` carries **no** box named `close`, `panel title`
    or `choose line`, so none of the three may be claimed as a box; and the frame draws no box
    whose name starts with `item icon`.
  - [ ] `[unit]` The same file pins the copy: the frame's `option label 1`, `option label 2`
    and `option label 3` characters are exactly `ATTACK · Adamant`, `SP. ATK · Modest` and
    `SPEED · Jolly`, which are the fixture's three `label`s in order and the three strings the
    view prints after the title, the choose line and the ✕; `view.close.label` is `×` and
    `textOf('close')` is the same character; `view.title.text` is `MINI-BOSS REWARD` and
    `view.choose.text` is `Choose one.`, both the frame's own text.
  - [ ] `[unit]` `npm test` fails **only** in `src/ui/hud/specGap.walk.test.ts` → `accounts
    for every screen: mapped, or a named reason`, with the message
    `screens both mapped and pending: 03g-panels-reward-pokemon`. That red is the
    Orchestrator's `PENDING` flip at merge. No other test fails — quote the summary line in the
    report.
  - [ ] `[unit]` `npm run build` exits 0.
  - [ ] `[unit]` `git diff --name-only main...task-251` lists exactly
    `src/ui/hud/specGap.views/rewards-pokemon.ts` and
    `src/ui/hud/panels/rewards/specGap.pokemon.test.ts` and nothing else. Nothing under
    `design/`, `src/scenes/`, `src/engine/`, `src/i18n/`, `.agent_specs/` or
    `src/ui/hud/panels/shop/`.
  - [ ] `[unit]` `git diff` shows no change to `src/ui/hud/specGap.walk.test.ts`, to
    `docs/hud-fidelity.md`, to `design/fixtures/03g-panels-reward-pokemon.json`, to
    `src/ui/hud/panels/rewards/fixture.test.ts`, or to
    `src/ui/hud/panels/rewards/README.md` (its two new lines are `[Task-250]`'s, not yours: the
    file must be byte-identical to `main` on this branch).
  - [ ] `[live]` At **1280×800**, on a floor whose **mini-boss** leaf rolled (`50 %` per floor,
    `docs/maps-spec.md` §5's O-M4 — start runs until the map card shows the mini-boss room),
    walk into that room and win the battle; the reward card opens on the win. Measured over CDP
    with `getBoundingClientRect()`, `getAttribute` and `textContent`:
    `document.querySelector('[data-hud-panel="rewards"]')` is exactly `360, 196, 560, 342`
    with `data-layout="card"`, `[data-hud-rewards="title"]`'s text is `MINI-BOSS REWARD`,
    `document.querySelectorAll('[data-hud-reward-row][data-kind="pokemon"]')` has **3**
    elements, each with `querySelector('[data-hud-reward-icon]')` `null` and
    `querySelector('.rewards__desc')` `null`, and each element's `textContent` matching
    `/^[A-Z][A-Z. ]* · \S+$/` (a `STAT · Nature` label and nothing else). If
    `[data-hud-panel="rewards"]` reads `0, 0, 0, 0`, the card is hidden (`data-open="false"`,
    the route paused underneath) and the read is taken again once the card is on screen. No
    mini-boss within five runs is reported as such with the runs tried; the card's rects are
    already pinned by the `[unit]` premise.
- **A `[live]` that compares pixels is not a criterion** (`D57`).

## 📣 Coordination

- **For the Orchestrator:** at merge, delete `'03g-panels-reward-pokemon'` from the `PENDING`
  map in `src/ui/hud/specGap.walk.test.ts` **and** flip the `03g-panels-reward-pokemon` row of
  `docs/hud-fidelity.md`'s `The spec gap, measured (D57)` table to `wired` — one push. The
  row's counts (**7 / 6 / 10**) stay as they are: they count the **frame**, not this
  comparison.
- **For the batch (the README collision):** `03f` and `03g` hang on **one** shipped panel, so
  the batch cannot give both tasks `specGap.test.ts` **and** the folder's `README.md`. The test
  file is named for the frame — `specGap.pokemon.test.ts` here, `specGap.item.test.ts` in
  `[Task-250]` — and `src/ui/hud/panels/rewards/README.md` belongs to the **lower ID**,
  `[Task-250]`, which writes both map lines including this task's. That is why the file is
  outside this task's exclusive paths; the same resolution is written in all four Batch 109
  specs.
- **For the next batch:** this frame and `03f` are the **same** card — the same `reward panel`,
  `panel highlight` and `row 1…3` rects — so a row claiming one of them claims the other's
  geometry too; what separates the two rows is the row set and the text, not a pixel. A frame
  that later draws the unidentified offers differently (an icon, a stat block) would move this
  row's strings and leave `03f`'s alone.
- **Do not** put a test file inside `src/ui/hud/specGap.views/`: the walker globs
  `./specGap.views/*.ts` and treats **every** module there as an adapter, so a `*.test.ts`
  beside an adapter registers an adapter with an `undefined` slug and breaks the walker.

## ⛔ Out of scope

- Giving a Pokémon row an icon, a description or a species name, or drawing the identified
  offer: `panels/rewards/README.md` rule 2 and the run's own reveal rule, both above this
  measurement.
- Claiming `close`, `panel title` or `choose line` as boxes: they are the board's **text
  nodes** and a box claim on them is a `missing` gap, not a measurement.
- Recomputing the `STAT · Nature` label from `topStat` / `nature` (the fixture carries the
  model's own string, and `panels/rewards/fixture.test.ts` already proves the two agree).
- The live card's six-row offer and the band's clip/scroll (`rewardsRowBand`), the two-step
  arm/commit, the `addPokemon` / `adoptAtLevel` path and the "not a catch" rule: the scene
  module's, untouched.
- The `03f` frame and its `item icon` / `item name` / `item desc` boxes, the phone twins
  (`m03f`, `m03g`), the painted `route screenshot` and `scrim`.
- Touching `specGap.ts`, the walker, `docs/hud-fidelity.md`, `design/**` or `design/source/**`,
  or any test other than the one this task adds.
- New dependencies, refactors of `bag.ts` / `main-menu.ts` / `pc.ts`, prettier sweeps of
  unrelated files.
