# HUD fidelity: what the board actually says

Status: **analysis** (2026-10-21), measured on the live Figma file `pkm-randomlike`, page `Page 1`,
through the figma-edit bridge. It does not restate `D49` (`docs/tech-decisions.md`); it is the
evidence behind it and the reference every Phase 12 task measures against. No code, no assets and no
decisions live here — when a number contradicts the board, the board wins and this file is corrected.

## 1. The inventory, measured

**66 top-level frames**: 33 desktop at 1280×800 and 33 mobile at 390×844, plus their labels. 3,884
nodes, **1,302 of them text**. The frame → node map is §6; it saves every task three MCP calls.

## 2. Typography: two families, ten sizes, tight boxes

The board uses **Silkscreen Regular and Silkscreen Bold and nothing else** (733 Bold, 569 Regular).
The ten sizes in use are 8, 9, 10, 11, 12, 13, 14, 16, 18, 20 and 24 px, and **each size carries a
fixed box height**, which is what makes "identical" measurable:

| size  | box height | ratio | where it is the usual choice                    |
| ----- | ---------- | ----- | ----------------------------------------------- |
| 8 px  | 10 px      | 1.25  | tags, dense metadata                            |
| 9 px  | 12 px      | 1.33  | values, meta lines, chips                       |
| 10 px | 13 px      | 1.30  | **row labels and buttons, the board's default** |
| 11 px | 15 px      | 1.36  | chip letters                                    |
| 12 px | 15 px      | 1.25  | names, small titles                             |
| 14 px | 18 px      | 1.29  | section numbers                                 |
| 16 px | 20 px      | 1.25  | readouts                                        |
| 18 px | 23 px      | 1.28  | panel titles                                    |
| 20 px | 26 px      | 1.30  | display                                         |
| 24 px | 31 px      | 1.29  | hero numbers                                    |

**Consequence for CSS.** `line-height` is pinned **in px per size** (10/13, 9/12, 18/23, …), never as
a unitless ratio: a ratio drifts by 1–2 px per row and the 2 px gate fails on every list. The board's
text boxes are the line box, so a row's `top` is the box top, not the baseline.

**Consequence for the diff.** Figma outlines text in its SVG export (§3), so a glyph-for-glyph
comparison is impossible by construction. Both sides are rasterised at `deviceScaleFactor: 2`
(Figma's PNG at scale 2, the browser at DPR 2), which puts glyph anti-aliasing on the same footing;
the gate still measures text on its **box and colour**, and geometry pixel by pixel.

## 3. Export: the SVG is paint, the JSON is text

Measured on `M 02 Options` (`8:3231`): the SVG carries 2 `<rect>`, 0 `<text>` and the panel as a
masked path. Figma converts every string to outlines. So:

- `<slug>.svg` gives **geometry and paint** (coordinates, fills, strokes, radii) and is diffable.
- `<slug>.json` is the **only** source of strings, family, size and box. Any task that renders text
  from the SVG alone will ship frozen labels.
- A panel's `stroke-width="2"` in the SVG is a **centred stroke clipped by its own mask**: the real
  border is 1 px **inside**. Copying the SVG number doubles every border.

## 4. Palette and chrome, measured across all 66 frames

| token            | value                                                           | uses         |
| ---------------- | --------------------------------------------------------------- | ------------ |
| muted            | `#94A3B8`                                                       | 451          |
| ink              | `#F8FAFC`                                                       | 302          |
| primary          | `#F1F5F9`                                                       | 253          |
| accent           | `#7DD3FC`                                                       | 169          |
| secondary        | `#CBD5E1`                                                       | 108          |
| board background | `#05070C`                                                       | 43           |
| panel            | `#10161F` at **72 %, 90 % and 92 %**                            | 41 / 21 / 88 |
| sheet            | `#0B1017` at 70 %                                               | 35           |
| warning          | `#FBBF24`                                                       | 28           |
| hairlines        | `#FFFFFF` at 2, 3, 4, 6, 7, 8, 10, 12, 14, 16, 18, 22, 50, 55 % | —            |

**Corrections to the proposal's token block.** `#F8FAFC` (ink) is missing there, `faint #475569`
appears in the proposal but not in the board's top fourteen, and the panel is **three** alphas, not
one. `tokens.json` must be generated from these, not typed from the proposal.

**Radii**, by frequency: **8** (497 — rows, cards, tiles), **6** (208 — chips and compact rows), **11**
(88 — every dialog panel), 12 (15 — the full-height mobile panel and the toggle), 16 (6 — sheets),
plus 1–4 for rules and pips.

**Strokes**: 1 px almost always (`#FFFFFF` at 8, 16, 10, 14 %; `#7DD3FC` solid for the armed row);
`#94A3B8` at 1.4 px 22 times (the type-icon ring) and `#FFFFFF` at 50 % **3 px** 12 times — that is
the touch pad, the only 3 px stroke on the board.

## 5. Panel geometry: the rules the frames actually follow

**Desktop.** A dialog is a 460, 560, 640, 720 or 760 px card with radius 11, a 1 px hairline at 16 %
and a **1 px highlight** 12 px inside its top edge (`(x+12, y+12, w-24, 1)`, white at 8 %). Measured:
menu card 460×362 at (724,236); reward 560×342 at (360,196); trade 760×560 at (260,120); run over
720×480 at (280,170); shop 656×164 at (312,364); battle panels 368×100 at (64,48) and (64,660);
message box 576×216 at (664,544); starter cards 260×320.

**Mobile.** The panel is **374 px wide at x = 8**, radius 11, and it is _either_ vertically centred
(`M 02 Options` 374×302 at (8,271)) _or_ a full-height screen **374×750 at (8,47)** with radius 12 —
which is the safe area, 47 top and 810 bottom, for the first time. Exceptions, both deliberate: the
route window in `M 01b` is 358×240 at x=16, and the battle panels keep the desktop 1:1 clone.

**Chips.** A 26×26 badge at the panel's left edge, `#10161F` at 90 %, white 22 % border, radius 6,
**the initial only** at 11 px Bold (`M`, `I`, `P`, `C`, `S`), cyan border when active.

**The pad** (unchanged, for `[Task-139]`): 156×156 at (103,741), A at (334,767) r35, B at (235,788)
r35, 3 px white at 50 %, letters at 32 px white 60.

## 6. Frame → node map

Every Phase 12 task takes its frames from here; the desktop id is the first column, the mobile one the
second.

| frame                            | desktop  | mobile    |
| -------------------------------- | -------- | --------- |
| 01 Main menu                     | `1:1556` | `8:3230`  |
| 01b Main menu · no save          | `4:1057` | `8:3239`  |
| 02 Options                       | `1:1557` | `8:3231`  |
| 03 Route HUD                     | `1:1558` | `8:3232`  |
| 03b Panels · row view            | `2:6`    | `8:3862`  |
| 03c Panels · compress            | `2:466`  | `8:3810`  |
| 03d Route · shop · buy           | `5:1114` | `8:3240`  |
| 03e Route · shop · sell          | `5:1276` | `11:5062` |
| 03f Panels · reward item         | `6:1447` | `8:3449`  |
| 03g Panels · reward pokemon      | `6:1468` | `8:3517`  |
| 03h Panels · rocket slots        | `6:1485` | `8:3245`  |
| 03i Panels · trade pick          | `6:1505` | `8:3246`  |
| 03j Panels · trade result        | `6:1559` | `8:3247`  |
| 03k Panels · notice item         | `6:1573` | `8:3248`  |
| 03l Panels · notice level up     | `6:1579` | `8:3249`  |
| 03m Panels · pokemon moves       | `6:1596` | `8:3250`  |
| 03n Panels · pause menu          | `6:2217` | `8:3571`  |
| 03o Panels · map routes          | `6:2250` | `8:3255`  |
| 03p Panels · pc rip              | `6:2525` | `8:3625`  |
| 04 Starter pick                  | `6:1416` | `8:3242`  |
| 05 Battle HUD                    | `1:1560` | `8:3233`  |
| 05b Battle · message             | `2:569`  | `8:4036`  |
| 05c Battle · bag                 | `2:702`  | `8:4119`  |
| 05d Battle · pokemon             | `4:855`  | `8:4221`  |
| 05e Battle · stats               | `6:1879` | `8:4304`  |
| 06 Run over · defeat             | `6:2171` | `8:3252`  |
| 07 Run over · victory            | `6:2172` | `8:4447`  |
| 07b Run over · victory · pokemon | `6:2440` | `8:4674`  |
| 08 Stats · totals                | `7:2663` | `8:3258`  |
| 08b Stats · runs                 | `7:2750` | `8:3259`  |
| 08c Stats · pokemon              | `7:2867` | `11:5218` |
| 09 Ranking                       | `7:2985` | `8:3261`  |
| 09b Ranking · pokemon            | `7:3095` | `11:5286` |

## 7. What this analysis changes in the plan

1. **`tokens.json` is generated from the measurement above**, not from the proposal's block: the type
   scale is ten sizes with ten line boxes, the panel has three alphas, and the ink is `#F8FAFC`.
2. **`[Task-122]`'s export writes three artifacts per frame and remembers which one carries text.** The
   SVG is paint, the JSON is text, the PNG is the diff's reference.
3. **`[Task-125]`'s kit is smaller than it looked**: `Panel` (r11 + hairline + 1 px highlight), `Row`
   (r6/r8, 4 %/3 % fill, 8 % border), `Chip` (26×26, r6), `Sheet` (r16, handle), `Button` (10 Bold, r9
   or r10), `Meta` (9 px muted) and `TypeBadge`. Nothing else repeats on the board.
4. **Each screen's fixture is the frame's own copy**, so `?hudFixture=<slug>` compares the same
   strings; and the frame map above is what the fixture names come from.
5. **The pad and the battle damage numbers stay open** — `[Task-139]` decides the pad, and `D49` keeps
   the floating numbers in the canvas until a sprite→screen projection exists.

## 8. What "identical" can and cannot mean

**Can be identical**, and is measured every time: panel edges, radii, row pitch, chip boxes, button
boxes, fills, borders, the highlight line, the pad's geometry, and every string's box and colour at
both viewports.

**Cannot be identical**, and the gate does not pretend otherwise: the shape of each glyph's
anti-aliased edge. Figma and the browser are different rasterisers; a per-pixel text comparison would
measure the renderer, not the layout, and would turn every screen into a tuning treadmill. That is why
`D49` splits the gate: **geometry pixel by pixel, text by box and colour**.
