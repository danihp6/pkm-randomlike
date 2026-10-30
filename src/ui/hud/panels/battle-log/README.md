# `src/ui/hud/panels/battle-log/` — the battle's message box (`05b`)

The battle feed's card as Preact over the `#hud` layer (`D49`): the glass box at the
battle menu's own card, its 1 px highlight, the message line in ink and the effect line
in the frame's red. The box **is** the menu window: the scene pushes the live
`battleMovesBox` rect and the panel paints the lines inside it, so opening a menu swaps
the lines for the rows without resizing or moving the card. Under `?hud=dom` the canvas
hides `messagePanel`/`messageText`, so this card is the message box; with the flag off
nothing here mounts and the canvas draws it exactly as before. The fixture preview
pushes no card and paints the measured `05b`/`m05b` board.

## Layout

- `view.ts` — the panel's value model: `BATTLE_LOG_DWELL_MS` (the one 900), `BATTLE_LOG_SLUG`
  and `BATTLE_LOG_SLUGS`, `battleLogBoard` (both frames' measured box and line rects),
  `battleLogLayout` (the same insets on the live menu card), `liveBattleLogView`,
  `fixtureBattleLogView` and `feedStep` (the feed's one clock).
- `view.test.ts` — `feedStep` at 899/900 and the 45 ms rush floor, the not-done reset, the
  live view's visible/hidden/one-line/empty/card cases, `battleLogLayout` on both widths and
  both boards' rects, headless.
- `battleLogPanel.tsx` — the card: the live card (or the board when no card is pushed), the
  highlight 12 px down, line 1 (primary ink) and line 2 (effect red) at their rects.
- `battleLogPanel.test.ts` — the card takes the live menu rect and the lines stay inside it;
  the preview falls back to the board; the closed box keeps its card and no line.
- `battleLog.css` — the 92 % glass, the hairline and highlight, and the two line skins at the
  board's type sizes; the phone card keeps the clone at the body size.
- `mount.tsx` — `mountBattleLog`: renders the card into a host element and returns the handle
  the scene pushes through; a push that repeats the line on screen is dropped, and a push
  that moves or resizes the card repaints.
- `preview.ts` — the `?hud=dom&hudFixture=<05b slug>` preview and its disposer.
- `preview.test.ts` — `battleLogPreviewRequested`'s truth table.
- `index.ts` — the barrel the scene imports.
- `fixture.test.ts` — `design/fixtures/05b-battle-message.json` is the frame's own copy, and
  both boards are checked against the exported `design/frames/*.json`.
- `README.md` — this map.

## Rules

1. The view is data, never the battle: the scene pushes
   `liveBattleLogView(!menuOpen, visibleText(this.typing), battleMovesBox(viewport))` and this
   paints it. No listener, no clock, no Phaser, no run and no i18n live here — the line
   arrives already localised.
2. `BATTLE_LOG_DWELL_MS` is the only 900: the scene imports it for every frame hold,
   capture beat included, so the DOM pace and the canvas pace cannot drift.
3. The card is `position: fixed` at the model's rect with `pointer-events: none`, so the
   canvas's pads and keys keep every press.
4. The live box **is** the battle menu card: `battleLogLayout` puts the two lines on the
   frame's insets inside that rect, so a menu opening never resizes or moves it. Only the
   fixture preview draws `battleLogBoard('desktop'|'narrow')`, the measured `05b`/`m05b`
   rects, which stay the only place those two boards are written.
