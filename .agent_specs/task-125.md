# Spec: Task-125 — The panel kit the board is made of

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** DOM UI kit (Preact components + plain CSS), tooling-adjacent.
- **Role:** Dev.
- **Objective:** `src/ui/hud/kit/` exists and holds the eight primitives every
  Phase 12 panel will compose — `Panel`, `Row`, `Chip`, `Bar`, `Sheet`,
  `PrimaryButton`, `Meta`, `TypeBadge` — as stateless Preact function components
  whose entire look comes from `src/ui/hud/styles/root.css`'s `--hud-*` tokens plus
  one kit stylesheet, with the board's measured geometry (radii 6/8/10/11/16, 1 px
  hairlines, a 1 px highlight, the ten fixed type sizes with their px line boxes,
  ≥ 44 px hit areas, a visible focus ring, no shadow the board does not draw) pinned
  by headless tests. Nothing in the running game consumes the kit yet: it is the
  contract the eleven panel migrations of Batches 60–65 are written against.
- **Environment:** worktree `../wt-pkm-125`, branch `task-125`. `node_modules/` is
  not present in a fresh worktree — run `npm ci` once (the lockfile is committed)
  before any gate. Linux, Node 22. No network at test time beyond that install.
- **Dependencies:** all merged on `origin/main` @ `4e5ce67` —
  - Task-122 — `design/tokens.json`, `scripts/hud/diff.mjs`, `design/README.md`.
  - Task-123 — `src/ui/hud/state.ts`, `src/ui/hud/commands.ts` (types only; the kit
    reads neither).
  - Task-124 — `src/ui/hud/mount.ts`, `src/ui/hud/shell.tsx`,
    `src/ui/hud/styles/root.css` (the `--hud-*` variables this task consumes),
    `src/assets/fonts/silkscreen-{400,700}.woff2`.

### Exclusive paths (single writer)

**Nothing outside this list.**

- `src/ui/hud/kit/**` (every file it adds: components, helpers, `kit.css`, tests,
  `README.md`)
- `src/ui/hud/README.md` (one edit: the `kit/` and `fixtures/` lines stop saying
  "planned" — the second folder is Task-126's, same batch; see Coordination)

### Inputs (read-only)

- `docs/hud-fidelity.md` — §2 typography, §4 palette/radii/strokes, §5 panel
  geometry and chips, §7.3 the kit's exact inventory. **This is the measurement
  source of truth; when a number here disagrees with your instinct, this file wins.**
- `docs/hud-dom-proposal.md` §4 (architecture) and §10 (open decisions).
- `design/tokens.json` — the generated token values.
- `src/ui/hud/styles/root.css` — the `--hud-*` variables and the two `@font-face`
  blocks; **do not edit it.**
- `src/ui/hud/shell.tsx`, `src/ui/hud/mount.ts`, `src/ui/hud/mount.test.ts` — the
  shell the kit will live inside, and the house style for a CSS-contract test.
- `src/ui/typeColors.ts` — `typeColor(type): number`, the canon type palette.
- `src/i18n/en.ts`, `src/i18n/es.ts` — **not imported**: a kit component receives its
  text as children/props, already localised by its caller.
- `AGENTS.md`.

## 🔒 Contract

The public surface the eleven panel tasks will be written against. It is a promise.

### TypeScript — `src/ui/hud/kit/` (barrel: `index.ts`)

All components are Preact function components (`tsx`, `jsxImportSource: preact`),
**stateless**: no hooks, no `useState`, no context, no Phaser import, no DOM query,
no `window`/`document` access, no i18n call, no RNG. Text arrives as props/children.

```ts
import type { ComponentChildren, JSX } from 'preact';

export type KitTone = 'primary' | 'secondary' | 'muted' | 'faint' | 'ink' | 'warning' | 'accent';

export type PanelProps = Readonly<{
  title?: string;
  aside?: string;
  children?: ComponentChildren;
  class?: string;
}>;
export function Panel(props: PanelProps): JSX.Element;

export type RowProps = Readonly<{
  children?: ComponentChildren;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  class?: string;
}>;
export function Row(props: RowProps): JSX.Element;

export type ChipProps = Readonly<{
  letter: string;          // the initial only: M, I, P, C, S
  label: string;           // the accessible name (aria-label)
  active?: boolean;
  onPress?: () => void;
}>;
export function Chip(props: ChipProps): JSX.Element;

export type BarTone = 'hp' | 'xp' | 'charge';
export type BarProps = Readonly<{ fraction: number; tone?: BarTone; label?: string }>;
export function Bar(props: BarProps): JSX.Element;

export type SheetProps = Readonly<{
  open?: boolean;
  title?: string;
  onClose?: () => void;
  children?: ComponentChildren;
}>;
export function Sheet(props: SheetProps): JSX.Element;

export type PrimaryButtonProps = Readonly<{
  children?: ComponentChildren;
  onPress: () => void;
  disabled?: boolean;
}>;
export function PrimaryButton(props: PrimaryButtonProps): JSX.Element;

export type MetaProps = Readonly<{ children?: ComponentChildren; tone?: Exclude<KitTone, 'ink'> }>;
export function Meta(props: MetaProps): JSX.Element;

export type TypeBadgeProps = Readonly<{ type: string; label?: string }>;
export function TypeBadge(props: TypeBadgeProps): JSX.Element;
```

Pure helpers the components are built on, exported beside them (each with a test):

```ts
/** Joins truthy class names with a single space; never leaves a double space. */
export function joinClasses(...parts: readonly (string | false | null | undefined)[]): string;

/** The class list of each primitive, so a panel can add a modifier without cloning CSS. */
export function panelClass(opts?: Readonly<{ class?: string }>): string;
export function rowClass(opts?: Readonly<{ interactive?: boolean; selected?: boolean; disabled?: boolean; class?: string }>): string;
export function chipClass(opts?: Readonly<{ active?: boolean }>): string;
export function barClass(opts?: Readonly<{ tone?: BarTone }>): string;
export function typeBadgeClass(): string;

/** Bar geometry: the fill's width as a CSS percentage, clamped to 0…100, two decimals. */
export function fillPercent(fraction: number): string;   // "0%", "61.5%", "100%"

/** The type badge's two colours, as CSS hex: the canon fill and a readable ink. */
export function typeBadgeTone(type: string): Readonly<{ fill: string; ink: string }>;
```

- **`typeBadgeTone`** derives `fill` from `typeColor(type)` (`src/ui/typeColors.ts`)
  formatted as lowercase `#rrggbb`, and picks `ink` from two fixed values —
  `#0b1017` (dark) or `#f8fafc` (light) — whichever gives the higher WCAG contrast
  against `fill`. Every one of the 18 canon types plus the unknown-type fallback
  must reach **contrast ≥ 4.5:1**; the test asserts it for all of them.
  Do **not** import `src/ui/frlg.ts` (it pulls Phaser and asset URLs).
- **`Bar`** renders `role="progressbar"` with `aria-valuemin="0"`,
  `aria-valuemax="100"`, `aria-valuenow` = the integer part of the clamped value,
  and `aria-label` = `label` when given. The fill is an inner element whose width
  is `fillPercent`; the track is the row fill.
- **`Row`** is a `<div>` when `onPress` is absent and a `<button type="button">` when
  it is present (so only real actions are focusable). `selected` sets
  `aria-current="true"`; `disabled` sets `disabled` **and** `aria-disabled="true"`.
  A `Row` never calls `onPress` while `disabled`.
- **`Chip`** is always a `<button type="button">`; it renders `letter` only, with
  `aria-label={label}`.
- **`Sheet`** renders nothing when `open` is false (`null`); when open it is a
  `<section>` with the handle and an optional close `<button aria-label="Close">`
  wired to `onClose`.
- **`PrimaryButton`** is a `<button type="button">` with `disabled` honoured.
- **`Meta`** is a `<span>`; default tone `muted`.
- **`Panel`** is a `<section>`: an optional header (`title` at the `title` type size,
  `aside` at `meta`), then children. The 1 px highlight 12 px inside the top edge is
  CSS (`.kit-panel::before`), never an extra node.
- **Determinism:** none of this reads RNG, a clock or the DOM.

### CSS — `src/ui/hud/kit/kit.css`

- **Every colour is a `var(--hud-*)` from `root.css`.** The stylesheet contains **no
  hex, no `rgb(`, no `hsl(`, no named colour**: the test fails on the first one.
- **Every `font-size` and `line-height` is one of the ten pairs `root.css` already
  declares** (`--hud-type-*-size` / `-line`), never a literal px and never a
  unitless ratio.
- **Radii** come from `var(--hud-panel-radius)` (11) and `var(--hud-row-radius)` (8)
  where those exist; the three the board uses and `root.css` does not carry are
  declared **once, kit-scoped**, in a `.kit` block and nowhere else:
  `--kit-chip-radius: 6px`, `--kit-button-radius: 10px`, `--kit-sheet-radius: 16px`
  (the sources: `docs/hud-fidelity.md` §4 "Radii" and §5 "Chips"). No other literal
  radius anywhere.
- **Borders are 1 px** (`border: 1px solid var(--hud-panel-border)` etc.). No
  `stroke-width="2"` copy from the SVG: the board's 2 px stroke is a centred stroke
  clipped by its mask, so the CSS border is 1 px inside (§3 of the fidelity doc).
- **No `box-shadow`.** The board draws none; the test fails on one.
- **`box-sizing: border-box`** on every `.kit-*` rule that declares a size.
- **Hit areas ≥ 44 × 44 px.** The drawn box keeps the board's height (rows are
  ~26–30 px); the *target* is widened by a transparent `::after` on
  `.kit-row--interactive` and `.kit-chip`, with the 44 px minimum written as
  `min-width: 44px; min-height: 44px;` (or the equivalent inset). The test asserts
  the 44 px declaration exists on both selectors.
- **Focus ring:** one `:focus-visible` rule with
  `outline: 2px solid var(--hud-accent); outline-offset: 2px;`. No `outline: none`
  anywhere.
- The stylesheet is imported by the barrel `index.ts` (`import './kit.css'`), so any
  panel that imports a component gets it exactly once. It is **not** imported by
  `mount.ts` or `shell.tsx`.

**Class names** are prefixed `kit-` (`kit-panel`, `kit-panel__title`,
`kit-row --selected`, `kit-chip`, `kit-bar`, `kit-sheet`, `kit-button`, `kit-meta`,
`kit-type`), one block per primitive, ordered as the components above. Modifiers use
the `--` form and are produced **only** by the `*Class` helpers, never typed inline in
a component.

### Data

No data files, no balancing values, no new dependency. Preact and its JSX runtime are
already installed (`package.json`); **do not touch `package.json` or the lockfile.**

## 🧩 Data and configuration

None. The kit is behaviour-free: it renders what it is given.

## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim. Every criterion is executable by someone who has read only
this spec.

- **Method:**
  - `npm ci` once in the worktree if `node_modules/` is absent.
  - `npm test` — Vitest, headless. The repo has **no jsdom**: assert on rendered
    vnode shape (`h(Component, props)` and its `type`/`props`), on pure helpers, and
    on the CSS **as text**, the way `src/ui/hud/mount.test.ts` already reads
    `root.css`.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-125` against the exclusive paths list.
  - This task ships **one** `[live]` regression criterion (the shell it mounts
    inside), not a panel: the kit has no consumer until Task-127.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean (`npm run build`, exit 0).
  - [ ] `[unit]` `npm test` is green and the new tests exist: `joinClasses` /
    `fillPercent` / `typeBadgeTone` / the `*Class` helpers; `fillPercent` clamps
    −1 → `0%`, 0.615 → `61.5%`, 2 → `100%`, and `NaN` → `0%`; `typeBadgeTone`
    reaches contrast ≥ 4.5 for all 18 canon types and for an unknown type.
  - [ ] `[unit]` The barrel `src/ui/hud/kit/index.ts` exports exactly the names in
    the Contract above — no more, no fewer — asserted against a literal list.
  - [ ] `[unit]` `kit.css`, read as text, contains no hex/`rgb(`/`hsl(` colour, no
    literal `font-size`/`line-height`, no `box-shadow`, no `outline: none`, only
    1 px borders, `box-sizing: border-box` on the sized primitives, exactly the three
    kit-scoped radius variables (6, 10, 16) and no other literal radius.
  - [ ] `[unit]` `.kit-row--interactive` and `.kit-chip` declare the 44 px hit area,
    and a `:focus-visible` rule declares `2px solid var(--hud-accent)`.
  - [ ] `[unit]` Every component returns a vnode whose `type` is the component and
    whose class comes from its helper; `Row` with `onPress` renders a `button` and
    without it a `div`; `Sheet` with `open` false renders `null`; `Bar`'s
    `aria-valuenow` is the clamped integer.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched; `package.json`,
    `root.css`, `mount.ts`, `shell.tsx` and `src/main.ts` are untouched by the diff.
  - [ ] `[unit]` `src/ui/hud/kit/README.md` exists, one line per file, no exported
    names; and `src/ui/hud/README.md`'s `kit/` and `fixtures/` lines no longer say
    "planned".
  - [ ] `[live]` **The shell still mounts and the kit leaks nothing into it.** With
    `npm run dev` running, navigate to `/?hud=dom` and measure over CDP
    (`Runtime.evaluate`): `document.getElementById('hud')` exists, its
    `getBoundingClientRect()` is `{x:0, y:0, width:1280, height:800}` at the default
    `1280x800` viewport, its child element count is `1` (the `.hud` shell), the shell
    carries `data-hud="root"`, `getComputedStyle(#hud).pointerEvents` is `none`, and
    no element with a class starting `kit-` exists anywhere in the document. Zero
    exceptions and zero `console.error` events in the 3 s window.

## 📣 Coordination

- **For the Architect:** the plan's Task-125 claim gained `src/ui/hud/README.md` as
  the **single writer** for that file in this batch, because two folder lines
  (`kit/`, `fixtures/`) go stale the moment this batch merges. Task-126 must not
  touch it (its spec says so).
- **For the next batch:** Task-127 (`Options 02`) is the first consumer: `Panel`,
  `Row`, `Meta`, `Chip` and `PrimaryButton` must be enough to lay out frame `02`'s
  rows and sliders without a new primitive. If you find you need a ninth primitive,
  that is a plan change, not a kit change.
- **For Task-126:** its `fixtures/` folder is named in the `src/ui/hud/README.md`
  line you write; keep the same wording shape as the `kit/` line.

## ⛔ Out of scope

- No panel, no scene, no fixture, no `design/` change, no `scripts/` change.
- No new dependency, no CSS framework, no CSS-in-JS, no styled-components, no
  Tailwind: the diff has to be debuggable in devtools (the plan says so).
- No `root.css` edit (it is Task-124's shipped file) and no change to `mount.ts`,
  `shell.tsx` or `src/main.ts`.
- No animation, no transition beyond the board's own (the board has none), no
  responsive breakpoint system: the panel width is `--hud-panel-width`, 374 px, and
  the two viewports are 1280×800 and 390×844.
- No i18n keys, no string tables, no `t()` calls.
