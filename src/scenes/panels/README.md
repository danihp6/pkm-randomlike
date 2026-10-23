# `src/scenes/panels/` — the route's overlay panels

One module per route panel, discovered by `RouteScene`'s registry from this folder
itself (`D47`'s shape, one folder over): a new panel is a new file here and the scene
is not edited. Each module exports a single `descriptor` whose `id` is its own file
name and whose `order` is its build/z slot; the scene owns the keyboard slot, the
pointer dispatch, the run and the route, and hands them over through
`RoutePanelHost` (`types.ts`). The folder imports Phaser **type-only**, so it loads in
a headless test, and never imports the scene.

## Layout

- `types.ts` — the port a panel draws through, the descriptor shape, the frozen panel
  ids and the HUD records (`HudPanel`, `HudMetrics`).
- `registry.ts` — collects the folder's `descriptor` exports, keyed by id and sorted
  by `order`; it throws on a duplicate id or a duplicate order.
- `registry.test.ts` — the collection rules and the folder's own module convention.
- `hud.ts` — the frame machinery: the draggable panel records, their collapse icons,
  the drag/clamp/persist rules, the Transparent HUD repaint, and the party header's
  shared level, XP and Pokevial bar.
- `map.ts` — the route header, which is the floor minimap.
- `party.ts` — the party window and its six rows.
- `bag.ts` — the bag window: pocket tabs, filter field, item grid, money row and its
  description card.
- `pc.ts` — the PC BOX window: page tabs, avatar grid and the RIP tab.
- `detail.ts` — the member detail window: STATS, MOVES, evolutions, nickname,
  learnset pool and the level-up/evolution popup.
- `notices.ts` — the notice strip, the area-entry banner and the floor's mission line.
- `rewards.ts` — the mini-boss reward card and its rows.
- `pause.ts` — the pause menu and the hold-to-reset overlay.
- `shop.ts` — the Mart's entry point; its drawing still lives in `rooms/shop.ts`.
- `trade.ts` — the trade card's entry point; its drawing still lives in `rooms/trade.ts`.
- `README.md` — this map.

## Rules

1. A panel is a new file exporting exactly one `descriptor`; adding one needs no edit
   to `RouteScene` and no edit to the other panels.
2. A panel reaches the scene only through `RoutePanelHost`; it never imports
   `RouteScene` and never writes the run (`commitRun` is the scene's).
3. A panel keeps its own state at module scope, the way the room layer does.
4. Phaser is a **type-only** import; drawing goes through `host.scene.add`, the
   `src/ui/` helpers and the HUD frame functions in `hud.ts`.
5. A helper another panel also needs is exported by the module that owns it, never
   copied.
