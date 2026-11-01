# Spec: Task-248 — The Mart's BUY tab is wired to its spec (`03d-route-shop-buy`)

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** HUD panel (Preact over the `#hud` layer) — DOM only: no engine rule,
  no Phaser scene, no data table, no asset.
- **Role:** Dev.
- **Objective:** after this task the frame `03d Route · shop · buy` is **measured**
  instead of `pending`: a new adapter `src/ui/hud/specGap.views/shop-buy.ts` builds the
  Mart's `PanelView` from `design/fixtures/03d-route-shop-buy.json` on its BUY tab at
  1280×800, claims the two strings the frame and the card agree on (`BUY`, `SELL`), claims
  **no box** — the board draws a 704 × 336 shell with a 656 × 164 grid of sixteen tiles and
  the shipped card is a 640 × 540 window with a seven-row list — and writes the rest of the
  comparison down as measured numbers in the adapter's doc comment and in a new test. No
  game behaviour and no pixel of the route changes.
- **Environment:** worktree `../wt-pkm-248`, branch `task-248`.
- **Dependencies:** none. The adapter contract (`src/ui/hud/specGap.views/README.md`,
  `src/ui/hud/specGap.ts`, `src/ui/hud/specGap.walk.test.ts`) and the precedents
  `src/ui/hud/specGap.views/bag.ts` and `.../pc.ts` are already merged.

### The measured facts this task is built on (verify them, then write them down)

- The frame is `03d Route · shop · buy` (`design/screens/03d-route-shop-buy.json`, caption
  exactly `03d Route · shop · buy`, `design/board.json` node `5:1114`), viewport **1280×800**,
  and it carries **51 boxes, 25 text nodes and 19 colours**. Its panel is **`shop`**
  (`design/import.json`'s `panel` column and `design/README.md`'s frame → scene map; the scene
  module is `src/scenes/panels/shop.ts`, the Preact card `src/ui/hud/panels/shop/`).
- **The board's Mart is not the shipped Mart, and the panel's own README says so**
  (`src/ui/hud/panels/shop/README.md`, first paragraph: "The board's own `03d` shell (a search
  field, category chips and a 16-cell grid) is a different design and not this migration").
  Measured, on the frame's own boxes:
  - `shop shell` — `288, 232, 704, 336`, radius 11;
  - `shop panel`, `shop panel group` and `shop grid viewport` — **one rect under three names**,
    `312, 364, 656, 164`;
  - inside that viewport, **sixteen `bag tile 1…16`** of `64 × 60` at **local** coordinates
    `(12, 16)`, `(93, 16)`, `(174, 16)` … `(579, 88)` — an **81 px** column pitch and a
    **72 px** row pitch — each with a `24 × 24` `bag icon <item>` at `(tile.x + 20, 18)`;
  - `shop panel highlight` — `324, 372, 632, 1`;
  - `tab buy` `312, 294, 66, 24` and `tab sell` `378, 294, 66, 24` (a 66 px pitch);
  - `cursor ring` — `322, 378, 68, 64`;
  - `bag search field` `744, 294, 224, 24`, `bag search icon` `754, 301, 10, 10` and two
    `Vector` glyph shapes inside it;
  - `shell highlight` `300, 244, 680, 1`, `header divider` `312, 280, 656, 1`;
  - `filter consumables` `312, 330, 116, 20`, `filter pokeballs` `436, 330, 108, 20`,
    `filter held` `552, 330, 60, 20`;
  - `route screenshot` and `scrim`, both `0, 0, 1280, 800`.
- **The shipped card is the 640 × 540 window.** `shopPanelBox({ width: 1280, height: 800 })`
  = `{ x: 320, y: 130, w: 640, h: 540 }` (`src/ui/hud/panels/shop/view.ts`, and
  `view.test.ts` line 62 pins it): against the board's `shop shell` that is
  **dx +32, dy −102, dw −64, dh +204**. Its content band is `20, 44, 600, 488`; its seven
  rows are `588 × 40` at a 44 px pitch from panel-relative `26, 118`; its two tabs are
  `108 × 30` at a **114 px** pitch from `20, 70`; it has **no** search field, **no** filter
  chip, **no** grid viewport and **no** cursor ring.
- **The fixture is the frame's own shelf.** `design/fixtures/03d-route-shop-buy.json` carries
  `screen: 'shop'`, a `state` that is the empty six-key `HudState`
  (`party: []`, `bag: []`, `money: null`, `route: null`, `battle: null`, `notice: null` — the
  shop view reads none of it), and **two** blocks, `buy` and `sell`. This task reads **`buy`**
  only: `title: 'MART'`, `money: 2480`, `message: 'What can I do for you?'`,
  `hint: 'Drag a row onto the bag or a Pokémon.'`, `empty: 'Nothing in stock.'`,
  `selected: 0`, `scroll: 0`, and **two rows** — `pokeball` `10x Poké Ball` `¥300` (`owned 0`)
  and `potion` `Potion` `¥700` (`owned 2`). The block carries **no `open` field**: the adapter
  passes `open: true`, exactly as `src/ui/hud/panels/shop/fixture.test.ts` does.
- **The copy misses everywhere but the two tabs.** `view.title` is `MART` where the board's
  `shop title` is `SHOP`; `view.money.text` is `t('mart.money', { amount: 2480 })` =
  `MONEY  ¥2480` (two spaces) where the board's `money` is one line `$ 2,480`; each row's
  price is `¥300` where the board's `bag qty 1` is `$300`; the owned count is the ASCII `x2`
  where the board draws `×`; and the board prints no row name, no message and no hint at all.
  `gapFor` folds case only, so none of those is the board's line.

### Exclusive paths (single writer)

- `src/ui/hud/specGap.views/shop-buy.ts` — new.
- `src/ui/hud/panels/shop/specGap.buy.test.ts` — new.
- `src/ui/hud/panels/shop/README.md` — **two new lines** in its `## Layout` list and nothing
  else in that file. One is this task's own map line for `specGap.buy.test.ts`; the other is
  `[Task-249]`'s line for `specGap.sell.test.ts`, which that task may not write because this
  batch gives the Mart's README **one owner**. Both lines are frozen below in **Coordination**
  and are to be inserted verbatim, in that order, directly after the `fixture.test.ts` line.

**Nothing outside this list.** In particular, these two are **the Orchestrator's at merge, not
yours** — do not touch them, and do not "fix" the red they cause:

- `src/ui/hud/specGap.walk.test.ts` — its `PENDING` line for `03d-route-shop-buy`
  (`'shop, one of its two states; no view builder is wired'`) is deleted at merge. While it is
  still there the walker **fails on purpose**: its case
  `accounts for every screen: mapped, or a named reason` reports
  `screens both mapped and pending: 03d-route-shop-buy`. That single red is the expected state
  of your branch.
- `docs/hud-fidelity.md` — its `03d-route-shop-buy` row in `The spec gap, measured (D57)`
  flips from `pending` to `wired` at merge, in the same push.

Also do not touch `design/**`, `src/ui/hud/specGap.ts`, `specGap.views/{bag,compress,map,pc,
hud,detail,notices,main-menu,battle-hp}.ts`, `src/ui/hud/panels/shop/view.ts`,
`shopPanel.tsx`, `shop.css`, `mount.tsx`, `index.ts`, `view.test.ts`, `fixture.test.ts`,
`src/ui/shop.ts`, `src/ui/hud/panels/{rewards,party,pc,bag,map,hud}/**`, `src/i18n/**`,
`src/scenes/**`, `src/engine/**` or `package.json`.

### Inputs (read-only)

- `AGENTS.md`, `docs/agent-spec-template.md`, `docs/hud-fidelity.md` (§5 "Panel geometry" and
  the `The spec gap, measured (D57)` table), `design/README.md`, `docs/maps-spec.md` §7
  (the merchant and the Mart card).
- `design/screens/03d-route-shop-buy.json` and `design/exports/03d-route-shop-buy.png` — frame
  **`03d Route · shop · buy`**, 1280×800.
- `design/fixtures/03d-route-shop-buy.json` — the `state` above and the `buy` / `sell` blocks.
- `src/ui/hud/panels/shop/` — the whole folder, especially `view.ts` (`shopPanelBox`,
  `shopContentRect`, `shopPanelView`, `ShopInput`, `ShopPanelView`, `ShopRowView`, `ShopIcon`,
  `ShopMode`, `Rect`, `Viewport` and the `SHOP_*` mirror constants), `fixture.test.ts` (the
  fixture → `ShopInput` mapping this adapter copies) and the `README.md`.
- `src/ui/hud/specGap.views/bag.ts` — the `at()` + `claim()` + string-fold idiom this adapter
  follows; `specGap.views/pc.ts` — the same shape with a claimed string list.
- `src/ui/hud/specGap.ts`, `src/ui/hud/specGap.test.ts`, `src/ui/hud/specGap.walk.test.ts`,
  `src/ui/hud/specGap.views/README.md`, `src/ui/hud/panels/pc/specGap.test.ts`.
- `src/i18n/en.ts` — read **only** for `mart.title`, `mart.buy`, `mart.sell`, `mart.money`,
  `mart.greeting`, `mart.emptyStock` and `mart.controls`, to quote them.

## 🔒 Contract

`src/ui/hud/specGap.views/shop-buy.ts` exports exactly two names:

```ts
export const slug = '03d-route-shop-buy';
export function buildView(spec: ScreenSpec): PanelView;
```

- `buildView` imports `design/fixtures/03d-route-shop-buy.json` as a module default and builds
  the card exactly as the scene module does:

  ```ts
  const DESKTOP = { width: 1280, height: 800 };
  /** An atlas URL is a runtime concern, and no box and no string depends on the icon. */
  const NO_ICON = () => null;
  const view = shopPanelView(inputFrom(FIXTURE.buy, 'buy'), DESKTOP, NO_ICON);
  ```

  with `inputFrom` the mapping `panels/shop/fixture.test.ts` already uses, in this task's own
  file:

  ```ts
  function inputFrom(block: ShopBlock, mode: ShopMode): ShopInput {
    return {
      title: block.title,
      mode,
      rows: block.rows.map((row) => ({
        itemId: row.itemId,
        name: row.name,
        price: row.price,
        count: row.count,
        owned: row.owned,
        affordable: row.affordable,
        draggable: mode === 'buy' && row.affordable,
      })),
      scroll: block.scroll,
      selected: block.selected,
      money: block.money,
      message: block.message,
      empty: block.empty,
      open: true,
    };
  }
  ```

  `ShopBlock` is declared in this file as `Readonly<{ title: string; money: number; message:
  string; hint: string; empty: string; rows: readonly Readonly<{ index: number; itemId: string;
  name: string; price: number; count: number; owned: number; affordable: boolean }>[];
  selected: number; scroll: number }>`, and `FIXTURE` is
  `shopFixture as unknown as Readonly<{ buy: ShopBlock; sell: ShopBlock }>`.
- **Boxes:** `[]`. Claim a box only when the shipped rect for it is within `GAP_TOLERANCE` of
  the frame's box of the **same name**, the way `specGap.views/bag.ts`'s `claim()` does, so a
  card that lands on the board becomes a claim instead of a silent pass. The five candidates
  and their shipped rects — every one of them outside the tolerance at this viewport:

  - `shop shell`: frame `288, 232, 704, 336`; shipped `view.box` = `320, 130, 640, 540`
    (dx +32, dy −102, dw −64, dh +204).
  - `shop panel`: frame `312, 364, 656, 164`; shipped `at(view.box, view.list.box)` =
    `340, 242, 600, 320` (dx +28, dy −122, dw −56, dh +156).
  - `shop panel highlight`: frame `324, 372, 632, 1`; shipped `at(view.box, view.highlight)` =
    `332, 142, 616, 1` (dx +8, dy −230, dw −16, dh 0).
  - `tab buy`: frame `312, 294, 66, 24`; shipped `at(view.box, view.tabs[0].box)` =
    `340, 200, 108, 30` (dx +28, dy −94, dw +42, dh +6).
  - `tab sell`: frame `378, 294, 66, 24`; shipped `at(view.box, view.tabs[1].box)` =
    `454, 200, 108, 30` (dx +76, dy −94, dw +42, dh +6).

  `at(origin, rect)` is `{ x: origin.x + rect.x, y: origin.y + rect.y, w: rect.w, h: rect.h }`
  — the panel-relative rects land on the card's outer box because `shop.css` hangs its content
  layer at `inset: -1px` on a 1 px border (`panels/shop/README.md` rule 3).

  **Do not declare `bag tile 1…16`.** The frame carries those rects at **local** coordinates
  inside `shop grid viewport` while the card's rows are viewport rects of a different object
  (a `588 × 40` row, not a `64 × 60` tile), so the comparison would be two coordinate spaces
  and the candidate could never match even if the card grew a grid. The rows are measured by
  the table below instead.
- **Strings:** exactly `['BUY', 'SELL']`, in that order — `view.tabs.map((tab) => tab.label)`.
  Claim a string only when `gapFor`'s own fold (trim + upper-case) makes it the board's, so a
  copy fix lands as a claim instead of passing silently. Build the printed list as

  ```ts
  const printed = [
    ...view.tabs.map((tab) => tab.label),
    view.title,
    view.money.text,
    ...view.rows.flatMap((row) => [row.name, row.price, row.owned]),
    view.message.text,
    view.hint.text,
    view.close.label,
    view.empty?.text ?? '',
  ].filter((line) => line !== '');
  ```

  and keep only the lines the board carries — that is `BUY` (the frame's `tab label buy`) and
  `SELL` (`tab label sell`). Everything else the card prints is **not** claimed, and the
  comment says why with the numbers (`MART` vs `SHOP`, `MONEY  ¥2480` vs `$ 2,480`, `¥300` vs
  `$300`, `x2` vs the board's `×` line, and the message/hint/close, which the board never
  prints).
- **Colours:** `[]`. The card's fills and borders are `shop.css`'s tokens and the item atlas;
  the view model carries no colour literal.
- **Determinism:** reads no `Rng`, no clock, no DOM and no store. `shopPanelView` is pure and
  the fixture is a module constant.
- You may read `spec` only as a **structural selector** — is this box name in the frame at
  all, is this line the board's text. Never filter strings or colours by the spec's content
  beyond that.

### The table the doc comment carries

Put these numbers in a doc comment above `buildView`, in the shape
`specGap.views/bag.ts` uses:

| frame box | frame rect | shipped | why not claimed |
| --- | --- | --- | --- |
| `shop shell` | `288, 232, 704, 336` | `view.box` = `320, 130, 640, 540` | dx +32, dy −102, dw −64, dh +204: the board's shell is a 704 × 336 window at 232, the card a 640 × 540 window centred at 130 |
| `shop panel` (and `shop panel group`, `shop grid viewport`, the same rect under three names) | `312, 364, 656, 164` | `view.list.box` → `340, 242, 600, 320` | dx +28, dy −122, dw −56, dh +156: sixteen tiles in a 656 × 164 grid against seven 588 × 40 rows |
| `shop panel highlight` | `324, 372, 632, 1` | `view.highlight` → `332, 142, 616, 1` | follows the card, and is 16 px narrower than the board's |
| `tab buy` | `312, 294, 66, 24` | `view.tabs[0].box` → `340, 200, 108, 30` | dx +28, dy −94, dw +42, dh +6 |
| `tab sell` | `378, 294, 66, 24` | `view.tabs[1].box` → `454, 200, 108, 30` | dx +76, dy −94, dw +42, dh +6 |
| `bag tile 1…16`, `bag icon …` | local `(12, 16)` … `64 × 60` at an 81 px / 72 px pitch inside the grid viewport | `view.rows[i].box` → `346, 248 + 44i, 588, 40`, seven rows | the board draws tiles inside a grid viewport; the card draws a row list, and the frame's rects there are local to that viewport |
| `bag search field`, `bag search icon`, `Vector` ×2 | `744, 294, 224, 24` / `754, 301, 10, 10` | — | the shipped card has no search field and no glyph |
| `filter consumables`, `filter pokeballs`, `filter held` | `312, 330, 116, 20` … | — | the shipped card has no category chips |
| `cursor ring` | `322, 378, 68, 64` | — | a selected row is a CSS wash on the row (`shop.css`'s `[data-selected]`), not a ring |
| `shell highlight`, `header divider` | `300, 244, 680, 1` / `312, 280, 656, 1` | `view.highlight` only | the card draws one 1 px rule 12 px inside its own top edge; the board's two extra rules have no field |
| `route screenshot`, `scrim` | `0, 0, 1280, 800` | — | the frame's painted scene and its dimming layer: a floating card paints no scrim (`D45`) |

And the copy it does not claim: the `money` text node `$ 2,480` (`902, 258, 66, 15`) against
the card's `MONEY  ¥2480`; `shop title` `SHOP` against `MART`; `bag search placeholder`
`SEARCH ITEMS` (no field to hold it); `filter label consumables` / `pokeballs` / `held` (no
chips); `shop stock count` `16 ITEMS` (no count); and `bag qty 1…16` `$300`, `$700`, `$2500` …
against the rows' `¥300` / `¥700` and their `''` / `x2` owned counts.

## 🧩 Data and configuration

None. No new key, no new default, no run field, no save version step. The fixture is
read-only — **do not add a row, an `open` field or a grid to
`design/fixtures/03d-route-shop-buy.json`** — and `src/i18n/**` is not this task's path: the
copy deltas are recorded, not fixed here.

## 🧪 Test and Validation Plan (for QA)

- **Method:** run from the task's worktree. `npm test` — Vitest, headless.
  `npm run build` — `tsc --noEmit && vite build`.
  `git diff --name-only main...task-248` — audit against the exclusive paths.
  One `[live]` pass, in the browser, below.
- **Acceptance criteria:**
  - [ ] `[unit]` `npx vitest run src/ui/hud/panels/shop/specGap.buy.test.ts` is green. It
    asserts: `slug === '03d-route-shop-buy'` and `SPEC.slug` the same; `SPEC.boxes` has
    **51** entries, `SPEC.text` **25** and `SPEC.colours` **19**;
    `buildView(SPEC)` deep-equals `{ boxes: [], strings: ['BUY', 'SELL'], colours: [] }`
    (`toStrictEqual`); `gapFor(buildView(SPEC), SPEC)` is
    `{ missing: [], moved: [], strings: [], colours: [] }`; `buildView(SPEC)` twice
    deep-equals itself.
  - [ ] `[unit]` The same file pins the **premise**: `shopPanelBox({ width: 1280, height: 800
    })` is `{ x: 320, y: 130, w: 640, h: 540 }` while the frame's `shop shell` is
    `{ x: 288, y: 232, width: 704, height: 336 }`, a delta of `{ dx: 32, dy: -102, dw: -64,
    dh: 204 }` whose four numbers all exceed `GAP_TOLERANCE`; the frame's `shop panel`,
    `shop panel group` and `shop grid viewport` all carry `{ x: 312, y: 364, width: 656,
    height: 164 }`; its `bag tile 1` is `{ x: 12, y: 16, width: 64, height: 60 }` and
    `bag tile 9` `{ x: 12, y: 88, width: 64, height: 60 }` (an 81 px / 72 px pitch); the
    shipped `view.list.box` is `{ x: 20, y: 112, w: 600, h: 320 }`, `view.rows[0].box`
    `{ x: 26, y: 118, w: 588, h: 40 }`, `view.highlight` `{ x: 12, y: 12, w: 616, h: 1 }`
    and the two `view.tabs` boxes `{ x: 20, y: 70, w: 108, h: 30 }` and
    `{ x: 134, y: 70, w: 108, h: 30 }`; the fixture's `buy` block yields **two** rows named
    `10x Poké Ball` and `Potion` priced `¥300` and `¥700`.
  - [ ] `[unit]` The same file pins the copy it cannot claim: the frame's `shop title` is
    `SHOP` and the view's title is `MART`; the frame's `money` is `$ 2,480` and the view's
    money line is `t('mart.money', { amount: 2480 })` = `MONEY  ¥2480`; the frame's
    `bag qty 1` is `$300` and the first row's price is `¥300`; the first row's owned count is
    `''` and the second's `x2`, while the board draws no `x` count at all; and neither
    `MART` nor the message, the hint or the `✕` appears in `SPEC.text` under `gapFor`'s fold.
  - [ ] `[unit]` `npm test` fails **only** in `src/ui/hud/specGap.walk.test.ts` → `accounts
    for every screen: mapped, or a named reason`, with the message
    `screens both mapped and pending: 03d-route-shop-buy`. That red is the Orchestrator's
    `PENDING` flip at merge. No other test fails — quote the summary line in the report.
  - [ ] `[unit]` `npm run build` exits 0.
  - [ ] `[unit]` `git diff --name-only main...task-248` lists exactly
    `src/ui/hud/specGap.views/shop-buy.ts`, `src/ui/hud/panels/shop/specGap.buy.test.ts` and
    `src/ui/hud/panels/shop/README.md`. Nothing under `design/`, `src/scenes/`,
    `src/engine/`, `src/i18n/` or `.agent_specs/`.
  - [ ] `[unit]` `git diff` shows no change to `src/ui/hud/specGap.walk.test.ts`, to
    `docs/hud-fidelity.md`, to `design/fixtures/03d-route-shop-buy.json`, to any other file
    of `src/ui/hud/panels/shop/` than the README's **two added lines**, and no file of
    `src/ui/hud/panels/rewards/` at all.
  - [ ] `[live]` At **1280×800**, after NEW RUN → a starter → the first route, walk into the
    floor's `trainers` room, talk to the **MERCHANT** (`E`) and take its `TRADE` row (the
    floor's guaranteed special NPC, `guaranteedFromMap: 1`, `docs/maps-spec.md` §7), measured
    over CDP with `getBoundingClientRect()` and `textContent`:
    `document.querySelector('[data-hud-panel="shop"]')` is exactly `320, 130, 640, 540` —
    `shopPanelBox({ width: 1280, height: 800 })` — `[data-hud-shop="list"]` is
    `340, 242, 600, 320`, and `[data-hud-shop-tab="buy"]` is `340, 200, 108, 30` with
    `textContent` `BUY` and `data-active="true"`. The frame's own shell is
    `288, 232, 704, 336`: the delta is the adapter's record, not a defect of this task. If
    `[data-hud-panel="shop"]` reads `0, 0, 0, 0`, the card is hidden (`data-open="false"`, the
    route paused underneath) and the read is taken again once the card is on screen.
- **A `[live]` that compares pixels is not a criterion** (`D57`).

## 📣 Coordination

- **For the Orchestrator:** at merge, delete `'03d-route-shop-buy'` from the `PENDING` map in
  `src/ui/hud/specGap.walk.test.ts` **and** flip the `03d-route-shop-buy` row of
  `docs/hud-fidelity.md`'s `The spec gap, measured (D57)` table to `wired` — one push. The
  row's counts (**51 / 25 / 19**) stay as they are: they count the **frame**, not this
  comparison. `src/ui/hud/specGap.views/README.md` says "one adapter per panel" and this batch
  ships **two** adapters for the Mart and two for the rewards card, each answering one slug
  (rule 1); the folder's prose is left as it is, and a later doc pass may reword it to "one
  adapter per slug".
- **For the batch (the README collision, recorded the same way in all four specs):** `03d` and
  `03e` hang on **one** shipped panel, `src/ui/hud/panels/shop/`, so the batch cannot give both
  tasks `specGap.test.ts` **and** the folder's `README.md`. Resolution: the test file is named
  for the frame (`specGap.buy.test.ts` here, `specGap.sell.test.ts` in `[Task-249]`) and the
  README belongs to the **lower ID**, this task, which adds **both** map lines and is the only
  writer of that file. `[Task-249]` adds no README line and does not touch it. The two lines,
  verbatim, each inserted after the existing `fixture.test.ts` line, in this order:

  ```
  - `specGap.buy.test.ts` — the `03d Route · shop · buy` frame measured through `specGap.views/shop-buy.ts`: the empty box claim and its numbers (the 640 × 540 card against the board's 704 × 336 shell), the two tab labels it claims and the copy it cannot, headless.
  - `specGap.sell.test.ts` — the `03e Route · shop · sell` frame measured through `specGap.views/shop-sell.ts`: the same card against the board's own bag-named shell, the list band and the two tab labels, headless.
  ```

  The second line names a file `[Task-249]` creates in the same wave: if that task is dropped
  between the cut and the merge, this line goes with it — the Orchestrator owns that check on
  the combined tree.
- **For `[Task-249]` and the next batch:** the frame's list window carries **three** names for
  one rect (`shop panel`, `shop panel group`, `shop grid viewport`) and `03e` republishes the
  same shell under the **bag's** names (`bag panel`, `bag panel group`, `bag grid viewport`). A
  candidate is named after **its own frame**, or it is a `missing` gap — declaring `shop panel`
  against `03e` would report one.
- **Do not** put a test file inside `src/ui/hud/specGap.views/`: the walker globs
  `./specGap.views/*.ts` and treats **every** module there as an adapter, so a `*.test.ts`
  beside an adapter registers an adapter with an `undefined` slug and breaks the walker.

## ⛔ Out of scope

- Moving the Mart onto the board's `288, 232, 704, 336`, growing it a 656 × 164 grid of
  sixteen tiles, a search field, three category chips, a cursor ring or a `SHOP` title: each is
  a `D45`/`D49` geometry and design decision above this measurement, and
  `panels/shop/README.md` already records that the board's shell is a different design.
- The `MONEY  ¥2480` line, the `¥` price glyph, the `x` owned glyph, the `MART` title and the
  `✕` label: copy, not geometry; `src/i18n/**` is not this task's path.
- The SELL tab's own measurement (`03e`) and the `03e` fixture's `sell` block: `[Task-249]`'s.
- The frame's painted `route screenshot` and `scrim`, the search glyph's two `Vector` shapes,
  the phone twin (`m03d-route-shop-buy`).
- Touching `specGap.ts`, the walker, `docs/hud-fidelity.md`, `design/**`, or any test other
  than the one this task adds.
- New dependencies, refactors of `bag.ts` / `pc.ts`, prettier sweeps of unrelated files.
