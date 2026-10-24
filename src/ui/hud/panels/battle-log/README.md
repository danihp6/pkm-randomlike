# `src/ui/hud/panels/battle-log/` — the battle's message box (`05b`)

The battle feed's card as Preact over the `#hud` layer (`D49`): the glass box at the
board's own rect, its 1 px highlight, the message line in ink and the effect line in the
frame's red. Under `?hud=dom` the canvas hides `messagePanel`/`messageText`, so this card
**is** the message box; with the flag off nothing here mounts and the canvas draws it
exactly as before.

## Layout

- `view.ts` — the panel's value model: `BATTLE_LOG_DWELL_MS` (the one 900), `BATTLE_LOG_SLUG`
  and `BATTLE_LOG_SLUGS`, `battleLogBoard` (both frames' measured box and line rects),
  `liveBattleLogView`, `fixtureBattleLogView` and `feedStep` (the feed's one clock).
- `view.test.ts` — `feedStep` at 899/900 and the 45 ms rush floor, the not-done reset, the
  live view's visible/hidden/one-line/empty cases and both boards' rects, headless.
- `battleLogPanel.tsx` — the card: the board's box, the highlight 12 px down, line 1 (primary
  ink) and line 2 (effect red) at their frame rects.
- `battleLog.css` — the 92 % glass, the hairline and highlight, and the two line skins at the
  board's type sizes; the phone card keeps the clone at the body size.
- `mount.tsx` — `mountBattleLog`: renders the card into a host element and returns the handle
  the scene pushes through; a push that repeats the line on screen is dropped, and a push
  after a resize repaints the board.
- `preview.ts` — the `?hud=dom&hudFixture=<05b slug>` preview and its disposer.
- `preview.test.ts` — `battleLogPreviewRequested`'s truth table.
- `index.ts` — the barrel the scene imports.
- `fixture.test.ts` — `design/fixtures/05b-battle-message.json` is the frame's own copy, and
  both boards are checked against the exported `design/frames/*.json`.
- `README.md` — this map.

## Rules

1. The view is data, never the battle: the scene pushes `liveBattleLogView(!menuOpen,
visibleText(this.typing))` and this paints it. No listener, no clock, no Phaser, no run
   and no i18n live here — the line arrives already localised.
2. `BATTLE_LOG_DWELL_MS` is the only 900: the scene imports it for every frame hold,
   capture beat included, so the DOM pace and the canvas pace cannot drift.
3. The card is `position: fixed` at the model's rect with `pointer-events: none`, so the
   canvas's pads and keys keep every press.
4. `battleLogBoard('desktop'|'narrow')` is the measured board — `05b` at 1280×800 and
   `m05b` under 600 px — and is the only place the two rects are written.
