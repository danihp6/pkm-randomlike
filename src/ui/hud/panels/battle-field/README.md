# `src/ui/hud/panels/battle-field/` — the battle's field chips (`05`)

The weather and the terrain a battle is under, as Preact over the `#hud` layer (`D49`): one
32 px chip per live condition at the battle stage's top right, each a drawn SVG glyph with its
remaining turns on the chip's own corner plate and no text row. The panel is the battle's only
readout: it takes no press, reads no `HudState` and calls no i18n from its component — the view
resolves the label. Under `?hud=dom` nothing here changes on the canvas, which draws no field
state at all.

## Layout

- `view.ts` — the panel's value model: `FIELD_CHIP`, `FIELD_CHIP_GAP`, `FIELD_CHIP_INSET` and
  `FIELD_CHIP_CLEARANCE`, `fieldChipRow` (the row's union box, anchored to `battleStage`) and
  `battleFieldView` (one chip per live weather and terrain, in draw order), plus the input,
  chip and view types.
- `view.test.ts` — the frozen rects at 1280×800, 390×844 and 900×900, the clear sky's empty
  view, the terrain-before-weather order, the clamped turns, the locale's label, the
  non-intersections with the HP boxes and the command card, and the eight surviving
  `battle.info` keys, headless.
- `battleField.tsx` — the layer and one chip per condition: the drawn glyph filling the cell
  and the numeral on its plate, the chip's whole accessible name being the view's label.
- `battleFieldPanel.test.ts` — the root's contract, the two chips' ids, kinds, names and rects,
  each glyph's `viewBox` and `path`, the numeral's plate and the clear sky's single layer.
- `battleField.css` — the four board tones as scoped custom properties (the frame's amber fill,
  stroke and ink, and the numeral's glass plate), the 32 px cell, the 6 px radius and the
  glyph filling it.
- `mount.tsx` — `mountBattleField`: renders the layer into a host element, paints the empty row
  on mount and returns the controller the scene pushes through.
- `index.ts` — the barrel the scene imports.
- `README.md` — this map.

## Rules

1. The view is data, never the battle: the scene pushes `BattleFieldInput` on every
   `refreshHud` and the panel paints it. Every rect is a page coordinate measured from
   `battleStage(viewport)`, the rect the camera viewport is set to.
2. **The weather holds the corner.** The chips run left to right with the terrain first and the
   weather last, so a weather — by far the commoner condition — never moves when a terrain
   appears; with one condition up that chip takes the corner cell.
3. A viewport narrower than `BATTLE_HP_BREAKPOINT` has the foe's card across the top of the
   square, so the row keeps the same right edge and drops 8 px under that side's lowest HP box.
4. The layer and every chip are `pointer-events: none`: a chip takes no hover, press, focus or
   tooltip and spends no turn.
5. The chips read the **live** battle state, never the beat: a weather or a terrain that starts
   mid-turn shows from that turn's first frame, and the stored turn count is what the numeral
   paints, so a weather under Air Lock still shows.
