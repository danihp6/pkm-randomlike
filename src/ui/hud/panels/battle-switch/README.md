# `src/ui/hud/panels/battle-switch/` — the battle's SWITCH window (`05d`)

The SWITCH command's card as Preact over the `#hud` layer (`D49`): one row per party
member with its portrait cell, its fitted name-and-level line, its HP track and fill,
its status mark, the selected row's accent and the ◀ back control. The card **is** the
battle's menu box — `battleSwitchBox`, the shipped `battleMovesBox` re-exported — so the
grid lands exactly where the Phaser window was, at 1280×800 and on the compact phone
layout alike.

## Layout

- `view.ts` — the panel's value model: `battleSwitchBox`, `battleSwitchView` (the six row
  rects from `partyGridLayout`, each member's portrait, fitted line, HP track, fill window,
  status mark and the ◀), `fixtureSwitchInput` and the mirrored constants.
- `view.test.ts` — both QA viewports' cards, the pinned row tops and pitch, the row,
  portrait, track, fill, label and mark rects, the three tone bands at their boundaries,
  the fainted row's missing bar, the clamps and the purity, headless.
- `battleSwitchPanel.tsx` — the card: one button per member (or nothing when the grid is
  closed), the ◀, and the press each one answers with. `rowPressIntent` is the
  one-press-one-switch rule.
- `battleSwitch.css` — the hidden canvas window's glass, the row and selected skins, the
  portrait tile, the HP track and its three fills and the status mark.
- `mount.tsx` — `mountBattleSwitch`: renders the card into a host element, returns the
  controller the scene pushes through, and carries the panel's own intent union.
- `preview.ts` — the `?hud=dom&hudFixture=05d-battle-pokemon` preview and its disposer.
- `preview.test.ts` — `previewRequested`'s truth table.
- `index.ts` — the barrel the scene imports.
- `fixture.test.ts` — `design/fixtures/05d-battle-pokemon.json` is the frame's own copy:
  its desktop card, its six members, the two status marks and the three HP bands.
- `README.md` — this map.

## Rules

1. The view is data, never the battle: the scene builds `BattleSwitchInput` from its own
   party and `menuIndex`. The panel reads **no** `HudState`, and nothing here imports the
   engine, a random stream or a clock.
2. The card is `battleMovesBox` and the rows are the same `partyGridLayout` call the canvas
   makes (`{ rows: 6, gap: 8, backColumn: 64, inset: 8 }`), so the two grids can never
   diverge; `src/ui/partyGrid.ts` stays the only place the row arithmetic lives.
3. Every intent lands on the call the canvas already made: `switch` on `confirmParty` (the
   row's own press) and `back` on `onBack`. The send-out beat is the scene's `playSwitch`,
   driven by the feed — the card never performs a switch, never submits a command.
4. The card is `position: fixed` at the model's rect and only its rows and its ◀ take a
   press (`pointer-events: none` on the layer), so the canvas's pads and keys keep every
   other press; under `?hud=dom` the scene draws none of its own switch chrome.
