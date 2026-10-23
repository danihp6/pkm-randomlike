# Spec: Task-124 — The HUD shell mounts once and owns no Phaser object

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** DOM layer (Preact) + tooling/config + assets.
- **Role:** Dev.
- **Objective:** the DOM HUD gets a shell. Opening the game with `?hud=dom` creates a
  single full-viewport `#hud` element above the canvas (z-index 1, `pointer-events:
  none`, so the world stays clickable), mounts the Preact shell into it exactly once, and
  loads the self-hosted Silkscreen webfont at the board's own type scale. Without the
  flag nothing mounts and the game behaves exactly as today. The shell owns **no Phaser
  object** and reads no scene: it is an empty container plus the tokens, the font and
  the folder maps the eleven panel migrations in Batches 61-65 will write into.
- **Environment:** worktree `../wt-pkm-124`, branch `task-124`. Base: `origin/main` @
  `eba1681`. All commands run from the worktree root.
- **Dependencies (both merged):** `[Task-122]` — `design/` exists (`design/tokens.json`,
  `design/board.json`, `design/frames/`), `scripts/hud/diff.mjs` and `npm run hud:diff`
  exist. `[Task-123]` — `src/ui/hud/state.ts` and `src/ui/hud/commands.ts` already build
  the HUD's snapshot and command channel; read them, do not modify them.

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**

- `src/main.ts` — create and mount the HUD root, behind the flag.
- `src/ui/hud/mount.ts` — **new**: the flag and the mount/unmount.
- `src/ui/hud/mount.test.ts` — **new**: the flag parser's tests.
- `src/ui/hud/shell.tsx` — **new**: the Preact shell component.
- `src/ui/hud/styles/root.css` — **new**: `@font-face`, the tokens and the type scale.
- `src/ui/hud/README.md` — **new**: the folder map (and the one line per planned subfolder).
- `src/ui/hud/panels/README.md` — **new**: the panel-subfolder map.
- `src/assets/fonts/silkscreen-400.woff2` — **new**: vendored OFL font.
- `src/assets/fonts/silkscreen-700.woff2` — **new**: vendored OFL font.
- `src/assets/fonts/OFL.txt` — **new**: the licence that travels with them.
- `src/assets/README.md` — the rows for the two font files and the licence.
- `src/ui/README.md` — **section split**: append the `hud/` lines only (see below).
- `package.json`, `package-lock.json` — `preact` and `@preact/signals`, nothing else.
- `tsconfig.json` — the JSX settings Preact needs.
- `vite.config.ts` — only if a build setting is genuinely required (it should not be).

**Section split (shared document, do not touch other lines).** `src/ui/README.md` is
also claimed by Task-118, which edits the existing `capture.ts` line of the `Layout`
list. You **append** the `hud/` lines after the existing `hud/commands.ts` line and edit
nothing else in that file — not the header, not the `capture.ts` line.

**Hot-file owner.** `package.json`, `tsconfig.json`, `src/main.ts` and `vite.config.ts`
belong to this task for the whole batch. No other task may touch them.

### Inputs (read-only)

Beyond `AGENTS.md` and this spec:

- `docs/tech-decisions.md` `D49` — the decision this task implements (Preact + signals,
  self-hosted Silkscreen, layer order, `?hud=dom`, "no jsdom").
- `docs/hud-dom-proposal.md` §4-§6 — the architecture, the input contract and the font.
- `docs/hud-fidelity.md` §2 (typography and box heights) and the `scale` block of
  `design/tokens.json` (the only source of a colour, radius, spacing or type size).
- `src/ui/hud/state.ts`, `src/ui/hud/commands.ts` — the snapshot and the command channel.
- `src/dev/env.ts` — `IS_DEVELOP`, the build-time dev gate.
- `src/assets/README.md` — its table shape, so your rows match it.

## 🔒 Contract

### `src/ui/hud/mount.ts`

```ts
/** Whether the DOM HUD was asked for: `?hud=dom`, anywhere in the query string. */
export function hudRequested(search: string): boolean;

export type HudHandle = Readonly<{ root: HTMLElement; dispose: () => void }>;

/** Mounts the shell into a new `#hud` root, or returns null when not requested. */
export function mountHud(search: string): HudHandle | null;
```

- `hudRequested` is pure string work: `?hud=dom`, `?a=1&hud=dom` and `HUD=DOM` are true;
  `?hud=phaser`, `?hudx=dom` and `''` are false. No DOM access, so Vitest runs it
  headless (the repo has **no jsdom** and must not gain one).
- `mountHud('')` returns `null` and creates nothing.
- When requested it creates `<div id="hud">` as the last child of `<body>`, renders
  `<HudShell />` into it with Preact's `render`, and returns the handle. `dispose()`
  unmounts the component, removes the node and is safe to call twice.
- **Mount once.** A second `mountHud('?hud=dom')` while a root exists returns the same
  handle instead of creating a second `#hud` (a module-level handle is enough; no
  observer, no interval).
- Nothing in this module may touch `document` at import time.

### `src/ui/hud/shell.tsx`

```tsx
export function HudShell(): preact.JSX.Element;
```

Renders `<div class="hud" data-hud="root" />` — the layer the eleven panel subtrees will
mount into — and nothing else. It imports no Phaser, takes no props, reads no scene,
holds no state and schedules no work: the shell of `D49`, not a panel. `src/main.ts` is
its only caller.

### `src/ui/hud/styles/root.css`

- Two `@font-face` blocks (`Silkscreen`, weights 400 and 700, `font-display: swap`,
  `src: url('../../../assets/fonts/silkscreen-400.woff2') format('woff2')` and the 700
  pair). Vite resolves and hashes those URLs; keep them relative to the CSS file.
- `:root` custom properties taken from `design/tokens.json` — panel fill/border/radius,
  the accent, the six text tones, the panel width 374 and the gutter 8 — plus the HUD's
  own `--hud-font`.
- The **ten** board type sizes as CSS vars (`8/10`, `9/12`, `10/13`, `11/15`, `12/15`,
  `14/18`, `16/20`, `18/23`, `20/26`, `24/31` — size/box height in px, the pair
  `docs/hud-fidelity.md` §2 pins). Line height is written in **px per size**, never as a
  unitless ratio.
- The layer contract: `#hud { position: fixed; inset: 0; z-index: 1; pointer-events:
  none; }` and `.hud { width: 100%; height: 100%; pointer-events: none;
  font-family: var(--hud-font); }`. Panels re-enable `pointer-events: auto` themselves
  (no panel exists yet).
- No CSS framework, no CSS-in-JS, no shadow the board does not draw.

### `src/main.ts`

After the existing `new Phaser.Game(config)` (and independent of it), import
`mountHud` from `./ui/hud/mount` and call it **once** with `window.location.search`;
keep the returned handle in a module constant and never touch it again. The HUD must
mount with no scene started and must not be imported conditionally by scene: the import
is static, the call is gated by the flag inside `mountHud`. `src/main.ts` is otherwise
unchanged — no scene list, no config edit.

### Preact setup

- `package.json`: `preact` and `@preact/signals` in `dependencies` (runtime, `D49` says
  ≈5 KB gzip). `npm install` updates `package-lock.json`. Nothing else is added.
- `tsconfig.json`: `"jsx": "react-jsx"`, `"jsxImportSource": "preact"`. Keep
  `"include": ["src", "vite.config.ts"]`.
- Vite needs no plugin: esbuild reads the tsconfig's JSX settings for `.tsx`.

### Fonts (vendored, OFL, committed)

Commit the two WOFF2 files at the exact paths above (latin subset, the 400 and the 700).
They are redistributable under the SIL Open Font License; `OFL.txt` is the licence file
that travels with them. Fetch them once, with a browser user agent (Google serves WOFF2
only to one):

```sh
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
curl -s -A "$UA" "https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&display=swap"
# take the two `latin` woff2 URLs of the response (the last @font-face of each weight)
curl -s -o src/assets/fonts/silkscreen-400.woff2 "<400 latin woff2 url>"
curl -s -o src/assets/fonts/silkscreen-700.woff2 "<700 latin woff2 url>"
curl -s -o src/assets/fonts/OFL.txt "https://raw.githubusercontent.com/google/fonts/main/ofl/silkscreen/OFL.txt"
```

Verify each file starts with the WOFF2 signature (`head -c 4` reads `wOF2`) and is
non-trivial in size (> 1 KB). The test in `mount.test.ts` pins both. They are not
gitignored (`git check-ignore src/assets/fonts/silkscreen-400.woff2` must print
nothing). `src/assets/README.md` gains one row per file, with "OFL, safe to commit" as
the licence column, in the table's existing shape.

### Folder maps (the READMEs are the deliverable of the split)

`src/ui/hud/README.md` maps the folder: `state.ts` (the snapshot), `commands.ts` (the
command channel), `mount.ts` (the flag and the mount), `shell.tsx` (the shell),
`styles/root.css` (tokens and type), plus one line per **planned** subfolder —
`kit/`, `fixtures/` and `panels/` — saying what will live there. `src/ui/hud/panels/README.md`
lists the panel subfolders the plan names, one line each, so the migrations only add
files: `options`, `bag`, `pc`, `party`, `detail`, `map`, `shop`, `trade`, `rewards`,
`notices`, `pause`, `hud` (the route strip), `battle-hp`, `battle-moves`, `battle-bag`,
`battle-switch`, `battle-log`, `main-menu`, `stats`, `starter`, `run-over`. No component
code for any of them here.

## 🧩 Data and configuration

No new data file, no run field, no RNG draw, no `SAVE_VERSION` step. The only new
dependency pair is `preact` + `@preact/signals`.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless (there is **no** jsdom; only the pure flag parser and
    the asset checks are unit-tested).
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only origin/main...task-124` — must list only the exclusive paths.
  - The `[live]` criteria need the dev build (`npm run dev`, port 5175) read over CDP at
    the two board viewports (1280×800 and 390×844).

- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean, and the build emits no second JSX
        runtime (the `tsc` pass is the check).
  - [ ] `[unit]` `hudRequested` passes its table: `?hud=dom` true, `?x=1&hud=dom` true,
        `HUD=DOM` true, `?hud=phaser` false, `?hudx=dom` false, `''` false.
  - [ ] `[unit]` Both WOFF2 files exist at their paths, start with `wOF2`, exceed 1 KB,
        and `git check-ignore` reports them not ignored; `root.css` names both weights
        and the ten size/line-height pairs.
  - [ ] `[unit]` `package.json` lists exactly `preact` and `@preact/signals` as the new
        dependencies and nothing else moved.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` **Without the flag the game is unchanged.** Loading `/` at 1280×800,
        `document.querySelector('#hud')` is `null` and `document.querySelector('#game
        canvas')` exists with a width equal to the viewport's.
  - [ ] `[live]` **With the flag one root, no pointer capture.** Loading `/?hud=dom`,
        `#hud` exists exactly once, `getComputedStyle(#hud).pointerEvents` is `none`,
        its `getBoundingClientRect()` equals `{0,0,innerWidth,innerHeight}`,
        `getComputedStyle(#hud).zIndex` is `1`, and `document.elementFromPoint` at the
        viewport's centre returns the `<canvas>` (not `#hud` or `.hud`).
  - [ ] `[live]` **The font is the vendored one.** `document.fonts.check('700 18px
        Silkscreen')` is `true`, `getComputedStyle(#hud).fontFamily` contains
        `Silkscreen`, the loaded-face list includes both weights, and the size vars
        resolve to the board's pairs (e.g. title `18px` / line height `23px`).
  - [ ] `[live]` **The shell owns no Phaser object.** On the same seed and screen,
        mounting the shell changes nothing in the canvas: the canvas keeps its size and
        the WebGL context is not recreated (the canvas element identity and its
        `width`/`height` are unchanged between the flag-on and flag-off loads).

## 📣 Coordination

- For the Architect: `src/ui/hud/mount.ts` owns the `?hud=dom` parse for now, because
  `[Task-126]` (not in this batch) is written against this shell. When 126 lands,
  `hudFlags.ts` lifts `hudRequested` and adds `?hudFixture`; 126 owns `src/main.ts`'s
  call site then and this module exposes the mount unchanged.
- For the next batch: `[Task-125]` builds `src/ui/hud/kit/**` against `styles/root.css`'s
  vars and `.hud` as its root class; it does not touch `package.json` (the dependency is
  already installed here). `[Task-127]` is the first panel and needs `[Task-126]`.

## ⛔ Out of scope

- Any panel, any kit component, any fixture, any diff run (`[Task-125]`–`[Task-127]`).
- The touch pad, the Phaser chrome, the canvas, any scene file: the canvas is untouched.
- `src/ui/hud/state.ts` and `src/ui/hud/commands.ts` — read-only.
- `index.html`, `vite.config.ts` (unless the build genuinely needs it), any new
  dependency beyond the two, any CSS framework or jsdom.
- `npm run hud:diff` passing for a panel: no panel exists yet.

## ✅ Definition of done

1. `npm test` and `npm run build` green in `../wt-pkm-124`.
2. Only the exclusive paths appear in `git diff --name-only origin/main...HEAD`.
3. Commit the work, then leave an **empty** commit on the tip and push:
   `git commit --allow-empty -m "dev: done task-124"` followed by
   `git push origin task-124`. The branch tip must read `dev: done task-124` when you
   report; `git ls-remote origin task-124` must show the sha you pushed.
