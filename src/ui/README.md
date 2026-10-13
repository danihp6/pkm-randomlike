# `src/ui/` — HUD, panels and windows

The chrome the player reads: windows, textboxes, panels, grids and the models behind them.
`frlg.ts` draws the FRLG window and textbox nine-slices (plus the HP bar and the cursor) and
`frlgFont.ts` the bitmap font every panel writes text with. The split is the rule: a module
either **draws** (it takes a Phaser scene and returns game objects) or **computes** (pure layout,
metrics or data mapping with a co-located `*.test.ts` that `npm test` runs headless), and the
testable logic belongs in the computing half.

## Layout

- `frlg.ts` — the FRLG window, textbox, HP-bar and cursor chrome, and the texture keys it loads.
- `frlgFont.ts` — the bitmap font and its metrics, from `src/assets/frlg/font.png`.
- `panel.ts` — the plain panel background and gauge, and the colours they use.
- `moveGrid.ts` — the shared moves grid: a type-tinted cell with type and category badges, PP and
  power, and a floating description window; the battle and the route HUD draw the same component.
- `infoPopup.ts` — the floating description window: an FRLG window sized from its wrapped text,
  with an optional left column of badges or a colour chip; the move cells and the ability rows
  float the same one.
- `abilityInfo.ts` — the ability row's info control and the text it floats, so the route HUD,
  the battle's switch window and the capture screen read the same way.
- `partyScreen.ts` — the party/box model: rows, panes, cursor, drag/drop and the box page math.
- `partyDetail.ts` — the party detail popup: STATS/MOVES tabs, nature effects and move reordering.
- `bag.ts` — the bag pockets, their labels and the pure categorisation of an item.
- `capture.ts` — the capture sequence's beats: the shakes, the holds and the click.
- `shop.ts` — the Mart and the sell list: stock, prices and the pure trades against the run.
- `rewards.ts` — the item choices a trainer or boss win offers.
- `runSummary.ts` — the run-over summary model and its lines.
- `permadeath.ts` — the release beats for the Pokémon the run lost.
- `evolutionGraph.ts` — a species' family graph and the levels between its members.
- `mapView.ts` — the minimap: the room grid, its openings and the boss/portal markers.
- `settingsScreen.ts` — the settings rows and the pure change rules (steps, cycles and rebinds).
- `typewriter.ts` — the message box's typewriter at the player's text speed.
- `beats.ts` — the faint, switch and level-up animation beats.
- `feed.ts` — the battle events as the frames the feed draws, and a frame's message.
- `metrics.ts` — HP fraction and colour and the status abbreviations.
- `typeColors.ts` — the canon type colours and tints.
- `touchLayout.ts` — the pure geometry of the on-screen pad and A/B; `touchControls.ts` draws it.
- `seedPrompt.ts` — the DOM seed/share prompt the starter screen opens.

## Rules

1. A module either draws or computes; it never does both.
2. The computing half carries a co-located `*.test.ts`, and the drawing half stays thin enough to
   trust to a scene.
3. Panels are built on `frlg.ts` and `frlgFont.ts`, not on ad-hoc graphics.
4. A colour, label or layout constant two panels share lives in the computing half, never
   duplicated.
