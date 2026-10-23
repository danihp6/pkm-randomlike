# `src/ui/` — HUD, panels and windows

The chrome the player reads: windows, textboxes, panels, grids and the models behind them.
`frlg.ts` draws the drawn chrome set's window and textbox nine-slices (plus the FRLG HP bar and the
▶ cursor) and `frlgFont.ts` the bitmap font every panel writes text with. The split is the rule: a module
either **draws** (it takes a Phaser scene and returns game objects) or **computes** (pure layout,
metrics or data mapping with a co-located `*.test.ts` that `npm test` runs headless), and the
testable logic belongs in the computing half.

## Layout

- `frlg.ts` — the drawn glass-card skins (the menu card and the battle message box), their corner,
  padding and translucency (`src/data/ui/chrome.json`), the chrome tokens every panel draws with
  (the surface, the five inks, the hairlines and the row / selected / track tones), the FRLG HP bar
  and ▶ cursor, and the texture keys it loads.
- `frlg.test.ts` — the pinned `chrome.json` tokens and the card's own contrast pass over the
  forest's ground tones, headless.
- `frlgFont.ts` — the bitmap font and its metrics, from `src/assets/ui/font.png`, and the light body ink.
- `floatingPanel.ts` — the floating glass card a non-modal window draws on: its header drag handle, its drawn ✕ and the pure clamp that keeps it on screen.
- `floatingPanel.test.ts` — the panel clamp: inside the viewport, each edge and a viewport smaller than the card, headless.
- `panel.ts` — the plain glass-card panel background and gauge, and the tokens they read.
- `moveGrid.ts` — the shared moves grid: a glass cell with type and category badges, PP and
  power, and a floating description window; the battle and the route HUD draw the same component.
- `moveGrid.test.ts` — the slot geometry and hit-testing the grid draws from: the four slots of a
  short list, the empty container's own rect, and the ⓘ no empty container has.
- `infoPopup.ts` — the floating description window: the glass card sized from its wrapped text,
  with an optional left column of badges or a colour chip; the move cells and the ability rows
  float the same one.
- `notice.ts` — the run's transient notices: their copy and hold time, one at a time, with no
  key and no input taken.
- `casino.ts` — the slot machine as a pure model: one spin against the run (price, lock,
  weighted prize or the grunt fight), the band's equipable pool the grouped row draws from, and
  the Egg's hatch on the floor advance.
- `casinoReels.ts` — the machine panel's reels: the card and three-window geometry, the item and
  Rocket faces, the three strips a spin turns and the stop/tick schedule its reveal follows.
- `casinoReels.test.ts` — the pinned reel geometry and stops, every band's payable faces in table
  order, the strips and the face index over time, headless.
- `npcPanel.ts` — the modal card every special NPC fills: the title, the wrapped paragraph, the
  column of choices with `LEAVE` last, and the pure row layout the card draws from.
- `rocketPanel.ts` — the Team Rocket NPC's slot machine: the cabinet card with its three clipped
  reels, the `SPIN` / `LEAVE` rows, the reveal the booked outcome runs and the grunt battle a
  booked fight starts on the NPC's own tile. It exports no room descriptor: the machine is a
  panel.
- `rocketPanel.test.ts` — the machine's own surface: the resting and revealing reels, the run
  committed before the first frame, the price and lock lines, the tile the grunt is fought on and
  the module's export list.
- `abilityInfo.ts` — the ability row's info control and the text it floats, so the route HUD and
  the battle's switch window read the same way.
- `battleInfo.ts` — the battle-state window's rows: the weather, the terrain, the field and side
  conditions, the stat stages and the status, and how the list window draws them.
- `partyScreen.ts` — the party/box model: rows, panes, cursor, drag/drop and the box page math.
- `partyDetail.ts` — the party detail popup: STATS/MOVES tabs, nature effects and move reordering.
- `partyGrid.ts` — the battle SWITCH window's row geometry: one fixed-size row per party member and the pure label truncation.
- `scroll.ts` — the pure row-window arithmetic a scrolling grid shares: the clamped row offset, the one-row step and the visible item range.
- `bag.ts` — the bag pockets, their labels and the pure categorisation of an item.
- `capture.ts` — the capture beat's one clock: the engine's own wobble count, the throw/drop/wobble/break/settle timeline the tweens and the message box share, and the wait line's dots.
- `shop.ts` — the Mart and the sell list: stock, prices and the pure trades against the run, and the row's own `draggable` flag.
- `rewards.ts` — the item and anonymous-Pokémon choices a trainer or boss win offers, and the row model the floating reward card draws.
- `runSummary.ts` — the run-over summary model and its lines.
- `permadeath.ts` — the release beats for the Pokémon the run lost.
- `evolutionGraph.ts` — a species' family graph and the levels between its members.
- `mapView.ts` — the minimap: the room grid, its openings and the boss/portal markers.
- `settingsScreen.ts` — the settings rows and the pure change rules (steps, cycles and rebinds).
- `typewriter.ts` — the message box's typewriter at the player's text speed.
- `beats.ts` — the faint, switch and level-up animation beats.
- `feed.ts` — the battle events as the frames the feed draws, a frame's message, and the log
  key resolved in the current locale through the move, ability and item tables.
- `metrics.ts` — HP fraction, colour and the low-HP danger cue, and the status abbreviations.
- `typeColors.ts` — the canon type colours.
- `touchLayout.ts` — the pure geometry of the on-screen pad and A/B; `touchControls.ts` draws it.
- `seedPrompt.ts` — the DOM seed/share prompt the starter screen opens.
- `hud/state.ts` — the DOM HUD's one projection: the serialisable snapshot of the run and the battle (party, bag, money, route, battle, notice) and the single emit point a scene notifies.
- `hud/commands.ts` — the HUD's command channel: the intents a panel can send and the reducer that maps them onto the action a key or pad press already produces.
- `hud/mount.ts` — the `?hud=dom` flag parser and the one-shot mount of the full-viewport `#hud` root, with its idempotent `dispose`.
- `hud/mount.test.ts` — the flag's truth table, the vendored Silkscreen files and the layer contract `root.css` pins, headless.
- `hud/shell.tsx` — the Preact shell: one `.hud` layer for the panel subtrees, with no state and no Phaser object.
- `hud/styles/root.css` — the Silkscreen faces, the `design/tokens.json` custom properties, the ten board type sizes and the `#hud` / `.hud` layer contract.

## Rules

1. A module either draws or computes; it never does both.
2. The computing half carries a co-located `*.test.ts`, and the drawing half stays thin enough to
   trust to a scene.
3. Panels are built on `frlg.ts` and `frlgFont.ts`, not on ad-hoc graphics, and every chrome tone
   they fill or ink with comes from the `chrome.json` tokens — never a literal in a scene.
4. A colour, label or layout constant two panels share lives in the computing half, never
   duplicated.
