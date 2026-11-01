# `src/ui/hud/specGap.views/` — one adapter per screen

The bridge between a panel's view model and its imported screen spec (`D57`). Each module
here answers for **one** screen slug and exports two things:

```ts
export const slug = '03k-panels-notice-item';
export function buildView(spec: ScreenSpec): PanelView;
```

`buildView` builds the panel's view exactly as the running panel does — from the panel's own
`design/fixtures/<slug>.json` block, at `1280×800` — and narrows it to the three facts
`gapFor` compares: the boxes it draws (named as the frame names them), the strings it prints
and the colours it paints.

`src/ui/hud/specGap.walk.test.ts` globs this folder, so **adding an adapter is the whole
task**: it keys itself by its `slug`, the walker discovers it, and it fails if the panel still
names a reason in `PENDING`. That is why one file per screen exists instead of one registry:
a per-screen task owns its own file, and four of them can ride the same batch without a shared
path. A panel the board draws in **two** states gets **two** adapters, one per slug — `03d`
and `03e` are both the Mart, `03f` and `03g` both the reward card — each claiming what its own
frame draws.

## Rules

1. One adapter, one slug. The module's `slug` must be a spec in `design/screens/`.
2. Read the panel's fixture, not the run: no engine, no scene, no state, no clock.
3. Name boxes exactly as the frame names them; a renamed box is a `missing` gap, not a typo.
4. No colour is invented here: the panel's colours are the ones its own view model carries.
5. A panel that gains an adapter loses its line in the walker's `PENDING` map and its row in
   `docs/hud-fidelity.md`'s table flips to `wired` — the same commit.
