# `src/ui/` — HUD, panels and windows

The chrome the player reads: windows, textboxes, panels, grids and the models behind
them. `frlg.ts` draws the FRLG window/textbox nine-slices (plus the HP bar and the
cursor) and `frlgFont.ts` the bitmap font every panel writes text with. The split is
the rule: a module either **draws** (it takes a Phaser scene and returns game
objects) or **computes** (pure layout, metrics or data mapping with a co-located
`*.test.ts` that `npm test` runs headless), and the testable logic belongs in the
computing half.

## Layout

- `frlg.ts` — the FRLG chrome: `addFrlgWindow` (the `FrlgWindowVariant` nine-slices), `addFrlgHpBar`, and the texture URLs and keys the atlas is loaded under.
- `frlgFont.ts` — the bitmap font: `registerFrlgFont`, `frlgFontData` and `addFrlgText`, from `src/assets/frlg/font.png` and its metrics.
- `panel.ts` — the plain panel background and gauge (`drawPanel`, `drawGauge`) and the colours they use.
- `moveGrid.ts` — the shared moves grid (`MoveGrid`): a type-tinted cell with the type and category badges, PP and power, and a floating description window; the battle's FIGHT menu and the route HUD's detail panel draw the same component.
- `partyScreen.ts` — the party/box model: rows, the two panes, cursor and drag/drop input, and the box page math.
- `partyDetail.ts` — the party detail popup's model: the STATS/MOVES tabs, the nature effect and the move reorder state.
- `bag.ts` — the bag pockets, their labels and the pure categorisation of an item.
- `capture.ts` — the capture sequence's beat (`captureBeat`): holds, shakes and the click.
- `shop.ts` — the Mart and the sell list: stock, prices and the pure buy/sell trades against a `RunState`.
- `rewards.ts` — `rewardChoices`: the item choices a trainer or boss win offers.
- `runSummary.ts` — the run-over summary model and its lines.
- `permadeath.ts` — the release beats for the Pokémon the run lost.
- `evolutionGraph.ts` — `evolutionGraph`: a species' family and the levels between them.
- `mapView.ts` — the minimap: the room grid, its openings and the boss/portal markers, from a `MapPlan`.
- `settingsScreen.ts` — the settings rows and every pure change rule (steps, cycles and rebinds).
- `typewriter.ts` — the message box's typewriter at the player's text speed.
- `beats.ts` — the faint, switch and level-up animation beats.
- `feed.ts` — turns the battle events into the frames the feed draws, and a frame's message.
- `metrics.ts` — HP fraction and colour and the status abbreviations.
- `typeColors.ts` — the canon type colours and tints.
- `touchLayout.ts` — the pure geometry of the on-screen pad and A/B; `touchControls.ts` draws it.
- `seedPrompt.ts` — the DOM seed/share prompt the starter screen opens.

## Rules

1. A module either draws or computes; it never does both.
2. The computing half carries a co-located `*.test.ts`, and the drawing half stays thin enough to trust to a scene.
3. Panels are built on `frlg.ts` and `frlgFont.ts`, not on ad-hoc graphics.
4. A colour, label or layout constant two panels share lives in the computing half, never duplicated.
