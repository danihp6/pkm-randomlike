# `src/ui/hud/panels/battle-hp/` — the battle HP boxes (`05`)

The battle's four name-and-HP boxes as Preact over the `#hud` layer, at the board's own
two columns: `05 Battle HUD`'s 368×100 cards at (64,48) over the foe and (64,674) under the
player **inside `battleStage(viewport)`**, and `m 05 Battle HUD`'s 358×80 cards at
(16,16)/(16,504) below a 600 px viewport.

## Layout

- `view.ts` — the panel's value model: the two columns' rects, the partner rule a 2 vs 2 needs (a partner stacks inside its own column, under the foe's lead and above the player's), the layout and the view built from a battle snapshot, the foe's ball row (one ball per fielded member, its gutter and its spacing), the player lead's stat-stage grid (34 px chips six px apart, three to a row, right-aligned to the player's column and 8 px above it), plus the breakpoint and the fill duration.
- `view.test.ts` — both columns' measured rects, the four-box draw order, the single battle's two boxes, the highlight, the snapshot fields, the ball row's geometry against both command cards and its wild/no-battle cases, the stage grid's boxes at both viewports with the chip cells, the tones and the signs, the layer the panel builds from the view, and purity, headless.
- `battleHp.tsx` — the layer, one card per active (the highlight, the name-and-level line, the HP track and fill, the readout and the status mark), the foe's ball row under its box, drawn from the Añil item atlas at the row's own 16 px cell, and the player lead's stage chips grid, painted only when a stage is non-zero.
- `battleHp.css` — the frames' measured geometry and paint, one scoped custom property per board value, the phone column, the stage chips' green and red, and the fill's transition (off under reduced motion).
- `mount.tsx` — `mountBattleHp`: renders the layer into a host element and returns the controller the scene pushes snapshots through.
- `index.ts` — the barrel the scene imports.
- `README.md` — this map.

## Rules

1. The view is data, never the battle: the scene pushes the snapshot, the panel paints it. Every rect it paints is a page coordinate: the board's column offset from the stage square `battleStage(viewport)` (`battle-moves/view.ts`), whose bottom edge the player's lead card and the command card both end on, `DESKTOP_BOTTOM_MARGIN` (26 px) above it.
2. The box is the kit's panel; only its fill (90 %/88 % against the kit's 72 %) and its highlight (14 %, drawn from the view, against the kit's 8 %) are overridden here.
3. The layer and every card are `pointer-events: none`: the battle's keys, pad and canvas zones keep every press.
4. A changed fraction transitions the fill over `HP_FILL_MS`; the first paint and a reduced-motion preference jump straight to it. The box reads the beat, never the finished turn: its HP, status and stage chips are the snapshot the scene pushed, so each change lands on the frame whose line the engine wrote.
5. The foe's box carries the trainer's remaining team as one 16 px ball per fielded member, 8 px under that box and 4 px apart; a spent ball stays in place at 35 % opacity, so the row always reads the team's size. A wild battle draws no row.
6. The player lead's non-zero stages are a grid of 34 px chips above its column: green for a raise, red for a drop, the sign (`+2`, `-1`) painted over the stat's abbreviation so colour is never the only carrier. Every stage at zero paints no grid, and the grid's box is the view's, never the component's arithmetic.
