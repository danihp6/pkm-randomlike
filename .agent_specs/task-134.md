# Spec: Task-134 — the shop panel is the HUD's

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + DOM HUD migration (`D49`).
- **Role:** Dev.
- **Objective:** under `?hud=dom` the Mart card (the floor's merchant counter:
  the BUY / SELL tabs, the seven visible stock rows with their icon, name, price and
  owned count, the money row, the message line and the empty-stock line) is a Preact
  card in the `#hud` layer built from `src/ui/shop.ts`'s rows. `src/scenes/rooms/shop.ts`
  keeps the stock rules, the cache key, the trade rules and the `RoomPanel` record but
  builds **no Phaser card** under the flag; `src/scenes/panels/shop.ts` becomes the
  DOM card's scene-side adapter (its view, its mount, its intentions and their one
  transaction). With the flag off the shipped card is untouched.
- **Environment:** worktree `../wt-pkm-134`, branch `task-134`.
- **Dependencies:** `[Task-124]` (`#hud` layer), `[Task-125]` (the kit),
  `[Task-127]` (`?hud=dom`), `[Task-128]` (`RoutePanelHost`, the descriptor
  registry). Shipped, merged, read as the seam pattern: `[Task-129]`
  `src/scenes/panels/bag.ts`, `[Task-130]` `src/scenes/panels/pc.ts`, `[Task-131]`
  `src/scenes/panels/party.ts`.

### Exclusive paths (single writer)

- `src/scenes/panels/shop.ts`
- `src/scenes/rooms/shop.ts` — **the drawing lives here**, so the flag's one branch is
  here. See Coordination: the backlog's claim list omits this file and the task is
  not feasible without it.
- `src/ui/hud/panels/shop/**` (new folder)
- `design/fixtures/03d-route-shop-buy.json` (new file)
- `src/scenes/panels/README.md` — **one line only**, the `shop.ts` role line (today
  line 31: "`shop.ts` — the Mart's entry point; its drawing still lives in
  `rooms/shop.ts`."). Replace it with: "`shop.ts` — the Mart's DOM card under
  `?hud=dom`; with the flag off its drawing still lives in `rooms/shop.ts`." Change
  nothing else in that file.

Nothing else. You may **not** touch `src/ui/shop.ts`, `src/data/shop.ts`,
`src/data/items.ts`, `src/ui/floatingPanel.ts`, `src/scenes/rooms/types.ts`,
`src/scenes/rooms/registry.ts`, `src/scenes/rooms/secretShop.ts`,
`src/scenes/RouteScene.ts`, `src/ui/hud/commands.ts`, `src/ui/hud/state.ts`,
`src/i18n/**`, `src/scenes/rooms/README.md` or `src/ui/hud/panels/README.md` (both
already describe this folder and file; no line changes).

### Inputs (read-only)

- `docs/agent-spec-template.md`, `docs/tech-decisions.md` (`D49`, `D45`, `D33`),
  `docs/hud-fidelity.md` (§4, §5), `docs/maps-spec.md` §7 (the Mart).
- `src/scenes/rooms/shop.ts` (the card you migrate: `SHOP_W`, `SHOP_H`, `SHOP_ROW_H`,
  `SHOP_ROWS`, `SHOP_TAB_W/H/GAP`, `SHOP_LIST_TOP`, `MartStock`, `openMart`,
  `refreshShop`, `handleShopWheel`, `switchShopMode`, `activateShop`, `dropBuyRow`,
  `closeShop`, `PANEL`), `src/scenes/rooms/types.ts` (`RoomHost`, `RoomPanel`),
  `src/scenes/panels/shop.ts` (the 25-line entry point you replace).
- `src/ui/shop.ts` (`ShopRow`, `ShopSlot`, `buyRows`, `sellRows`, `buyItem`,
  `sellItem`, `sellPriceOf`, `sellableStacks`, `ShopTrade`), `src/ui/floatingPanel.ts`
  (`FLOATING_HEADER_H = 44`, `FLOATING_MARGIN = 8`, `clampPanelOrigin`),
  `src/ui/frlg.ts` (`FRLG_WINDOW_PADDING`), `src/data/itemIcons.ts`
  (`ITEM_ICON_ATLAS_URL`, `ITEM_ICON_SIZE`, `itemIconFrame`), `src/data/items.ts`.
- The shipped DOM panels (`src/ui/hud/panels/bag/*`, `src/ui/hud/fixtures/index.ts`),
  `src/ui/hud/styles/root.css`, `src/ui/hud/commands.ts` (`HudCommand`, read only).
- The board: `design/frames/03d-route-shop-buy.json`, `design/frames/03e-route-shop-sell.json`,
  `design/frames/m03d-route-shop-buy.json`, `design/frames/m03e-route-shop-sell.json`,
  their `.png` siblings in `design/screens/` (reference only), `design/tokens.json`.
- `src/i18n/en.ts` (`mart.title`, `mart.secretTitle`, `mart.buy`, `mart.sell`,
  `mart.money`, `mart.greeting`, `mart.greetingSell`, `mart.emptyStock`,
  `mart.emptySell`, `mart.noMoney`, `mart.bought`, `mart.sold`, `mart.controls`).

## 🔒 Contract

### `src/ui/hud/panels/shop/view.ts` — the pure layout model

```ts
export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;
export type ShopMode = 'buy' | 'sell';

/** A CSS-ready atlas cell: `background-position: -x px -y px`. */
export type ShopIcon = Readonly<{ url: string; size: number; x: number; y: number }>;

export type ShopRowView = Readonly<{
  /** The row's index in the tab's full list (what a press sends back). */
  index: number;
  itemId: string;
  name: string;
  /** `¥300`, the string the card prints. */
  price: string;
  /** `x2`, or '' when the run holds none. */
  owned: string;
  /** False on a BUY row the run cannot afford (its price reads in the warning tone). */
  affordable: boolean;
  selected: boolean;
  box: Rect;
  icon: ShopIcon | null;
}>;

export type ShopPanelView = Readonly<{
  /** False while the Merchant's card is closed or the route is paused. */
  open: boolean;
  /** Viewport coordinates, from `shopPanelBox`. */
  box: Rect;
  title: string;
  /** Panel-relative, exactly the shipped card's own control rects. */
  highlight: Rect;
  money: Readonly<{ text: string; box: Rect }>;
  tabs: readonly Readonly<{ mode: ShopMode; label: string; active: boolean; box: Rect }>[];
  list: Readonly<{ box: Rect }>;
  rows: readonly ShopRowView[];
  /** `1` while the first of `rows` is list index `scroll`; the wheel steps it. */
  scroll: number;
  message: Readonly<{ text: string; box: Rect }>;
  hint: Readonly<{ text: string; box: Rect }>;
  empty: Readonly<{ text: string; box: Rect }> | null;
  /** The card's drawn ✕, in the header band. */
  close: Readonly<{ label: string; box: Rect }>;
}>;

export const SHOP_PANEL_W = 640;    // SHOP_W
export const SHOP_PANEL_H = 540;    // SHOP_H
export const SHOP_HEADER_H = 44;    // FLOATING_HEADER_H
export const SHOP_PAD_X = 20;       // FRLG_WINDOW_PADDING.x
export const SHOP_PAD_BOTTOM = 8;   // FRLG_WINDOW_PADDING.bottom
export const SHOP_ROW_H = 44;       // SHOP_ROW_H
export const SHOP_ROWS = 7;         // SHOP_ROWS
export const SHOP_TAB_W = 108;      // SHOP_TAB_W
export const SHOP_TAB_H = 30;       // SHOP_TAB_H
export const SHOP_TAB_GAP = 6;      // SHOP_TAB_GAP
export const SHOP_LIST_TOP = 68;    // SHOP_LIST_TOP

export function shopPanelBox(viewport: Viewport): Rect;
export function shopPanelView(
  input: Readonly<{
    title: string;
    mode: ShopMode;
    rows: readonly ShopRow[];
    scroll: number;
    selected: number;
    money: number;
    message: string;
    empty: string;
    open: boolean;
  }>,
  viewport: Viewport,
  icon: (itemId: string) => ShopIcon | null,
): ShopPanelView;
```

`shopPanelView` is **pure and total** (`ShopRow` comes from `src/ui/shop.ts`; the
module imports that type and `t()` only — no run, no engine, no Phaser, no DOM). It
clamps `scroll` to `0…max(0, rows.length - SHOP_ROWS)` and `selected` to
`-1…rows.length-1`, slices the seven visible rows and numbers them
`index = scroll + i`.

`shopPanelBox` mirrors `addFloatingPanel`'s centring **and** the HUD's own clamp,
because the shipped 640 px card cannot fit a 390 px window (today it overflows):

```
w = min(640, max(160, width - 16))
h = min(540, max(200, height - 16))
x = min(max((width - w) / 2, 8), max(8, width - w - 8))
y = min(max((height - h) / 2, 8), max(8, height - h - 8))
```

so `shopPanelBox({1280,800}) = {x:320,y:130,w:640,h:540}` and
`shopPanelBox({390,844}) = {x:8,y:152,w:374,h:540}`.

The controls repeat the shipped card's own arithmetic, in card-relative coordinates:

- `content = { x: 20, y: 44, w: w - 40, h: h - 44 - 8 }`;
- money text at `{ x: content.x + content.w, y: content.y, w: 0, h: 20 }`
  (right-aligned; `t('mart.money', { amount })`);
- tabs at `{ x: content.x + i·(108 + 6), y: content.y + 26, w: 108, h: 30 }` for
  `i = 0` (BUY) and `1` (SELL);
- list `{ x: content.x, y: content.y + 68, w: content.w, h: 7·44 + 12 }` (320 tall);
- row `i`'s box `{ x: list.x + 6, y: list.y + 6 + i·44, w: list.w - 12, h: 40 }`; its
  icon `24×24` at `{ x: list.x + 14, y: row.y + 9 }`; the name at `list.x + 52`, the
  price right-aligned at `list.x + list.w - 92`, the owned count right-aligned at
  `list.x + list.w - 18` (all at `row.y + 10`, line box 20);
- message at `{ x: content.x, y: list.y + list.h + 12, w: content.w, h: 20 }`;
- hint (controls) right-aligned at `{ x: content.x + content.w, y: message.y + 24 }`;
- empty label centred at `{ x: list.x + list.w / 2, y: list.y + 20 }` (origin `0.5 0`);
- the ✕ at `{ x: w - 20 - 24, y: 44 / 2 - 12, w: 24, h: 24 }` (the shipped
  `FLOATING_CLOSE_SIZE` at the shipped centre).

### `src/ui/hud/panels/shop/mount.tsx`

```ts
export function mountShopPanel(
  host: Element,
  view: Signal<ShopPanelView>,
  onIntent?: ((intent: ShopIntent) => void) | undefined,
): () => void;
```

Same shape as `mountBagPanel` (`<div class="shop-mount">`, `paint()` on every signal
change, idempotent disposer).

```ts
/** The Mart's own command channel: plain data; the scene module owns every trade. */
export type ShopIntent =
  | Readonly<{ type: 'mode'; mode: ShopMode }>
  | Readonly<{ type: 'select'; index: number }>
  | Readonly<{ type: 'buy'; itemId: string }>
  | Readonly<{ type: 'sell'; itemId: string }>
  | Readonly<{ type: 'scroll'; delta: number }>
  | Readonly<{ type: 'close' }>;
```

A BUY press sends **one** `{ type: 'buy', itemId }`; the adapter resolves the stock
row by id and calls `buyItem` once. A SELL press sends **one**
`{ type: 'sell', itemId }` and the adapter calls `sellItem` once. One press, one
`ShopTrade`, one `host.commitRun`. `src/ui/hud/commands.ts` is **not** edited: the
shared union has no shop variant and this task does not own it.

### `src/ui/hud/panels/shop/index.ts` — the barrel

```ts
export { ShopPanel } from './shopPanel';
export type { ShopPanelProps } from './shopPanel';
export { mountShopPanel } from './mount';
export type { ShopIntent } from './mount';
export {
  SHOP_HEADER_H, SHOP_LIST_TOP, SHOP_PAD_BOTTOM, SHOP_PAD_X, SHOP_PANEL_H, SHOP_PANEL_W,
  SHOP_ROWS, SHOP_ROW_H, SHOP_TAB_GAP, SHOP_TAB_H, SHOP_TAB_W,
  shopPanelBox, shopPanelView,
} from './view';
export type { Rect, ShopIcon, ShopMode, ShopPanelView, ShopRowView, Viewport } from './view';
```

### DOM contract (`shopPanel.tsx`)

- `div.shop` with `data-hud-panel="shop"`, `data-open`, `hidden={!view.open}`,
  `position: fixed` at `view.box`, `pointer-events: auto`.
- `[data-hud-shop="money"]`, `[data-hud-shop="tabs"]` with
  `[data-hud-shop-tab="buy" | "sell"]` (buttons, `aria-pressed`),
  `[data-hud-shop="list"]` with `[data-hud-shop-row="<index>"]` (buttons,
  `data-selected`, `data-affordable`), `[data-hud-shop="message"]`,
  `[data-hud-shop="hint"]`, `[data-hud-shop="empty"]`, `[data-hud-shop="close"]`.
- Each row prints its name, its price and its owned count; the icon, when
  `view.rows[i].icon !== null`, is a `<span>` with the atlas URL and
  `background-position`, exactly as `bagPanel.tsx` does.
- The list scrolls with the wheel (`onWheel` → `{ type: 'scroll', delta: ±1 }`) and
  keeps seven rows visible; the native scroll of the `<ol>` is **not** used (the
  shipped card pages rows, it does not scroll pixels).

### `src/scenes/rooms/shop.ts` — the seam

Keep every existing export and the whole shipped code path. Edits only:

1. Module scope: `const DOM_HUD = typeof window === 'undefined' ? false : parseHudFlags(window.location.search).dom;`
   (`parseHudFlags` from `../../ui/hud/fixtures`).
2. `openMart(host, stock?)`: keep the stock resolution **exactly** as it is (the
   `key`/`shopStockKey` cache, `buildShop(band.id, new Rng(hashSeed(...)))`, the
   secret counter's `MartStock`), then `if (DOM_HUD) { shopMode = 'buy'; shopIndex = 0;
   shopScroll = 0; shopMessage = t('mart.greeting'); panelHost = host;
   openShopCard(host, { title: t(title), mode: shopMode, … }); host.openPanel(PANEL);
   return; }` and otherwise the shipped `buildShopPanel(host, t(title))` + `refreshShop()`.
3. `refreshShop()`: `if (DOM_HUD) { pushShopCard(host); return; }` before it touches
   `shopMoneyText`; the shipped body stays for the flag off.
4. `handleShopWheel` / `switchShopMode` / `activateShop` / `dropBuyRow`: unchanged off
   the flag. Under it: the wheel listener is not installed (`buildShopPanel` returns
   early), `switchShopMode`/`activateShop` are reached only from the DOM intents
   (below), and `dropBuyRow` is unreachable (see Out of scope).
5. `closeShop()`: `if (DOM_HUD) { closeShopCard(); <the same module-state reset>; return; }`.
6. `PANEL` stays exactly as it is (`modal: false`, `close()` → `closeShop()`), so the
   room slot still opens and closes the same way and the walker still runs behind it.
7. The module imports `{ openShopCard, pushShopCard, closeShopCard }` from
   `../panels/shop` — one direction only (**rooms → panels**). Nothing under
   `src/scenes/panels/shop.ts` may import `src/scenes/rooms/shop.ts` any more.

### `src/scenes/panels/shop.ts` — the adapter

Replace the 25-line forwarding module. Keep `descriptor` (`id: 'shop'`, `order: 80`,
`build(): void {}`) exactly; delete the dead `open(host)` (no module imports it; grep
proves it) and export instead:

```ts
/** The scene-side owner of the Mart's DOM card (`?hud=dom`). */
export function openShopCard(host: RoomHost, view: ShopInput): void;
export function pushShopCard(host: RoomHost): void;
export function closeShopCard(): void;
export function shopDrawnObjectCount(): number; // 0 under the flag
```

- `openShopCard` creates the signal from `shopPanelView(...)` and mounts it into
  `document.getElementById('hud')`; a missing layer mounts nothing (the shipped
  `mountDomPanel` guard).
- `pushShopCard` rebuilds the view from `buyRows(host.run, stock)` /
  `sellRows(host.run)` (the tab, the scroll and the selection are this module's own
  state) and assigns the signal once.
- The intent handler — the only writer — maps: `mode` → the module's `shopMode` +
  the shipped greeting (the exact strings `switchShopMode` uses); `select` → `shopIndex`;
  `scroll` → the shipped clamp; `close` → `host.closePanel()`; `buy` →
  `buyItem(host.run, slot)` then `if (trade.ok) host.commitRun(trade.run)` and the
  `mart.bought` message, else the `mart.noMoney` message; `sell` →
  `sellItem(host.run, itemId)` then `commitRun` and `mart.sold`. Each intent
  repaints through `pushShopCard`.
- It subscribes `pause` / `resume` on `host.scene.events` so a battle over the route
  hides the card and the resume brings it back; `closeShopCard` unsubscribes and
  disposes.
- It must not hold the stock: `openShopCard` receives the `ShopSlot[]` and the title
  from `rooms/shop.ts` and keeps them for the session of the card, clearing both on
  close (the shipped cache stays in `rooms/shop.ts`).

**Determinism:** reads no `Rng` stream, no clock, no random number. The stock is
still rolled by `rooms/shop.ts` on the same `hashSeed(\`${seed}:shop:${mapIndex}\`)`
stream, so the same floor opens the same shelf with the flag on or off.

**Rules:** `view.ts` imports no Phaser, touches no DOM, has no `Math.random`/`Date.now`;
only `*.tsx`/`mount.tsx` import Preact. No new dependency.

### Data

- No engine, save, `SAVE_VERSION`, RNG, `src/data/shop.ts` or `src/data/items.ts` change.
- New fixture: **`design/fixtures/03d-route-shop-buy.json`** (below).
- No i18n key is added; the `mart.*` keys above are reused. `src/i18n/**` is not edited.

## 🧩 Data and configuration

`design/fixtures/03d-route-shop-buy.json` — the frame's own copy, in the established
shape (`{ slug, state, <panel block> }`, extra keys allowed):

```json
{
  "slug": "03d-route-shop-buy",
  "state": { "party": [], "bag": [], "money": null, "route": null, "battle": null, "notice": null },
  "buy": {
    "title": "MART",
    "money": 2480,
    "message": "What can I do for you?",
    "hint": "Drag a row onto the bag or a Pokémon.",
    "empty": "Nothing in stock.",
    "rows": [
      { "index": 0, "itemId": "pokeball",  "name": "10x Poké Ball", "price": 300,  "count": 10, "owned": 0,  "affordable": true },
      { "index": 1, "itemId": "potion",    "name": "Potion",        "price": 700,  "count": 1,  "owned": 2,  "affordable": true }
    ],
    "selected": 0,
    "scroll": 0
  },
  "sell": {
    "title": "MART",
    "money": 2480,
    "message": "What would you like to sell?",
    "hint": "Drag a row onto the bag or a Pokémon.",
    "empty": "Nothing to sell.",
    "rows": [ { "index": 0, "itemId": "nugget", "name": "Nugget", "price": 5000, "count": 1, "owned": 1, "affordable": true } ],
    "selected": 0,
    "scroll": 0
  }
}
```

- `state` is the empty `HudState` (it passes `isHudState` unchanged); this panel reads
  `ShopRow`s and a title, not `HudState` — say so in the folder README.
- `buy.rows` / `sell.rows` are `ShopRow` **verbatim** minus the view-only fields
  (`selected`, `box`, `icon`), which the view model derives. Prices and names are the
  frame's own (`$300`, `$700`, `$2500`, … / `10x Poké Ball`); `price` is the number,
  the card prints `¥{price}`.
- `money: 2480` is the frame's `$ 2,480`; the shipped key prints
  `MONEY  ¥2480`.
- `selected` / `scroll` pin the frame's first row highlighted on each tab.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; green including
    `src/ui/hud/panels/shop/view.test.ts` and `fixture.test.ts`.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-134` audited against **Exclusive paths**.
  - The browser pass is only for the `[live]` criteria.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `src/ui/hud/panels/shop/view.test.ts` exists and passes and pins:
        `shopPanelBox({1280,800}) = {320,130,640,540}`,
        `shopPanelBox({390,844}) = {8,152,374,540}`; the content rect
        `{20,44,600,488}` / `{20,44,334,488}`; the two tabs at `x = 20` and `134`,
        `y = 70`, `108×30`; the list at `{20,112,600,320}` / `{20,112,334,320}`; row
        `i` at `{26, 118 + 44i, 588, 40}` / `{26, 118 + 44i, 322, 40}`; the message at
        `y = 444`; the ✕ at `{596,10,24,24}`.
  - [ ] `[unit]` `view.test.ts` also asserts: purity (deep-equal views, no input
        mutation); exactly `SHOP_ROWS` rows drawn and `index = scroll + i`; the
        `scroll` clamp (16 rows ⇒ max 9) and the `selected` clamp; `empty !== null`
        only when the tab's list is empty; an unaffordable BUY row keeps
        `affordable: false`; `sell` rows always affordable; `money` text is
        `t('mart.money', { amount })`.
  - [ ] `[unit]` `fixture.test.ts` imports the fixture, asserts `state` passes
        `isHudState`, and asserts `shopPanelView(buy…, {1280,800}, icon)` reproduces
        `"10x Poké Ball"`, `"¥300"`, the title `MART`, `tabs[0].active`, and the buy
        block's money line; then the same four assertions for the `sell` block
        (`"Nugget"`, `"¥5000"`, `tabs[1].active`).
  - [ ] `[unit]` `grep -rn "from 'phaser'\|document\.\|Math.random\|Date.now\|window\." src/ui/hud/panels/shop/view.ts` prints nothing.
  - [ ] `[unit]` `git diff --name-only main...task-134` ⊆ the five entries above, and
        `src/scenes/panels/README.md`'s diff is **one line** (`git diff --numstat`
        reports `1 1 src/scenes/panels/README.md`).
  - [ ] `[live]` **The card is the shipped rect at both sizes.** With `?hud=dom`, walk
        to the merchant and press interact, then
        `document.querySelector('[data-hud-panel="shop"]').getBoundingClientRect()` is
        `320,130 640×540` at 1280×800 and `8,152 374×540` at 390×844, Δ ≤ 1 px per
        edge; `getComputedStyle` gives `border-radius: 11px`.
  - [ ] `[live]` **A purchase is one transaction.** On the BUY tab at 1280×800, read
        `[data-hud-shop="money"]`.textContent and the row's owned count, click the
        first row once, and read both again: the money fell by exactly that row's
        price, the owned count rose by exactly its `count`, the message reads
        `Bought … for ¥…`, and the bag card's stack for that item rose by the same
        `count`.
  - [ ] `[live]` **A sale is one transaction.** Switch to SELL, click a row, and read
        the same three values: money rose by `sellPriceOf(itemId)`, the owned count
        fell by one, the message reads `Sold … for ¥…`.
  - [ ] `[live]` **The canvas draws nothing under the flag.** `shopDrawnObjectCount()`
        returns `0` with `?hud=dom` and > 0 with the flag off on the same floor; the
        shipped card's own ✕ closes the DOM card too (the room slot closes and the
        walker never stopped).
  - [ ] `[live]` **The card follows the route's pause.** With the card open, start a
        battle and return: while the battle is up the card is hidden (`hidden` or
        `display: none`), and after it the card is back with the same mode, row list
        and money.

## 📣 Coordination

- **For the Orchestrator:** the flag is `?hud=dom`; the fixture slug is
  `03d-route-shop-buy`; the tests are `view.test.ts` and `fixture.test.ts` under
  `src/ui/hud/panels/shop/`. **The backlog's claim list is incomplete:** it names
  `src/scenes/panels/shop.ts` as the panel to migrate, but that file is a 25-line
  forwarding stub and the whole Mart card lives in `src/scenes/rooms/shop.ts`
  (`buildShopPanel`, `refreshShop`, `handleShopWheel`, `dropBuyRow`). This spec adds
  `src/scenes/rooms/shop.ts` as a claimed path with a minimal, flag-only branch —
  without it the task cannot be executed at all. `design/board.json` and
  `scripts/design/frames.mjs` already map `03d`/`03e` to `src/scenes/panels/shop.ts`,
  so the intended shape is the one above (scene-side adapter in `panels/`, rules in
  `rooms/`). As in Batch 61 the gate is DOM-vs-Phaser rect parity plus the board's
  paint over CDP, **not** `npm run hud:diff` (its reference carries the board's own
  route world).
- **For the next batch:** `ShopIntent` is the Mart's own channel; a later task that
  folds the panel intents into the shared `HudCommand` union should take
  `ShopIntent` and `DetailIntent` (`Task-132`) together in one `commands.ts` change.
  `[Task-135]` (trade) sits on the same `RoomHost` + floating-card shape and the same
  `src/ui/hud/panels/<name>/` layout, so it can copy this adapter verbatim.

## ⛔ Out of scope

- No engine, `src/ui/shop.ts`, `src/data/shop.ts`, save, `SAVE_VERSION` or RNG change.
- **No quantity stepper.** The backlog mentions one, but it exists neither in the
  shipped card nor in the board (`03d`'s text nodes are prices, `SHOP`, `SEARCH
  ITEMS`, `BUY`, `SELL`, `CONSUMIBLES`, `POKEBALLS`, `HELD`, `16 ITEMS`): the only
  multi-unit concept is `ShopRow.count`, folded into the row's name (`10x Poké Ball`),
  and that is what ships.
- **No search field, no category chips and no 4×4 grid.** The board's `03d` card is a
  different design (a 704×336 shell at `288,232` with a 656×164 inner card at
  `312,364`, `SEARCH ITEMS`, `CONSUMIBLES`/`POKEBALLS`/`HELD` chips and a 16-cell
  `shop grid viewport`) than the shipped `640×540` seven-row list. Redesigning the
  Mart is not a chrome migration and no task owns it: this task reproduces the
  shipped card, painted with the board's tokens (radius 11, 16 % hairline, 4 %/8 %
  rows, 10 px body). Report back if the human wants the board's design instead — that
  is a new `D##`, not this task.
- **No drag-a-row-onto-a-member purchase.** Under the flag a BUY row's press buys
  **into the bag** (one command, one transaction); the shipped drag path
  (`dropBuyRow`, `RoomDrop`, `useItemOn`/`equipHeldItem`) stays flag-off, exactly as
  the DOM bag dropped its canvas drag in `[Task-129]`. Equipping a bought item is the
  bag's/party's own shipped path.
- No `src/scenes/rooms/README.md` edit (its `shop.ts` line stays true), no
  `hud:diff` change, no kit change, no i18n edit.
