# Spec: Task-249 — The Mart's SELL tab is wired to its spec (`03e-route-shop-sell`)

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** HUD panel (Preact over the `#hud` layer) — DOM only: no engine rule,
  no Phaser scene, no data table, no asset.
- **Role:** Dev.
- **Objective:** after this task the frame `03e Route · shop · sell` is **measured** instead
  of `pending`: a new adapter `src/ui/hud/specGap.views/shop-sell.ts` builds the Mart's
  `PanelView` from `design/fixtures/03e-route-shop-sell.json` on its SELL tab at 1280×800,
  claims the two strings the frame and the card agree on (`BUY`, `SELL`), claims **no box** —
  the board republishes the same 704 × 336 shell under the **bag's** names with a 656 × 164
  grid of sixteen tiles, and the shipped card is a 640 × 540 window with a seven-row list — and
  writes the rest of the comparison down as measured numbers in the adapter's doc comment and
  in a new test. No game behaviour and no pixel of the route changes.
- **Environment:** worktree `../wt-pkm-249`, branch `task-249`.
- **Dependencies:** none. The adapter contract (`src/ui/hud/specGap.views/README.md`,
  `src/ui/hud/specGap.ts`, `src/ui/hud/specGap.walk.test.ts`) and the precedents
  `src/ui/hud/specGap.views/bag.ts` and `.../pc.ts` are already merged.

### The measured facts this task is built on (verify them, then write them down)

- The frame is `03e Route · shop · sell` (`design/screens/03e-route-shop-sell.json`, caption
  exactly `03e Route · shop · sell`, `design/board.json` node `5:1276`), viewport **1280×800**,
  and it carries **51 boxes, 25 text nodes and 19 colours**. Its panel is **`shop`**
  (`design/import.json`'s `panel` column; the scene module is `src/scenes/panels/shop.ts`, the
  Preact card `src/ui/hud/panels/shop/`).
- **The shell is the same rect as `03d`'s, republished under the bag's names.** Measured, on
  this frame's own boxes:
  - `shop shell` — `288, 232, 704, 336`, radius 11 (the same rect `03d` draws);
  - `bag panel`, `bag panel group` and `bag grid viewport` — **one rect under three names**,
    `312, 364, 656, 164`. **This frame draws no `shop panel` box at all**: the list window is
    called `bag panel` here, which is why a candidate copied from `[Task-248]` would report a
    `missing` gap;
  - inside that viewport, **sixteen `bag tile 1…16`** of `64 × 60` at **local** coordinates
    `(12, 16)`, `(93, 16)`, `(174, 16)` … `(579, 88)` — an **81 px** column pitch and a
    **72 px** row pitch — each with a `24 × 24` `bag icon <item>` at `(tile.x + 20, 18)`;
  - `bag panel highlight` — `324, 372, 632, 1` (again `03d`'s `shop panel highlight` rect under
    the bag's name);
  - `tab buy` `312, 294, 66, 24` and `tab sell` `378, 294, 66, 24` (a 66 px pitch); on this
    frame the **SELL** chip is the active one (accent fill `#7dd3fc@0.16`, accent stroke) and
    its label `SELL` is `#7dd3fc@1`;
  - `cursor ring` — `322, 378, 68, 64`;
  - `bag search field` `744, 294, 224, 24`, `bag search icon` `754, 301, 10, 10` and two
    `Vector` glyph shapes inside it;
  - `shell highlight` `300, 244, 680, 1`, `header divider` `312, 280, 656, 1`;
  - `filter consumables` `312, 330, 116, 20`, `filter pokeballs` `436, 330, 108, 20`,
    `filter held` `552, 330, 60, 20`;
  - `route screenshot` and `scrim`, both `0, 0, 1280, 800`.
- **The shipped card is the 640 × 540 window, and it is the same card on both tabs.**
  `shopPanelBox({ width: 1280, height: 800 })` = `{ x: 320, y: 130, w: 640, h: 540 }`
  (`src/ui/hud/panels/shop/view.ts`; `view.test.ts` line 62 pins it): against the board's
  `shop shell` that is **dx +32, dy −102, dw −64, dh +204**. Its content band is
  `20, 44, 600, 488`; its list band is `20, 112, 600, 320` with rows of `588 × 40` at a 44 px
  pitch; its two tabs are `108 × 30` at a **114 px** pitch from `20, 70`; the mode changes the
  rows, the active tab and the message, never a rect. It has **no** search field, **no** filter
  chip, **no** grid viewport and **no** cursor ring.
- **The fixture is the frame's own bag, priced for sale.**
  `design/fixtures/03e-route-shop-sell.json` carries `screen: 'shop'`, a `state` that is the
  empty six-key `HudState` (`party: []`, `bag: []`, `money: null`, `route: null`,
  `battle: null`, `notice: null` — the shop view reads none of it), and **one** block,
  `sell` (unlike `03d`'s fixture, which carries both): `title: 'MART'`, `money: 2480`,
  `message: 'What would you like to sell?'`, `hint: 'Drag a row onto the bag or a Pokémon.'`,
  `empty: 'Nothing to sell.'`, `selected: 0`, `scroll: 0`, and **eight rows** —
  `potion` `Potion` `¥150` (`owned 3`), `superpotion` `Super Potion` `¥350` (`1`),
  `nugget` `Nugget` `¥5000` (`2`), `antidote` `Antidote` `¥50` (`1`), `pokeball`
  `Poke Ball` `¥100` (`5`), `fullheal` `Full Heal` `¥300` (`2`), `greatball`
  `Great Ball` `¥300` (`4`), `ultraball` `Ultra Ball` `¥600` (`1`). The block carries **no
  `open` field**: the adapter passes `open: true`, exactly as the panel's `fixture.test.ts`
  does. Eight rows is more than the seven-row window, so `view.rows` draws the **first seven**
  (indices 0–6) and `view.scroll` is `0`.
- **The copy misses everywhere but the two tabs.** `view.title` is `MART` where the board's
  `shop title` is `SHOP`; `view.money.text` is `t('mart.money', { amount: 2480 })` =
  `MONEY  ¥2480` (two spaces) where the board's `money` is one line `$ 2,480`; each row's price
  is `¥150` where the board's `bag qty 1` is the compound `×3 · $150`; the owned count is the
  ASCII `x3` where the board draws `×`; and the board prints no row name, no message and no
  hint at all. `gapFor` folds case only, so none of those is the board's line.

### Exclusive paths (single writer)

- `src/ui/hud/specGap.views/shop-sell.ts` — new.
- `src/ui/hud/panels/shop/specGap.sell.test.ts` — new.

**Nothing outside this list.** In particular, these two are **the Orchestrator's at merge, not
yours** — do not touch them, and do not "fix" the red they cause:

- `src/ui/hud/specGap.walk.test.ts` — its `PENDING` line for `03e-route-shop-sell`
  (`'shop, the other state; no view builder is wired'`) is deleted at merge. While it is still
  there the walker **fails on purpose**: its case
  `accounts for every screen: mapped, or a named reason` reports
  `screens both mapped and pending: 03e-route-shop-sell`. That single red is the expected state
  of your branch.
- `docs/hud-fidelity.md` — its `03e-route-shop-sell` row in `The spec gap, measured (D57)`
  flips from `pending` to `wired` at merge, in the same push.

**And `src/ui/hud/panels/shop/README.md` is not yours.** `03d` and `03e` hang on one shipped
panel, so this batch gives that folder's README **one** owner: `[Task-248]`, which writes both
map lines — this task's `specGap.sell.test.ts` line included. Do not add, reorder or reword a
line there; QA checks the file is byte-identical to `main`.

Also do not touch `design/**`, `src/ui/hud/specGap.ts`,
`specGap.views/{shop-buy,bag,compress,map,pc,hud,detail,notices,main-menu,battle-hp}.ts`,
`src/ui/hud/panels/shop/view.ts`, `shopPanel.tsx`, `shop.css`, `mount.tsx`, `index.ts`,
`view.test.ts`, `fixture.test.ts`, `specGap.buy.test.ts`, `src/ui/shop.ts`,
`src/ui/hud/panels/{rewards,party,pc,bag,map,hud}/**`, `src/i18n/**`, `src/scenes/**`,
`src/engine/**` or `package.json`.

### Inputs (read-only)

- `AGENTS.md`, `docs/agent-spec-template.md`, `docs/hud-fidelity.md` (§5 "Panel geometry" and
  the `The spec gap, measured (D57)` table), `design/README.md`, `docs/maps-spec.md` §7
  (the merchant and the Mart card).
- `design/screens/03e-route-shop-sell.json` and `design/exports/03e-route-shop-sell.png` — frame
  **`03e Route · shop · sell`**, 1280×800.
- `design/fixtures/03e-route-shop-sell.json` — the `state` above and the single `sell` block.
- `src/ui/hud/panels/shop/` — the whole folder, especially `view.ts` (`shopPanelBox`,
  `shopContentRect`, `shopPanelView`, `ShopInput`, `ShopPanelView`, `ShopRowView`, `ShopIcon`,
  `ShopMode`, `Rect`, `Viewport` and the `SHOP_*` mirror constants), `fixture.test.ts` (the
  fixture → `ShopInput` mapping this adapter copies) and the `README.md`.
- `src/ui/hud/specGap.views/bag.ts` — the `at()` + `claim()` + string-fold idiom this adapter
  follows; `specGap.views/pc.ts` — the same shape with a claimed string list.
- `src/ui/hud/specGap.ts`, `src/ui/hud/specGap.test.ts`, `src/ui/hud/specGap.walk.test.ts`,
  `src/ui/hud/specGap.views/README.md`, `src/ui/hud/panels/pc/specGap.test.ts`.
- `src/i18n/en.ts` — read **only** for `mart.title`, `mart.buy`, `mart.sell`, `mart.money`,
  `mart.greetingSell`, `mart.emptySell` and `mart.controls`, to quote them.

## 🔒 Contract

`src/ui/hud/specGap.views/shop-sell.ts` exports exactly two names:

```ts
export const slug = '03e-route-shop-sell';
export function buildView(spec: ScreenSpec): PanelView;
```

- `buildView` imports `design/fixtures/03e-route-shop-sell.json` as a module default and builds
  the card exactly as the scene module does, on the sell tab:

  ```ts
  const DESKTOP = { width: 1280, height: 800 };
  /** An atlas URL is a runtime concern, and no box and no string depends on the icon. */
  const NO_ICON = () => null;
  const view = shopPanelView(inputFrom(FIXTURE.sell, 'sell'), DESKTOP, NO_ICON);
  ```

  with `inputFrom` the mapping the panel's own `fixture.test.ts` uses, declared in this task's
  own file:

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
  `shopFixture as unknown as Readonly<{ sell: ShopBlock }>`.
- **Boxes:** `[]`. Claim a box only when the shipped rect for it is within `GAP_TOLERANCE` of
  the frame's box of the **same name**, the way `specGap.views/bag.ts`'s `claim()` does, so a
  card that lands on the board becomes a claim instead of a silent pass. The five candidates,
  named with **this** frame's names, and their shipped rects — all outside the tolerance:

  - `shop shell`: frame `288, 232, 704, 336`; shipped `view.box` = `320, 130, 640, 540`
    (dx +32, dy −102, dw −64, dh +204).
  - `bag panel`: frame `312, 364, 656, 164`; shipped `at(view.box, view.list.box)` =
    `340, 242, 600, 320` (dx +28, dy −122, dw −56, dh +156).
  - `bag panel highlight`: frame `324, 372, 632, 1`; shipped `at(view.box, view.highlight)` =
    `332, 142, 616, 1` (dx +8, dy −230, dw −16, dh 0).
  - `tab buy`: frame `312, 294, 66, 24`; shipped `at(view.box, view.tabs[0].box)` =
    `340, 200, 108, 30` (dx +28, dy −94, dw +42, dh +6).
  - `tab sell`: frame `378, 294, 66, 24`; shipped `at(view.box, view.tabs[1].box)` =
    `454, 200, 108, 30` (dx +76, dy −94, dw +42, dh +6).

  `at(origin, rect)` is `{ x: origin.x + rect.x, y: origin.y + rect.y, w: rect.w, h: rect.h }`
  — the panel-relative rects land on the card's outer box because `shop.css` hangs its content
  layer at `inset: -1px` on a 1 px border (`panels/shop/README.md` rule 3).

  **Do not declare `shop panel` or `shop panel highlight`.** This frame draws the list window
  and its highlight under the **bag's** names; a candidate named after `03d` reports a
  `missing` gap here, which is a red this task cannot close. **Do not declare `bag tile 1…16`
  either**: the frame carries those rects at **local** coordinates inside `bag grid viewport`
  while the card's rows are viewport rects of a different object (a `588 × 40` row, not a
  `64 × 60` tile), so the two would be compared across coordinate spaces and could never match
  even if the card grew a grid. The rows are measured by the table below instead.
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
  `SELL` (`tab label sell`). Everything else the card prints is **not** claimed, and the comment
  says why with the numbers (`MART` vs `SHOP`, `MONEY  ¥2480` vs `$ 2,480`, `¥150` vs the
  board's `×3 · $150`, `x3` vs the board's `×`, and the message/hint/close, which the board
  never prints).
- **Colours:** `[]`. The card's fills and borders are `shop.css`'s tokens and the item atlas;
  the view model carries no colour literal. The board's own accent on the active SELL chip is a
  stylesheet token too (`shop.css`'s `[data-active='true']`), not a view literal.
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
| `bag panel` (and `bag panel group`, `bag grid viewport`, the same rect under three names) | `312, 364, 656, 164` | `view.list.box` → `340, 242, 600, 320` | dx +28, dy −122, dw −56, dh +156: sixteen tiles in a 656 × 164 grid against seven 588 × 40 rows. The frame calls the window the **bag's**, so a `shop panel` candidate copied from `03d` is a `missing` gap, not a claim |
| `bag panel highlight` | `324, 372, 632, 1` | `view.highlight` → `332, 142, 616, 1` | follows the card, and is 16 px narrower than the board's |
| `tab buy` | `312, 294, 66, 24` | `view.tabs[0].box` → `340, 200, 108, 30` | dx +28, dy −94, dw +42, dh +6 |
| `tab sell` | `378, 294, 66, 24` | `view.tabs[1].box` → `454, 200, 108, 30` | dx +76, dy −94, dw +42, dh +6 |
| `bag tile 1…16`, `bag icon …` | local `(12, 16)` … `64 × 60` at an 81 px / 72 px pitch inside the grid viewport | `view.rows[i].box` → `346, 248 + 44i, 588, 40`, seven of the fixture's eight rows | the board draws tiles inside a grid viewport; the card draws a row list, and the frame's rects there are local to that viewport |
| `bag search field`, `bag search icon`, `Vector` ×2 | `744, 294, 224, 24` / `754, 301, 10, 10` | — | the shipped card has no search field and no glyph |
| `filter consumables`, `filter pokeballs`, `filter held` | `312, 330, 116, 20` … | — | the shipped card has no category chips |
| `cursor ring` | `322, 378, 68, 64` | — | a selected row is a CSS wash on the row (`shop.css`'s `[data-selected]`), not a ring |
| `shell highlight`, `header divider` | `300, 244, 680, 1` / `312, 280, 656, 1` | `view.highlight` only | the card draws one 1 px rule 12 px inside its own top edge; the board's two extra rules have no field |
| `route screenshot`, `scrim` | `0, 0, 1280, 800` | — | the frame's painted scene and its dimming layer: a floating card paints no scrim (`D45`) |

And the copy it does not claim: the `money` text node `$ 2,480` (`902, 258, 66, 15`) against
the card's `MONEY  ¥2480`; `shop title` `SHOP` against `MART`; `bag search placeholder`
`SEARCH ITEMS` (no field to hold it); `filter label consumables` / `pokeballs` / `held` (no
chips); `bag slots` `16/20` (no slot counter); and `bag qty 1…16` `×3 · $150`, `×1 · $350` …
against the rows' `¥150` / `¥350` and their `x3` / `x1` owned counts — two pieces joined by a
separator on the board, two fields on the card.

## 🧩 Data and configuration

None. No new key, no new default, no run field, no save version step. The fixture is
read-only — **do not add a `buy` block, a ninth row or an `open` field to
`design/fixtures/03e-route-shop-sell.json`** — and `src/i18n/**` is not this task's path: the
copy deltas are recorded, not fixed here.

## 🧪 Test and Validation Plan (for QA)

- **Method:** run from the task's worktree. `npm test` — Vitest, headless.
  `npm run build` — `tsc --noEmit && vite build`.
  `git diff --name-only main...task-249` — audit against the exclusive paths.
  One `[live]` pass, in the browser, below.
- **Acceptance criteria:**
  - [ ] `[unit]` `npx vitest run src/ui/hud/panels/shop/specGap.sell.test.ts` is green. It
    asserts: `slug === '03e-route-shop-sell'` and `SPEC.slug` the same; `SPEC.boxes` has
    **51** entries, `SPEC.text` **25** and `SPEC.colours` **19**;
    `buildView(SPEC)` deep-equals `{ boxes: [], strings: ['BUY', 'SELL'], colours: [] }`
    (`toStrictEqual`); `gapFor(buildView(SPEC), SPEC)` is
    `{ missing: [], moved: [], strings: [], colours: [] }`; `buildView(SPEC)` twice
    deep-equals itself.
  - [ ] `[unit]` The same file pins the **premise**: `shopPanelBox({ width: 1280, height: 800
    })` is `{ x: 320, y: 130, w: 640, h: 540 }` while the frame's `shop shell` is
    `{ x: 288, y: 232, width: 704, height: 336 }`, a delta of `{ dx: 32, dy: -102, dw: -64,
    dh: 204 }` whose four numbers all exceed `GAP_TOLERANCE`; the frame's `bag panel`,
    `bag panel group` and `bag grid viewport` all carry `{ x: 312, y: 364, width: 656,
    height: 164 }`, and the frame draws **no** box named `shop panel` nor one named
    `shop panel highlight` (`SPEC.boxes.some((box) => box.name === 'shop panel')` is `false`);
    its `bag tile 1` is `{ x: 12, y: 16, width: 64, height: 60 }` and `bag tile 9`
    `{ x: 12, y: 88, width: 64, height: 60 }` (an 81 px / 72 px pitch); the shipped
    `view.list.box` is `{ x: 20, y: 112, w: 600, h: 320 }`, `view.rows[0].box`
    `{ x: 26, y: 118, w: 588, h: 40 }`, `view.highlight` `{ x: 12, y: 12, w: 616, h: 1 }` and
    the two `view.tabs` boxes `{ x: 20, y: 70, w: 108, h: 30 }` and
    `{ x: 134, y: 70, w: 108, h: 30 }`; the fixture's `sell` block yields **eight** rows, of
    which the view draws **seven** (`view.rows.map((row) => row.index)` is `[0, 1, 2, 3, 4, 5,
    6]`) with the first named `Potion` priced `¥150` and owned `x3`.
  - [ ] `[unit]` The same file pins the copy it cannot claim: the frame's `shop title` is
    `SHOP` and the view's title is `MART`; the frame's `money` is `$ 2,480` and the view's
    money line is `t('mart.money', { amount: 2480 })` = `MONEY  ¥2480`; the frame's
    `bag qty 1` is `×3 · $150` and the first row prints `¥150` and `x3` as two fields; the
    frame's `bag slots` is `16/20` and the card has no slot counter; and neither `MART` nor the
    message, the hint or the `✕` appears in `SPEC.text` under `gapFor`'s fold.
  - [ ] `[unit]` `npm test` fails **only** in `src/ui/hud/specGap.walk.test.ts` → `accounts
    for every screen: mapped, or a named reason`, with the message
    `screens both mapped and pending: 03e-route-shop-sell`. That red is the Orchestrator's
    `PENDING` flip at merge. No other test fails — quote the summary line in the report.
  - [ ] `[unit]` `npm run build` exits 0.
  - [ ] `[unit]` `git diff --name-only main...task-249` lists exactly
    `src/ui/hud/specGap.views/shop-sell.ts` and
    `src/ui/hud/panels/shop/specGap.sell.test.ts` and nothing else. Nothing under `design/`,
    `src/scenes/`, `src/engine/`, `src/i18n/`, `.agent_specs/` or
    `src/ui/hud/panels/rewards/`.
  - [ ] `[unit]` `git diff` shows no change to `src/ui/hud/specGap.walk.test.ts`, to
    `docs/hud-fidelity.md`, to `design/fixtures/03e-route-shop-sell.json`, or to
    `src/ui/hud/panels/shop/README.md` (its two new lines are `[Task-248]`'s, not yours: the
    file must be byte-identical to `main` on this branch).
  - [ ] `[live]` At **1280×800**, after NEW RUN → a starter → the first route, walk into the
    floor's `trainers` room, talk to the **MERCHANT** (`E`) and take its `TRADE` row (the
    floor's guaranteed special NPC, `guaranteedFromMap: 1`, `docs/maps-spec.md` §7), then press
    the SELL tab, measured over CDP with `getBoundingClientRect()` and `textContent`:
    `document.querySelector('[data-hud-panel="shop"]')` is exactly `320, 130, 640, 540` —
    `shopPanelBox({ width: 1280, height: 800 })`, the same rect on both tabs —
    `[data-hud-shop-tab="sell"]` is `454, 200, 108, 30` with `data-active="true"` and
    `textContent` `SELL`, and the first drawn `[data-hud-shop-row]` is `346, 248, 588, 40`.
    The frame's own shell is `288, 232, 704, 336`: the delta is the adapter's record, not a
    defect of this task. If `[data-hud-panel="shop"]` reads `0, 0, 0, 0`, the card is hidden
    (`data-open="false"`, the route paused underneath) and the read is taken again once the
    card is on screen.
- **A `[live]` that compares pixels is not a criterion** (`D57`).

## 📣 Coordination

- **For the Orchestrator:** at merge, delete `'03e-route-shop-sell'` from the `PENDING` map in
  `src/ui/hud/specGap.walk.test.ts` **and** flip the `03e-route-shop-sell` row of
  `docs/hud-fidelity.md`'s `The spec gap, measured (D57)` table to `wired` — one push. The
  row's counts (**51 / 25 / 19**) stay as they are: they count the **frame**, not this
  comparison.
- **For the batch (the README collision):** `03d` and `03e` hang on **one** shipped panel, so
  the batch cannot give both tasks `specGap.test.ts` **and** the folder's `README.md`. The test
  file is named for the frame — `specGap.sell.test.ts` here, `specGap.buy.test.ts` in
  `[Task-248]` — and `src/ui/hud/panels/shop/README.md` belongs to the **lower ID**,
  `[Task-248]`, which writes both map lines including this task's. That is why the file is
  outside this task's exclusive paths; the same resolution is written in all four Batch 109
  specs.
- **For the next batch:** this frame republishes `03d`'s shell under the **bag's** names
  (`bag panel`, `bag panel group`, `bag grid viewport`) where `03d` calls them `shop panel`,
  `shop panel group`, `shop grid viewport`. A candidate must be named after **its own** frame
  or it is a `missing` gap. `03b`'s row already measures the bag panel at `(24, 24, 304, 130)`
  on another frame, so these names are not private to one row.
- **Do not** put a test file inside `src/ui/hud/specGap.views/`: the walker globs
  `./specGap.views/*.ts` and treats **every** module there as an adapter, so a `*.test.ts`
  beside an adapter registers an adapter with an `undefined` slug and breaks the walker.

## ⛔ Out of scope

- Moving the Mart onto the board's `288, 232, 704, 336`, growing it a 656 × 164 grid of
  sixteen tiles over the run's bag, a search field, three category chips, a cursor ring or a
  `SHOP` title: each is a `D45`/`D49` geometry and design decision above this measurement, and
  `panels/shop/README.md` already records that the board's shell is a different design.
- Rendering the SELL tab as a grid of the bag's slots (`bag slots` `16/20`): the shipped tab is
  the seven-row list and the room owns the bag it sells from.
- The `MONEY  ¥2480` line, the `¥` price glyph, the `x3` owned glyph, the `MART` title and the
  `✕` label: copy, not geometry; `src/i18n/**` is not this task's path.
- The BUY tab's own measurement (`03d`) and the `03d` fixture's `buy` block: `[Task-248]`'s.
- The frame's painted `route screenshot` and `scrim`, the search glyph's two `Vector` shapes,
  the phone twin (`m03e-route-shop-sell`).
- Touching `specGap.ts`, the walker, `docs/hud-fidelity.md`, `design/**`,
  `panels/shop/README.md`, or any test other than the one this task adds.
- New dependencies, refactors of `bag.ts` / `pc.ts`, prettier sweeps of unrelated files.
