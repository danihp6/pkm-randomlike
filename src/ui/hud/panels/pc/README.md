# `src/ui/hud/panels/pc/` — the PC box (`03b`)

The route's PC box as Preact over the `#hud` layer (`D49`): the shipped 344 × 378 window —
the page-tab strip, the RIP tab with its lock veil and the 4 × 4 grid of avatar cells — with
the board's paint taken from `03b Panels · row view` and nothing else from it. The scene
module `src/scenes/panels/pc.ts` keeps the shipped layout arithmetic and feeds this panel's
view, so a turn of `?hud=dom` swaps the drawing and not the rules.

## Layout

- `view.ts` — the panel's value model: `pcPanelView` (a pure projection of the rows, the pane, the page and the cursor), `pcPanelBox`, `initialPcPanelUi` and the block of mirrored Phaser constants.
- `view.test.ts` — the mirrored constants against their literals, both panel boxes, the page slice with its empty cells, the tab strip, the RIP tab, the highlight, the key chip, the selected/locked marks and purity, headless.
- `pcPanel.tsx` — the panel itself: the card, the key chip, the page tabs, the RIP tab, the 16 cells with their name, level, HP bar, HP text, status mark and lock veil, the commands they emit and the pointer drag that reorders the box; the drag cell lives in `PcPanel` (which also drops a carried cell on any release outside the card) and the paint in `PcCard`.
- `pcPanel.test.ts` — the card walked as Preact props: the drag's one `onReorder` and the click it swallows, the press that only asks for the member's detail, the locked cell and the RIP pane that start no drag, the scene's own press and reorder receivers, and the HUD's one member gesture resolving both cards on release.
- `pc.css` — the board's card and slot paint plus the shipped tab strip, one scoped custom property per board value.
- `mount.tsx` — `mountPcPanel`: renders the panel into a host element against the scene's signal, beside the command and reorder callbacks, inside the panel frame that carries its chip and drag, and returns its disposer.
- `index.ts` — the barrel the scene module imports.
- `README.md` — this map.

## Rules

1. The view is data: no scene, no run, no engine, no save, no RNG. The scene stamps `open` from the frame machinery, because collapsed/expanded belongs to the HUD and not to the box.
2. The page is the cursor's page (`boxPageForIndex`), never a second copy of it, so the keyboard cursor and the drawn page cannot disagree.
3. The board supplies paint only: the card's radius and hairline, the 12 px highlight, the 24 × 24 accent-edged key chip and the slot's radius 8 with its 4 % / 8 % pair. The paging strip, the shipped cell size and the grid are the screen's own.
4. Every control carries the kit's 44 × 44 hit overlay (`::after`); a cell is 76 × 76 and needs none.
5. Commands: the key chip asks for the `box` panel toggle, a cell asks for its member (the scene opens that member's detail window and moves nobody), the page tabs and the wheel ask for a left/right page step, and the RIP tab asks for a confirm (it selects that list). The component never touches the run. The card's root carries `data-hud-panel="box"`, the marker the HUD's member gesture hit-tests a release against.
6. A cell dragged **onto** another cell reports `onReorder(from, to)` once and swallows the click that follows it; the scene reorders the box through the run engine. A drag starts only on a member the rules will move — a locked cell (outside the floor's entry room) and every RIP cell paint no drag and keep the press for their detail window. A cell dragged **off** the card leaves the whole crossing to that same HUD gesture.
7. A paused route (a battle over it, the Settings screen) hides the root: `src/scenes/panels/pc.ts` follows the scene's own `PAUSE`/`RESUME` beats and stamps `open: false`, so the card never floats over the battle, and the resume gives back the same rect and the same collapsed state. The mount stays alive throughout; only the view changes.
