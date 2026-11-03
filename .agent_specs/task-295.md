# Spec: Task-295 — Every new screen and every old label speaks

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** data + docs + test (i18n table). No screen is created or changed.
- **Role:** Dev.
- **Objective:** the key table catches up with the region. After this task:
  (1) every `dev.*` label Task-296's node-aware debug menu will need exists, in
  English first and Spanish by key, with its `{params}` declared in both tables;
  (2) the keys whose only caller is a screen Batch 125 deletes are identified and
  the ones that are already dead are pruned from both tables;
  (3) `src/i18n/README.md` documents the new `dev.*` group and the pruning rule.
  The table's shape (`TranslationKey`, `t`, `LOCALES`, `setLocale`) does not change.
- **Environment:** worktree `../wt-pkm-295`, branch `task-295`.
- **Dependencies (already merged on `main`):** the region screens and their panels
  (Batches 120-123), the mission stack (`src/scenes/panels/missions.ts`,
  `src/data/missions.ts`, Task-291) and the Centre (`src/scenes/services.ts`,
  Task-292). The table itself (`src/i18n/en.ts`, `es.ts`, `index.ts`) is on `main`.

### Exclusive paths (single writer)

- `src/i18n/en.ts`
- `src/i18n/es.ts`
- `src/i18n/content.ts`
- `src/i18n/content.test.ts`
- `src/i18n/index.test.ts`
- `src/i18n/README.md`

**Nothing outside this list.** In particular do **not** touch
`src/i18n/index.ts` (its signatures do not change), any scene, any panel, any
`src/data/**` file, `src/dev/**`, `src/main.ts` or `TODO.md`. If the build cannot
stay green without a path outside the list, **stop** and say so in your final
report instead of touching it.

### Inputs (read-only)

- `AGENTS.md`, `docs/design-spec.md` §3 (the HUD language) and §7, `D43` in
  `docs/tech-decisions.md` (English is the source table, a locale overlays by key).
- `src/i18n/index.ts` (`t`, `setLocale`, `TranslationKey`, `translationParams`).
- `src/i18n/en.ts` (912 keys today) and `src/i18n/es.ts` (the same keys).
- `src/dev/debugMenu.ts` and `src/dev/ids.ts` — **read only, to learn the labels the
  menu already uses**; Task-296 rewrites them in the next cycle against this table.
- Every non-test `src/**/*.ts`/`*.tsx` file, to audit the call sites.
- `src/data/**` — read only, to audit `nameKey`/`lineKey`-style references.

## 🔒 Contract

The table is a promise, and Task-296 is already written against this paragraph.
The following keys must exist **in both tables** with exactly these English values:

```ts
'dev.node': 'Node',
'dev.nodeTitle': 'node key',
'dev.nodePlaceholder': 'node:1',
'dev.teleportNode': 'Teleport',
'dev.markVisited': 'Mark visited',
'dev.badge': 'Badge',
'dev.badgeTitle': 'badge (1-8)',
'dev.badgePlaceholder': '1',
'dev.grantBadge': 'Grant badge',
'dev.streak': 'Streak',
'dev.streakTitle': 'tower streak',
'dev.streakPlaceholder': '0',
'dev.setStreak': 'Set streak',
'dev.mode': 'Mode',
'dev.modeLeague': 'League',
'dev.modeTower': 'Tower',
'dev.status.unknownNode': 'unknown node',
'dev.status.teleported': 'Teleported to {node}',
'dev.status.badge': 'Badge {badge} granted',
'dev.status.streak': 'Streak {streak}',
'dev.status.visited': 'Marked {node} visited',
'dev.location.node': '{node}',
```

- Spanish values are yours to write, in the table's existing voice (uppercase only
  where the surrounding `dev.*` group is uppercase; it is not). `es.ts` overlays by
  key: every one of the 22 keys must have a Spanish value that is not the English
  one, and every `{param}` declared by the English value must appear in the Spanish
  one too.
- The existing `dev.*` keys (`dev.title`, `dev.species`, the floor/room/tile
  teleports, the two ignore toggles, …) stay untouched until Task-296 stops using
  them; the pruning rule below is the only exception.
- No export is added, renamed or removed. `TranslationKey` grows by exactly the 22
  keys above (plus whatever the audit prunes from the other direction).

### Determinism

The table reads no RNG, no clock and no browser storage.

## 🧩 The pruning rule (what "every old label" means)

A key is **dead** when **none** of these hold in the tree as it is on `main`:

1. it appears as a literal `t('<key>')` call site in a non-test file under `src/`,
   **excluding** `src/scenes/RouteScene.ts` and `src/scenes/StarterScene.ts` — those
   two screens are deleted by Batch 125, so the keys only they read **stay** (the
   deletion is not this task's);
2. it appears as a full quoted string (`'key'`) in any file under `src/data/**`, or
   in a `nameKey`/`lineKey`/`tag`/`labelKey` field of any shipped data table — the
   mission catalogue and the NPC rows resolve their names this way;
3. it belongs to a family a call site builds at runtime: `detail.stat.${…}`,
   `keybind.${…}`, `battle.stage.${…}`, `battle.log.*`, and any other family you
   find while auditing (list them in the report);
4. it appears in a **non-test** `src/**` file in any other form (a lookup table, an
   array, a `switch`).

Delete only keys that fail all four. When in doubt, **keep the key and list it in
your report under "open rows"** rather than deleting a live one. Record the exact
pruned list in `src/i18n/README.md`, so the sweep Batch 125 does not have to
rediscover it. If the list is empty, say so: the earlier region tasks may already
have removed the floor's language (they removed the screens' literals, not
necessarily their keys).

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-295` audit against the exclusive paths list.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `src/i18n/index.test.ts` pins the 22 `dev.*` keys: each exists in
    `en` and `es`, is non-empty, every `{param}` in the English value is in the
    Spanish value, and the group's key list is asserted as an exact sorted array (so
    Task-296 can be written against it and a later edit cannot silently drop one).
  - [ ] `[unit]` The parity test still passes both ways (`en` and `es` carry the same
    keys), every key still renders with no unresolved `{`/`}` in both locales, and
    the Spanish table still never declares a param English does not.
  - [ ] `[unit]` `src/i18n/README.md` gains the `dev.*` group line and the pruning
    rule with the pruned list: a test or the README audit shows every key listed as
    pruned is absent from both tables and no key listed as kept was removed.
  - [ ] `[unit]` `git diff --name-only main...task-295` names only the six exclusive
    paths.
  - [ ] `[live]` At 1280×800 in the running game with `setLocale('es')` called from
    the page, enter a `city:2` run's Centre and open its shop: the shop's title text
    node reads the Spanish value of `mart.title` (`'TIENDA'`, not `'MART'`) and its
    greeting reads the Spanish value of `mart.greeting`; the region-map panel and the
    Centre's own text contain no substring matching the key shape
    `/^[a-z][A-Za-z0-9]*\.[A-Za-z0-9.]+$/`. **Measurement:** start
    `npm run dev -- --port 5305 --strictPort`, drive headless Chromium over CDP at
    1280×800, build the save in the page with the tree's own `createRun`/`storeRun`
    (as the shipped `qa-292` live pass did), `Runtime.evaluate` the text nodes and
    report the exact strings and the key-shape matches (expected zero).
  - [ ] `[unit]` No browser pass is owed for the pruning itself; the `[live]` above is
    the only browser criterion.

## 📣 Coordination

- **For Task-296 (next cycle):** the 22 keys above are the exact contract; its menu
  may use `dev.node`, `dev.teleportNode`, `dev.markVisited`, `dev.badge`,
  `dev.badgeTitle`, `dev.grantBadge`, `dev.streak`, `dev.streakTitle`,
  `dev.setStreak`, `dev.mode`, `dev.modeLeague`, `dev.modeTower`,
  `dev.status.unknownNode`, `dev.status.teleported`, `dev.status.badge`,
  `dev.status.streak`, `dev.status.visited` and `dev.location.node`. The four
  placeholder/title keys (`dev.nodeTitle`, `dev.nodePlaceholder`,
  `dev.badgePlaceholder`, `dev.streakPlaceholder`) exist for its inputs.
- **For Batch 125:** the kept-key list in `src/i18n/README.md` is the sweep's input;
  the keys only `RouteScene.ts`/`StarterScene.ts` read die with those screens.

## ⛔ Out of scope

- No screen, panel, data table, `src/dev/**` or `src/main.ts` change.
- No new locale, no change to `index.ts`'s signatures, no change to the FRLG font or
  its width guards.
- No key is renamed (a rename is a code change in another task's path); keys are only
  added or pruned.
