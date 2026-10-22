# Spec: Task-109 — An area-entry panel: a boxed banner on entering a room

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + a pure notice builder + i18n.
- **Role:** Dev.
- **Objective:** Walking into a room now greets the player the way the originals
  do: a **boxed banner**, naming the area, floating at the top of the route HUD
  and dismissing itself. It is the fourth message the run's notice module knows
  (`src/ui/notice.ts`), but it is **not** the one-line notice strip: it is a
  `addFrlgWindow` card on the `'window'` skin wearing the **accent hairline** the
  chrome mock froze for this one card, it holds for its own constant, and it takes
  **no key** and blocks nothing. After this task the biome a run walks into is
  announced on screen without reading the HUD header, and the copy is an i18n key
  authored in English and overlaid in Spanish.
- **Environment:** worktree `../wt-pkm-109`, branch `task-109`.
- **Dependencies:** none. `src/ui/notice.ts` and its builders ship (Batch 7, 15,
  16, 36), the chrome tokens and the accent hairline ship (`src/ui/frlg.ts`,
  `[Task-58]`, Batch 20), the i18n table and its overlay ship (Batch 10), and the
  route HUD's pointer-first rule is `[Task-84]`'s (Batch 29). This task adds no
  run field, no `SAVE_VERSION` step and draws no RNG.

### The decision this spec freezes

The backlog entry left one reading open — every room, or only a map change. The
**human decided: every room.** The panel is raised on **every** room change, not
only when the map changes: from `applyRoute` (the route the scene starts on and
the dev frame-map import), from `transitionTo` (every door), and from
`advanceMap`'s own call site — the boss room's portal, which enters the next
map through `transitionTo`. Do not add a `mapIndex` comparison and do not gate it
on the floor number.

### Exclusive paths (single writer)

Nothing outside this list. Every path is explicit; no glob.

- `src/ui/notice.ts`
- `src/ui/notice.test.ts`
- `src/scenes/RouteScene.ts`
- `src/i18n/en.ts`
- `src/i18n/es.ts`
- `docs/routes-spec.md` — **§6 ("Healing stops") only**, the transient-notice
  block: one new bullet after the mission/static-leaf bullet (the paragraph ending
  "...a legendary leaf floats one more line on entry."), before the consumable
  paragraph.
- `docs/design-spec.md` — **§3 ("The party") only**, one new bullet immediately
  after the "The route **header is the floor minimap**" bullet. No other bullet in
  §3 is edited, and **§7 is not touched** (it belongs to another task in this
  batch).

**Hot files this task holds:** `src/scenes/RouteScene.ts` (one owner in the batch
— this task), and `src/i18n/en.ts` + `src/i18n/es.ts`.

### Inputs (read-only)

- `docs/agent-spec-template.md`, `AGENTS.md`, `TODO.md` (this task's entry).
- `src/ui/notice.ts` (the four shipped builders, `NOTICE_HOLD_MS`),
  `src/ui/notice.test.ts`, `src/ui/frlg.ts` (`addFrlgWindow`,
  `FrlgWindowVariant`, `FRLG_ACCENT`, `FRLG_HAIRLINE`, `FRLG_WINDOW_ALPHA`),
  `src/ui/frlgFont.ts` (`addFrlgText`, `FRLG_INK`), `src/ui/panel.ts`,
  `src/ui/floatingPanel.ts` (for the "floating, non-modal" precedent only).
- `src/scenes/RouteScene.ts` (`create`, `buildHud`, `buildNotice`,
  `buildMissionLine`, `showNotice`, `hideNotice`, `refreshHud`, `applyRoute`,
  `transitionTo`, `tryLeaveRoom`, `rebuildRoom`).
- `src/i18n/en.ts`, `src/i18n/es.ts`, `src/i18n/index.ts`, `src/i18n/index.test.ts`.
- `src/data/biomes.ts` (`getBiome`, `Biome.name`; the only biome today is
  `Deep Forest`).
- `docs/routes-spec.md` §6, `docs/design-spec.md` §3, `docs/tech-decisions.md`
  (`D43` — the dex's own names, **biomes included**, stay English in every
  locale).

## 🔒 Contract

### TypeScript — `src/ui/notice.ts`

Add beside `NOTICE_HOLD_MS`, in the same module, following its own convention
("one module, N strings"):

```ts
/**
 * The area panel's own hold: `[Task-109]`'s boxed banner, one beat longer than a
 * transient notice because it is the room's greeting, and its own constant so the
 * two windows can be tuned apart.
 */
export const AREA_PANEL_HOLD_MS = 3000;

/**
 * The area-entry panel's line (`docs/routes-spec.md` §6): entering a room names
 * the area in a boxed banner. `area` is the biome's display name, resolved by the
 * caller, so this never reads the dex or the run.
 */
export function areaEntryNotice(area: string): Notice;
```

- `areaEntryNotice(name)` returns `{ text: t('notice.areaEntry', { area: name }), holdMs: AREA_PANEL_HOLD_MS }`.
- The module stays pure: no Phaser import, no DOM, no dex read. It already
  imports `t` from `../i18n`.
- **No other builder changes.** `NOTICE_HOLD_MS` stays `2600` and every shipped
  builder keeps it.

### TypeScript — `src/scenes/RouteScene.ts`

Freeze these names; they are the scene's private surface and nothing outside the
scene reads them.

```ts
/** The area panel's card: a boxed banner under the notice strip and the mission line. */
const AREA_PANEL_W = 360;
const AREA_PANEL_H = 64;
const AREA_PANEL_TOP = MISSION_TOP + MISSION_H + 8; // 24 + 44 + 8 + 32 + 8 = 116
/** Above the HUD's cards, below the mission line (439) and the notice strip (440). */
const AREA_PANEL_DEPTH = 438;

/** Fields, beside `noticeRoot` / `noticeText` / `noticeTimer`. */
private areaPanelRoot?: Phaser.GameObjects.Container;
private areaPanelText?: Phaser.GameObjects.BitmapText;
private areaPanelTimer?: Phaser.Time.TimerEvent;

private buildAreaPanel(): void;
private showAreaPanel(): void;
private hideAreaPanel(): void;
```

- `buildAreaPanel()` — called in `create()` **immediately after
  `this.buildNotice()`** (the HUD camera already exists by then, exactly as the
  notice strip requires). It draws, centered on `this.scale.width`:
  - `const width = Math.min(AREA_PANEL_W, this.scale.width - 32);` and
    `const x = (this.scale.width - width) / 2;`
  - `addFrlgWindow(this, x, AREA_PANEL_TOP, width, AREA_PANEL_H, 'window')` — the
    variant argument is **explicit** `'window'`, never `'textbox'`.
  - the accent hairline: a `Phaser.GameObjects.Graphics` stroke,
    `lineStyle(1, FRLG_ACCENT, 1)` + `strokeRect(x + 0.5, AREA_PANEL_TOP + 0.5, width - 1, AREA_PANEL_H - 1)`.
    This is the **one card whose hairline is the accent** instead of
    `FRLG_HAIRLINE`; `FRLG_ACCENT`'s own doc comment says "never a border of its
    own" and the mock overrides it here, so leave that comment alone and note the
    exception in the panel's own comment.
  - `addFrlgText(this, this.scale.width / 2, AREA_PANEL_TOP + AREA_PANEL_H / 2, '', { align: 'center', origin: 0.5, size: 18, tint: FRLG_INK })`,
    `setMaxWidth(width - 32)`.
  - one container of `[card, hairline, text]`, `setDepth(AREA_PANEL_DEPTH)`,
    `setVisible(false)`, and `this.cameras.main.ignore(this.areaPanelRoot)` — the
    notice strip's own pattern, so only the pinned HUD camera draws it.
- `showAreaPanel()` — no arguments. It **no-ops** when `this.areaPanelRoot` or
  `this.route` is missing (that is what makes the `applyRoute` raise safe during
  `create`), otherwise it sets
  `areaEntryNotice(getBiome(this.route.biomeId).name)`'s text, shows the root,
  restarts `this.areaPanelTimer = this.time.delayedCall(notice.holdMs, () => this.hideAreaPanel())`,
  and does nothing else: **no input handler, no keyboard capture, no scroll,
  no pause**. `getBiome` is already imported by the scene.
- `hideAreaPanel()` — clears the timer and hides the root; safe when it is not up
  (the `hideNotice` shape).
- `create()` raises the first banner: after `this.refreshHud()` in the same
  method, call `this.showAreaPanel()` once (the first room's greeting; the
  `applyRoute` call happened before the panel existed and no-ops).
- **The two room-change seams:**
  - at the end of `applyRoute` (after `this.encounters = new RouteEncounters(...)`),
    call `this.showAreaPanel()` — guarded, as above, so it is a no-op during
    `create` and fires for the dev frame-map import.
  - in `transitionTo`, capture `const fromRoom = this.room;` and
    `const fromMap = this.run.mapIndex;` **at the top, before `this.run = run`**;
    then, after `this.refreshHud()` at the end, raise the banner **only when the
    room actually changed**:
    ```ts
    const entered =
      !fromRoom || fromMap !== this.run.mapIndex || fromRoom.roomId !== this.room?.roomId;
    if (entered) this.showAreaPanel();
    ```
    This is what makes the boss-fall rebuild (`transitionTo(this.run, { keepPosition: true })`,
    the same room with its portal now open) raise **no** banner, while every door
    and the portal do. Do not use `keepPosition` as the test.
- `advanceMap` is reached **through** `transitionTo` (the portal branch of
  `tryLeaveRoom`): do **not** add a second raise there — one room entry, one
  banner. The banner it shows names the new map's biome, because `this.route`
  has already been rebuilt.
- `rebuildRoom()` raises nothing: the run never left the room.

### Data (i18n)

One key, authored in `src/i18n/en.ts` and overlaid in `src/i18n/es.ts`,
inserted **directly after `'notice.missionComplete'`** in both tables:

```ts
'notice.areaEntry': '{area}',
```

Both tables carry the same value: the area's name is a **biome name**, and `D43`
keeps the dex's own names — species, items and biomes — English in every locale.
The key exists so the locale owns the banner's string (its punctuation, its case,
the possibility of a label) and so the copy is not hard-coded in the scene. It
declares exactly one param, `area`.

## 🧩 Data and configuration

- `AREA_PANEL_HOLD_MS = 3000` (ms). Distinct from `NOTICE_HOLD_MS = 2600`; a
  notice that arrives while the banner is up keeps its own hold and does not
  restart the banner's.
- `AREA_PANEL_W = 360`, `AREA_PANEL_H = 64`, `AREA_PANEL_TOP = 116`,
  `AREA_PANEL_DEPTH = 438`. Nothing is persisted and nothing is configurable.
- Text size `18` (the HUD title is `16`; the banner is the louder card).

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the new
    `src/ui/notice.test.ts` cases.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-109` audit against the exclusive paths.
  - `git diff main...task-109 -- docs/design-spec.md` must show **one inserted
    bullet** in §3 and nothing in §7; `git diff main...task-109 -- docs/routes-spec.md`
    must show **one inserted bullet** in §6 and nothing in §2.
  - The `[unit]` criteria need no browser. The `[live]` criteria need the dev
    build (`npm run dev`) at the game's default viewport (1280×720).
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` is clean.
  - [ ] `[unit]` `npm test` is green.
  - [ ] `[unit]` `npx vitest run src/ui/notice.test.ts` is green and asserts:
        `areaEntryNotice('Deep Forest')` equals
        `{ text: 'Deep Forest', holdMs: 3000 }`; `AREA_PANEL_HOLD_MS` is `3000`
        and `!== NOTICE_HOLD_MS`; `translationParams(en['notice.areaEntry'])`
        equals `['area']` and the same for `es`; with `setLocale('es')` the line
        is still `'Deep Forest'` (a biome name stays English, `D43`); and the
        line differs from every other builder's text.
  - [ ] `[unit]` `npx vitest run src/i18n/index.test.ts` is green (the two tables
        keep the same keys, the token resolves, the Spanish glyphs exist).
  - [ ] `[unit]` No new key is hard-coded in `RouteScene.ts`: the scene's area
        copy comes only from `areaEntryNotice(...)`.
  - [ ] `[unit]` `git diff --name-only main...task-109` lists only this spec's
        exclusive paths.
  - [ ] `[live]` **Every room.** Walk from the entry room through one door: a
        boxed card appears at the top centre, reads `Deep Forest`, and is gone
        after ~3 s with no key pressed. Repeat for four consecutive rooms; count
        4 banners for 4 entries. Measurement: screen recording or four screenshots
        taken within 1 s of each arrival, plus one at +4 s showing the card gone.
  - [ ] `[live]` **The floor advance.** Cross the boss room's portal: exactly one
        banner, naming the new floor's biome, within 1 s of arrival; the banner
        does **not** reappear on the boss-fall rebuild of the same room (the
        portal opening). Measurement: the banner count across the boss kill and
        the portal step is `1`, not `2`.
  - [ ] `[live]` **The card, not the strip.** With the banner up, the one-line
        notice strip and the mission line are both still visible and unmoved
        (strip top edge at y=24, height 44; mission line at y=76, height 32); the
        banner sits below them (top edge at y=116, height 64) and its **outer 1px
        ring reads `#7dd3fc`** (`FRLG_ACCENT`), where the strip's and the mission
        line's hairline read the muted `rgba(255,255,255,0.16)` tone. Measurement:
        one screenshot with the banner up, pixel read at the banner's top edge
        centre and at the strip's top edge centre.
  - [ ] `[live]` **It takes no key and blocks nothing.** While the banner is up,
        the player can still walk (a full room crossing at walking speed), the
        interact key still opens a ground item, and the pause menu still opens on
        its own key. Measurement: three actions performed inside the banner's
        3 s window, each succeeding.
  - [ ] `[live]` **A notice does not cancel it.** Enter a room that raises a
        notice at the same time (the banned-species leaf, or pick a ground item on
        arrival): the notice strip shows its line and the banner stays up for its
        own hold. Measurement: one screenshot showing both, and the banner gone at
        +3.2 s while the notice's own hold is unaffected.
  - [ ] `[live]` **Spanish.** Switch the language to Spanish: the banner still
        reads `Deep Forest` (a biome name is never localised, `D43`) and nothing
        else on the card changes. Measurement: one screenshot after the locale
        switch.

## 📣 Coordination

- **For the Architect:** the area panel is **not** a new module — it is a builder
  in `src/ui/notice.ts` plus a private card in `RouteScene`, so no folder
  `README.md` changes. The decision "every room" is frozen above, with the boss
  rebuild explicitly excluded because it is not a room entry.
- **For the rest of this batch:** this task holds `src/scenes/RouteScene.ts`
  alone. `docs/routes-spec.md` §2 (the special-NPC paragraph) and
  `docs/design-spec.md` §7 belong to the Team-Rocket task if it rides along; they
  are **not** touched here, and §6/§3 are this task's only doc sections.
- **Measured correction to the backlog entry:** the entry calls the notice strip
  an `addFrlgWindow(..., 'textbox')`. It is not — `buildNotice` calls
  `addFrlgWindow` with **no variant**, so the strip is the default `'window'`
  card and its comment says "the same card as every other panel". The area panel
  is therefore distinguished by being **boxed, taller, lower and
  accent-fringed**, not by a different skin. The spec's live criterion measures
  that, and the docs must not claim a textbox skin either.
- **For the next batch:** a later notice is still "a string in this module". If a
  second *boxed* window is ever wanted, this card is the precedent, and
  `AREA_PANEL_HOLD_MS` is the first hold that is not `NOTICE_HOLD_MS`.

## ⛔ Out of scope

- The three shipped notices and every other builder in `src/ui/notice.ts`; their
  hold stays `2600`.
- The battle scene's own beats (`src/ui/beats.ts`), the level-up popup and the
  capture screen.
- The room's contents, the HUD header's area string (`route.mapTitle` keeps
  printing it), the minimap, the mission line and the pause menu.
- A setting or a reduced-motion path: the banner has no animation and no switch.
- Any new run field, `SAVE_VERSION` step, RNG draw or engine change.
- `src/main.ts`, `package.json`, `vite.config.ts`, `src/data/**`.
