# `design/` — the board, as an imported spec

The board is the live Figma file `pkm-randomlike`, page `Page 1`, key `nfyJ8Yerc6lL1BouvCAfd3`. It
was last modified `2026-10-21T18:23:44Z` and holds **66 frames — 33 desktop at 1280×800 and 33
mobile at 390×844**. It carries **0 styles and 0 components**, so every colour on it is a literal
fill and nothing here is a variable lookup. `D57` (`docs/tech-decisions.md`) is the decision;
`docs/hud-fidelity.md` is the measurement; `D50` is why the rasters are committed.

`import.json` is hand-authored and is the truth. Everything else in this folder is imported from
Figma by `node scripts/design/import.mjs` and never hand-edited: Figma → `import.json` + the four
artifact families → the code, one direction only.

## Files

| path                   | what it is                                                                                                                                                                         | written by                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `import.json`          | the map: file key, page, and one row per desktop frame — `slug`, `caption`, `panel`, `scene`, `mobile`, `states`, `snapshot`                                                       | by hand, in this repo       |
| `tokens.json`          | panel/row fills and radii, the type scale with its boxes, panel width and gutter with their variants, panel bounds, grid, `safeArea`, the complete palette, `source`, `warnings`   | `import.mjs`                |
| `board.json`           | page and slug → `name`, `panel`, `scene`, the desktop and mobile node ids and the exports index — node ids only, no task, no files, no timestamp                                   | `import.mjs`                |
| `screens/<slug>.json`  | the screen spec: node id, viewport, mobile twin, states, every box and every string in document order, the colours, the snapshot hash                                              | `import.mjs`                |
| `exports/<slug>.png`   | the board's own `@2x` raster, 66 of them (desktop and mobile)                                                                                                                      | `import.mjs`                |
| `fixtures/<slug>.json` | the panel's copy for `?hudFixture=<slug>`: `slug`, `screen`, the six-key `state` and the panel's own block. **Not the spec** and not a source: it is what the running panel is fed | a migration task, by hand   |
| `frames/<slug>.json`   | the old exporter's geometry-and-text dump, kept because the panels' fixtures were cut from it                                                                                      | `scripts/design/export.mjs` |
| `screens/<slug>.svg`   | the old exporter's 1:1 vector, diffable, no `<text>`                                                                                                                               | `scripts/design/export.mjs` |
| `screens/<slug>.png`   | the old exporter's raster; `Task-223` moves these to `exports/`                                                                                                                    | `scripts/design/export.mjs` |

`<slug>` is the frame name in lower-kebab; the mobile twin is `m` + the desktop slug (`03 Route HUD`
→ `03-route-hud` / `m03-route-hud`). 33 frames, 66 viewports.

## `import.json`

```json
{
  "fileKey": "nfyJ8Yerc6lL1BouvCAfd3",
  "page": "Page 1",
  "screens": [
    {
      "slug": "02-options",
      "caption": "02 Options",
      "panel": "options",
      "scene": "src/scenes/SettingsScene.ts",
      "mobile": "m02-options",
      "states": [],
      "snapshot": true
    }
  ]
}
```

- 33 rows, ordered by `slug` ascending. `caption` is the frame name exactly as drawn — middle dot
  included — because that is how the import finds the frame; `mobile` is always `m` + `slug` and is
  resolved as `M <caption>` on the board.
- `panel` and `scene` are the code's side of the frame; `check.mjs` validates them against the tree.
- `states` is empty for every frame today: the board's variants are separate mapped screens, not
  state variants. The key exists so a future variant has a home and `variant_missing` can report it.
- `snapshot: true` means the frame owns an exported PNG and a screen spec that names its sha256.

## The command

```sh
FIGMA_TOKEN=… FIGMA_FILE_KEY=nfyJ8Yerc6lL1BouvCAfd3 node scripts/design/import.mjs
FIGMA_TOKEN=… FIGMA_FILE_KEY=nfyJ8Yerc6lL1BouvCAfd3 node scripts/design/import.mjs --check
```

It reads the map, fetches the index (`?depth=3`), the mapped subtrees (`?ids=…&depth=30`) and the
PNGs (`/v1/images/…?format=png&scale=2`) from `api.figma.com`, and writes four artifact families in
this order: `tokens.json`, `board.json`, `screens/<slug>.json` (33), `exports/<slug>.png` (66).
There is no timestamp in any of them, so the same Figma revision always produces the same bytes.

`--check` performs the same fetches and the same computation and **writes nothing**: it compares each
artifact with what is on disk and reports every path that is different or missing. Exit codes: `0`
clean, `1` drift (or a frame the map maps but the board no longer draws), `2` a missing variable, an
unreadable map or a failed request. The command is invoked by path, not through a `package.json`
alias.

## The four checks

`node scripts/design/check.mjs` runs headless — no network, no token, no browser, no clock — and
prints exactly four lines, one per check, in this order.

| check                     | fatal?                     | what it asks                                                                                                                                                |
| ------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `colour_outside_tokens`   | fatal                      | every colour a screen spec records is in `tokens.json`. The palette is complete, so this holds by construction after an import                              |
| `frame_without_component` | fatal                      | every mapped `scene` exists, every `panel` matches `board.json`, and every panel has a component (`src/ui/hud/panels/<panel>/` or `src/ui/<panel>Panel.ts`) |
| `snapshot_hash_mismatch`  | fatal for pairs that exist | a screen spec and its PNG agree on the sha256 and on the file name; a pair that is not there yet is _pending_, not broken                                   |
| `variant_missing`         | report-only                | every declared state and every mobile twin resolves to a frame in `board.json`                                                                              |

`snapshot_hash_mismatch` is fatal only for pairs that exist because the 33 specs and 66 PNGs land
after the operator's run: before it the line reads `0 mismatched, 33 pending the import`, after it a
moved byte is a failure. `variant_missing` never changes the exit code — a variant the board has not
drawn yet is a report, not a broken screen.

## The operator's run

`node scripts/design/import.mjs` is run by the operator with a personal access token **after the
merge**, and the four artifact families are committed then. **The loop never performs it**: no CI
job, no dev task and no QA task holds `FIGMA_TOKEN` or calls Figma, and no one hand-edits
`screens/<slug>.json`, `exports/**`, `board.json` or `tokens.json`.

## The repair rule

**A frame that stops matching the code is fixed in Figma or deleted.** A spec is not patched by
hand and a check is not silenced: the next operator run rewrites the specs from the board, so a
frame that lies about the code has exactly two honest outcomes — corrected on the board, or removed
from it and from `import.json`.

## The frame → scene map

The panel column is the map's assignment; the frame's own content is the truth, so a migration that
proves a frame belongs to another panel corrects `import.json` — the map is hand-authored, the
index in `board.json` is imported from it.

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

## Two things the board does not carry

- **Text is not in the SVG.** Figma outlines every string, so the strings, the family, the size and
  the box come from the JSON: that is why a screen spec exists at all. A panel that renders text
  from the vector alone ships frozen labels.
- **A panel's `stroke-width="2"` is a centred stroke clipped by its own mask**, so the CSS border is
  **1 px inside**. `docs/hud-dom-proposal.md` §11 measured it on `M 02 Options`.
