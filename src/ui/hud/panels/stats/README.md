# `src/ui/hud/panels/stats/` — the stats and ranking screen (`08` / `08b` / `08c` / `09` / `09b` and their `m…` twins)

The run-history screen as Preact over the `#hud` layer (`D49`): the title and blurb, the
TOTALS / RUNS / POKEMON tabs, the twelve-figure totals grid, the run list, the
Pokédex-style Pokémon table and the local monthly record, with an empty state per view.
The rule never lives here: `src/scenes/MainMenuScene.ts` keeps the save's history, the
mode, the selected month and every navigation, and this panel paints the view it is
handed.

## Layout

- `view.ts` — the panel's value model: `liveStatsView` (the totals, the run rows, the
  species aggregation and the monthly board — the global one when the scene hands a
  `RankingBoard`, the device's own record otherwise), `fixtureStatsView` (the frame's
  own copy and its structural guards), `statsMonths`, both boards' rects and their
  `figureRule`, `figureRuleBox` / `figureRuleLocal`, the narrow breakpoint, the slugs,
  the modes and the three formats (`statsDuration`, `statsDate`, `statsMonthLabel`,
  `statsDay`).
- `view.test.ts` — the twelve totals figures and their em dashes, the run rows and their
  re-sort, the species aggregation and both sort orders, the month list, the selector's
  clamp and fallback, the empty states, the global board and its own marked line, both
  boards, the twelve rule boxes and the purity checks, headless.
- `records.ts` — the run-history arithmetic the stats totals and the main-menu footer
  share: the won runs, the deepest floor of a list and a UTC month key for an instant.
- `records.test.ts` — the wins, the best floor over a hand-built store and a filtered
  store, the unreadable floors and the UTC month keys, headless.
- `statsPanel.tsx` — the panel itself: the card with its highlight and accent, the title
  and blurb, the tab strip, the month chip, the figures grid with a rule node per figure,
  the table with a rule node per row, the empty line and the actions; `statsPanelTree` is
  the hook-free tree the panel paints, so the rules are read headless.
- `statsPanel.test.ts` — the tree's rule nodes: one per figure with the board's own local
  box at both widths, one as the last child of every row of every table mode, headless.
- `stats.css` — the frames' measured geometry and paint, one scoped custom property per
  board value, the two rule nodes on `--stats-rule`, then the phone column under the
  600 px breakpoint.
- `stats.css.test.ts` — the stylesheet's half of the rule: the token's single declaration,
  the two rule blocks, the relative figure block and the breakpoint, headless.
- `mount.tsx` — `mountStats`: renders the panel into a host element, repaints it on
  `update`, and returns the handle the scene disposes.
- `preview.ts` — `statsPreviewRequested` and `installStatsPreview`: the frame's panel
  behind `?hud=dom&hudFixture=<slug>`, one payload per slug.
- `preview.test.ts` — `statsPreviewRequested`'s truth table, headless.
- `fixture.test.ts` — the five fixtures against `design/frames/08`, `08b`, `08c`, `09`,
  `09b` and the `m…` twins: the copy, the figures, the rows, the boards, the figure rule
  and the payload guards.
- `index.ts` — the barrel the scene and the preview import.
- `README.md` — this map.

## Rules

1. **The store is the only source.** The twelve figures, the run rows and the species
   rows are read from `SaveDocument.history` (`src/engine/run/history.ts`), so a finished
   run the store never recorded is invisible. `Task-152` shipped the store with no writer
   yet and `RunState` carries no timestamp, so a real playthrough shows the empty states;
   the five frames are exercised through the fixtures only.
2. **Data honesty.** A record carries no damage taken, so the tanked column — and only
   that column — is the em dash (`\u2014`, U+2014). The fixtures' DMG TANKED figures
   belong to the frame, not to the model, and no code derives them.
3. **The ranking is global; the rest is local.** `ranking` draws the month's board the
   endpoint aggregated (`RankingBoard`, `D56`) and marks the device's own line, while
   `totals`, `runs`, `pokemon` and `ranking-pokemon` read this device's store. With no
   board — offline, no `ranking.json`, or an unreadable answer — `ranking` falls back to
   the device's own record and says so in its blurb (`stats.blurbRanking`, the offline
   copy). The other player's label is `#` + the last four characters of its rotating
   device id, because the save carries no player name.
4. The panel is data: no scene, no run, no RNG, no clock, no storage and no Phaser. Every
   label arrives in the `StatsView` (the i18n call sites live in `view.ts`), and a fixture
   payload's own copy wins when it carries one.
5. The `data-hud-stats-*` attributes are the measurement surface (`docs/hud-fidelity.md`):
   the panel root carries `data-hud-panel="stats"` and sits on the board's `panel` rect,
   the figures, the tabs, the table, the month chip, the empty line and the actions each
   carry the attribute their criterion reads. The actions are plain `<button>`s with the
   kit's `.kit-button` skin, because the hook has to sit on the clickable node itself.
6. The month chip's arrows belong to its label: the label prints `‹ OCT 2026 ›` while a
   month step is possible and the two ends of the chip are the buttons, so the selector's
   own text stays the month (or `ALL RUNS` with both steps off).
7. `08c` draws a `SEARCH POKEMON...` field the model does not have: a text input is an
   intent plus a re-render loop this screen does not ask for, so the table ships complete
   and unsorted-by-query. The frame's per-row `N RUNS · N CAUGHT` line is not modelled
   either: the run list already carries the meta and the table carries the figures.
8. The rows a mode draws are the frame's own block — `runs` has no header row, `pokemon`
   and both ranking tables do — so the table's header, row height and pitch switch on
   `data-mode`, the same signal the fixtures use.
9. `08`'s `SINCE 2026-09-14 · ALL RUNS INCLUDED` line has no field in the view, so it is
   not painted; its fixture keeps `empty: null`. The fixture's twelve figures carry the
   model's ids in the model's order and `08`'s own labels and values, which is what lets
   the frame be replayed while the ids stay the contract the live panel keys on.
10. **The figure's rule is measured data.** `StatsBoard.figureRule` is the frames' own
    `stat N rule` / `m rule …` rectangle, and `figureRuleBox` / `figureRuleLocal` are the
    only arithmetic over it; the panel positions it inside `.stats__figure` for the board
    the 600 px query picks and the stylesheet paints it from `--stats-rule`. The row rule
    has no frame node (08b / 08c draw row cards): it is the same token flush with each
    card's bottom edge. A new figure inherits the rule by being a figure.
