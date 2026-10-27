# Spec: Task-190 — R rerolls the starter offer

## 🎯 Scope

- **Task type:** Phaser scene + data table + i18n.
- **Role:** Dev.
- **Objective:** The starter pick's frame (`04`) advertises **HOLD R FOR NEW SEED** and the
  scene has no R: after this task, holding/pressing R on the starter pick throws the current
  offer away and draws the next one from a **fresh random seed**, exactly the path a brand-new
  run takes, while `S` keeps its typed-seed prompt. `R` becomes its own keybind action named
  `reroll`, so the options screen and the footer can both name it, and the offer stays a
  **pure function of the seed** (no extra state): a reroll is a new seed and nothing else. The
  share line follows the seed it just drew.
- **Environment:** worktree `../wt-pkm-190`, branch `task-190`. Run
  `npm ci --prefer-offline --no-audit --no-fund` first (a worktree has no `node_modules`).
  Never junction or symlink `node_modules` or the asset tree; `ASSETS_ROOT` is already set in
  the environment and is outside this checkout.
- **Dependencies:** none (everything it reads is on `main`).

### Exclusive paths (single writer)

Nothing outside this list — not even a "harmless" cleanup.

- `src/data/keybinds.ts`
- `src/data/keybinds.test.ts`
- `src/engine/run/starters.ts`
- `src/engine/run/starters.test.ts` (exists; extend it)
- `src/scenes/StarterScene.ts`
- `src/scenes/StarterScene.test.ts` (new — add it, see the test plan)
- `src/ui/settingsScreen.ts`
- `src/ui/settingsScreen.test.ts`
- `src/i18n/en.ts`
- `src/i18n/es.ts`
- `src/scenes/README.md` (the new test file is one more line in the folder map)
- `docs/design-spec.md` **§2** (the seed/share bullet) and **§10.3** (the "Starter cards and
  seed prompt" and "Reset hold ring" rows only)

### Inputs (read-only)

- `.agent_specs/task-190.md` (this file) and `AGENTS.md`.
- `docs/design-spec.md` §2, §3, §10.3.
- `src/engine/rng.ts`, `src/engine/run/starters.ts`, `src/data/run.ts`.
- `src/input/input.ts` (`subscribeKeybinds`, `actionKeys`).
- `src/ui/hud/panels/starter/{view.ts,starterPanel.tsx,preview.ts}` (the DOM panel and its
  `data-hud-starter-*` markers — read only, do not edit).
- `src/ui/hud/panels/options/view.ts` (the options rows are generated from
  `KEYBIND_ACTIONS`; read only).
- `src/scenes/RouteScene.ts` (read only — see the Ruling below).

## 🔒 Contract

### The Ruling this task must implement (read it before coding)

`R` **already** belongs to the shipped `reset` action (`DEFAULT_KEYBINDS.reset = 'R'`,
`KEYBIND_LABELS.reset = 'Reset run'`), and `RouteScene` polls it as the hold-to-restart ring.
`actionForKey` resolves **one** action per key and `sanitizeKeybinds` keeps the keys distinct,
so two actions cannot both default to `R`.

Therefore, in this task:

- `reroll` is a new action with default **`'R'`**, listed in `KEYBIND_ACTIONS`
  **immediately before `reset`**;
- `reset` keeps its name, its label and its two call sites (`RouteScene`,
  `src/scenes/panels/pause.ts`) but its default key moves to **`'BACKSPACE'`**, so
  `actionForKey('R') === 'reroll'` everywhere and the map stays unambiguous. `RouteScene.ts`
  is **not** edited: it polls `actionKeys(this, 'reset', …)` and picks the new default up.
- `docs/design-spec.md` §10.3's "Reset hold ring" row records the reset key and the §2 bullet
  plus the "Starter cards and seed prompt" row record `R`.

### TypeScript

```ts
// src/data/keybinds.ts
export const KEYBIND_ACTIONS = [
  /* …unchanged order up to 'interact'… */
  'reroll',
  'reset',
  /* …unchanged from 'party' on… */
] as const;

export const DEFAULT_KEYBINDS: Keybinds = {
  /* …unchanged… */
  reroll: 'R',
  reset: 'BACKSPACE',
  /* …unchanged… */
};

export const KEYBIND_LABELS: Readonly<Record<KeybindAction, string>> = {
  /* …unchanged… */
  reroll: 'Reroll starter',
  reset: 'Reset run',
  /* …unchanged… */
};
```

```ts
// src/engine/run/starters.ts — the offer becomes a pure function of the seed
export function starterOffer(seed: string, count?: number): readonly string[];
```

`starterOffer(seed)` is exactly `rollStarterPool(rngFromSeed(`${seed}:starters`), count ??
STARTER_POOL_SIZE)` — same stream name, same count, same order — so the offers the game
already draws do not move. Pure: reads no clock, no DOM, no `Math.random()`.

```ts
// src/scenes/StarterScene.ts
private rerollOffer(): void; // seed = randomSeed(); index = 0; pool = starterOffer(seed);
                             // repaint both paths (canvas cards and DOM panel) and the share line
```

- `handleAction` gains `case 'reroll': this.rerollOffer(); return;`.
- Both places that build the pool today (`create`, `applyShare`) must use `starterOffer`.
- Under `?hud=dom` the reroll repaints through the shipped `render()` path (the panel's view is
  rebuilt from `pool`, `index`, `seed`) — no second mount, no second listener.
- The mode is untouched by a reroll (`this.mode` keeps its value; only the seed changes).
- A reroll **never** writes the save: the run is still only created on `confirm()`.

### i18n

`src/i18n/en.ts` and `src/i18n/es.ts`:

- new key `keybind.reroll`, whose English value is **exactly** `KEYBIND_LABELS.reroll`
  (`'Reroll starter'`) — `src/ui/settingsScreen.test.ts` asserts that equality;
- `starter.controls` gains a `{reroll}` slot naming the key (keep today's wording otherwise);
- `starter.controlsCompact` also names `{reroll}` (it is the phone footer and the board's
  `m04` has the same hint line);
- `src/scenes/StarterScene.ts::controlsCopy()` passes `reroll: keyLabel(keys.reroll)` to both
  strings (the key must come from the player's bindings, never a hard-coded `'R'`).

`src/ui/settingsScreen.ts`: `KEYBIND_LABEL_KEYS` gains `reroll: 'keybind.reroll'` beside
`reset` (the record is `Record<KeybindAction, TranslationKey>`, so the build breaks without
it). `src/ui/settingsScreen.test.ts` gains `'reroll'` in its expected row-id list, in
`KEYBIND_ACTIONS` order.

### Data

No new data table. `STARTER_POOL_SIZE` stays in `src/data/run.ts` and is read, not moved.

## 🧩 Data and configuration

Nothing new. The only configuration is the keybind default (`reroll: 'R'`) and the two i18n
slots described above.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-190` audited against the exclusive paths above.
  - The `[live]` criteria run in a browser against `npm run dev` (Vite), read through CDP.
    This machine's Chromium is `/usr/bin/google-chrome` (also `/usr/bin/chromium`); set
    `CHROME_PATH` if the tool you use needs it. Start your own server on a free port
    (`npm run dev -- --port <free> --strictPort`) and stop it when done. Read the **DOM panel**
    (`?hud=dom`) with `Runtime.evaluate`, not a screenshot: its markers are stable.
- **Acceptance criteria:**
  - [ ] `[unit]` `DEFAULT_KEYBINDS.reroll === 'R'`, `DEFAULT_KEYBINDS.reset === 'BACKSPACE'`,
    and `sanitizeKeybinds(undefined)` returns exactly `DEFAULT_KEYBINDS` with **no two actions
    sharing a key** (assert the key set's size equals `KEYBIND_ACTIONS.length`).
  - [ ] `[unit]` a save written before this task (an object with `reset: 'R'` and no `reroll`
    key) sanitises to `reroll: 'R'` and `reset: 'BACKSPACE'` — the new action takes R and the
    old one yields it, deterministically.
  - [ ] `[unit]` `starterOffer(seed)` is pure and pinned: two fixed seeds in the test return
    the exact arrays the task pins (regression), `starterOffer(s)` deep-equals itself, and the
    two seeds' offers differ.
  - [ ] `[unit]` `StarterScene.test.ts`: with `randomSeed` and `starterOffer` mocked,
    `rerollOffer()` (a) reads the fresh seed from `randomSeed`, (b) leaves `pool` equal to
    `starterOffer(newSeed)`, and (c) resets the cursor to index `0`. The mock is the point:
    the assertion is that the scene draws **through** the helper, not that it re-implements it.
  - [ ] `[unit]` the footer copy names the reroll key: `t('starter.controls', {reroll: 'R', …})`
    and `t('starter.controlsCompact', {reroll: 'R', …})` both contain `'R'`, in `en` and in
    `es`, and `KEYBIND_LABEL_KEYS.reroll` resolves in both locales.
  - [ ] `[unit]` `actionForKey(DEFAULT_KEYBINDS, 'R') === 'reroll'` and
    `actionForKey(DEFAULT_KEYBINDS, 'BACKSPACE') === 'reset'`.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` At 1280×800, `?hud=dom`, on the starter screen (start a new run from the main
    menu), read with CDP `Runtime.evaluate`:
    (1) `document.querySelectorAll('[data-hud-starter-card]')` has length 3 and
    `[data-hud-starter-share]`'s text carries a seed;
    (2) record the share text and the three `[data-hud-starter-card]` `data-hud-starter-card`
    values, dispatch a real `R` keydown (`Input.dispatchKeyEvent` with `key: 'r'`,
    `code: 'KeyR'`, `windowsVirtualKeyCode: 82`, keyDown then keyUp), then read both again:
    the share text differs (a new seed) and the three species are the ones
    `starterOffer(<new seed>)` returns — a reroll is a new seed and nothing else;
    (3) press `R` a second time: the share text changes again;
    (4) type the **second** seed back through `S` (the seed prompt accepts a share string or a
    seed) and assert the three cards are exactly the three seen after the first `R`
    (same seed → same offer);
    (5) `E` confirms: the run opens on the route and its lead is the species the cursor was on.
    Report the five readings (share text before/after, both card lists, the confirmed species).
  - [ ] `[live]` At 390×844 the same screen prints the footer hint
    (`[data-hud-starter-hint]`) containing the R label and the reroll still changes the share
    line — the compact footer is a different string and must not lose the key.

## 📣 Coordination

- For the Architect: `reset` moved from `R` to `BACKSPACE`; the next task that documents the
  route's keys must say so. `KEYBIND_ACTIONS` grew by one, so anything that enumerates it
  (options rows, settings rows) gains a row automatically.
- For the next batch: `starterOffer(seed)` is the only way to draw the starter offer; Task-196
  takes the i18n pair next and must not reorder `KEYBIND_ACTIONS`.

## ⛔ Out of scope

- Any pointer/touch affordance for the reroll (no new `StarterIntent`): R is the advertised
  key, and a click on a card still picks.
- Changing `RouteScene`, the pause menu, the on-screen reset ring, or the meaning of
  `reset` beyond its default key.
- Re-rolling the **mode** (`finite` / `infinite`): a reroll keeps the current mode.
- Any save migration: keybinds are sanitised on read, and an unknown/missing action already
  falls back to its default.
