# `src/ui/hud/panels/missions/` — the node's mission stack card (`D58`)

The node the run stands on as a card over the `#hud` layer (`D49`): its **stack of
missions**, one row each, in the engine's own order — the stretch's automatic mission,
the city's fixed one and the random row one of its NPCs offers
(`docs/region-spec.md` §7.10). The stack is never empty (the stretch row is always
there), so the card is one row on a route and three in a city. The board's
`03 Route HUD` carries the strip the old mission line hung under but **no missions
card**: this panel is an addition that takes the slot that line occupied, so it is
measured from the stack it replaces and never compared to a frame (`D57`).

The card hangs in the shared `PanelFrame`, so its chip, its drag, its clamp and its
saved slot are the kit's. It is the one card the strip has **no** badge for, so the
frame keeps its chip on screen while the card is collapsed (`chipWhenCollapsed`): the
`!` chip is the only way back to it, and `HUD_PANEL_IDS` starts it collapsed.

## Layout

- `view.ts` — the panel's value model: `missionsPanelBox`, `missionsPanelView`,
  `missionsPanelRows` (the head row first), the card's measured constants and the input
  the scene hands over (the strings are already resolved). Its one engine import is the
  `MissionStatus` union, **type-only**, so a row's state cannot drift from the engine's.
- `view.test.ts` — both card rects, the stack's order and one row per mission, the
  status/tag/progress each row carries, the head row's height, the six-row cap, the
  empty stack, the window clamp and the view's purity, headless.
- `missionsPanel.tsx` — the card itself: the title line and one row per mission, each
  with `data-hud-missions-row={scopeKey}` and `data-state={status}`, painted at the
  model's own box.
- `missions.css` — the card's glass and the row's paint over the `styles/root.css`
  tokens, including the met and failed states.
- `mount.tsx` — `mountMissionsPanel`: renders the card into a host element against the
  scene's view signal, inside the shared panel frame, and returns its disposer.
- `index.ts` — the barrel the scene module imports.
- `README.md` — this map.

## Rules

1. The view is data: no run, no scene, no RNG, no clock, no i18n and no `src/data/**`.
   The scene resolves every string; the panel places it.
2. Every rect is the model's (`missionsPanelBox`, one row's `box`); the stylesheet paints
   only, so a measured rect cannot drift from a rule.
3. The card takes no input of its own: no press, no key, no drag of its rows. The frame's
   chip collapses it and drags it, and that is the whole interaction.
4. The rows are the engine's — same order, same count, same status, same `scopeKey`. The
   card filters nothing, sorts nothing and never re-derives a status.
5. The empty state survives only for the case the stack is empty; the stretch row means
   the card never reaches it in play.
6. `missions` is a `HudPanelId` with its own saved slot and no strip badge, which is what
   `chipWhenCollapsed` exists for: a collapsed card with no badge would otherwise be
   unreachable.
