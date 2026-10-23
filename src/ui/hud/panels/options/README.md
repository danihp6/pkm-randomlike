# `src/ui/hud/panels/options/` — the options screen (`02`)

The spike of `D49`: the board's `02 Options` panel as Preact over the `#hud` layer, painting a
`OptionsView` the scene builds from its settings and answering with `HudCommand`s.

## Layout

- `view.ts` — the panel's value model: `liveOptionsView` from the settings model and `fixtureOptionsView(payload, narrow)` from `design/fixtures/02-options.json`'s `panel`/`mobile` blocks, the breakpoint constant and the slug the frame answers to.
- `view.test.ts` — the live row split, the printed values, the slider and toggle rows, the capture hint, and both fixture variants with their structural guards, headless.
- `optionsPanel.tsx` — the panel itself: the title, one or two cards, the rows (step, slider, toggle, keybind), the actions and the commands they emit.
- `options.css` — the frame's measured geometry and paint, one scoped custom property per board value, plus the phone column.
- `mount.tsx` — `mountOptionsPanel`: renders the panel into a host element and returns its disposer.
- `preview.ts` — `previewRequested` and `installOptionsPreview`: the fixture panel behind `?hud=dom&hudFixture=02-options`, one content block per viewport.
- `preview.test.ts` — `previewRequested`'s truth table, headless.
- `index.ts` — the barrel the scene and the preview import.
- `README.md` — this map.

## Rules

1. The view is data, never the settings object: the scene pushes values, the panel paints them.
2. Every control answers with the same `HudCommand` a key or pad press produces; the reset control draws and does nothing.
3. The panel composes `kit/` and never re-draws a primitive; `options.css` only adds classes and geometry.
