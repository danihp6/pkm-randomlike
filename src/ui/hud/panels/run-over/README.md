# `src/ui/hud/panels/run-over/` — the score screen (`06` / `07` / `07b` and their `m…` twins)

The end-of-run screen as Preact over the `#hud` layer (`D49`): the card, the win/loss title
and blurb, the party strip, the TOTALS / POKéMON tabs, the four stat rows, the share line, the
POKéMON table and the one action. The rule never lives here: `src/scenes/RunOverScene.ts` keeps
the permadeath save wipe, the input delay, the tab it owns and the return to the main menu, and
this panel paints the view it is handed.

## Layout

- `view.ts` — the panel's value model: `liveRunOverView` (the run summary's four figures, the
  member tallies of every party/box/rip row, the two tab labels and the party strip),
  `fixtureRunOverView` (the frame's own copy and its structural guards), both boards' rects, the
  slugs and the board's own chrome copy.
- `view.test.ts` — the live title/blurb, the four tallied figures, the dash rule, the tab labels,
  the party strip, the row order, the per-member columns, the defeat-free stylesheet, both boards'
  rects and the purity check, headless.
- `runOverPanel.tsx` — the panel itself: the card, its highlight and accent, the title and blurb,
  the party cells, the tabs, the stat rows with their rules, the share line, the POKéMON table and
  the one action (plus the frame's second, inert action).
- `run-over.css` — the frames' measured geometry and paint, one scoped custom property per board
  value, then the phone column under the 600 px breakpoint.
- `mount.tsx` — `mountRunOver`: renders the panel into a host element, repaints it on `update`, and
  returns the handle the scene disposes on `SHUTDOWN`.
- `preview.ts` — `runOverPreviewRequested` and `installRunOverPreview`: the frame's panel behind
  `?hud=dom&hudFixture=<slug>`, one payload per slug.
- `preview.test.ts` — `runOverPreviewRequested`'s truth table, headless.
- `fixture.test.ts` — the three fixtures against `design/frames/06`, `07`, `07b`, `m06`, `m07` and
  `m07b`: the copy, the figures, the rows, the party strip, the boards and the payload guards.
- `index.ts` — the barrel the scene and the preview import.
- `README.md` — this map.

## Rules

1. **Data honesty.** The board prints the run's own figures: `RunStats.faints` for the TOTALS
   `fainted` row and each member's `kos` / `damage` / `damageTaken` for the POKéMON table, all
   through the shared rule `recordedCount` + `figure()` in `src/ui/runSummary.ts` and
   `view.ts`. The em dash (`—`, U+2014) marks a counter the run never recorded — an older save,
   an absent or unreadable field — and never a recorded `0`, which prints `00`. The frames'
   numbers (`37`, `4,120`, `2,140`) exist only in `design/fixtures/` so the layout can be diffed;
   no code derives, seeds or invents them.
2. The panel is data: no run, no scene, no RNG, no clock and no Phaser. It makes no i18n call, so
   every label it paints travels in the view — the tab strip, the four table headers, the member
   states (`runOver.col*`, `runOver.state*`) and the fainted row (`runOver.enemiesFainted`) come
   from `src/i18n/en.ts` through `liveRunOverView`, and a fixture payload's own copy wins when it
   carries one.
3. The card wrapper and the row wrappers are the measured nodes; the kit `Panel` and `Row` they
   wrap are the skins, so the paint and the board's 1 px edges sit on the wrapper.
4. `portraits` is read from the fixture's `payload.state.party` (and from `run.party` live), never
   from `rows`: the frame, not the payload, decides whether a strip is drawn — and a lost run has
   no party left, so `06` and `m06` draw none.
5. Both phone boards use the `m07` geometry: a lost card keeps the TOTALS / POKéMON tab strip and
   the same height as a won one. `design/frames/m06-*` still draws a 560 px, tab-less defeat card
   and stays the frozen design source the live screen now deliberately diverges from; `won` still
   separates the two boards' copy and accent only.
6. `07b`'s filter row (MOST KOs / MOST DAMAGE / MOST TANKED) is not drawn: the live screen has no
   sortable columns because it has no figures, and sorting is out of scope.
