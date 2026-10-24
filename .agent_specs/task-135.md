# Spec: Task-135 — the trade panel is the HUD's

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + DOM panel migration (Phase 12, `D49`).
- **Role:** Dev.
- **Objective:** the trade room's card becomes a Preact panel in
  `src/ui/hud/panels/trade/`, mounted into `#hud` behind `?hud=dom`, and its Phaser
  drawing leaves `src/scenes/rooms/trade.ts` for `src/scenes/panels/trade.ts`. With
  the flag **off** the card is the same Phaser window it is today, drawn by the panel
  module instead of the room; with the flag **on** the room draws no card at all and
  the Preact card paints the board's `03i`/`03j` frames. The trade **rule** does not
  move: `tradePokemon` (`src/engine/run/trade.ts`) stays the only thing that changes
  the run, and the room's own descriptor keeps its counter, its fixture and its
  interact hook.
- **Environment:** worktree `../wt-pkm-135`, branch `task-135`.
- **Dependencies:** all merged on `main` before this branch:
  - `[Task-127]` — the Options spike, which proved `?hud=dom` and the kit
    (`src/ui/hud/panels/options/`).
  - `[Task-124]` — the shell, `#hud`, the Silkscreen faces and `styles/root.css`.
  - `[Task-125]` — the kit (`src/ui/hud/kit/`).
  - `[Task-128]` — the panel layer `src/scenes/panels/` and its registry
    (`descriptor`, `RoutePanelDescriptor`, `RoomHost`).
  - `[Task-129]`–`[Task-134]` — the eight sibling migrations; read
    `src/scenes/panels/shop.ts` + `src/ui/hud/panels/shop/` as the worked example of
    this exact shape.

Before you write code, in your worktree: `npm ci` (the tree ships without
`node_modules`), then `npm test` once to see the baseline (213 files / 3942 tests
green on the base commit).

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**

- `src/scenes/panels/trade.ts`
- `src/scenes/rooms/trade.ts`
- `src/scenes/rooms/README.md`
- `src/ui/hud/panels/trade/**` (new folder: `view.ts`, `view.test.ts`,
  `tradePanel.tsx`, `trade.css`, `mount.tsx`, `index.ts`, `fixture.test.ts`,
  `README.md`)
- `design/fixtures/03i-panels-trade-pick.json` (new)
- `design/fixtures/03j-panels-trade-result.json` (new)
- `src/i18n/en.ts`, `src/i18n/es.ts` (the keys listed under **Data** only)

`src/scenes/panels/README.md` is **not** yours: Batch-mate `Task-137` owns that file
and rewrites the `trade.ts` / `rewards.ts` / `notices.ts` lines after this task
merges. Do not touch it, and do not fear the stale line: it is fixed in this batch.

### Inputs (read-only)

- `src/engine/run/trade.ts` — `canTrade`, `tradePokemon`, `tradeId`, `TradeRequest`,
  `TradeResult`, the refusal reasons. **Never edit it.**
- `src/engine/run/items.ts`, `src/engine/run/state.ts` — `RunState`, `RunPokemon`,
  `addPokemon` is **not** yours.
- `src/scenes/rooms/types.ts` — `RoomHost`, `RoomPanel`, `RoomDrop`.
- `src/scenes/panels/types.ts` — `RoutePanelDescriptor`, `RoutePanelHost`.
- `src/ui/hud/panels/shop/**` and `src/scenes/panels/shop.ts` — the reference
  implementation (flag read, pause/resume, `mount…` disposer, `…DrawnObjectCount`).
- `src/ui/hud/panels/party/**` — the row/portrait/HP treatment a party tile mirrors.
- `src/ui/hud/kit/` — `Panel`, `Row`, `Chip`, `Meta`, `PrimaryButton`, `TypeBadge`,
  `Sheet`.
- `src/ui/partyScreen.ts`, `src/ui/bag.ts` — label helpers you may reuse; do not edit.
- `src/data/dex/species.ts` — the species accessor (name, types, sprite frame).
- `src/i18n/index.ts` — `t()`; `src/i18n/en.ts` / `es.ts` (your two edits).
- `design/frames/03i-panels-trade-pick.json` and `03j-panels-trade-result.json` (and
  their `m…` twins) — the board's own geometry and strings.
- `design/fixtures/02-options.json` and `03d-route-shop-buy.json` — the fixture shape
  (`{ slug, state, … })` your two files follow.
- `docs/hud-fidelity.md`, `docs/hud-dom-proposal.md`, `docs/tech-decisions.md` `D49`,
  `D33`, `D47`.

## 🔒 Contract

### The card is two states of one panel

`src/ui/hud/panels/trade/view.ts` exports the pure model:

```ts
export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;

/** One party tile the player may give away. */
export type TradePartyTile = Readonly<{
  memberId: string;
  name: string;
  level: number;
  /** The dex sprite frame the portrait cell paints (null when it has no sheet). */
  frame: number | null;
  selected: boolean;
  box: Rect; // panel-relative
}>;

/** One PC cell: informational only — the rule only ever trades a party member. */
export type TradePcTile = Readonly<{
  memberId: string;
  name: string;
  frame: number | null;
  box: Rect; // panel-relative
}>;

export type TradeInput = Readonly<{
  /** 'pick' while the window offers the party, 'result' after a trade landed. */
  kind: 'pick' | 'result';
  /** The room's line: greeting, used, refused or a refusal of the last press. */
  message: string;
  /** True when a trade can still happen in this room (not used, party >= 2). */
  canTrade: boolean;
  party: readonly TradePartyTile[];
  pc: readonly TradePcTile[];
  /** The selected party index, or -1. */
  selected: number;
  /** The party and box sizes the meta line prints. */
  partyCount: number;
  pcCount: number;
  /** The received member, on 'result'; null on 'pick'. */
  received: Readonly<{
    name: string;
    level: number;
    type: string;
    frame: number | null;
  }> | null;
  open: boolean;
}>;

export type TradePanelView = Readonly<{
  open: boolean;
  kind: 'pick' | 'result';
  box: Rect;             // viewport coordinates, from tradePanelBox
  highlight: Rect;       // the board's 1 px line 12 px inside the top edge
  title: Readonly<{ text: string; box: Rect }>;
  meta: Readonly<{ text: string; box: Rect }>;
  message: Readonly<{ text: string; box: Rect }>;
  partyLabel: Readonly<{ text: string; box: Rect }>;
  pcLabel: Readonly<{ text: string; box: Rect }>;
  party: readonly TradePartyTile[];
  pc: readonly TradePcTile[];
  give: Readonly<{ label: string; enabled: boolean; box: Rect }> | null;
  close: Readonly<{ label: string; box: Rect }>;
  result: Readonly<{
    title: string;
    kicker: string;
    name: string;
    added: string;
    portrait: Rect;
    type: Readonly<{ id: string; box: Rect }> | null;
    button: Readonly<{ label: string; box: Rect }>;
  }> | null;
}>;

export function tradePanelBox(viewport: Viewport): Rect;
export function tradePanelView(input: TradeInput, viewport: Viewport): TradePanelView;
```

- **Geometry, desktop 1280×800, from `03i`:** card 760×560 at (260,120), radius 11;
  highlight (272,132,736,1); header divider at y=204; `PARTY` label at (284,216);
  six party tiles 158×104 at x=284/454, y=236/352/468; `PC` label at (656,216);
  sixteen PC cells 76×76, four columns at x=656/744/832/920, four rows at
  y=236/324/412/500; `GIVE AWAY` button 340×44 at (470,612).
- **Geometry, mobile 390×844, from `m03i`:** sheet 374×508 at (8,168), radius 12;
  divider (24,236,326,1); six party tiles 104×64 at x=24/136/248, y=260/332;
  PC cells 56×56, four columns, from y=422; the confirm button 350×44 at (20,?) —
  derive it from the sheet's bottom inset (20 px) as the frame does.
- **The result card, from `03j`:** card 560×420 at (360,190); highlight
  (372,202,536,1); divider at y=240; portrait 128×128 at (576,278); type chip 24×24
  at (628,486); title (384,210); meta (700,216,196,16); kicker (384,252); name
  (384,422); level line (384,458); dismiss button 340×44 (mobile `m03j`: 350×44 at
  (20,578)).
- The box is clamped to the viewport exactly as `shopPanelBox` does: 8 px margin,
  size gives way to the margin before the margin does; a 390 px window never
  overflows.
- **Pure and total:** same input ⇒ deep-equal view; the input is never written; no
  Phaser, no DOM, no `run` read inside.

### The scene side

`src/scenes/panels/trade.ts` becomes the card's owner (the drawing leaves the room):

```ts
export function openTradeCard(host: RoomHost): void;   // opens the card for this room
export function closeTradeCard(): void;                // tears it down (idempotent)
export function pushTradeCard(host: RoomHost): void;   // repaints from the live run
export function tradeDrawnObjectCount(): number;       // 0 under ?hud=dom
export const descriptor: RoutePanelDescriptor;         // id 'trade', order 90
```

- `?hud=dom` is read once, as every sibling migration does:
  `parseHudFlags(window.location.search).dom` guarded for `typeof window`.
- **Flag off:** the exact shipped Phaser window moves here verbatim (640×540 card,
  scrim, seven rows, `LEAVE`, message line, controls line, `setDepth(500)`,
  `cameras.main.ignore`) — a pure move from `src/scenes/rooms/trade.ts`, no
  behaviour change, no copy change, no geometry change.
- **Flag on:** nothing is drawn in Phaser; `#hud` gets `mountTradePanel` with a
  `Signal<TradePanelView>`; the module owns the card's own state (selection, message)
  and is the **only** writer, through `host.commitRun(result.run)` exactly once per
  successful trade. It listens to the scene's `pause` / `resume` events (spelled
  `'pause'`/`'resume'`, never a Phaser import) and to `'shutdown'`, like
  `src/scenes/panels/shop.ts`; a paused route's card goes `open: false` and comes
  back as it was.
- **Intents** (`mount.tsx` exports `TradeIntent`): `pick` (a party index),
  `give` (commit the selected member), `close`. The module maps each onto the same
  call the shipped window made, in this order: `tradePokemon(host.run, { memberId,
  mapIndex: host.view.mapIndex, roomId: host.view.roomId })`; on `ok` →
  `host.commitRun(result.run)` and switch the card to `kind: 'result'` with the
  received member; on refusal → the shipped line (`t('trade.used')`,
  `t('trade.refused')`) and no state write.
- **Keyboard keeps working:** the room's `RoomPanel.handle` stays the input path.
  Under the flag its up/down/confirm/cancel actions move the selection, commit and
  close through the same functions, so a key and a press reach one code path.
- `src/scenes/rooms/trade.ts` keeps: `descriptor` (`kind`, `marker`, `fixture`,
  `drawFixture`, `drawMarker`) and `interact`, which now calls `openTradeCard(host)`
  from the panel module. It imports the panel, **never the other way round** (no
  cycle). It keeps exporting nothing else the card needs.

### The run is never written outside `tradePokemon`

No new run field, no RNG draw of your own, **no `SAVE_VERSION` step**. The only RNG
is the one `tradePokemon` already spends (`hashSeed(`${seed}:trade:${map}:${room}`)`).

### Data

Six new keys in `src/i18n/en.ts` and the same six in `es.ts` (English source table,
Spanish overlay, `D43`); the token set and the FRLG font guard in
`src/i18n/index.test.ts` enforce the rest — do not edit that test unless a guard
fails on a character, and then only to add the character to the table it names.

| key              | en                    | es                        |
| ---------------- | --------------------- | ------------------------- |
| `trade.party`    | `PARTY`               | `EQUIPO`                  |
| `trade.pc`       | `PC`                  | `PC`                      |
| `trade.meta`     | `PARTY {party}/6 · PC {pc}/16` | `EQUIPO {party}/6 · PC {pc}/16` |
| `trade.give`     | `GIVE AWAY`           | `ENTREGAR`                |
| `trade.received` | `RECEIVED`            | `RECIBIDO`                |
| `trade.added`    | `ADDED TO YOUR PARTY` | `AÑADIDO A TU EQUIPO`     |
| `trade.close`    | `CLOSE`               | `CERRAR`                  |
| `trade.complete` | `COMPLETE`            | `COMPLETO`                |

(`trade.title`, `trade.greeting`, `trade.used`, `trade.refused`, `trade.missing`,
`trade.done`, `trade.controls` already ship — reuse them, never duplicate them.)

## 🧩 Data and configuration

- The two fixtures must satisfy `isHudState` in `src/ui/hud/fixtures/index.ts`:
  `{ "slug": "<same as the filename>", "state": { party: [], bag: [], money: null,
  route: null, battle: null, notice: null }, "pick": { … }, "result": { … } }`, the
  extra blocks being your own `TradeInput` fields, exactly as `03d-route-shop-buy`
  carries `buy`/`sell`.
- `03i-panels-trade-pick.json` carries the frame's own strings: title `TRADE`,
  message `Pick the Pokémon you will give away.`, six party members (Bulbasaur,
  Charmander, Squirtle, Growlithe, Eevee, Gastly) and five PC members (Abra, Machop,
  Oddish, Psyduck, Ponyta), selected 0.
- `03j-panels-trade-result.json` carries `SHELLDER`, water, the level line and the
  close button.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; green, including `view.test.ts` and
    `fixture.test.ts`.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-135` audited against the exclusive paths.
  - This task has one `[live]` criterion (the card on screen); the rest are
    `[unit]`.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` is clean (no `any`, no unused, no Phaser import
        from `src/ui/hud/panels/trade/`).
  - [ ] `[unit]` `tradePanelView` is pure and total: the same `TradeInput` twice is a
        deep-equal object, the input is not mutated, and `tradePanelBox` clamps a
        390×844 viewport inside 8 px on every edge.
  - [ ] `[unit]` At 1280×800 the view returns the board's own numbers: card
        `(260,120,760,560)`, six tiles `(284,236,158,104)` … and sixteen PC cells at
        the four columns / four rows above, the give-away button at `(470,612,340,44)`
        — asserted against `design/frames/03i-panels-trade-pick.json`, not against
        hand-typed numbers alone.
  - [ ] `[unit]` `fixture.test.ts` reads both fixtures and pins: the six tiles in
        party order, the selected index, the meta string, the PC count, the gave-away
        state (`canTrade: false` → `give.enabled === false`), and the result card's
        name/type/level line.
  - [ ] `[unit]` The rule is untouched: `git diff main...task-135 --
        src/engine/run/trade.ts` is empty, and `tradePokemon` is called exactly once
        per press (`grep`-auditable in `src/scenes/panels/trade.ts`).
  - [ ] `[unit]` `tradeDrawnObjectCount()` returns 0 with the flag on and the
        shipped count with it off (the same shape as `shopDrawnObjectCount`).
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` **The card lands on the board's rect and nothing of it is drawn in
        canvas.** Measurement: with `CHROME_PATH=/usr/bin/chromium npm run dev`
        running, open `http://127.0.0.1:<port>/?hud=dom`, walk to a route (Enter ×3:
        new run, seed, starter), then via CDP `Runtime.evaluate` with
        `awaitPromise: true`:
        `const m = await import('/src/main.ts'); const r = m.game.scene.getScene('Route'); const t = await import('/src/scenes/panels/trade.ts'); t.openTradeCard(r.panelHost);`
        — read `document.querySelector('[data-hud-panel="trade"]').getBoundingClientRect()`
        and require `x = 260 ± 2`, `y = 120 ± 2`, `w = 760 ± 2`, `h = 560 ± 2` at
        1280×800, then the same at 390×844 requiring `x = 8`, `w = 374` within 2 px;
        separately `(await import('/src/scenes/panels/trade.ts')).tradeDrawnObjectCount() === 0`
        on the same page, and the same count **> 0** with `?hud` absent (flag off).
        Report the two rects and the two counts verbatim.

## 📣 Coordination

- For the Architect: the trade card's own card state (rows, opening line, selection)
  moved from the room to the panel; the room keeps only its counter/fixture/interact.
  `src/scenes/panels/README.md`'s `trade.ts` line is `Task-137`'s to update.
- For the next batch: the DOM panel carries `data-hud-panel="trade"`; its intents are
  `pick`/`give`/`close`; the result state is `kind: 'result'` on the same panel.
- Under the flag the PC column is **read-only**: `tradePokemon` only accepts a party
  `memberId` (`TradeRequest` says so), so the panel must never send a PC id.

## ⛔ Out of scope

- `src/engine/run/trade.ts`, `src/ui/trade`-style modules, `src/i18n/index.test.ts`
  (unless a shipped guard rejects a new character — see Data).
- Any other panel, `src/scenes/panels/README.md`, `src/ui/hud/panels/README.md`,
  `docs/**`, `package.json`, `vite.config.ts`, `src/main.ts`, `src/data/**`.
- The area-entry banner, the notices and the reward card (batch-mates 136/137).
- The mobile touch pad, the board's unlabelled extras the frame does not carry, and
  any new art: portraits reuse the party panel's placeholder-cell treatment.
