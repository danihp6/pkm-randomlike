# `design/` — the prototype board, as the repo sees it

The board lives in the live Figma file `pkm-randomlike` (page `Page 1`). This folder is its
**snapshot**: only the frames a Phase 12 screen needs, exported by `scripts/design/export.mjs`
through the figma-edit MCP bridge, one frame at a time. `D49` (`docs/tech-decisions.md`) is the
decision; `docs/hud-dom-proposal.md` §11 is the recipe; `docs/hud-fidelity.md` is the measurement.

## Files

| path                 | what it is                                                    | who reads it                         |
| -------------------- | ------------------------------------------------------------- | ------------------------------------ |
| `frames/<slug>.json` | geometry (name, box, radius, fills, strokes) **and the text** | the fixture, `tokens.mjs`, the panel |
| `fixtures/<slug>.json` | one frame's copy as the panel reads it: `slug`, `screen`, the six-key `state` and the panel's own block | `?hudFixture=<slug>` and `scripts/hud/diff.mjs` |
| `screens/<slug>.svg` | 1:1 vector, diffable, **no `<text>`** (Figma outlines it)     | review, the escape-hatch assets      |
| `screens/<slug>.png` | `@2x` rasterisation, the diff's reference, never edited       | `scripts/hud/diff.mjs`               |
| `board.json`         | slug → node ids, frame name, task, panel, scene               | the exporter, the README below       |
| `tokens.json`        | the derived palette, type scale, radii and geometry           | the kit, the CSS vars, the chrome    |

`design/diff/<slug>/` is `npm run hud:diff`'s own output (shot, pixelmatch diff, report) and is
gitignored: it is evidence of a run, not a reference.

The rasters under `screens/` carry the game's own screen inside them (the board draws each panel over
the route it belongs to), so they hold decomp art. `D50` accepts that for this one directory and says
why; the frames carry no image bytes, so a checkout without `screens/` still has every string and box.

`<slug>` is the frame name in lower-kebab; the mobile twin carries an `m` prefix
(`03 Route HUD` → `03-route-hud` / `m03-route-hud`). 33 frames, 66 viewports.

Measured size at export: ≈3.7 MB of JSON, 3.9 MB of SVG, 10.1 MB of PNG.

## The frame → scene map

The panel column is the plan's assignment (`TODO.md`, Phase 12); the frame's own content is the
truth, so a migration that proves a frame belongs to another panel corrects `scripts/design/frames.mjs`
and reruns the exporter.

| frame                            | task     | slug                                                             | panel                               |
| -------------------------------- | -------- | ---------------------------------------------------------------- | ----------------------------------- |
| 01 Main menu                     | Task-145 | `01-main-menu` / `m01-main-menu`                                 | main-menu                           |
| 01b Main menu · no save          | Task-145 | `01b-main-menu-no-save` / `m01b-main-menu-no-save`               | main-menu                           |
| 02 Options                       | Task-127 | `02-options` / `m02-options`                                     | options                             |
| 03 Route HUD                     | Task-139 | `03-route-hud` / `m03-route-hud`                                 | hud                                 |
| 03b Panels · row view            | Task-129 | `03b-panels-row-view` / `m03b-panels-row-view`                   | bag                                 |
| 03c Panels · compress            | Task-131 | `03c-panels-compress` / `m03c-panels-compress`                   | party                               |
| 03d Route · shop · buy           | Task-134 | `03d-route-shop-buy` / `m03d-route-shop-buy`                     | shop                                |
| 03e Route · shop · sell          | Task-134 | `03e-route-shop-sell` / `m03e-route-shop-sell`                   | shop                                |
| 03f Panels · reward item         | Task-136 | `03f-panels-reward-item` / `m03f-panels-reward-item`             | rewards                             |
| 03g Panels · reward pokemon      | Task-136 | `03g-panels-reward-pokemon` / `m03g-panels-reward-pokemon`       | rewards                             |
| 03h Panels · rocket slots        | —        | `03h-panels-rocket-slots` / `m03h-panels-rocket-slots`           | rocket (the casino's, `[Task-117]`) |
| 03i Panels · trade pick          | Task-135 | `03i-panels-trade-pick` / `m03i-panels-trade-pick`               | trade                               |
| 03j Panels · trade result        | Task-135 | `03j-panels-trade-result` / `m03j-panels-trade-result`           | trade                               |
| 03k Panels · notice item         | Task-137 | `03k-panels-notice-item` / `m03k-panels-notice-item`             | notices                             |
| 03l Panels · notice level up     | Task-137 | `03l-panels-notice-level-up` / `m03l-panels-notice-level-up`     | notices                             |
| 03m Panels · pokemon moves       | Task-132 | `03m-panels-pokemon-moves` / `m03m-panels-pokemon-moves`         | detail                              |
| 03n Panels · pause menu          | Task-138 | `03n-panels-pause-menu` / `m03n-panels-pause-menu`               | pause                               |
| 03o Panels · map routes          | Task-133 | `03o-panels-map-routes` / `m03o-panels-map-routes`               | map                                 |
| 03p Panels · pc rip              | Task-130 | `03p-panels-pc-rip` / `m03p-panels-pc-rip`                       | pc                                  |
| 04 Starter pick                  | Task-147 | `04-starter-pick` / `m04-starter-pick`                           | starter                             |
| 05 Battle HUD                    | Task-140 | `05-battle-hud` / `m05-battle-hud`                               | battle-hp                           |
| 05b Battle · message             | Task-144 | `05b-battle-message` / `m05b-battle-message`                     | battle-log                          |
| 05c Battle · bag                 | Task-142 | `05c-battle-bag` / `m05c-battle-bag`                             | battle-bag                          |
| 05d Battle · pokemon             | Task-143 | `05d-battle-pokemon` / `m05d-battle-pokemon`                     | battle-switch                       |
| 05e Battle · stats               | Task-143 | `05e-battle-stats` / `m05e-battle-stats`                         | battle-switch                       |
| 06 Run over · defeat             | Task-148 | `06-run-over-defeat` / `m06-run-over-defeat`                     | run-over                            |
| 07 Run over · victory            | Task-148 | `07-run-over-victory` / `m07-run-over-victory`                   | run-over                            |
| 07b Run over · victory · pokemon | Task-148 | `07b-run-over-victory-pokemon` / `m07b-run-over-victory-pokemon` | run-over                            |
| 08 Stats · totals                | Task-146 | `08-stats-totals` / `m08-stats-totals`                           | stats                               |
| 08b Stats · runs                 | Task-146 | `08b-stats-runs` / `m08b-stats-runs`                             | stats                               |
| 08c Stats · pokemon              | Task-146 | `08c-stats-pokemon` / `m08c-stats-pokemon`                       | stats                               |
| 09 Ranking                       | Task-146 | `09-ranking` / `m09-ranking`                                     | stats                               |
| 09b Ranking · pokemon            | Task-146 | `09b-ranking-pokemon` / `m09b-ranking-pokemon`                   | stats                               |

## Re-exporting

The bridge is a **single-session lock**: nothing else may hold the figma-edit channel while this runs.

```sh
npx -y --package figma-edit-mcp figma-edit-mcp-socket   # the bridge, port 3055 (IPv6 ::1)
node scripts/design/export.mjs --channel <code>          # the plugin's status-bar code
node scripts/design/export.mjs --channel <code> --only 03-route-hud --force
```

Without `--force` the exporter resumes: a frame whose three files exist is skipped, so an
interrupted run costs nothing. `--no-png`, `--no-svg` and `--no-json` narrow what it rewrites.

## Two things the board does not carry

- **Text is not in the SVG.** Figma outlines every string, so the strings, the family, the size and
  the box come from `frames/<slug>.json`; that is why the JSON exists at all.
- **A panel's `stroke-width="2"` is a centred stroke clipped by its own mask**, so the CSS border is
  **1 px inside**. `docs/hud-dom-proposal.md` §11 measured it on `M 02 Options`.
