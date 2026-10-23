# Spec: Task-127 — Options (`02`) is the spike, and the spike is the gate

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + DOM panel (Phase 12, `D49`).
- **Role:** Dev.
- **Objective:** the options screen exists as a DOM/Preact panel that reproduces the
  board's frame `02 Options` at 1280×800 and `m02-options` at 390×844, while the
  Phaser `SettingsScene` keeps its panel untouched behind the flag. Behind
  `?hud=dom` the scene draws **no** Phaser object for the panel and mounts the DOM
  one instead; the DOM panel is driven by the same settings model and the same
  action handler as today, so pressing one key steps one row. The title screen's
  content for the diff comes from a new `design/fixtures/02-options.json`, so the
  gate compares the board against the board. The gate is `npm run hud:diff --slug
  02-options` exiting 0 at both viewports; if it cannot, Phase 12 does not start and
  the Phaser screen stays the shipped one (that is the escape hatch this task
  proves).
- **Environment:** worktree `../wt-pkm-127`, branch `task-127`.
- **Dependencies (all merged):**
  - Task-122 — `design/frames/*.json`, `design/screens/*.png`, `design/tokens.json`
    and `scripts/hud/diff.mjs` (the gate you must make pass).
  - Task-124 — `src/ui/hud/mount.ts` (`mountHud`, `#hud`), `src/ui/hud/shell.tsx`,
    `src/ui/hud/styles/root.css` (the `--hud-*` tokens) and both HUD folder maps.
  - Task-125 — `src/ui/hud/kit/**`: `Panel`, `Row`, `Chip`, `Bar`, `PrimaryButton`,
    `Meta`, their class helpers and `kit.css`.
  - Task-126 — `src/ui/hud/fixtures/**`: `parseHudFlags`, `installFixture`,
    `FIXTURE_MODULES` and the `{ slug, state }` payload guard.

### Exclusive paths (single writer)

Only these paths may appear in `git diff --name-only main...task-127`:

- `src/scenes/SettingsScene.ts`
- `src/ui/hud/panels/options/**` (new folder: `view.ts`, `view.test.ts`,
  `optionsPanel.tsx`, `options.css`, `preview.ts`, `index.ts`, `README.md`)
- `src/ui/hud/panels/README.md` — **one line only**: the `options/` entry (line 9)
  and the "nothing in this folder exists yet" sentence (line 5).
- `src/i18n/en.ts` — five new keys, listed under **Data**.
- `src/i18n/es.ts` — the same five keys in Spanish.
- `design/fixtures/02-options.json` (new file).

Nothing else. Specifically **not**: `src/main.ts`, `package.json`,
`vite.config.ts`, `src/ui/hud/styles/root.css`, `src/ui/hud/kit/**`,
`src/ui/hud/fixtures/**`, `src/ui/hud/commands.ts`, `src/ui/settingsScreen.ts`,
`src/settings.ts`, any `src/engine/**`, any `src/data/**`, `scripts/**`.
Deleting a stray `.gitkeep` from a directory this task populates is always allowed.

### Inputs (read-only)

- `AGENTS.md`, `docs/agent-spec-template.md`.
- `docs/tech-decisions.md` § `D49` (the layer, the fixture, the two gates, the
  escape hatch), `D50`.
- `docs/hud-dom-proposal.md` (§6 input, §7 the spike's acceptance list, §11 the
  export recipe and the two measured rules), `docs/hud-fidelity.md` (§2 typography:
  line height pinned in px per size).
- `design/frames/02-options.json` and `design/frames/m02-options.json` — geometry
  **and** the strings; `design/screens/02-options.{png,svg}` and
  `design/screens/m02-options.{png,svg}` — the diff's references.
- `design/tokens.json`, `design/README.md` (the frame → scene map).
- `src/ui/hud/{state.ts,commands.ts,mount.ts,shell.tsx,README.md}`,
  `src/ui/hud/kit/**`, `src/ui/hud/fixtures/**`.
- `src/ui/settingsScreen.ts`, `src/settings.ts`, `src/engine/save.ts`,
  `src/data/keybinds.ts`, `src/input/input.ts`, `src/input/device.ts`,
  `src/i18n/en.ts`, `src/i18n/index.ts`.
- `src/scenes/MainMenuScene.ts` (how Settings is opened, for the measurements),
  `src/scenes/RouteScene.ts` (only to confirm it is not touched).
- `scripts/hud/diff.mjs` (read it; never edit it).

## 🔒 Contract

### TypeScript — `src/ui/hud/panels/options/view.ts`

The panel renders a value, never the settings object. Two producers build that value:
the live screen and the fixture.

```ts
/** One row the panel draws. `fraction`/`on` are null for the kinds that do not use them. */
export type OptionsRowView = Readonly<{
  id: string;
  kind: 'step' | 'slider' | 'toggle' | 'keybind';
  label: string;
  /** The printed value exactly as the board writes it: 'NORMAL', '70%', 'OFF', 'ENGLISH', 'A'. */
  value: string;
  /** A slider's fill, 0…1; null for every other kind. */
  fraction: number | null;
  /** A toggle's state; null for every other kind. */
  on: boolean | null;
}>;

export type OptionsGroupView = Readonly<{
  id: 'gameplay' | 'keybinds';
  title: string;
  rows: readonly OptionsRowView[];
}>;

export type OptionsView = Readonly<{
  title: string;
  /** Empty means "not drawn" (the mobile frame carries no subtitle). */
  subtitle: string;
  /** Empty means "not drawn" (the mobile frame carries no footer). */
  footer: string;
  back: string;
  /** The reset control's label; null renders no reset control at all. */
  reset: string | null;
  /** The id of the row drawn selected, or null when none is. */
  selected: string | null;
  /** One or two groups in this order (gameplay, then keybinds); an empty `title` draws no header. */
  groups: readonly OptionsGroupView[];
}>;

/** The breakpoint the board's two frames switch at; `options.css` uses the same 600px. */
export const OPTIONS_NARROW_QUERY: '(max-width: 600px)';

/** The shipped screen: `settingsRows(touch)` and `settingValue`, localised as they are drawn. */
export function liveOptionsView(
  settings: Settings,
  touch: boolean,
  index: number,
  capturing: boolean,
): OptionsView;

/** The slug this task's fixture and preview answer to. */
export const OPTIONS_SLUG: '02-options';

/**
 * The frame's own content, or null when the payload is not one this panel can draw.
 * `narrow` selects the mobile frame's variant (`payload.mobile`) instead of the
 * desktop one (`payload.panel`).
 */
export function fixtureOptionsView(payload: unknown, narrow?: boolean): OptionsView | null;
```

Rules for `liveOptionsView`:

- The gameplay rows are the entries of `settingsRows(touch)` whose `isStepRow(row)`
  is true, in that order; the keybind rows are the rest, in that order.
- `label = settingsRowLabel(row)`; `value = settingValue(settings, row.id)`.
  - `volume` → `kind: 'slider'`, `fraction = settings.volume`, and the printed value
    stays `settingValue`'s percentage.
  - `alwaysRun`, `hudTransparent`, `reducedFlash` → `kind: 'toggle'`, `on = the
    setting`, the printed value stays `settingValue`'s On/Off label.
  - a keybind row → `kind: 'keybind'`, `fraction`/`on` null.
  - every other step row → `kind: 'step'`, `fraction`/`on` null.
- While `capturing` is true the selected keybind row prints `t('settings.pressKey')`
  instead of its key (the shipped screen's behaviour).
- `selected` is the id of `settingsRows(touch)[index]`, or null when out of range.
- `reset` is `null` in this task: no reset behaviour exists (`src/settings.ts` has
  none and is not this task's path). The board's RESET DEFAULTS control ships only
  in the fixture view, where it is a picture, never a dead live button.
- Reads no RNG, no engine state, no locale global beyond `t`/`keyLabel`.

Rules for `fixtureOptionsView`:

- It reads `payload.panel` (desktop frame `02-options`) or, with `narrow === true`,
  `payload.mobile` (mobile frame `m02-options`). The two frames are **different
  content**, not two layouts of one snapshot: the mobile frame orders VOLUME first
  and prints `FAST`. A missing or malformed requested variant → `null`.
- Structural validation, in the `isHudState` style already in
  `src/ui/hud/fixtures/index.ts`: an object with non-empty string `title`, `back`,
  `subtitle` and `footer` that are strings (**empty allowed**, meaning "not
  drawn"); a `reset` that is a string or null; a `selected` that is a string or
  null; a `groups` array of one or two entries, `gameplay` first, each with a
  string `title` (empty allowed) and a `rows` array. Every row needs a non-empty
  string `id`, a string `label`, a string `value`, a `kind` in the four literals, a
  `fraction` that is a number in `[0, 1]` **iff** kind is `slider` (otherwise null)
  and an `on` that is a boolean **iff** kind is `toggle` (otherwise null). Anything
  else → `null` (no throw, no console noise).
- It does **not** validate `state`: that is the store's job (`installFixture`).

### TypeScript — `src/ui/hud/panels/options/preview.ts`

```ts
/** True only when the URL asks for `?hud=dom&hudFixture=02-options`. */
export function previewRequested(search: string): boolean;

/**
 * Mounts the fixture's panel once into the HUD layer and returns its disposer, or
 * null when the URL does not ask for it. Inert — no node, no listener — otherwise.
 */
export function installOptionsPreview(search: string): (() => void) | null;
```

- Reads the flags through `parseHudFlags` from `src/ui/hud/fixtures/flags.ts` and
  resolves the payload through `installFixture(flags, FIXTURE_MODULES)` from
  `src/ui/hud/fixtures/index.ts`, so a file the store rejects mounts nothing (the
  gate then fails loudly instead of comparing invented content). The view itself
  comes from the same file's `panel` key through `fixtureOptionsView(payload,
  narrow)`, where `narrow` is `window.matchMedia(OPTIONS_NARROW_QUERY).matches`, so
  each viewport compares the board frame authored for it. Re-read the variant when
  the media query flips (one `change` listener), so a resize never leaves the
  desktop content on the mobile layout.
- The panel must live inside the `#hud` layer `mountHud` creates, so z-order and
  the `pointer-events` contract stay the shell's: `#hud` (and `.hud`) is
  `pointer-events: none`, the panel sets `auto`. `mountHud` runs after the module
  graph is evaluated, so attach once it exists (a microtask / `DOMContentLoaded`
  is enough) and never mount a second copy.
- Mounts at most once per page load; the disposer removes exactly what it added.
- It is invoked once from `src/scenes/SettingsScene.ts` at module scope, because
  `src/main.ts` already imports that scene and is not this task's path. With the
  flag off the call must be invisible (no node, no listener, no log).

### TypeScript — `src/ui/hud/panels/options/optionsPanel.tsx`

```tsx
export type OptionsPanelProps = Readonly<{
  view: OptionsView;
  /** Every control answers with the same command a key or pad press produces. */
  onCommand?: (command: HudCommand) => void;
}>;

export function OptionsPanel(props: OptionsPanelProps): JSX.Element;
```

- Stateless: no `useState` on the content, no `loadSettings`, no Phaser import. The
  scene owns the settings and pushes a new view; the panel only paints and calls
  back.
- The rendered tree carries these attributes (the measurements below read them):
  - the root: `data-hud-panel="options"`;
  - each group card: `data-hud-group="gameplay"` / `data-hud-group="keybinds"`;
  - each row: `data-hud-row="<row id>"`, with `data-selected="true"` on the
    selected one;
  - a step row's two steppers: `data-hud-step="prev"` and `data-hud-step="next"`;
  - a slider: `role="progressbar"` with `aria-valuenow` (reuse the kit `Bar`);
  - a toggle: `role="switch"` with `aria-checked`;
  - the back control: `data-hud-action="back"`; the fixture-only reset control:
    `data-hud-action="reset"`.
- Commands, all plain `HudCommand` (never a mutation): a click on row *n* emits the
  `{ type: 'press', action: 'up' | 'down' }` presses that walk the selection to it;
  a stepper emits `{ type: 'press', action: 'left' | 'right' }`; a slider click or
  drag emits one press per 10-point step it crosses; BACK emits
  `{ type: 'press', action: 'cancel' }`. The reset control emits nothing.
- Composes the kit (`Panel`, `Row`, `Bar`, `Meta`, `PrimaryButton`) rather than
  re-drawing it: a panel may add its own class through `Panel`'s `class` prop but
  never forks `kit.css`.

### TypeScript — `src/ui/hud/panels/options/mount.tsx` (or inside `preview.ts`)

Whatever mounts the panel into a DOM node and returns its disposer. Exported from
`index.ts` so the scene and the preview share one mount path. Signature:

```ts
export function mountOptionsPanel(
  host: Element,
  view: Signal<OptionsView> | (() => OptionsView),
  onCommand?: (command: HudCommand) => void,
): () => void;
```

(Use `@preact/signals` — already a dependency — or a plain subscribe; the choice
belongs to the implementation as long as one call to the setter re-renders once.)

### The live screen — `src/scenes/SettingsScene.ts`

- Read the flag once (`parseHudFlags(window.location.search).dom`).
- **Flag on:** `create()` draws no Phaser object at all — no background rectangle,
  no `addFrlgWindow`, no text, no slider, no pointer listeners — and mounts
  `OptionsPanel` into `#hud` with `liveOptionsView(settings, prefersTouchControls(),
  index, capturing)`. Every existing keyboard path stays: `subscribeKeybinds` →
  `handleAction`, the rebind capture and its `captureSkip`, `saveSettings`,
  `applyVolume`. `render()` becomes the one emit point: it recomputes the view and
  pushes it to the mounted panel. The panel's `onCommand` reduces through
  `reduceHudCommand` and calls the same `handleAction`. `close()` disposes the panel
  before resuming the opener.
- **Flag off:** the shipped path verbatim — same objects, same pointer listeners,
  same `render()`. Nothing about this task may change what a player sees without
  the flag.
- The scene never reads a DOM node to decide a rule; the DOM never reads settings.

### Determinism and layering

- No RNG stream is read, no save field is added, `SAVE_VERSION` does not move, no
  `src/engine/**` file is touched.
- `src/ui/hud/**` imports no Phaser; `src/scenes/**` may import the panel.
- The canvas is untouched: the panel owns only the DOM layer.

## 🧩 Data and configuration

### `design/fixtures/02-options.json` (new)

The fixture the store validates **and** the frame's own content the preview paints.
It is exactly this shape (the board's copy is English because the board is):

```json
{
  "slug": "02-options",
  "state": { "party": [], "bag": [], "money": null, "route": null, "battle": null, "notice": null },
  "panel": {
    "title": "SETTINGS",
    "subtitle": "Changes apply immediately and save to this browser.",
    "footer": "Keybinds are shared with the route and battle screens.",
    "back": "BACK",
    "reset": "RESET DEFAULTS",
    "selected": "textSpeed",
    "groups": [
      {
        "id": "gameplay",
        "title": "GAMEPLAY",
        "rows": [
          { "id": "textSpeed",   "kind": "step",   "label": "TEXT SPEED",   "value": "NORMAL",  "fraction": null, "on": null },
          { "id": "volume",      "kind": "slider", "label": "VOLUME",       "value": "70%",     "fraction": 0.7,  "on": null },
          { "id": "alwaysRun",   "kind": "toggle", "label": "ALWAYS RUN",   "value": "OFF",     "fraction": null, "on": false },
          { "id": "menuOpacity", "kind": "slider", "label": "MENU OPACITY", "value": "80%",     "fraction": 0.8,  "on": null },
          { "id": "language",    "kind": "step",   "label": "LANGUAGE",     "value": "ENGLISH", "fraction": null, "on": null }
        ]
      },
      {
        "id": "keybinds",
        "title": "KEYBINDS",
        "rows": [
          { "id": "confirm", "kind": "keybind", "label": "CONFIRM", "value": "A",    "fraction": null, "on": null },
          { "id": "cancel",  "kind": "keybind", "label": "CANCEL",  "value": "B",    "fraction": null, "on": null },
          { "id": "run",     "kind": "keybind", "label": "RUN",     "value": "SHIFT","fraction": null, "on": null },
          { "id": "party",   "kind": "keybind", "label": "PARTY",   "value": "P",    "fraction": null, "on": null },
          { "id": "bag",     "kind": "keybind", "label": "BAG",     "value": "I",    "fraction": null, "on": null },
          { "id": "map",     "kind": "keybind", "label": "MAP",     "value": "M",    "fraction": null, "on": null },
          { "id": "options", "kind": "keybind", "label": "OPTIONS", "value": "ESC",  "fraction": null, "on": null }
        ]
      }
    ]
  },
  "mobile": {
    "title": "SETTINGS",
    "subtitle": "",
    "footer": "",
    "back": "BACK",
    "reset": null,
    "selected": "volume",
    "groups": [
      {
        "id": "gameplay",
        "title": "",
        "rows": [
          { "id": "volume",      "kind": "slider", "label": "VOLUME",       "value": "70%",     "fraction": 0.7,  "on": null },
          { "id": "textSpeed",   "kind": "step",   "label": "TEXT SPEED",   "value": "FAST",    "fraction": null, "on": null },
          { "id": "alwaysRun",   "kind": "toggle", "label": "ALWAYS RUN",   "value": "OFF",     "fraction": null, "on": false },
          { "id": "menuOpacity", "kind": "slider", "label": "MENU OPACITY", "value": "80%",     "fraction": 0.8,  "on": null },
          { "id": "language",    "kind": "step",   "label": "LANGUAGE",     "value": "ENGLISH", "fraction": null, "on": null }
        ]
      }
    ]
  }
}
```

`state` is an empty but **valid** `HudState` (the six keys, `money` null), so
Task-126's guard accepts the file. `panel` is frame `02-options` and `mobile` is
frame `m02-options`; they are **different content** — the mobile frame lists VOLUME
first, selects it, prints `FAST`, and carries no subtitle, footer, keybinds or reset
— so the preview picks the variant that matches the viewport it is drawn at and
each viewport compares like with like. Only the options panel reads these keys.

### i18n keys (`src/i18n/en.ts` + `src/i18n/es.ts`)

Five keys, both locales (the parity test enforces it):

| key                        | en                                              | es                                                  |
| -------------------------- | ----------------------------------------------- | --------------------------------------------------- |
| `settings.subtitle`        | `Changes apply immediately and save to this browser.` | `Los cambios se aplican al momento y se guardan en este navegador.` |
| `settings.footer`          | `Keybinds are shared with the route and battle screens.` | `Los atajos se comparten con las pantallas de ruta y combate.` |
| `settings.back`            | `BACK`                                          | `VOLVER`                                            |
| `settings.group.gameplay`  | `GAMEPLAY`                                      | `JUEGO`                                             |
| `settings.group.keybinds`  | `KEYBINDS`                                      | `ATAJOS`                                            |

All-caps in the board comes from CSS (`text-transform: uppercase`); the existing
row labels stay in sentence case so no shipped string changes.

### Geometry the panel must reproduce

Read from `design/frames/*.json` (never hand-invented); the gate compares pixels.
For orientation only:

| viewport | element          | box (x, y, w, h)  | radius |
| -------- | ---------------- | ----------------- | ------ |
| 1280×800 | gameplay card    | 96, 200, 640, 470 | 11     |
| 1280×800 | keybinds card    | 760, 200, 424, 470| 11     |
| 1280×800 | back button      | 836, 88, 140, 40  | 8      |
| 1280×800 | reset button     | 992, 88, 192, 40  | 8      |
| 1280×800 | selected row     | 112, 262, 608, 48 | 8      |
| 390×844  | the panel card   | 8, 271, 374, 302  | 11     |
| 390×844  | rows             | 32, …, 326, 26    | 6      |
| 390×844  | back button      | 32, 517, 326, 40  | 9      |

Page backgrounds from the frames' own fill: `#0b1017` at 1280 (rgb 11,16,23) and
`#05070c` at 390 (rgb 5,7,12). The desktop title is 40 px Silkscreen Bold in a
51 px box, rows 16/20, values 14/18; the mobile title is 18/23, rows 10/13, values
9/12. The board's row pitch is 56 px on desktop and 26 px on mobile; the keycap is
52×28 r6 (68×28 for SHIFT, 60×28 for ESC). Every value the tokens do not carry is
declared **once** as a custom property at the top of `options.css` with the frame's
node name in the comment (the `kit.css` radii precedent) — never inline in a rule.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`; clean.
  - `git diff --name-only main...task-127` audited against the exclusive paths
    (`.agent_specs/task-127.md` is expected and is dropped from the merge).
  - **The gate:** `node scripts/hud/diff.mjs --slug 02-options --dev`.
    This Linux box has no usable Chromium sandbox, so point `CHROME_PATH` at a
    two-line wrapper before running it (the harness does not pass `--no-sandbox`):
    ```sh
    printf '#!/bin/sh\nexec /usr/bin/chromium --no-sandbox "$@"\n' > /tmp/chromium-nosandbox.sh
    chmod +x /tmp/chromium-nosandbox.sh
    CHROME_PATH=/tmp/chromium-nosandbox.sh node scripts/hud/diff.mjs --slug 02-options --dev --settle 2000
    ```
    Read `design/diff/02-options/report.json`; the harness's own `pass` per viewport
    is the criterion (geometry `max ≤ 2` px, colour `flat ≤ 2` ΔE, both printed).
  - **Live-screen measurements** (the `[live]` criteria 9–14): Vite dev on a free
    port, Chromium via `--headless=new --no-sandbox --remote-debugging-port=<port>`,
    CDP `Emulation.setDeviceMetricsOverride` (`deviceScaleFactor: 2`), then
    `Runtime.evaluate` reads of the DOM and, where stated, of the canvas through
    Phaser's `renderer.snapshotArea` / `getImageData`. Report the JS expression and
    the number it returned for every criterion.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` is clean and `npm test` is green, including the new
        tests.
  - [ ] `[unit]` `view.test.ts` proves `liveOptionsView` against
        `settingsRows(false)`: 7 gameplay rows and one row per
        `KEYBIND_ACTIONS` entry, in order; the volume row is a slider whose
        `fraction === settings.volume` and whose value is `70%` for `volume: 0.7`;
        the three boolean rows are toggles carrying `on`; a keybind row's value is
        `keyLabel(settings.keybinds[action])`; `selected` is the row at `index`; and
        the same call with `capturing: true` on a keybind row prints
        `t('settings.pressKey')`. It also proves `settingsRows(true)` yields 7 rows
        and an empty keybinds group.
  - [ ] `[unit]` `view.test.ts` imports `design/fixtures/02-options.json` and proves
        `fixtureOptionsView` returns frame `02-options` (5 gameplay rows in the
        desktop order, 7 keybinds, `0.7`/`0.8` fractions, `selected: 'textSpeed'`,
        reset `RESET DEFAULTS`), that `fixtureOptionsView(payload, true)` returns
        frame `m02-options` (VOLUME first, `selected: 'volume'`, `FAST`, one group
        with an empty title, `reset: null`, empty subtitle/footer), and that it
        returns `null` for: no requested variant (`mobile` missing while `narrow`),
        no `panel` key, a row with an unknown `kind`, a slider whose `fraction` is
        1.5, a toggle whose `on` is `'yes'`, a missing group, and a non-object
        payload.
  - [ ] `[unit]` `previewRequested`'s truth table: true only for both flags with
        `02-options` (any case, any parameter order, extra parameters allowed);
        false for `''`, `?hud=dom`, `?hudFixture=02-options` without `hud`,
        `?hud=dom&hudFixture=03-route-hud`, and a malformed slug.
  - [ ] `[unit]` the five i18n keys resolve in both locales and the existing i18n
        parity test passes.
  - [ ] `[unit]` the folder maps are current: `panels/options/README.md` exists and
        lists each file with one role line; `src/ui/hud/panels/README.md`'s
        `options/` line lists them and no longer claims the folder is empty.
  - [ ] `[unit]` nothing outside the exclusive paths changed.
  - [ ] `[live]` **The gate:** `node scripts/hud/diff.mjs --slug 02-options --dev`
        exits 0; `design/diff/02-options/report.json` has `pass: true` for both
        `1280x800` and `390x844` with `geometry.max ≤ 2` and `colour.flat ≤ 2`.
  - [ ] `[live]` `/?hud=dom&hudFixture=02-options` at 1280×800 **and** 390×844:
        exactly one `[data-hud-panel="options"]`, and it is inside `#hud`;
        `document.documentElement.scrollWidth <= window.innerWidth` (no horizontal
        overflow); `getComputedStyle(#hud).pointerEvents === 'none'` and the
        panel's is `'auto'`; the keybinds group exists at 1280 and is absent at 390.
        Geometry read with `getBoundingClientRect` (border box): at 1280 the
        gameplay card is `(96, 200, 640, 470) ±2` and the keybinds card
        `(760, 200, 424, 470) ±2`; at 390 the card is `(8, 271, 374, 302) ±2`.
  - [ ] `[live]` **One press, one step:** with `?hud=dom`, press the `settings`
        keybind (`TAB` by default) on the main menu; one `[data-hud-panel="options"]`
        appears with a `[data-hud-row]` per `settingsRows(false)` entry, the first
        row's text is `settingsRowLabel(SETTINGS_ROWS[0])` and it is the selected
        one. Then one CDP `Input.dispatchKeyEvent` `ArrowDown` (keyDown + keyUp)
        leaves the second row selected and the scene's `index === 1` (**not** 2 —
        read `(await import('/src/main.ts')).game.scene.getScene('Settings').index`).
  - [ ] `[live]` **No input regression / the flag-off path:** on plain `/` (no
        flags) `TAB` opens Settings and the Phaser panel still draws: the Settings
        scene's display list has ≥ 10 children **and** `renderer.snapshotArea` of
        the panel's rect contains more than one non-background colour
        (`getImageData`, colours counted). On `/?hud=dom` the same scene's display
        list is empty (`children.length === 0`), which is what "deleting the panel
        leaves the Phaser one untouched" means here.
  - [ ] `[live]` **A click reaches the same handler:** with the DOM panel open, a
        click on `[data-hud-row="language"]` selects it (scene `index` equals its
        position in `settingsRows(false)`), and a click on that row's
        `[data-hud-step="next"]` moves the stored language exactly one entry
        (`loadSettings().language`, read through
        `(await import('/src/settings.ts')).loadSettings()`), with `localStorage`
        holding the same value.
  - [ ] `[live]` **Slug-scoped:** `/?hud=dom&hudFixture=03-route-hud` mounts no
        options panel (`document.querySelector('[data-hud-panel]') === null`) and
        logs no error above the browser's baseline; so does `/?hud=dom` before any
        scene opens.

## 📣 Coordination

- For the Architect: this task adds `src/i18n/{en,es}.ts` to its claims (the live
  chrome's five keys) and the one-line `src/ui/hud/panels/README.md` update;
  `src/ui/hud/panels/options/**` now exists, so `[Task-129]`+ add files beside it
  and must not edit its README. `holdForFixture` has **no** consumer here: the
  options screen renders no `HudState`, so the fixture is validated through
  `installFixture` and read for its `panel`/`mobile` keys; the freeze stays the
  route/battle lanes' tool. **`design/fixtures/<slug>.json` must be able to carry
  one content block per board frame:** the two `02` frames disagree (row order,
  selection and a value), so one payload cannot match both and the fixture's
  `panel`/`mobile` pair is the rule later screens with a genuinely different mobile
  snapshot should follow.
- For the next batch: the panel folder's shape (`view.ts` + `optionsPanel.tsx` +
  `options.css` + `preview.ts` + `mount.tsx` + `index.ts`), the
  `data-hud-panel`/`data-hud-group`/`data-hud-row`/`data-hud-step` attribute names
  and the `mountOptionsPanel(host, view, onCommand)` signature are the migration's
  template; `SettingsScene` shows how a scene swaps its drawing for a mounted panel
  behind the flag and keeps its keyboard path. `options.css`'s scoped custom
  properties are the precedent for values `root.css` does not carry.
- The gate command and the `CHROME_PATH` wrapper this environment needs are
  documented above; a runner without a Chromium sandbox must use it.

## ⛔ Out of scope

- No reset behaviour: `RESET DEFAULTS` is fixture-only (it draws, it does nothing).
- No new `HudCommand` variant, no edit to `src/ui/hud/commands.ts`,
  `src/ui/hud/fixtures/**`, `src/ui/hud/styles/root.css`, `src/ui/hud/kit/**` or the
  diff harness.
- No change to the settings model (`src/ui/settingsScreen.ts`), the save
  (`src/engine/save.ts`) or a setting's meaning: the live screen shows the rows the
  game has today, in the board's chrome.
- No other screen migrates; no Phaser panel of any other scene is touched; no
  engine, data, RNG, save-version or asset change.
- No jsdom, no component library, no CSS framework, no new dependency.
