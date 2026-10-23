# Spec: Task-136 — the mini-boss reward panel is the HUD's

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + DOM panel migration (Phase 12, `D49`).
- **Role:** Dev.
- **Objective:** the mini-boss reward card — the item-and-Pokémon choice
  `openMiniBossReward` floats today — becomes a Preact panel in
  `src/ui/hud/panels/rewards/` mounted into `#hud` behind `?hud=dom`, and with the
  flag on `src/scenes/panels/rewards.ts` draws none of it in Phaser. The reward
  **rules do not move**: the same three items and three unidentified Pokémon, the
  same streams, the same `commitRun`, the same placement (`addItem` /
  `createRunPokemon` + `adoptAtLevel` + `addPokemon`) and the same level-up callback
  (`onDone`) run on a committed pick.
- **Environment:** worktree `../wt-pkm-136`, branch `task-136`.
- **Dependencies:** merged on `main` before this branch:
  - `[Task-127]`, `[Task-124]`, `[Task-125]` — the flag spike, the shell and the kit.
  - `[Task-128]` — the panel layer (`src/scenes/panels/`) and `RoutePanelHost`.
  - `[Task-129]`–`[Task-135]` — the sibling migrations; read
    `src/scenes/panels/shop.ts` + `src/ui/hud/panels/shop/` for the flag/mount/pause
    shape and `src/ui/hud/panels/party/` for the row/portrait treatment.

Before you write code, in your worktree: `npm ci`, then `npm test` once (baseline on
the base commit: 213 files / 3942 tests green).

### Exclusive paths (single writer)

**Nothing outside this list.**

- `src/scenes/panels/rewards.ts`
- `src/ui/hud/panels/rewards/**` (new folder: `view.ts`, `view.test.ts`,
  `rewardsPanel.tsx`, `rewards.css`, `mount.tsx`, `index.ts`, `fixture.test.ts`,
  `README.md`)
- `design/fixtures/03f-panels-reward-item.json` (new)
- `design/fixtures/03g-panels-reward-pokemon.json` (new)

`src/scenes/panels/README.md` is **Task-137**'s in this batch (it rewrites the
`trade.ts` / `rewards.ts` / `notices.ts` lines after yours merges). Do not touch it.
`src/ui/hud/panels/README.md` already lists `rewards/`, so it needs no edit either.

### Inputs (read-only)

- `src/ui/rewards.ts` — `rewardChoices`, `pokemonRewardChoices`, `rewardRows`,
  `RewardRow`. **Never edit**: it is the row model both cards read.
- `src/engine/run/**` — `addItem`, `addPokemon`, `adoptAtLevel`, `createRunPokemon`,
  `equipHeldItem`, `nextMemberId`, `squadLevel`, `useItemOn`, `speciesPool`,
  `bandForMap`, `hashSeed`, `Rng`. Never edited.
- `src/ui/notice.ts` — `itemPickupNotice` (the shipped pickup line).
- `src/scenes/rooms/types.ts` — `RoomDrop` (`bag` | `member` | `party` | `none`),
  `RoomRowDrag`.
- `src/scenes/panels/types.ts` — `RoutePanelHost` (`beginRowDrag`, `commitRun`,
  `showNotice`, `run()`), `RoutePanelDescriptor`.
- `src/ui/hud/panels/shop/**`, `src/scenes/panels/shop.ts` — the reference migration.
- `src/ui/hud/kit/` — `Panel`, `Row`, `Chip`, `Meta`, `PrimaryButton`, `TypeBadge`,
  `Sheet`.
- `src/data/itemIcons.ts` — `ITEM_ICON_ATLAS_URL`, `ITEM_ICON_SIZE`,
  `itemIconFrame`; `src/data/anil/item-icons.json` (the atlas columns).
- `src/data/items.ts` — `getItem` (name, description, kind).
- `design/frames/03f-panels-reward-item.json`, `03g-panels-reward-pokemon.json` and
  their `m…` twins — the board's geometry and strings.
- `design/fixtures/02-options.json`, `03d-route-shop-buy.json` — the fixture shape.
- `docs/hud-fidelity.md`, `docs/hud-dom-proposal.md`, `docs/tech-decisions.md` `D49`,
  `D45`.

## 🔒 Contract

### The pure view

`src/ui/hud/panels/rewards/view.ts`:

```ts
export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;

/** One row the card offers: an item or an unidentified Pokémon. */
export type RewardRowView = Readonly<{
  /** The row's index in `rewardRows` order (what a press sends back). */
  index: number;
  kind: 'item' | 'pokemon';
  /** The item's name, or the Pokémon's `STAT · Nature` label. */
  label: string;
  /** The item's short description; '' on a Pokémon row (it must leak nothing). */
  description: string;
  /** CSS atlas cell for an item icon; null on a Pokémon row. */
  icon: Readonly<{ url: string; size: number; x: number; y: number }> | null;
  /** The row armed by the last press and not yet committed. */
  armed: boolean;
  box: Rect; // panel-relative
}>;

export type RewardsInput = Readonly<{
  title: string;
  choose: string;
  rows: readonly RewardRowView[];
  armed: number;   // -1 when nothing is armed
  open: boolean;
}>;

export type RewardsPanelView = Readonly<{
  open: boolean;
  box: Rect;          // viewport coordinates, from rewardsPanelBox
  highlight: Rect;    // the board's 1 px line 12 px inside the top edge
  title: Readonly<{ text: string; box: Rect }>;
  choose: Readonly<{ text: string; box: Rect }>;
  close: Readonly<{ label: string; box: Rect }>;
  rows: readonly RewardRowView[];
}>;

export function rewardsPanelBox(viewport: Viewport): Rect;
export function rewardsPanelView(input: RewardsInput, viewport: Viewport): RewardsPanelView;

/** The two-step press, pure: what the card does to its own state on one press. */
export type RewardsAction = Readonly<{ armed: number; commit: number | null }>;

/**
 * A press on row `index` while `armed` is the current arm. Pressing another row
 * arms it and commits nothing (`{ armed: index, commit: null }`); pressing the
 * armed row again commits exactly it (`{ armed, commit: index }`). Out-of-range
 * input never arms and never commits.
 */
export function rewardsPress(armed: number, index: number, count: number): RewardsAction;
```

- **Desktop, from `03f`/`03g`:** card 560×342 at (360,196), radius 11; highlight
  (372,208,536,1); title (380,212); choose line (380,240); three rows 520×76 at
  x=380, y=274/358/442; an item row's icon 24×24 at (394, y+14), name at
  (436, y+8) and description at (436, y+38); a Pokémon row's label at (396, y+30)
  and **nothing else** — no icon, no name, no description.
- **Mobile, from `m03f`/`m03g`:** a bottom sheet 374×392 at (8,226), radius 16, a
  36×4 handle at (177,238), a 14×14 close at (356,258), title (20,252), subtitle
  (20,282), three rows 350×64 at x=20, y=320/392/464 (the frame's own third row
  sits at 464) with the icon at (34, y+24) and the text at x=70.
- The box is clamped exactly as `shopPanelBox` does (8 px margin, size gives way to
  the margin, never overflowing a 390 px window).
- **Pure and total:** same input ⇒ deep-equal view; the input is never written; no
  Phaser, no DOM, no `run`, no RNG inside.
- The two blocks are the same panel: the item frame's three rows and the Pokémon
  frame's three rows are what `rewardRows(items, pokemon)` already returns in one
  list, so the view never invents a fourth row and never reorders them.

### The scene side

`src/scenes/panels/rewards.ts` keeps the whole rule and gains the flag branch:

- **Flag off:** the shipped Phaser card is built exactly as today (`addFloatingPanel`
  560×660, the highlight, the drag ghost through `host.beginRowDrag`, the ✕, the
  controls line, `takeMiniBossReward` on a drop).
- **Flag on:** nothing Phaser is built; `#hud` gets `mountRewardsPanel` with a
  `Signal<RewardsPanelView>`; the module still owns the rows, the armed index and
  the callback. It must handle the two scene events as the siblings do
  (`'pause'`/`'resume'` spelled as strings, `'shutdown'` → close), and the card's
  `open` goes false while the route is paused.
- **The pick is inert until it is committed** (this is the board's rule and the
  plan's wording): a press on a row **arms** it (`armed: index`); a press on the
  already-armed row — or the `confirm` action — **commits** it; `cancel`, the ✕ and
  the scene's own close leave it. Committing runs the shipped `takeMiniBossReward`
  with the same `onDrop` the canvas path builds:
  - an **item** row → `{ onto: 'bag' }` (the shipped bag path: `addItem` +
    `commitRun` + `itemPickupNotice` + close);
  - a **Pokémon** row → `{ onto: 'party' }` (the shipped party path:
    `createRunPokemon` → `adoptAtLevel(squadLevel(run))` → `addPokemon` →
    `commitRun` → close).
  Record the consequence in the module's doc comment: under the flag a reward item
  lands in the bag, and using it on a member happens from the bag afterwards; with
  the flag off the shipped drag still drops it straight onto a member. Nothing else
  changes: no capture is spent, `stats.catches` does not move, the callback runs
  exactly once, and the two streams (`:reward:` and `:reward:…:pokemon`) are still
  the only RNG.
- Keyboard: `confirm` commits the armed row (arming the first row when none is
  armed), `up`/`down` move the armed row, `cancel` closes. A key and a press reach
  the same functions.
- Add `rewardsDrawnObjectCount(): number` (0 under `?hud=dom`, the shipped count
  with it off) in the shape of `shopDrawnObjectCount`, for the live flag contract.
- `openMiniBossReward(host, onDone)` and `closeMiniBossReward()` keep their exact
  signatures: `RouteScene` (lines 3699-3701 and its import at 321) is **not**
  edited.

### State and RNG

No run field, no new RNG draw, no rule change: **no `SAVE_VERSION` step**.

## 🧩 Data and configuration

- Fixtures follow `isHudState` and carry your own extra blocks:
  `{ "slug": "03f-panels-reward-item", "state": {party:[],bag:[],money:null,route:null,battle:null,notice:null}, "item": { …RewardsInput with the frame's rows }, "pokemon": { … } }`
  — the item fixture pins Charcoal/Hard Stone/Miracle Seed with their descriptions,
  the Pokémon fixture pins `ATTACK · Adamant`, `SP. ATK · Modest`, `SPEED · Jolly`.
- The strings come from the frame, not from the game data, so the fixture test can
  compare the painted boxes with `design/frames/<slug>.json` directly.
- No new i18n key: `reward.title`, `reward.choose` and `reward.controls` already
  ship and are the only copy the card prints (`src/i18n/en.ts` 144-146).

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; green, including `view.test.ts` and
    `fixture.test.ts`.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-136` audited against the exclusive paths.
  - One `[live]` criterion (the card on screen); the rest are `[unit]`.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` is clean and `src/ui/hud/panels/rewards/` imports no
        Phaser and no scene module.
  - [ ] `[unit]` `rewardsPanelView` is pure and total; `rewardsPanelBox` keeps a
        390×844 viewport inside 8 px on every edge.
  - [ ] `[unit]` At 1280×800 the view returns the board's own numbers: card
        `(360,196,560,342)`, three rows at y = 274/358/442 with height 76, the close
        at (876,206,24,24) — asserted against
        `design/frames/03f-panels-reward-item.json`.
  - [ ] `[unit]` A Pokémon row paints **only** its label: its view has
        `icon === null`, `description === ''`, and its label is the `STAT · Nature`
        string the model gave it (`03g` fixture).
  - [ ] `[unit]` `fixture.test.ts` pins both fixtures: the three labels in order,
        `armed` defaulting to -1, the item icons' frames, and the close label.
  - [ ] `[unit]` Arming and committing are distinct: a view-level test proves one
        press arms and does **not** call the commit path, and the second press on the
        same row commits once (drive the exported intent reducer with a spy, no DOM).
  - [ ] `[unit]` `rewardsDrawnObjectCount()` is 0 with the flag on and the shipped
        count with it off.
  - [ ] `[unit]` `src/engine/run/**`, `src/ui/rewards.ts` and `RouteScene.ts` are
        untouched (`git diff --name-only main...task-136` proves it).
  - [ ] `[live]` **The card lands on the board's rect and the canvas draws none of
        it.** Measurement: `CHROME_PATH=/usr/bin/chromium npm run dev`, open
        `http://127.0.0.1:<port>/?hud=dom`, reach a route (Enter ×3: new run, seed,
        starter), then via CDP `Runtime.evaluate` (`awaitPromise: true`):
        `const m = await import('/src/main.ts'); const r = m.game.scene.getScene('Route'); const p = await import('/src/scenes/panels/rewards.ts'); p.openMiniBossReward(r.panelHost, () => {});`
        — read `document.querySelector('[data-hud-panel="rewards"]').getBoundingClientRect()`
        and require `(360,196,560,342)` within 2 px at 1280×800 and `x = 8`, `w = 374`
        at 390×844; then `p.rewardsDrawnObjectCount() === 0` on the same page and
        `> 0` with `?hud` absent. Report both rects and both counts verbatim.

## 📣 Coordination

- For the Architect: the reward card's commit path under the flag is the bag/party
  drop, not a member drop; the plan's "pick inert until it is committed" is
  implemented as arm-then-commit.
- For the next batch: the DOM card carries `data-hud-panel="rewards"`; its intents
  are `arm(index)`, `commit`, `close`; `rewardsDrawnObjectCount` is the live probe.
- `src/scenes/panels/README.md`'s `rewards.ts` line is `Task-137`'s.

## ⛔ Out of scope

- `src/ui/rewards.ts`, `src/engine/**`, `RouteScene.ts`, any i18n table, any other
  panel, `src/scenes/panels/README.md`, `src/ui/hud/panels/README.md`, `docs/**`,
  `package.json`, `src/main.ts`, `src/data/**`.
- The member-drop path under the flag (recorded above, not implemented here).
- New art: item icons come from the packed Añil atlas the canvas already uses; the
  Pokémon rows are unidentified by design and draw no sprite.
