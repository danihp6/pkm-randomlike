# `src/ui/` — HUD, panels and windows

The chrome the player reads: windows, textboxes, panels, grids and the models behind them.
`frlg.ts` draws the drawn chrome set's window and textbox nine-slices (plus the FRLG HP bar and the
▶ cursor) and `frlgFont.ts` the bitmap font every panel writes text with. The split is the rule: a module
either **draws** (it takes a Phaser scene and returns game objects) or **computes** (pure layout,
metrics or data mapping with a co-located `*.test.ts` that `npm test` runs headless), and the
testable logic belongs in the computing half.

## Layout

- `frlg.ts` — the drawn window and textbox nine-slices, their corner, padding and translucency
  (`src/data/ui/chrome.json`), the FRLG HP bar and ▶ cursor, and the texture keys it loads.
- `frlgFont.ts` — the bitmap font and its metrics, from `src/assets/ui/font.png`, and the deep-black ink.
- `panel.ts` — the plain panel background and gauge, and the colours they use.
- `moveGrid.ts` — the shared moves grid: a type-tinted cell with type and category badges, PP and
  power, and a floating description window; the battle and the route HUD draw the same component.
- `moveGrid.test.ts` — the slot geometry and hit-testing the grid draws from: the four slots of a
  short list, the empty container's own rect, and the ⓘ no empty container has.
- `infoPopup.ts` — the floating description window: an FRLG window sized from its wrapped text,
  with an optional left column of badges or a colour chip; the move cells and the ability rows
  float the same one.
- `notice.ts` — the run's transient notices: their copy and hold time, one at a time, with no
  key and no input taken.
- `abilityInfo.ts` — the ability row's info control and the text it floats, so the route HUD and
  the battle's switch window read the same way.
- `battleInfo.ts` — the battle-state window's rows: the weather, the terrain, the field and side
  conditions, the stat stages and the status, and how the list window draws them.
- `partyScreen.ts` — the party/box model: rows, panes, cursor, drag/drop and the box page math.
- `partyDetail.ts` — the party detail popup: STATS/MOVES tabs, nature effects and move reordering.
- `partyGrid.ts` — the battle SWITCH window's row geometry: one fixed-size row per party member and the pure label truncation.
- `scroll.ts` — the pure row-window arithmetic a scrolling grid shares: the clamped row offset, the one-row step and the visible item range.
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
- `metrics.ts` — HP fraction, colour and the low-HP danger cue, and the status abbreviations.
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
