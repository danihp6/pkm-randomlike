# Spec: Task-301 — The level line wears its space

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** i18n copy + HUD panel claim (no engine rule, no scene).
- **Role:** Dev.
- **Objective:** The two English level keys print `LV 36`, the shape every frame
  draws, instead of `Lv36`. The member detail card can then claim its own level
  line (19 strings instead of 18), and the PC cell's line matches its board
  without opening a gap. The Spanish locale keeps `Nv{level}` (`D43`: a locale
  overlays the key, it does not mirror it).
- **Environment:** worktree `../wt-pkm-301`, branch `task-301`, base `main`.
- **Dependencies:** none. Everything it edits already ships: the key table
  (`src/i18n/en.ts`), the detail card (`src/ui/hud/panels/detail/`) and the PC
  panel's spec-gap adapter (`src/ui/hud/panels/pc/specGap.test.ts`).

### Exclusive paths (single writer)

**Nothing outside this list.**

- `src/i18n/en.ts`
- `src/i18n/index.test.ts`
- `src/i18n/README.md`
- `src/ui/hud/specGap.views/detail.ts`
- `src/ui/hud/panels/detail/specGap.test.ts`
- `src/ui/hud/panels/detail/view.test.ts`
- `src/ui/hud/panels/detail/fixture.test.ts`
- `src/ui/hud/panels/detail/README.md`
- `src/ui/hud/panels/pc/specGap.test.ts`
- `src/ui/hud/panels/party/partyPanel.test.ts`

`src/i18n/es.ts` is **not** edited. `src/ui/hud/specGap.views/pc.ts`,
`battle-stats.ts` and `battle-pokemon.ts` are **not** edited: their `Lv36` lines
describe the canvas battle row, not these two keys, and they must keep
compiling untouched.

### Inputs (read-only)

- `AGENTS.md`.
- `src/i18n/en.ts` (the whole key table; only two values move),
  `src/i18n/es.ts` (read, never edit), `src/i18n/index.ts` (`t`, key typing).
- `src/ui/hud/specGap.views/detail.ts`,
  `src/ui/hud/panels/detail/specGap.test.ts`,
  `src/ui/hud/panels/detail/view.test.ts`,
  `src/ui/hud/panels/detail/fixture.test.ts`,
  `src/ui/hud/panels/pc/specGap.test.ts`,
  `src/ui/hud/panels/party/partyPanel.test.ts`,
  `src/i18n/index.test.ts`.
- `src/ui/hud/panels/detail/view.ts` (builds `view.level` from `common.level`),
  `src/ui/hud/panels/pc/pcPanel.tsx` (prints `hud.level`).
- `design/screens/03m-panels-pokemon-moves.json` — **read-only board input**,
  frame `03m Panels · Pokémon / Moves`, the `detail lv` node,
  `"characters": "LV 36"`. The frame's exact `caption` is
  `03m Panels · Pokémon / Moves`; its export is
  `design/exports/03m-panels-pokemon-moves.png`.

## 🔒 Contract

### Keys

```ts
// src/i18n/en.ts
'hud.level': 'LV {level}',       // was 'Lv{level}'
'common.level': 'LV {level}',    // was 'Lv{level}'
```

- The placeholder stays `{level}`; nothing else in the key table moves.
- `src/i18n/es.ts` stays `'hud.level': 'Nv{level}'` and
  `'common.level': 'Nv{level}'` byte-for-byte.
- The dev keys (`dev.status.launch`, `dev.partyMemberLabel`, …) that also contain
  `Lv{level}` are **not** this shape and do not change.
- **Determinism:** reads no `Rng`, no clock, no DOM.

### Detail adapter — `src/ui/hud/specGap.views/detail.ts`

`buildView` now claims the level line: `strings` is
`[view.name, view.level, ...cells, view.search.placeholder]` filtered for empty
lines, so the card reports **19** strings. The doc comment loses its "the level
line is not claimed" paragraph and instead records that the line is `LV 36` on
both the card and the board. Boxes and colours are unchanged (still empty).

### Tests that pinned the old shape

Update exactly these assertions to the new shape and the new count; do not
delete the coverage:

- `src/ui/hud/panels/detail/specGap.test.ts` — the `STRINGS` length **18 → 19**;
  `view().level` is `'LV 36'`; the "leaves it out of the claim" block becomes the
  opposite claim (the level line **is** in `buildView(SPEC).strings` and
  `gapFor(...).strings` is still `[]`).
- `src/ui/hud/panels/detail/view.test.ts` — `view.level` is `'LV 36'`.
- `src/ui/hud/panels/detail/fixture.test.ts` — `view.level` is `'LV 36'`.
- `src/ui/hud/panels/pc/specGap.test.ts` — `t('hud.level', { level: 30 })` is
  `'LV 30'`, the cell's line is still not claimed (the PC adapter claims names
  and `RIP` only), and `gapFor(...).strings` stays `[]`.
- `src/ui/hud/panels/party/partyPanel.test.ts` — the header's level line is
  `'LV 12'`.
- `src/i18n/index.test.ts` — `en['common.level']` is `'LV {level}'`; add the
  matching `en['hud.level'] === 'LV {level}'` assertion beside it.

## 🧩 Data and configuration

- No new key, no removed key, no data file, no `SAVE_VERSION` step.
- The string shape is `LV {level}` — one space, both letters capitals — and it is
  the one the board draws (`detail lv`, `characters: "LV 36"`).

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm ci --prefer-offline --no-audit --no-fund`, then `npm test` and
    `npm run build`.
  - `git diff --name-only main...task-301` against **Exclusive paths** above.
  - `grep -rn "'common.level'\|'hud.level'" src/i18n` shows `LV {level}` in `en`
    and `Nv{level}` in `es`.
- **Acceptance criteria:**
  - [ ] `[unit]` `t('common.level', { level: 36 }) === 'LV 36'` and
        `t('hud.level', { level: 36 }) === 'LV 36'`.
  - [ ] `[unit]` The detail adapter emits **19** strings, the level line among
        them, and `gapFor(buildView(SPEC), SPEC)` is empty (`gapIsEmpty` true).
  - [ ] `[unit]` The PC panel's `gapFor` is still empty and its claimed strings
        still exclude the level line.
  - [ ] `[unit]` `npm test` and `npm run build` are green; the Spanish key values
        are unchanged (`es['common.level'] === 'Nv{level}'`).
  - [ ] `[unit]` The diff is a subset of the exclusive paths.
  - [ ] `[live]` At 1280×800 the member detail card's level line reads `LV 36`
        (read `document.querySelector` on the level field's text,
        `detail__level`, after opening the party card's detail panel on a fresh
        run) and no spec-gap test reports a missing string. The measurement is
        the element's text content read over CDP on the running dev server, never
        a screenshot.
  - **Browser budget:** one `[live]`, one server, one port owned by QA; the
    `[unit]` set costs seconds.

## 📣 Coordination

- For the Architect: the copy defect registered under `TODO.md` → **Bugs** is
  closed by this task; `src/i18n/README.md`'s `Name Lv##` note moves to
  `Name LV ##`.
- For the next batch: `common.level` and `hud.level` are now the board's shape,
  so any card that reads them inherits it.

## ⛔ Out of scope

- `src/i18n/es.ts`, the dev keys, `evolutionGraph` / `evolution` own `Lv 16`
  strings (they are a different family and already ship `Lv ##`).
- No panel geometry, CSS, scene, engine or data change.
- No new `[live]` beyond the one above.
