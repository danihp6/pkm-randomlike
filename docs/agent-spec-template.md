# Spec: Task-<ID> — <task title>

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** [engine rule / Phaser scene / data / tooling / docs].
- **Role:** Dev.
- **Objective:** one paragraph. What must exist after this task that did not exist
  before. Written as an outcome, not as a list of steps.
- **Environment:** worktree `../wt-pkm-<ID>`, branch `task-<ID>`.
- **Dependencies:** the tasks that must already be merged, by name, with the file
  each one produced that this task reads.

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**
No other task in the batch may claim the same path. Deleting a stray `.gitkeep`
from a directory this task populates is always allowed.

- `src/engine/...`
- `src/data/...`
- `src/scenes/...`

### Inputs (read-only)

Files this task may read, and only these, beyond `AGENTS.md` itself.

- `docs/...`
- `src/engine/...`
- `design/screens/<slug>.json` and `design/exports/<slug>.png` — **mandatory for any task
  that creates or changes a routed screen or a HUD panel**: the imported spec and its
  export, named by slug, with the frame's `caption` exactly as the board draws it (middle
  dot included). `<slug>` is the caption in lower-kebab (`03 Route HUD` → `03-route-hud`),
  so the spec, the export and the task cannot drift. A screen task that names no spec is
  not ready to launch (`D57`).

## 🔒 Contract

The public surface other tasks will be written against in parallel. It is a
promise, not a suggestion. Write the exact exported names and signatures.

### TypeScript

```ts
export interface ExampleConfig {
  id: string;
}

export function resolveExample(config: ExampleConfig, rng: Rng): ExampleResult;
```

- Events and the meaning of their arguments.
- **Determinism:** which `Rng` stream this reads and for what (or "reads no RNG").
- Rules: no Phaser imports in `src/engine/`, no DOM, allocation budget, what must
  not be read.

### Data

- Keys this task introduces or freezes, with their shape, unit and default.

## 🧩 Data and configuration

Any JSON entry, key, default or balancing value this task introduces, with its
shape and its meaning. Balancing lives in `src/data/`, never in engine code.

## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim. A criterion that cannot be executed by someone who has not
read the rest of the spec is not a criterion.

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task
    adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-<ID>` audit against the exclusive paths list.
  - A task whose criteria are all `[unit]` owes **no** browser pass; say so.
- **Acceptance criteria:** every one is tagged **`[unit]`** (a headless command, a
  decoded asset, a pinned number — seconds and deterministic) or **`[live]`** (it only
  exists in the running game: layering, overlap, a band, a beat, a colour on screen).
  QA runs them all, but its browser budget goes to the `[live]` ones, so an untagged
  criterion is a spec bug. A `[live]` criterion states its **measurement** — what to
  read, on which layout, against which bound — so QA reproduces it instead of
  inventing one.
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` The declared tests exist and pass.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` <task-specific, objective, checkable condition, with its measurement>
- **A `[live]` that compares pixels is not a criterion** (`D57`): the board enters as an
  imported spec, so fidelity is read from `design/screens/<slug>.json`, never from a
  screenshot diff.

## 📣 Coordination

Facts another role needs to know, and the shape of them. Anything another task
depends on that is not in the Contract above.

- For the Architect: <what changed in the plan>
- For the next batch: <what to build against>

## ⛔ Out of scope

Explicit non-goals, to stop scope creep and gold-plating.
