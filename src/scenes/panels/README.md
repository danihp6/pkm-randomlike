# `src/scenes/panels/` — the route's overlay panels

One module per route panel, discovered by `RouteScene`'s registry from this folder
itself (`D47`'s shape, one folder over): a new panel is a new file here and the scene
is not edited. Each module exports a single `descriptor` whose `id` is its own file
name and whose `order` is its build/z slot; the scene owns the keyboard slot, the run
and the route, and hands them over through `RoutePanelHost` (`types.ts`). The folder
imports Phaser **type-only**, so it loads in a headless test, and never imports the
scene.

## Layout

- `types.ts` — the port a panel mounts and reads through, the descriptor shape, the frozen
  panel ids and the HUD metrics. A panel is a **controller**: it mounts its card into `#hud`,
  feeds it the view and forwards its intents. The HUD's windows, rows, texts and strip are
  DOM-only; the folder's two canvas overlays — the level-up/evolution popup and the reset
  ring, both listed under _The canvas residue_ below — are the only Phaser objects a panel
  still builds (`D49` amended).
- `registry.ts` — collects the folder's `descriptor` exports, keyed by id and sorted
  by `order`; it throws on a duplicate id or a duplicate order.
- `registry.test.ts` — the collection rules and the folder's own module convention.
- `hud.ts` — the HUD's frame: the panel metrics, the open/collapsed state the quick keys and the
  chips toggle, each card's default dock, and the mounted edge chip strip. The drag, its clamp
  and the saved placement left with the canvas layer (`Task-208` owns their DOM parity).
- `map.ts` — the route header, which is the floor minimap: its card in `#hud` and the open
  flag that hides it behind another screen.
- `party.ts` — the party card: the six rows, a press that opens the pressed member's detail
  window and never moves it, and the row reorder on a drop through `reorderParty`.
- `bag.ts` — the bag card: pocket tabs, filter field, item grid, money row and its
  description card; it owns the pocket, the cursor and the query.
- `bag.test.ts` — the drawn card's body: the English name over the localised text, headless.
- `pc.ts` — the PC BOX card: page tabs, avatar grid and the RIP tab, with the page following
  the cursor, a press opening the member's detail window and a cell drop reordering the box
  through `moveInBox`.
- `detail.ts` — the member detail card: STATS, MOVES, evolutions, nickname and the learnset
  pool. It also builds the level-up/evolution popup, the folder's one canvas residue — see
  below — and owns the HUD's single member gesture: the press-then-release on `#hud` that
  opens no card but withdraws a box cell let go on the party card and deposits a party row
  let go on the PC card.
- `notices.ts` — the notice strip, the area banner and the mission line as the DOM card's
  three lines, with their own hold timers on the scene's clock.
- `rewards.ts` — the mini-boss reward card: the rows, the two-press arm/commit and the level-up
  callback, painted by the mount.
- `pause.ts` — the pause menu card (the cursor, the two-press Reset and the keys) plus the
  hold-to-reset overlay, the folder's other canvas residue — see below.
- `shop.ts` — the Mart's card: the stock's model, the tab, the scroll and the one writer of a
  trade. The shelf rules stay in `rooms/shop.ts`.
- `trade.ts` — the trade card: the selection, the line and the received member, with one
  `tradePokemon` call and one `commitRun` per landed trade.
- `README.md` — this map.

## The canvas residue: two transient overlays

Everything above is DOM. Two overlays have no card in `design/`, so this folder still
builds them in Phaser exactly as it did before `D49` was amended, and their DOM parity — or
their retirement — is follow-up `Task-208`, not assumed here:

- **The level-up / evolution popup, complete.** `buildLearnPopup`
  (`detail.ts:354-385`) runs unconditionally from `buildDom` (`detail.ts:754`): its
  full-screen scrim (`:361`), its FRLG nine-slice window (`:362`), its three bitmap texts —
  title, body and press-any-key hint — (`:363`, `:367`, `:372`), the whole-screen press zone
  that dismisses it (`:377`) and the container around them (`:380`).
- **The hold-to-reset feedback.** The scrim (`pause.ts:120`) and the ring that fills while
  the key is held (`pause.ts:125`).

## The port's additions over the spec's frozen list

`RoutePanelHost` (`types.ts`) is the spec's frozen surface **plus** the five reads a panel
cannot compute on its own, treated as frozen from now on:

- `route()` — the route on screen, for the header's biome name.
- `plan()` — the floor plan (or null off a planned room), for the minimap.
- `rooms()` — the special rooms' descriptors, for the minimap's own markers (`D47`).
- `openSettings()` — opens the Settings screen paused on top (the pause menu's row).
- `restartRun()` — starts a fresh run (the pause menu's Reset row; the rule itself
  stays in the scene).

`hudCardOpen(id)` / `setHudCardOpen(id, open)` are the frame's own pair: a card asks whether
it is open and the quick keys plus the chip strip write it, so no panel keeps a second copy
of that state.

`close` is optional on every descriptor and the scene walks it with `panel.close?.()`.
Eight of the eleven cards dispose their mount there; `rewards`, `shop` and `trade` ship no
`close` and are torn down by their own room timers (`closeMiniBossReward`, `closeShopCard`,
`closeTradeCard`), which the scene does not own.

## Rules

1. A panel is a new file exporting exactly one `descriptor`; adding one needs no edit
   to `RouteScene` and no edit to the other panels.
2. A panel reaches the scene only through `RoutePanelHost`; it never imports
   `RouteScene` and never writes the run (`commitRun` is the scene's).
3. A panel keeps its own state at module scope, the way the room layer does.
4. Phaser is a **type-only** import. A panel paints through the Preact mount it is handed,
   never through `host.scene.add`; the two overlays named above are the only place a scene
   object is built.
5. A helper another panel also needs is exported by the module that owns it, never
   copied.
6. A card unmounts what it mounted when its descriptor says so: `build` mounts once,
   `refresh` only pushes the view, and `close` — where the descriptor ships one — disposes
   the mount and its listeners.
