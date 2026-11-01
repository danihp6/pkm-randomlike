# `src/ui/hud/panels/missions/` — the floor's mission card (`D58`)

The run's missions as a route card over the `#hud` layer (`D49`): the floor the run stands
on with its progress, then every floor it already met, newest first (at most six rows). The
board's `03 Route HUD` carries the strip the old mission line hung under but **no missions
card**: this panel is an addition that takes the slot that line occupied, so it is measured
from the stack it replaces and never compared to a frame (`D57`).

The card hangs in the shared `PanelFrame`, so its chip, its drag, its clamp and its saved
slot are the kit's. It is the one card the strip has **no** badge for, so the frame keeps
its chip on screen while the card is collapsed (`chipWhenCollapsed`): the `!` chip is the
only way back to it, and `HUD_PANEL_IDS` starts it collapsed.

## Layout

- `view.ts` — the panel's value model: `missionsPanelBox`, `missionsPanelView`, the card's
  measured constants and the input the scene hands over (the strings are already resolved).
- `view.test.ts` — both card rects, the row per met floor, the six-row cap, the empty state,
  the null head row, the window clamp and the view's purity, headless.
- `missionsPanel.tsx` — the card itself: the title line and one row per mission, each with
  its `data-hud-missions-*` hook, painted at the model's own box.
- `missions.css` — the card's glass and the row's paint over the `styles/root.css` tokens.
- `mount.tsx` — `mountMissionsPanel`: renders the card into a host element against the
  scene's view signal, inside the shared panel frame, and returns its disposer.
- `index.ts` — the barrel the scene module imports.
- `README.md` — this map.

## Rules

1. The view is data: no run, no scene, no engine, no RNG, no i18n and no `src/data/**`. The
   scene resolves every string; the panel places it.
2. Every rect is the model's (`missionsPanelBox`, one row's `box`); the stylesheet paints
   only, so a measured rect cannot drift from a rule.
3. The card takes no input of its own: no press, no key, no drag of its rows. The frame's
   chip collapses it and drags it, and that is the whole interaction.
4. The list is newest first and capped at `MISSIONS_MAX_ROWS`; it never pages and never
   filters, because the run's history is read, not browsed.
5. `missions` is a `HudPanelId` with its own saved slot and no strip badge, which is what
   `chipWhenCollapsed` exists for: a collapsed card with no badge would otherwise be
   unreachable.
