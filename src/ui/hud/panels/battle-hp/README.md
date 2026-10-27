# `src/ui/hud/panels/battle-hp/` — the battle HP boxes (`05`)

The battle's four name-and-HP boxes as Preact over the `#hud` layer, at the board's own
two columns: `05 Battle HUD`'s 368×100 cards at (64,48) over the foe and (64,660) under the
player, and `m 05 Battle HUD`'s 358×80 cards at (16,16)/(16,504) below a 600 px viewport.

## Layout

- `view.ts` — the panel's value model: the two columns' rects, the partner rule a 2 vs 2 needs (a partner stacks inside its own column, under the foe's lead and above the player's), the layout and the view built from a battle snapshot, plus the breakpoint and the fill duration.
- `view.test.ts` — both columns' measured rects, the four-box draw order, the single battle's two boxes, the highlight, the snapshot fields and purity, headless.
- `battleHp.tsx` — the layer and one card per active: the highlight, the name-and-level line, the HP track and fill, the readout and the status mark.
- `battleHp.css` — the frames' measured geometry and paint, one scoped custom property per board value, the phone column, and the fill's transition (off under reduced motion).
- `mount.tsx` — `mountBattleHp`: renders the layer into a host element and returns the controller the scene pushes snapshots through.
- `index.ts` — the barrel the scene imports.
- `README.md` — this map.

## Rules

1. The view is data, never the battle: the scene pushes the snapshot, the panel paints it.
2. The box is the kit's panel; only its fill (90 %/88 % against the kit's 72 %) and its highlight (14 %, drawn from the view, against the kit's 8 %) are overridden here.
3. The layer and every card are `pointer-events: none`: the battle's keys, pad and canvas zones keep every press.
4. A changed fraction transitions the fill over `HP_FILL_MS`; the first paint and a reduced-motion preference jump straight to it.
