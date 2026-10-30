# `src/ui/hud/panels/battle-command/` — the battle's command window (`05`)

The battle's **FIGHT / BAG / SWITCH / RUN** window as Preact over the `#hud` layer (`D49`):
the battle menu card the moves window shares and one row per command on the canvas grid's own
cells. Under `?hud=dom` the scene's `renderCommandMenu` returns on its first statement and
hides its chrome, so this card **is** the command window; with the flag off nothing here
mounts and the canvas draws it exactly as before.

## Layout

- `view.ts` — the panel's value model: `battleCommandBox` (the moves card, `battleMovesBox`),
  `battleCommandView` (the 2×2 grid's four cells over the card's whole width, the clamped
  selection) and the input, row and view types.
- `view.test.ts` — both viewports' card and cell rects, the partner window's single
  full-height row, the non-intersections with the two HP boxes, the selection and clamping
  rules, the absence of any fifth control and the view's purity, headless.
- `battleCommandPanel.tsx` — the card: its glass and one row per command at its measured box;
  it emits `BattleCommandIntent` and never performs a command.
- `battleCommand.css` — the card's 90 % glass, the board `05` `menu tab` row skin (the
  `--hud-row-*` pair, the 16 % accent fill on the selected row, the 0.4 dim on a disabled
  one) and the 10/13 label at the body size.
- `mount.tsx` — `mountBattleCommand`: renders the card into a host element, returns the
  controller the scene pushes through, and carries the panel's own intent union.
- `index.ts` — the barrel the scene imports: the panel and its mount, `battleCommandBox`,
  `battleCommandView`, and the view's input, row and box types.
- `README.md` — this map.

## Rules

1. The view is data, never the battle: the scene builds `BattleCommandInput` from its own
   `menuItems` and `menuIndex`, and the labels arrive already localised. The panel reads no
   `HudState`, no i18n, no engine, no `Rng` and no clock.
2. **The card is the moves card.** `battleCommandBox` is `battleMovesBox`, and the grid
   arithmetic mirrors `BattleScene.renderCommandMenu` cell for cell — 2 columns, an 8 px gap,
   the window padding plus the grid inset — so the DOM card and the keyboard cursor can never
   disagree. The four cells take the card's whole two-column width, the 62 px column the moves
   menu keeps for MEGA and G-MAX being the grid's own here: **250×72** on the desk and
   **147×94** on the phone, a two-command partner list being one full-height row (152 / 196).
3. `BattleCommandIntent` is this panel's own channel: `src/ui/hud/commands.ts` has no
   battle-menu variant. Hover is `onMenuHover`'s rule (including clearing the MEGA / G-MAX
   selections) and press is the canvas row's `confirmMenu` — no new engine call, no new
   command path.
4. **A dimmed row is never `disabled`.** The canvas keeps a refused command reachable and lets
   `confirmMenu` say no, so the card does the same: `aria-disabled` and the 0.4 opacity only,
   and the scene refuses the press.
5. The card is `position: fixed` at the model's rect and only its buttons take a press
   (`pointer-events: none` on the layer), so the canvas's pads and keys keep every other
   press; the closed view is painted on mount, so `[data-hud-panel="battle-command"]` exists
   from the moment the battle mounts.
6. The row radius is `--hud-row-radius` (8 px in `styles/root.css`), not the board's measured
   6 px `menu tab`: the token is shared with the other battle cards, and changing it is a
   palette change outside this panel.
