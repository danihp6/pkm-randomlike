# `src/ui/hud/panels/rewards/` — the mini-boss reward (`03f` / `03g`)

The beaten mini-boss's reward as Preact over the `#hud` layer (`D49`): the title, the
"choose one" line, the drawn ✕ and one pressable row per offer — three items with their
icon, name and description, then three unidentified Pokémon that print nothing but their
`STAT · Nature` label. The card is the board's: 560 × 342 at (360,196) on the desktop
(`03f`/`03g`) and a 374 × 392 bottom sheet at x = 8 on the phone (`m03f`/`m03g`), radius
11 / 16, the 1 px highlight 12 px inside the top edge and the 8 px edge clamp
`shopPanelBox` uses. `src/scenes/panels/rewards.ts` keeps every rule: the rows, the
streams, the arm and the `commitRun`.

## Layout

- `view.ts` — the panel's value model: `rewardsPanelBox`, `rewardsPanelView`, `rewardsPress` (the two-step arm/commit reducer), `rewardsRowBand` and the mirror block of every board rect and type size (`REWARDS_PANEL_W`, `REWARDS_ROW_H`, `REWARDS_SHEET_ROW_TOP`, …).
- `view.test.ts` — both QA viewports' card rects, the row pitch and arm clamp, the label-only Pokémon row, the reducer's arm/commit split (with a spy on the commit path), the pinned constants and the `rewardsDrawnObjectCount` flag contract, headless.
- `fixture.test.ts` — `design/fixtures/03f-panels-reward-item.json` and `03g-panels-reward-pokemon.json`, each compared box by box with its own `design/frames/` frame (card, highlight, title, choose line, three rows, close), the item icons' atlas frames and the model's `STAT · Nature` labels.
- `rewardsPanel.tsx` — the card itself: the sheet's handle, the highlight, the title, the choose line, the ✕ and the row band with one button per offer.
- `rewards.css` — the board's paint and the two layouts' type sizes over the `styles/root.css` tokens, one scoped rule block per layout.
- `mount.tsx` — `mountRewardsPanel`: renders the card into a host element behind a view signal, routes the four pick keys to the same intents a press sends, and returns its disposer, plus the card's `RewardsIntent` channel.
- `index.ts` — the barrel the scene module imports.
- `README.md` — this map.

## Rules

1. The view is data: no scene, no run, no engine, no RNG and no `HudState`. The scene hands over the rows `rewardRows(items, pokemon)` already produced — a `RewardRowView` per row, the arm and the two copy strings — and the atlas URL and sprite offsets arrive through `RewardRowView.icon`, so a test passes a stub.
2. A Pokémon row is label-only: the view forces `icon: null` and `description: ''` on it, so an unidentified option can never leak a name, an icon or a description, whatever the caller passed.
3. The pick is inert until it is committed: a press sends `arm(index)` and the scene's `rewardsPress` decides — another row arms, the armed row commits. The first press therefore never reaches the trade.
4. The card is the board's three-row block and does not resize with the list: the model lays every row at the board's pitch and the panel clips and scrolls the band (`rewardsRowBand`), because a live card offers all six rows at once. No row is dropped or reordered.
5. The mount takes `up`/`down`/`confirm`/`cancel` in the document's capture phase while the card is open, so a key reaches the same two-step intents a press does and never the route's own key path behind the card.
6. A paused route (a battle over it, the Settings screen) hides the card: `src/scenes/panels/rewards.ts` follows the scene's own `pause`/`resume` beats and stamps `open: false`, and the resume gives the card back with the same rows and arm.
