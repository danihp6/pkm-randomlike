# `src/ui/hud/panels/pause/` — the pause menu (`03n`)

The pause card as Preact over the `#hud` layer (`D49`): the board's centred 360 px card
with the 55 % scrim, the title, the hairline, the divider and the game's **two**
pressable rows (`Settings`, `Reset run`). The card is the board's `03n` geometry with a
two-row height (`88 + 56 × 2 = 200`), and its labels are the live i18n strings because
the board's four CONTINUE/OPTIONS/NEW RUN/EXIT rows do not ship. `src/scenes/panels/pause.ts`
keeps every rule: the open state, the cursor, the two-press Reset arming, the keys and the
hold-to-reset overlay, which stays in Phaser on both paths.

## Layout

- `view.ts` — the panel's value model: `pausePanelBox`, `pausePanelView` from the scene's own open/cursor/arm, `fixturePausePanelView` from `design/fixtures/03n-panels-pause-menu.json`'s `menu` block, and the mirror block of every board rect (`PAUSE_CARD_W`, `PAUSE_ROW_PITCH`, `PAUSE_TITLE`, …).
- `view.test.ts` — the two QA viewports' card rects, the measured table node by node, the cursor and arm clamps, the closed card's unchanged geometry, the scene module's frozen descriptor and its row paths headless, and the `pauseDrawnObjectCount` flag contract.
- `fixture.test.ts` — `design/fixtures/03n-panels-pause-menu.json` against `design/frames/03n-panels-pause-menu.json`, node by node card-relative, plus the structural guards that answer `null` instead of throwing.
- `pausePanel.tsx` — the card itself: the scrim sibling, the highlight, the title, the divider and one hand-rolled button per row.
- `pause.css` — the board's paint as scoped custom properties (the card's 92 % fill, 16 % edge, 14 % highlight, 8 % divider, the 4 %/16 % rows) over the `styles/root.css` type tokens.
- `mount.tsx` — `mountPausePanel`: renders the card into a host element behind a view signal, paints once before subscribing, takes no key listener, and returns an idempotent disposer; plus the card's `PausePanelIntent` channel.
- `preview.ts` — `pausePreviewRequested` and `installPausePreview`: the fixture card behind `?hud=dom&hudFixture=03n-panels-pause-menu`, mounted in a microtask because `#hud` does not exist yet.
- `preview.test.ts` — `pausePreviewRequested`'s truth table and the inert mount without a document, headless.
- `index.ts` — the barrel the scene module imports.
- `README.md` — this map.

## Rules

1. The view is data: no scene, no run, no engine, no RNG and no `HudState`. The scene hands it three values — `open`, `selected` and `armed` — and the panel paints them.
2. The card is mounted for the scene's lifetime and merely `hidden` while closed, like the notices strip; `descriptor.close` is what unmounts it. `notices` and every later always-present panel copy that shape.
3. Only a row press answers. The scrim is `pointer-events: none` and the mount adds no key listener: the menu's keys are the scene's (`RouteScene` → `descriptor.key`), and a DOM key path would double-fire them.
4. `kit/Row` is not composed: its selected state is the 72 % panel fill with the card's hairline, while the board's selected pause row is the accent at 16 % under a solid accent 1 px edge, so the rows are hand-rolled buttons with `box-shadow: inset`.
5. A press sends `{ type: 'row', index }` and nothing else; the scene owns the cursor, the arm and the two-press restart.
