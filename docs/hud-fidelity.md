# HUD fidelity: what the board actually says

Status: **analysis** (2026-10-21), measured on the live Figma file `pkm-randomlike`, page `Page 1`,
through the figma-edit bridge. It does not restate `D49` (`docs/tech-decisions.md`); it is the
evidence behind it and the reference a panel's copy is read against. The measured pixel gate it once
fed retired with `D57`: identity is read from `design/screens/<slug>.json` through
`node scripts/design/check.mjs`, and the table below is that gate's record, not a live criterion. No
code, no assets and no decisions live here — when a number contradicts the board, the board wins and
this file is corrected.

## 1. The inventory, measured

**66 top-level frames**: 33 desktop at 1280×800 and 33 mobile at 390×844, plus their labels. 3,884
nodes, **1,302 of them text**. The frame → node map is §6; it saves every task three MCP calls.

## 2. Typography: two families, ten sizes, tight boxes

The board uses **Silkscreen Regular and Silkscreen Bold and nothing else** (733 Bold, 569 Regular).
The kit is built on **ten box sizes** — 8, 9, 10, 11, 12, 14, 16, 18, 20 and 24 px — and **each size
carries a fixed box height**, which is what makes "identical" measurable. The export of the 66
viewports finds eighteen sizes in use (7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32, 38
and 40 px); `design/tokens.json` carries all of them in `scale`, and the ten below are the ones the kit
draws:

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

| token            | value                                                           | uses          |
| ---------------- | --------------------------------------------------------------- | ------------- |
| muted            | `#94A3B8`                                                       | 451           |
| ink              | `#F8FAFC`                                                       | 302           |
| primary          | `#F1F5F9`                                                       | 253           |
| accent           | `#7DD3FC`                                                       | 169           |
| secondary        | `#CBD5E1`                                                       | 108           |
| board background | `#05070C`                                                       | 43            |
| panel            | `#10161F` at **72 %, 86 %, 88 %, 90 %, 92 %, 96 % and 100 %**   | 41+ / 21 / 88 |
| sheet            | `#0B1017` at 70 %                                               | 35            |
| warning          | `#FBBF24`                                                       | 28            |
| hairlines        | `#FFFFFF` at 2, 3, 4, 6, 7, 8, 10, 12, 14, 16, 18, 22, 50, 55 % | —             |

**Corrections to the proposal's token block.** `#F8FAFC` (ink) is missing there, `faint #475569`
appears in the proposal but not in the board's top fourteen, and the panel is **not one alpha**: the
export measures seven between 72 % and 100 %, and `design/tokens.json` lists them in `panel.alphas`
while pinning 72 % as the default. `tokens.json` must be generated from these, not typed from the
proposal.

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

**A panel's chip and its compressed state.** Every route card — the map header, PARTY, the bag, the
PC box and the member detail window — hangs in one shared frame, and its chip is the badge above,
unchanged: **26 × 26** at the card's own top-left corner, the initial at 11/15 px bold, and the
panel's name plus its **live quick key** as the accessible label, so a rebind is announced and not
painted. The chip is two controls in one: a press that does not move **collapses** the card — the
same toggle its quick key runs — and a press that moves it **drags** the whole card, the chip riding
along with it because the frame moves the card and its chip together and paints no position of its
own. The drag is **clamped**: the card's default rect is measured once per gesture and the offset is
cut so `left` stays `≥ 0` and `right ≤` the window, and a card wider (or taller) than the window
takes **no** offset on that axis rather than hanging off it. A **collapsed** card paints nothing of
its own, chip included — the strip's edge chip is its compressed form, and two layers never draw the
same object twice. The offset (`dx`, `dy`) and the collapsed flag are the panel's own `hudLayout`
record (`D22`), which is what a reload restores; the board draws no chip for the member detail
window, so that card keeps its own way back and takes only the saved offset.

**A collapsed panel's badge is the same gesture.** The strip's edge chip is dragged by the same
rule the card's chip is — one `DRAG_SLOP` and one clamp (`panels/hud/drag.ts`), never a second
port — and its commit writes the same `{ dx, dy }` of the same `hudLayout` record, so the reopened
card inherits the offset and a reload restores it. A press that travels under the slop is still the
toggle on both. On a phone the frame's measured slots are the **origins** the saved offset is added
to, never a position an offset replaces: the badge sits at `slot + {dx, dy}`, while a wider window
keeps the dock the panel's own dock rule gives it. Both drags are clamped so the badge stays inside
the window less its 26 px, and two badges may overlap — the last drag wins the draw order, with no
snapping.

**The detail card's three-tab row.** The member detail card carries three tabs, `STATS · EVOLUTION ·
MOVES`, on one row: three boxes **26 px** tall at `y = 72` in the card's own coordinates, with a
**4 px** gap between two of them and the card's own lateral padding at both ends — **20 px** on the
460 px desktop card, **12 px** on the 374 px phone one. The first two boxes take
`floor((inner − 2 × 4) / 3)`, the third takes the remainder, so the row ends exactly on the card's
inner right edge: at **1280×800** the three are `{128, 144, 137, 26}`, `{269, 144, 137, 26}` and
`{410, 144, 138, 26}` in page coordinates, and at **390×844** `{20, 144, 114, 26}`,
`{138, 144, 114, 26}`, `{256, 144, 114, 26}`. Each box is a row-filled button with the 1 px row
border, the active one on the accent `#7DD3FC` at a 16 % tint with the accent as its border, and its
label is the chip type size in uppercase. The boxes come from the view model
(`detailPanelView(...).tabs`), never from a grid template, so a fourth tab is one array entry in
`DETAIL_TABS` and one label key.

**The main menu's glow.** `01` / `01b` draw the backdrop as a soft radial glow, never a flat oval:
the ellipse is **1000 × 720 at (−180, −140)** — stage coordinates, so it runs off the page's left and
top edges — painted by one `radial-gradient(closest-side, …)` whose stops are the accent `#7DD3FC`
at **22 %** in the centre, **10 %** at 45 % of the radius and **0 %** at the rim. `closest-side`
gives the gradient the box's own **500 × 360** radii, so it fills the ellipse the retired
`border-radius: 50%` box drew, with the falloff the board's frame has and a rim that reaches nothing.
Its mean is the frame's measured 10 %, which is why the centre stops at 22 %. The box and the three
stops are the view model's data (`MAIN_MENU_GLOW` in `panels/main-menu/view.ts`, painted by
`glowBackground`), so `main-menu.css` keeps **only** the layer's `position: absolute` and a repaint
cannot drift from the frame; the phone frames draw no glow at all.

**The pad** (unchanged, for `[Task-139]`): 156×156 at (103,741), A at (334,767) r35, B at (235,788)
r35, 3 px white at 50 %, letters at 32 px white 60.

**Battle zones.** At 1280×800 the HP column is one 368 px card at x = 64 — a right edge of **432** — and a
partner never leaves its side's column: the foe's stacks 8 px under its lead and the player's 8 px above its
own, so a double keeps the single's right edge. The battle menu card therefore starts at **440** (the column's
right edge plus the 8 px gutter) and keeps the shipped right edge, 1004: 564 wide, and no `[data-hud-hp]` box
can be drawn behind it. On a phone the card keeps its shipped full-width rect under both boxes (390×844 →
x 16, 358×236 at y 592). **The command window is that same card**: FIGHT / BAG / SWITCH / RUN is painted at
`battleMovesBox`'s rect (440 → 1004 at 1280×800, the 358×236 phone card at 390×844), so its four cells occupy
the boxes the four move cells occupy — 219×72 in the desk's 2×2, 116×94 on the phone — and its fifth **INFO**
control takes the same 62 px column the moves menu keeps for MEGA and G-MAX. **The message box is that
same window**: the feed paints the menu's live card (`battleMovesBox`'s rect) and its two lines on the
frame's insets inside it, so a menu opening swaps the lines for the rows and never resizes or moves the
window; the board's own 576×216 at (664,544) is the copy the live box replaces. The category is drawn as the
atlas glyph in the box `[Task-203]`'s §5 blocks describe (`MOVE_ICON_BOX`), not as a right-aligned word, so a
category cannot run under a button. No cell carries one: the card above the menu describes the cursor's own
cell. The foe's box also carries the trainer's remaining team as a **ball row**: one 16 px
ball per **fielded** member, 4 px apart, its top edge 8 px under that box's bottom edge — 56 px wide at (64,156)
at 1280×800 and at (16,104) on the phone — so it never meets the player's card or the battle menu card. A spent
ball keeps its cell at 35 % opacity, so the row counts the team the trainer fielded, and a wild battle draws no
row at all.

**A cell's text is bounded by its own box.** Every label in a battle move cell is measured against the font
the panel actually draws with — `font.json`'s advances at `--hud-type-body-size` — never a per-glyph
constant: **the name takes the cell's own remaining width** — its content box less the category glyph's
24 px square and the 8 px gap beside it, one count of each (**162 px** in the 222 px cell at 1280×800) — and
is cut to that width with an ellipsis (the move card keeps the whole name), while the type badge is a
**24×24 square in the stat gutter**, its right edge one gap past the name's left column so the stat lines
start clear of it and no type can charge the move's name for its own width. The category is the atlas glyph
in a **24 px square that ends on the cell's own right padding edge**, at the cell's first text row: that
square is the whole column, so nothing prints right-aligned and `PHYSICAL` / `SPECIAL` / `STATUS` are never
drawn as words. A box that merely avoids its neighbour is not enough — the retired text column shipped 48 px
wide against a 56 px label and the string ran under the button it shared the row with; the glyph cannot
spill, because the frame is FIT into its square (32×14 becomes 24×10.5) and clipped to the frame's own band,
so a badge never paints the rows above or below it. A wide cell narrower than the 52 px the glyph's square
and the cell's two paddings need — the 222 px cell at 1280×800 is the narrowest one shipped — gives the name
what is left of it, and the move card is where its whole text stays readable; the phone card's 119 px cell
takes the compact geometry below.

**The move card.** The menu's own `attack detail`: **one 160 px card**, 20 px in from the menu's sides, that
always describes the cell the cursor is on — the move's name, its type badge, its category glyph and its
`PP` / `PWR` / `ACC`, then its description. It has no ⓘ to open because no cell carries a button any more:
the cursor is the info intent, and the freed 22 px button and its 8 px gap went back to the name. The wide
anchor is the menu's own top edge — `x = card.x + 20`, `y = card.y − 8 − 160`, `w = card.w − 40`, `h = 160`,
which is `{460,414,524,160}` at 1280×800: its bottom 8 px above the menu, in the empty band between the
foe's boxes (bottom 148) and the player's (top 660). It hangs off the menu's top edge rather than the board's
own (664,372) offset because this menu starts at 440 where the board's starts at 664. On the phone the card
**cedes its right rail** to the stage grid instead of spanning the menu: it keeps its 20 px left margin and
its `COMPACT_CARD_CLEARANCE` — the 88 px between the menu's top edge and the player's lead box — and stops
`COMPACT_CARD_RAIL_W` short of that column's right edge, where the rail (122: three 34 px chips, their two
6 px gaps and the grid's own 8 px clearance) is the grid's. So it is `{36,336,216,160}` at 390×844, its
right edge **252** and its bottom 8 px above the box at 504, and it clears the grid whatever the chip count:
the widest box is `{260,422,114,74}`, the one-chip box `{340,462,34,34}`, both right-aligned to 374, and
252 + 8 = 260 is exactly the widest one's left edge. The board backs the rail — `05` draws its chips at
448…562, left of its card at 664, and `m05` draws no card at all. The card takes no pointer event, and its
description scrolls inside the 160 px: the text never grows the box.

**The compact battle has its own cell.** At 390×844 the menu card keeps its shipped rect — 358×236 at
(16,592), starting 8 px under the player's 358×80 card at y 504…584, so no HP box is drawn behind it — but
its four cells are 119×94 and paint **six stacked lines** instead of the wide three: the type badge takes
the first row, the category glyph the second line's **13 px band**, ending on the content box's right edge
(24 px wide, its frame drawn 24×10.5, and it clears the name line under it), and the name, PP, power and
accuracy each get a full **91 px** line of their own — one label a line, because `PP 15/15` (55 px) and
`PWR 90` (50 px) side by side are 105 px with their gap in a 91 px content box, and because the accuracy
cannot share the name's line either: `ACC 300 ↑` is 67.5 px and its 8 px gap would leave the name 15 of
those 91 px, under the 40 px a name column needs. The category column is the glyph and nothing else: the
compact cell's `categoryLabel` is `''` — its label set is type chip · name · PP · PWR · accuracy — while
the wide cell's is the word it carries, and a cell paints a word only where its own column is wide enough
for it: **a cell never reserves a column it cannot paint**. In both width classes every label is painted at
the box `cellTextBoxes` measures for it (`BattleMoveSlotView.boxes`) and both atlas squares at their own
`typeBox` / `categoryBox`, instead of at a stylesheet grid, so a cell's text is bounded by its own model
rect: the name is the one line that is ever cut — 91 px at 390 against the 162 px the wide 222 px cell
gives it — and nothing else needs eliding. The stack needs a **52 px** cell (its two 14 px paddings and the
24 px glyph column), so a stage under 256 px is below what this panel is asked to draw.

**The target step's prompt.** The row is **22 px** tall (`MOVE_TARGET_H`) and lives inside the card's top
band — `x = card.x + 20`, `y = card.y + 1`, `w = card.w − 40`, `h = 22` on both widths — so it ends **1 px**
above the first cell (the grid starts at the card's 16 px padding plus its 8 px inset) and is one line that
never meets the four cells at 1280×800 or 390×844; it prints the marked foe's name and nothing else.

**The route header's readouts.** The party card's 82 px header prints three readouts and nothing else: the
squad's level line at `(32, 16, 186, 20)` (`Lv12` for a level-12 squad), the shared XP **bar alone** at
`(32, 38, 186, 8)` — no digits painted beside it, so the number lives in the bar's accessible label
(`D45`/§10.1: a fill is never the only carrier) — and the Pokevial at `(75, 54, 100, 20)`. The vial fills one
step per charge (three `--party-vial-fill-*` colours, a spent or absent vial painting **no** fill at all, two
charges painting 66.67 px of the 100 px track), and that step is the **model's own** — `VIAL_STEPS = 3` and
`vialStep(charges, max)` in the panel's view, clamped to `0…min(VIAL_STEPS, max)` — never recomputed by the
component, so a repaint and the meter cannot drift.

**The stage grid.** The player lead's stat changes are a grid of 34×34 chips, 6 px apart, three to a row,
green (the frame's `#4ADE80` at 14 % fill / 60 % stroke) for a raise and red (`#F87171`, the same alphas) for
a drop, and no grid at all while every stage is zero. The board draws its chips at `(448, 673)`, inside the
576 px gap its own menu leaves between the HP column (ending at 432) and the card (starting at 664); the
shipped card starts at **440** here, so that origin is inside the moves grid and cannot be used — the grid is
anchored to the player's HP column instead, right-aligned to that column's own right edge (432 at 1280×800,
374 at 390×844) and 8 px above its topmost box: one chip is `(398, 618, 34, 34)`, two `(358, 618, 74, 34)`,
six `(318, 578, 114, 74)` and seven `(318, 538, 114, 114)` (three rows) on the desktop, and one
`(340, 462, 34, 34)` with six `(260, 422, 114, 74)` on the phone. A double anchors the grid above the
**partner** box (552 at 1280×800, 416 at 390×844) even though only the lead's chips are drawn, so the grid is
never painted over its own partner. The chip paints a 13 px sign over a 7 px label, and the sign is what
carries the direction — `+2`, `-1` — so the colour is never the only carrier (`D45`).

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

**The figure's rule.** Every figure of `08` / `m08` draws the `stat N rule` rectangle — **1 px**, white
at **8 %** (`--stats-rule`, never a new alpha), **320 px** at x `120` / `480` / `840` on the desk and
**165 px** at x `32` / `201` on the phone, with an **88 px** row pitch (desk) and **62 px** (phone). The
run list and the Pokémon table carry the same 1 px rule flush with the bottom of each row card (no frame
node — the row cards are the frame's own node there), and a new figure inherits the rule by being a
figure.

**The move icons.** A move's type and category are drawn from the two packed atlases and never as words:
`move chip N` / `move category N` is a **24×24 box** with an `IMAGE` fill, `scaleMode: FIT`, so the frame
is contained and centred (32×14 becomes 24×10.5 in that square). The background is the **whole atlas
scaled**, moved by the frame's column and row and **clipped to the frame's own band**, so a badge never
paints the rows above or below it; `moveIcons.tsx` carries that arithmetic (`spriteBox`) and the two
resolvers. The frames, read from the two manifests:

| badge                            | frames                                                                                                                                                                                                    | grid                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| type (`type-icons.png`)          | 19, dex order: normal 0, fighting 1, flying 2, poison 3, ground 4, rock 5, bug 6, ghost 7, steel 8, unknown 9, fire 10, water 11, grass 12, electric 13, psychic 14, ice 15, dragon 16, dark 17, fairy 18 | 4 columns × 5 rows, 32×14 a frame |
| category (`move-categories.png`) | Physical 0, Special 1, Status 2                                                                                                                                                                           | 1 row of 3, 32×14 a frame         |

They are painted in the battle's four cells (`typeBox` / `categoryBox`), in the battle's description
card head, in the detail panel's four move cells and — the type badge alone, since a pool row carries no
category — in the detail's learnset pool row. A name the atlas does not carry falls back to the word,
never to an empty box.

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

## 9. Portraits in the DOM HUD

A portrait in the DOM HUD is **one cell of `public/anil/portraits.png`** (64 × 64, 32 columns,
dex order) drawn by CSS background arithmetic, never a Phaser texture read and never a `fetch`.
`src/ui/hud/portrait.ts` is the one seam: `portraitCrop` turns a species id into the atlas URL
plus that cell's `col`/`row`, and `portraitBackground(crop, box)` returns the inline style that
scales the whole sheet to the box — `background-size: <cols × box>px auto` and
`background-position: -<col × box>px -<row × box>px` — so a 26 px desk cell and a 22 px phone
cell are the same arithmetic at two sizes. The sheet is gitignored local art, so the panel stays
synchronous and measurable headlessly: the model carries the cell, the browser rasterises it.

The empty 4 % box with its 1 px hairline is **only the fallback**, for a species the atlas does
not name (an id outside the manifest, a Mega with no cell of its own and no base, or a party row
with no species id). A panel that has a crop never paints the empty box.

The main menu's compact footer is **two rows** on the phone. At ≤ 600 px the three record blocks
leave the desk's single row (`01`'s columns 96 / 240 / 724) and wrap: WINS and MAX ELITE STRIKE
share the first row and MONTHLY MAX STRIKE sits under them, one block 172 × 48 at x = 16 and
196, the second row 8 px below the first. The rects are data — `MAIN_MENU_FOOTER_NARROW` in
`src/ui/hud/panels/main-menu/view.ts` — and the stylesheet's compact block draws exactly those
numbers, so no label can run into the block beside it. The desk footer is unchanged.

The three figures are **live**, not the frame's copy: `mainMenuStats` in
`src/ui/hud/panels/main-menu/view.ts` prints WINS (every finished run won), MAX ELITE
STRIKE (the deepest floor a finite run reached) and MONTHLY MAX STRIKE (the deepest floor
a finite run reached in the current UTC month) from the run-history store, and the month
itself prints under the monthly figure where the board prints a record holder's name. On
a fresh profile the labels and zeroes still draw, never a blank. The desk frame's
bottom-right version line is build metadata: `menuVersionLabel` in
`src/ui/hud/panels/main-menu/version.ts` assembles `v<package.json version> · PHASE
<phase>`, identical in every locale, and the phone block hides the line because neither
phone frame draws one.

The main menu's narrow CONTINUE row carries **one** secondary datum: the party's portraits.
At 390×844 the row is 326 × 48 at (32, 402) and the four 22 px cells (pitch 25) fill
x 258..355, everything to the right of the CONTINUE label, so the map/biome value is
**absent** there — not elided to fewer letters and not moved into a tooltip.
`forLayout(view, 'compact')` in `src/ui/hud/panels/main-menu/view.ts` is the seam: it drops
that one row's `value` (`runPositionLabel`, which the STATS and route HUDs still read) and
its `valueBox` and returns every other field, row and the portrait list unchanged, and the
panel applies it from `MAIN_MENU_NARROW_QUERY`, so a resize flips the row without the scene
re-mounting it. The empty-value rule paints no node at all, which is what keeps the label off
the screen. The desk frame keeps both fields: `forLayout(view, 'wide')` returns the very same
object.

**The desk row's label is bounded by its portraits.** On the desk (`01`, 420 × 54 at
(744, 300)) the same row reserves its portraits' block at the row's own 6 px right inset —
the four 26 px cells at a 30 px pitch fill x 1042..1158, and the cell size, pitch and top stay
the frame's. The block is the row's, so the map/biome label can only own the strip to its
left: from the CONTINUE label's measured end plus the kit's 8 px gutter to one gutter before
the block, 124 px with four members and 214 px with one, in `valueBox` and `portraitsBox` on
the view (`mainMenuPortraitsBox` / `elideValue`). The label is elided with `…` against the
Silkscreen advance at the value's 12 px, so **no glyph of a map name is ever painted under a
party cell**: a four-member save on `Map 1 · Deep Forest` paints `MAP 1 · DEEP F…` at
x 910..1034 — 8 px clear of the block and 4 px clear of the word CONTINUE — where the same
row used to paint its first glyphs 26 px beneath the fourth portrait. The value keeps its
`main-menu__value` node, class and right alignment; the box it is handed is the only bound,
and the 12 px string never needs clipping.

**The party card's rows.** The route card's `party__portrait` cell is **45 px** and uses the same
`portraitCrop`/`portraitBackground` arithmetic as the 26 px desk and 22 px phone cells, so the sheet
scales to `<32 × 45>px auto` — a `1440px auto` background-size and a `-col × 45px` position; only a
species the atlas does not name (or a row with no id) keeps the empty 4 % box, and the dark mark
keeps its violet hairline. The row's HP fill starts at the track's left edge — the baked FRLG
track's 34.5 px inset retired — so a full bar paints edge to edge and a fractional one starts flush.

**The menu card's five rows.** The main menu's card draws five rows on the desk — CONTINUE, NEW
RUN, OPTIONS, STATS and RANKING — and four without a save (NEW RUN, OPTIONS, STATS, RANKING),
because `liveMainMenuView` in `src/ui/hud/panels/main-menu/view.ts` pushes RANKING even with no
run. RANKING is the STATS screen opened straight on its `ranking` mode: the row's label is the
existing `stats.actionRanking` string and its value is empty, so it paints no value node and no
portraits; the scene's `openStats('ranking')` mounts the very panel STATS mounts on `totals`, and
BACK returns to the menu. The board has no `01` node for a fifth row — it predates the row — so
the numbers below are data in the view, not a frame export.

The card's height is data: `MAIN_MENU_CARD_H` is `{ 4: 362, 5: 372 }` and
`MAIN_MENU_CARD_H_NARROW` is `{ 4: 264, 5: 275 }`, and `main-menu.css` draws exactly those
numbers in `.main-menu__card[data-rows='5']` (372 px, and 275 px inside `max-width: 600px`),
the wrapper's `data-rows` being `view.rows.length`. On the desk the card is
`padding: 63px 0 0 19px`, `gap: 8px` and 54 px rows at a 62 px pitch, so five rows need
`63 + 5·54 + 4·8 = 365` px: **372** puts the card's bottom at 608, 8 px above the footer's first
label at y 616. 424 — the 4-row height plus one pitch — would reach 660 and paint over the
MONTHLY MAX STRIKE figure. On the phone the card is `padding: 11px 0 0 23px`, `gap: 6px`, 48 px
rows at a 54 px pitch, so five rows need `11 + 5·48 + 4·6 = 275` px of content: **275** puts its
bottom at 665, 11 px above the footer's first block at 676, while 318 would collide. The card's
1 px border leaves 273 px of content box, so the rows carry `flex-shrink: 0` and stay 48 px on
the frame's 54 px pitch instead of squeezing to 47.6.

## The measured table

Status: **the retired gate's own evidence** (2026-10-27, branch `task-197`). One row per frame per
viewport, produced by the pixel harness on every desk frame of §6; it served the source, so no `dist`
build is involved. `design/diff/<slug>/report.json` is each run's artifact and is gitignored, so this
table is the record and its numbers are copied from those reports verbatim. **The gate itself retired
with `D57`**: identity is read from `design/screens/<slug>.json` through
`node scripts/design/check.mjs`, never from a pixel diff, and this table is kept as the measurement it
was. A `backlog` verdict is a screen nobody has built yet — work to do, never a failure.

**How the gate read a frame.** It booted the app, then waited for the page's own readiness —
`document.readyState === 'complete'`, the `#hud` layer present and `document.fonts.status === 'loaded'`,
polled every 100 ms against a 30 s budget — and settled for 1.2 s. Chromium was found at `CHROME_PATH`
when set, else `/usr/bin/google-chrome`, `-stable`, `/usr/bin/chromium`, `chromium-browser`, then the
Windows Chrome and Edge paths. Each measurement read the mounted roots (`[data-hud-panel]` plus the
five marker roots `[data-hud-starter]`, `[data-hud-strip]`, `[data-hud-battle-hp]`,
`[data-hud-battle-log]`, `[data-hud-run-over]`), named the screen the frame's fixture declares, and
**hid every other root before the capture**: the page mounts its live scene behind a fixture, so
without that one rule a frame's shot would be the main menu painted over the panel under test. A frame
that named a screen the page could not carry was never a pixel FAIL — it is a `backlog` row naming
the screen it needs, because a screen nobody has built yet is work to do, not a regression. `measured`
is the root the page actually carried, and the exit code stayed non-zero only when a compared row
failed.

**What a red row can mean.** The board's rasters carry the game's own screen inside them (the board
draws each panel over the route it belongs to, `design/README.md`), so a frame whose window holds a
painted scene can never be matched by a DOM-only shot: that row measures the panel _and_ the board's
scene, and its colour and geometry are dominated by the art the DOM does not draw (`01`, `01b`, `03n`,
`05b`, `05d`, `06`, `07`, `07b`). `01`/`01b` add the CONTINUE row's party portraits, which come from
the gitignored `public/anil/portraits.png` and are the documented empty 4 % box in a clean checkout. A
red row on a flat-backed frame is the panel itself, and that is the row to cut: `08`'s 155 px max is the
board's per-row rules and column separators plus the `SINCE … · ALL RUNS INCLUDED` meta line, none of
which the shipped panel draws; `04`'s 126 px max is one of its 80 matched edges landing 126 px away on
a 1 px-median card.

| frame                          | viewport | screen          | measured        | pixels differing    | geometry median / max (px) | colour flat ΔE | verdict                                                                         |
| ------------------------------ | -------- | --------------- | --------------- | ------------------- | -------------------------- | -------------- | ------------------------------------------------------------------------------- |
| `01-main-menu`                 | 1280x800 | `main-menu`     | `main-menu`     | 813,794 (19.87 %)   | 8 / 470                    | 13.41          | FAIL                                                                            |
| `01-main-menu`                 | 390x844  | `main-menu`     | `main-menu`     | 334,622 (25.41 %)   | 1 / 222                    | 19.22          | FAIL                                                                            |
| `01b-main-menu-no-save`        | 1280x800 | `main-menu`     | `main-menu`     | 811,420 (19.81 %)   | 6 / 470                    | 13.35          | FAIL                                                                            |
| `01b-main-menu-no-save`        | 390x844  | `main-menu`     | `main-menu`     | 333,881 (25.36 %)   | 10 / 238                   | 19.49          | FAIL                                                                            |
| `02-options`                   | 1280x800 | `options`       | `options`       | 4,061 (0.10 %)      | 0 / 1                      | 0.12           | PASS                                                                            |
| `02-options`                   | 390x844  | `options`       | `options`       | 1,914 (0.15 %)      | 0 / 2                      | 0.12           | PASS                                                                            |
| `03-route-hud`                 | 1280x800 | `hud`           | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "hud"`                                                   |
| `03-route-hud`                 | 390x844  | `hud`           | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "hud"`                                                   |
| `03b-panels-row-view`          | 1280x800 | `bag`           | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "bag"`                                                   |
| `03b-panels-row-view`          | 390x844  | `bag`           | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "bag"`                                                   |
| `03c-panels-compress`          | 1280x800 | —               | `none`          | —                   | —                          | —              | `not framed`: the compressed state lives in the saved layout, not in a HudState |
| `03c-panels-compress`          | 390x844  | —               | `none`          | —                   | —                          | —              | `not framed`: the compressed state lives in the saved layout, not in a HudState |
| `03d-route-shop-buy`           | 1280x800 | `shop`          | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "shop"`                                                  |
| `03d-route-shop-buy`           | 390x844  | `shop`          | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "shop"`                                                  |
| `03e-route-shop-sell`          | 1280x800 | `shop`          | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "shop"`                                                  |
| `03e-route-shop-sell`          | 390x844  | `shop`          | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "shop"`                                                  |
| `03f-panels-reward-item`       | 1280x800 | `rewards`       | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "rewards"`                                               |
| `03f-panels-reward-item`       | 390x844  | `rewards`       | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "rewards"`                                               |
| `03g-panels-reward-pokemon`    | 1280x800 | `rewards`       | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "rewards"`                                               |
| `03g-panels-reward-pokemon`    | 390x844  | `rewards`       | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "rewards"`                                               |
| `03h-panels-rocket-slots`      | 1280x800 | `rocket`        | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "rocket"`                                                |
| `03h-panels-rocket-slots`      | 390x844  | `rocket`        | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "rocket"`                                                |
| `03i-panels-trade-pick`        | 1280x800 | `trade`         | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "trade"`                                                 |
| `03i-panels-trade-pick`        | 390x844  | `trade`         | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "trade"`                                                 |
| `03j-panels-trade-result`      | 1280x800 | `trade`         | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "trade"`                                                 |
| `03j-panels-trade-result`      | 390x844  | `trade`         | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "trade"`                                                 |
| `03k-panels-notice-item`       | 1280x800 | `notices`       | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "notices"`                                               |
| `03k-panels-notice-item`       | 390x844  | `notices`       | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "notices"`                                               |
| `03l-panels-notice-level-up`   | 1280x800 | `notices`       | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "notices"`                                               |
| `03l-panels-notice-level-up`   | 390x844  | `notices`       | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "notices"`                                               |
| `03m-panels-pokemon-moves`     | 1280x800 | `detail`        | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "detail"`                                                |
| `03m-panels-pokemon-moves`     | 390x844  | `detail`        | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "detail"`                                                |
| `03n-panels-pause-menu`        | 1280x800 | `pause`         | `pause`         | 3,116,621 (76.09 %) | 456 / 888                  | 31.64          | FAIL                                                                            |
| `03n-panels-pause-menu`        | 390x844  | `pause`         | `pause`         | 295,219 (22.42 %)   | 6 / 184                    | 14.11          | FAIL                                                                            |
| `03o-panels-map-routes`        | 1280x800 | `header`        | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "header"`                                                |
| `03o-panels-map-routes`        | 390x844  | `header`        | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "header"`                                                |
| `03p-panels-pc-rip`            | 1280x800 | `pc`            | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "pc"`                                                    |
| `03p-panels-pc-rip`            | 390x844  | `pc`            | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "pc"`                                                    |
| `04-starter-pick`              | 1280x800 | `starter`       | `starter`       | 50,089 (1.22 %)     | 1 / 126                    | 0.82           | FAIL                                                                            |
| `04-starter-pick`              | 390x844  | `starter`       | `starter`       | 31,594 (2.40 %)     | 2 / 78                     | 1.45           | FAIL                                                                            |
| `05-battle-hud`                | 1280x800 | `battle-hp`     | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "battle-hp"`                                             |
| `05-battle-hud`                | 390x844  | `battle-hp`     | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "battle-hp"`                                             |
| `05b-battle-message`           | 1280x800 | `battle-log`    | `battle-log`    | 309,703 (7.56 %)    | 98 / 1200                  | 13.22          | FAIL                                                                            |
| `05b-battle-message`           | 390x844  | `battle-log`    | `battle-log`    | 119,994 (9.11 %)    | 107 / 1152                 | 11.26          | FAIL                                                                            |
| `05c-battle-bag`               | 1280x800 | `battle-bag`    | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "battle-bag"`                                            |
| `05c-battle-bag`               | 390x844  | `battle-bag`    | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "battle-bag"`                                            |
| `05d-battle-pokemon`           | 1280x800 | `battle-switch` | `battle-switch` | 459,134 (11.21 %)   | 74 / 1068                  | 14.13          | FAIL                                                                            |
| `05d-battle-pokemon`           | 390x844  | `battle-switch` | `battle-switch` | 197,857 (15.03 %)   | 25 / 1152                  | 13.71          | FAIL                                                                            |
| `05e-battle-stats`             | 1280x800 | `battle-switch` | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "battle-switch"`                                         |
| `05e-battle-stats`             | 390x844  | `battle-switch` | `main-menu`     | —                   | —                          | —              | `backlog: needs screen "battle-switch"`                                         |
| `06-run-over-defeat`           | 1280x800 | `run-over`      | `run-over`      | 545,884 (13.33 %)   | 0 / 496                    | 11.24          | FAIL                                                                            |
| `06-run-over-defeat`           | 390x844  | `run-over`      | `run-over`      | 105,702 (8.03 %)    | 5 / 74                     | 7.68           | FAIL                                                                            |
| `07-run-over-victory`          | 1280x800 | `run-over`      | `run-over`      | 551,283 (13.46 %)   | 0 / 38                     | 11.30          | FAIL                                                                            |
| `07-run-over-victory`          | 390x844  | `run-over`      | `run-over`      | 99,810 (7.58 %)     | 0 / 92                     | 6.57           | FAIL                                                                            |
| `07b-run-over-victory-pokemon` | 1280x800 | `run-over`      | `run-over`      | 594,173 (14.51 %)   | 0 / 91                     | 11.77          | FAIL                                                                            |
| `07b-run-over-victory-pokemon` | 390x844  | `run-over`      | `run-over`      | 105,559 (8.02 %)    | 1 / 53                     | 6.94           | FAIL                                                                            |
| `08-stats-totals`              | 1280x800 | `stats`         | `stats`         | 68,115 (1.66 %)     | 2 / 155                    | 1.45           | FAIL                                                                            |
| `08-stats-totals`              | 390x844  | `stats`         | `stats`         | 26,641 (2.02 %)     | 1 / 152                    | 2.29           | FAIL                                                                            |
| `08b-stats-runs`               | 1280x800 | `stats`         | `stats`         | 61,993 (1.51 %)     | 38 / 217                   | 1.10           | FAIL                                                                            |
| `08b-stats-runs`               | 390x844  | `stats`         | `stats`         | 64,868 (4.93 %)     | 16 / 118                   | 4.70           | FAIL                                                                            |
| `08c-stats-pokemon`            | 1280x800 | `stats`         | `stats`         | 53,348 (1.30 %)     | 2 / 120                    | 1.09           | FAIL                                                                            |
| `08c-stats-pokemon`            | 390x844  | `stats`         | `stats`         | 61,226 (4.65 %)     | 4 / 72                     | 4.75           | FAIL                                                                            |
| `09-ranking`                   | 1280x800 | `stats`         | `stats`         | 45,819 (1.12 %)     | 28 / 147                   | 0.93           | FAIL                                                                            |
| `09-ranking`                   | 390x844  | `stats`         | `stats`         | 34,746 (2.64 %)     | 4 / 72                     | 3.15           | FAIL                                                                            |
| `09b-ranking-pokemon`          | 1280x800 | `stats`         | `stats`         | 42,393 (1.03 %)     | 8 / 174                    | 0.95           | FAIL                                                                            |
| `09b-ranking-pokemon`          | 390x844  | `stats`         | `stats`         | 46,801 (3.55 %)     | 10 / 86                    | 4.88           | FAIL                                                                            |

**The mobile twins.** Both are kept and both are compared. `m<slug>.png` is the same screen's phone
layout, not a stale frame, so one fixture file carries both shapes — the desk block and the narrow one,
read by the panel at its own breakpoint (`02-options`'s `mobile`, through
`fixtureOptionsView(payload, true)`). The board wins: a phone row that disagrees with `m<slug>.png` is a
panel to fix, never a twin to drop.
