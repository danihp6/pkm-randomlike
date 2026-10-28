# `src/ui/hud/panels/battle-hp/` — the battle HP boxes (`05`)

The battle's four name-and-HP boxes as Preact over the `#hud` layer, at the board's own
two columns: `05 Battle HUD`'s 368×100 cards at (64,48) over the foe and (64,660) under the
player, and `m 05 Battle HUD`'s 358×80 cards at (16,16)/(16,504) below a 600 px viewport.

## Layout

- `view.ts` — the panel's value model: the two columns' rects, the partner rule a 2 vs 2 needs (a partner stacks inside its own column, under the foe's lead and above the player's), the layout and the view built from a battle snapshot, the foe's ball row (one ball per fielded member, its gutter and its spacing), plus the breakpoint and the fill duration.
- `view.test.ts` — both columns' measured rects, the four-box draw order, the single battle's two boxes, the highlight, the snapshot fields, the ball row's geometry against both command cards and its wild/no-battle cases, and purity, headless.
- `battleHp.tsx` — the layer, one card per active (the highlight, the name-and-level line, the HP track and fill, the readout and the status mark) and the foe's ball row under its box, drawn from the Añil item atlas at the row's own 16 px cell.
- `battleHp.css` — the frames' measured geometry and paint, one scoped custom property per board value, the phone column, and the fill's transition (off under reduced motion).
- `mount.tsx` — `mountBattleHp`: renders the layer into a host element and returns the controller the scene pushes snapshots through.
- `index.ts` — the barrel the scene imports.
- `README.md` — this map.

## Rules

1. The view is data, never the battle: the scene pushes the snapshot, the panel paints it.
2. The box is the kit's panel; only its fill (90 %/88 % against the kit's 72 %) and its highlight (14 %, drawn from the view, against the kit's 8 %) are overridden here.
3. The layer and every card are `pointer-events: none`: the battle's keys, pad and canvas zones keep every press.
4. A changed fraction transitions the fill over `HP_FILL_MS`; the first paint and a reduced-motion preference jump straight to it.
5. The foe's box carries the trainer's remaining team as one 16 px ball per fielded member, 8 px under that box and 4 px apart; a spent ball stays in place at 35 % opacity, so the row always reads the team's size. A wild battle draws no row.
