# Spec: Task-165 — The boss door's sign is never an opaque square

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** tooling (two packers) + one committed asset + a test + docs.
- **Role:** Dev.
- **Objective:** a checkout whose packed atlas set does not contain
  `src/assets/frlg/sign.png` can no longer draw a solid slate-black square on the boss
  door. Three things must be true afterwards: (a) the placeholder generator writes a
  **transparent** 16×16 signboard-with-post silhouette for `frlg/sign.png` instead of
  its generic opaque fill, so the fallback art itself is a sign; (b) the packer
  `scripts/frlg/build-sign.mjs` **fails loudly** instead of committing a flat crop, and
  prints the source cell it cut; (c) `src/data/tilesets/props.test.ts` measures the
  committed placeholder **always** (a clean clone has no pack) and measures the packed
  crop's colour spread where the art exists, so the next re-crop cannot reintroduce the
  square silently. Today the generator paints every atlas as one opaque `FILL` square
  with a lighter border and alpha 255 (`scripts/assets/build-placeholders.mjs` 48-71),
  `build-sign.mjs` copies the cell as-is with no key and no uniformity check (32-40),
  and the only test is `describe.skipIf(!hasArt('frlg/sign.png'))` counting alpha 0
  alone (`props.test.ts` 21-40).
- **Environment:** worktree `../wt-pkm-165`, branch `task-165`.
- **Dependencies:** none — `[Task-161]` shipped the prop and its `assets:pack` step;
  this task repairs its placeholder and its packer. All read files are on `main` @
  `f211850`.

### Exclusive paths (single writer)

Nothing outside this list. No other task in the batch claims any of these.

- `scripts/frlg/build-sign.mjs`
- `scripts/assets/build-placeholders.mjs`
- `src/assets/placeholders/frlg/sign.png` — the committed placeholder itself (a
  generated binary; regenerating it is part of the task).
- `src/data/tilesets/props.ts` — the batch's only claimant. Claimed so the file may
  carry the placeholder contract in one place; **no edit may be required** (see the
  Contract: the shipped exports already say everything the fix needs).
- `src/data/tilesets/props.test.ts`
- `src/scenes/BootScene.ts` — the batch's only claimant; claimed for the same reason
  and expected to stay **unchanged** (see the Contract).
- `docs/tileset-spec.md` **§2 only** ("Atlas contract", today lines 28-94, ending
  before `## 3. Autotiling`). No other task in the batch touches that file.

No file is added, renamed or deleted, so no folder `README.md` changes.

### Inputs (read-only)

- `AGENTS.md` — its **Asset trees** and **Art** rules bind this task: a packer takes
  its source directory through **argv or the environment** as an absolute path, never
  a path inside a worktree, and no asset tree is ever linked into a worktree.
- `scripts/assets/root.mjs` (`ASSETS_ROOT`, `assetPath`) — the only way a packer may
  resolve its source. In this environment the store is
  `/home/runner/work/_temp/assets/store` (it holds `frlg/tileset-2.png`), passed as
  `ASSETS_ROOT=/home/runner/work/_temp/assets/store`.
- `scripts/legacy-art/png-codec.mjs` (`decodePng`, `encodePng`) — the only encoder
  available; no new dependency.
- `scripts/assets/pack.mjs` (how the packers are invoked, for style only).
- `src/assets/optional.ts` (`packedAtlasUrl`), `src/assets/art.ts` (`hasArt`),
  `src/data/README.md` and `src/assets/README.md` (contracts, read-only).
- `src/data/tilesets/props.ts`, `src/data/tilesets/props.test.ts`,
  `src/scenes/BootScene.ts` (145-150, the sign's one-frame spritesheet load).
- `docs/tileset-spec.md` §2 (the props bullet, today lines 70-76).

Rules: no new dependency, no `package.json` change, no `SAVE_VERSION` change, no
ripped output committed (every `src/assets/frlg/*.png` is gitignored; only
`src/assets/placeholders/**` is committed).

## 🔒 Contract

### Tooling — `scripts/assets/build-placeholders.mjs`

Two changes, both inside the existing loop:

1. **An argv filter.** After the `ATLASES` list (today 24-45):

   ```js
   const only = process.argv.slice(2)
   for (const path of only) {
     if (!ATLASES.includes(path)) {
       console.error(`build-placeholders: unknown atlas "${path}"`)
       process.exit(1)
     }
   }
   const TARGETS = only.length > 0 ? ATLASES.filter((path) => only.includes(path)) : ATLASES
   ```

   The loop then runs over `TARGETS`. No argument = every atlas, exactly as today.
   This is what lets a clean clone (which has no packed art) regenerate the one
   placeholder it owns: `node scripts/assets/build-placeholders.mjs frlg/sign.png`.

2. **A per-atlas branch for `frlg/sign.png`**, taken **before** the source PNG is read
   (so it works with no pack at all). It writes the fixed silhouette below and
   `continue`s:

   ```js
   if (path === 'frlg/sign.png') {
     const size = 16
     const rgba = Buffer.alloc(size * size * 4)            // alpha 0 everywhere
     const put = (x, y, [r, g, b]) => { const i = (y * size + x) * 4; rgba[i] = r; rgba[i+1] = g; rgba[i+2] = b; rgba[i+3] = 255 }
     for (let y = 3; y <= 8; y++) for (let x = 2; x <= 13; x++) put(x, y, BORDER)   // board 12x6
     for (let y = 9; y <= 13; y++) for (let x = 7; x <= 8; x++) put(x, y, FILL)     // post 2x5
     const target = OUT + path
     mkdirSync(dirname(target), { recursive: true })
     const png = encodePng(size, size, rgba)
     writeFileSync(target, png)
     console.log(`wrote src/assets/placeholders/${path} ${size}x${size} (${png.length} bytes)`)
     continue
   }
   ```

   Frozen properties of that image: **16×16**, alpha 0 on every pixel outside the two
   rectangles, **82** opaque pixels, all four corners alpha 0, exactly two opaque
   colours (`BORDER` = 120,136,160 on the board, `FILL` = 58,66,82 on the post). It is
   deterministic: running it twice writes byte-identical bytes.

### Tooling — `scripts/frlg/build-sign.mjs`

Between the crop loop (today 32-40) and the write (today 42-44) add the flatness
guard; the file must **never** be written when the guard trips:

```js
const MIN_OPAQUE_COLOURS = 3
const MAX_NEAR_BLACK = 0.4
const nearBlack = (r, g, b) => r <= 16 && g <= 16 && b <= 16
const colours = new Set()
let nearBlackCount = 0
for (let i = 0; i < out.length; i += 4) {
  if (out[i + 3] === 0) continue
  colours.add(`${out[i]},${out[i + 1]},${out[i + 2]}`)
  if (nearBlack(out[i], out[i + 1], out[i + 2])) nearBlackCount += 1
}
const nearBlackShare = nearBlackCount / (SIZE * SIZE)
if (colours.size < MIN_OPAQUE_COLOURS || nearBlackShare > MAX_NEAR_BLACK) {
  console.error(
    `build-sign: flat crop at the source cell (${ORIGIN_X},${ORIGIN_Y}) = column ${COLUMN}, row ${ROW}: ` +
      `${colours.size} distinct opaque colours, ${Math.round(nearBlackShare * 100)} % near-black pixels ` +
      `— refusing to write src/assets/frlg/sign.png`,
  )
  process.exit(1)
}
```

Frozen definitions: "distinct opaque colours" = distinct `r,g,b` triples among pixels
with alpha > 0; "near-black" = all three channels ≤ 16; the share's denominator is the
whole 16×16 crop (256). Exit code **1**, one `console.error` line that names the source
cell's pixel origin **and** its grid coordinates. A passing crop still prints the
shipped `wrote …` line and exits 0.

### TypeScript

`src/data/tilesets/props.ts` and `src/scenes/BootScene.ts` keep their exact shipped
surface — no rename, no new export, no signature change:

```ts
export const PROP_SIGN_TEXTURE_KEY = 'frlg:sign';
export const PROP_SIGN_URL: string;   // packed crop when present, else the committed placeholder
export const PROP_SIGN_SIZE = 16;
export const PROP_SIGN_FRAME = 0;
```

`BootScene` keeps loading it as a one-frame 16×16 spritesheet (today 145-150); a
transparent placeholder needs no loader change. **Expected diff: none in either
file.** If the dev believes one is required, it is a report, not an edit.

`src/data/tilesets/props.test.ts` gains one **always-run** describe and keeps the
skipped one:

```ts
const PLACEHOLDER_PATH = fileURLToPath(
  new URL('../../assets/placeholders/frlg/sign.png', import.meta.url),
);

describe('the sign placeholder', () => {
  it('is a 16x16 silhouette, not an opaque square', () => {
    const png = decodePng(readFileSync(PLACEHOLDER_PATH));
    expect(png.width).toBe(PROP_SIGN_SIZE);
    expect(png.height).toBe(PROP_SIGN_SIZE);
    const alphaAt = (x: number, y: number): number => png.data[(y * png.width + x) * 4 + 3];
    expect(alphaAt(0, 0)).toBe(0);
    expect(alphaAt(15, 0)).toBe(0);
    expect(alphaAt(0, 15)).toBe(0);
    expect(alphaAt(15, 15)).toBe(0);
    let opaque = 0;
    for (let i = 3; i < png.data.length; i += 4) if (png.data[i] !== 0) opaque += 1;
    expect(opaque).toBeGreaterThanOrEqual(40);
    expect(opaque).toBeLessThanOrEqual(200);
  });
});
```

The existing skipped describe (`describe.skipIf(!hasArt('frlg/sign.png'))`, today
21-40) keeps its five pins (16×16, four corners 0, `transparent === 68`) and **gains**
one assertion before it closes: the number of distinct opaque `r,g,b` triples in the
crop is `>= 3` (the same bound the packer now enforces).

**Determinism:** nothing here reads an RNG, a clock or the network. The placeholder is
a fixed pixel buffer and the packer's output is a pure crop of the store's cell, so
both write byte-identical bytes on every run — which is exactly what the two
`git status` gates in the plan measure.

### Data

- No config key, no JSON, no save field: `SAVE_VERSION` stays **25**.
- The committed placeholder `src/assets/placeholders/frlg/sign.png` changes bytes (it
  is the only committed binary in this task's diff).

## 🧩 Data and configuration

| value | where | meaning |
| --- | --- | --- |
| `MIN_OPAQUE_COLOURS = 3` | `scripts/frlg/build-sign.mjs` | a packable crop carries at least three distinct opaque colours |
| `MAX_NEAR_BLACK = 0.4` | `scripts/frlg/build-sign.mjs` | more than 40 % near-black pixels means the cell is not a sign |
| near-black = all channels ≤ 16 | `scripts/frlg/build-sign.mjs` | the definition the share uses |
| placeholder body 82 opaque px | `scripts/assets/build-placeholders.mjs` | board 12×6 at (2,3) + post 2×5 at (7,9), alpha 0 elsewhere |

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-165` audited against the exclusive paths list.
  - Two `node` gates on the packers (no network, no browser) and one `[live]` pass.
  - `src/assets/frlg/sign.png` is **gitignored**: a packer gate that writes it must not
    appear in `git status --porcelain` and must never be committed.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean (`npm run build`).
  - [ ] `[unit]` `npm test -- props` proves the placeholder half **on a tree without
        the pack** (`test ! -e src/assets/frlg/sign.png`, true on a fresh worktree):
        the `the sign placeholder` describe runs (not skipped) and passes — 16×16, four
        corners alpha 0, opaque count between 40 and 200.
  - [ ] `[unit]` The same command with the pack present
        (`ASSETS_ROOT=/home/runner/work/_temp/assets/store node scripts/frlg/build-sign.mjs`
        first) runs **both** describes: the packed crop is 16×16 with `68` transparent
        pixels and at least 3 distinct opaque colours.
  - [ ] `[unit]` The placeholder generator is deterministic and store-free for the sign:
        `node scripts/assets/build-placeholders.mjs frlg/sign.png` exits 0 and
        `git status --porcelain src/assets/placeholders/frlg/sign.png` prints **nothing**
        (the committed file is byte-identical to what the branch writes).
  - [ ] `[unit]` The generator rejects an unknown atlas:
        `node scripts/assets/build-placeholders.mjs nope.png` exits **1** and prints
        `build-placeholders: unknown atlas "nope.png"`.
  - [ ] `[unit]` The packer's flatness guard fires on a synthetic flat cell. Create the
        store and run the gate (both commands verbatim, in this order):

        ```
        node --input-type=module -e "import { mkdirSync, writeFileSync } from 'node:fs'; import { encodePng } from './scripts/legacy-art/png-codec.mjs'; const w=425,h=425,b=Buffer.alloc(w*h*4); for (let i=0;i<w*h;i++){ b[i*4]=14; b[i*4+1]=14; b[i*4+2]=16; b[i*4+3]=255; } mkdirSync('/tmp/sign-guard/frlg',{recursive:true}); writeFileSync('/tmp/sign-guard/frlg/tileset-2.png', encodePng(w,h,b));"
        ASSETS_ROOT=/tmp/sign-guard node scripts/frlg/build-sign.mjs; echo "exit=$?"
        ```

        Pass when `exit=1`, stderr names the cell (`column 23, row 3` and
        `(392,52)`), reports `1 distinct opaque colours` and `100 % near-black`, and
        `src/assets/frlg/sign.png` was **not** created or modified
        (`git status --porcelain src/assets/frlg/sign.png` is empty; `test -e` matches
        its state before the command).
  - [ ] `[unit]` The packer still passes on the real store:
        `ASSETS_ROOT=/home/runner/work/_temp/assets/store node scripts/frlg/build-sign.mjs`
        exits 0 and prints `wrote src/assets/frlg/sign.png 16x16`.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched
        (`git diff --name-only main...task-165`), and the diffs of
        `src/data/tilesets/props.ts` and `src/scenes/BootScene.ts` are **empty**.
  - [ ] `[live]` **No 24×24 square of the placeholder's own paint anywhere on the
        route.** On a worktree **without** the pack (`test ! -e
        src/assets/frlg/sign.png`, so `PROP_SIGN_URL` is the placeholder), dev server
        (`npm run dev -- --port <free> --strictPort`) in headless Chromium at
        **1280×800**, start a run and reach the route's **boss room** (the dev-only
        `#debug-menu` floor/room teleport controls, or walk to the boss door). Then, in
        the page, read `renderer.snapshotArea(0, 0, 1280, 800)` + `getImageData` and
        scan every 24×24 window: a window **matches** when its outer 1-px ring
        (92 px) is at least **60 %** the placeholder border colour `#7888A0`
        (120,136,160) **and** its central 10×10 region is at least **90 %** the
        placeholder fill colour `#3A4252` (58,66,82). Pass when the number of matching
        windows is **0**. Before the fix the sign's cell matches exactly (it is a
        24×24 opaque placeholder block scaled 1.5×), and no ground, wall or UI window
        matches either state, because a big placeholder atlas only carries the border
        on its own sheet edge. Report the match count and, if non-zero, each match's
        top-left coordinate.

## 📣 Coordination

- **For the next batch:** a placeholder is **art**, not a swatch: any atlas whose
  fallback would read as a wrong object (not just a missing texture) gets its own
  branch in `build-placeholders.mjs` before the generic fill. Packers take their source
  through `ASSETS_ROOT`/`assetPath` only, and a packer that can silently ship a flat
  crop owes a uniformity guard with a named threshold, like this one.
- **For Task QA:** the `[live]` scan is the only browser work; the two packer gates and
  `npm test -- props` are seconds. Delete `/tmp/sign-guard` afterwards and leave
  `src/assets/frlg/sign.png` in whatever state the positive gate left it (gitignored,
  never committed).
- **For the Orchestrator:** `props.ts` and `BootScene.ts` are claimed but expected to
  end up unchanged; the Task QA audit must accept a diff that omits them. The only
  committed binary in the diff is the placeholder PNG.

## ⛔ Out of scope

- No new prop, no new atlas cell, no change to `PROP_SIGN_*` exports, no new i18n key.
- No re-crop of the real sign from the store and no committed packed atlas; no change to
  `scripts/assets/pack.mjs`, `scripts/assets/root.mjs` or `package.json`.
- No placeholder redesign for any other atlas (only `frlg/sign.png` gets a branch).
- No change to `RouteScene.drawSigns` (read-only, 2142-2154), to the sign's depth
  (`5`) or its 24 px scale.
- No `SAVE_VERSION` step and no new run field.
