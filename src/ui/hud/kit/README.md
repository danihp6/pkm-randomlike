# `src/ui/hud/kit/` — the primitives every panel is made of

The eight pieces of the board a panel composes, one module each, plus the class
helpers and the one kit stylesheet. Stateless by contract: no hooks, no context, no
Phaser, no DOM, no i18n — text arrives as props or children, already localised.

## Layout

- `index.ts` — the barrel: imports the kit stylesheet once, then re-exports the eight primitives and their helpers.
- `classes.ts` — the class list of each primitive and the space-joining helper, one modifier per flag.
- `classes.test.ts` — the join's falsy and double-space cases and every primitive's modifier set, headless.
- `panel.tsx` — the dialog card: an optional header (title plus aside) over the children.
- `panel.test.ts` — the header's presence rules and the title/aside boxes, asserted on the vnode.
- `row.tsx` — one board row: a plain element without an action and a real button with one.
- `row.test.ts` — the element swap, the selected and disabled states and the press handler, headless.
- `chip.tsx` — the 26×26 initial badge with its full name as the accessible label.
- `chip.test.ts` — the button shape, the initial-only render and the active modifier.
- `bar.tsx` — the one bar primitive and the percentage geometry its fill is drawn from.
- `bar.test.ts` — the percentage clamping and rounding, and the progressbar's accessible values.
- `sheet.tsx` — the bottom sheet, radius 16: nothing while closed, handle, title and close button when open.
- `sheet.test.ts` — the closed null, the handle and the close button's wiring.
- `primaryButton.tsx` — the one filled action of a panel.
- `primaryButton.test.ts` — the button shape, the press handler and the disabled state.
- `meta.tsx` — the 9 px meta line and its six tones.
- `meta.test.ts` — the span shape and one modifier per tone.
- `typeBadge.tsx` — the canon type chip: the type palette's fill and the readable ink chosen by contrast.
- `typeBadge.test.ts` — the hex format, the 4.5:1 contrast for the eighteen types and the unknown fallback.
- `kit.css` — the measured geometry of every primitive: tokens only, 1 px hairlines, the ten type pairs, the kit's three radii and the 44 px targets.
- `kit.css.test.ts` — the stylesheet read as text: no literal colour, no literal size, no shadow, 1 px borders, the three scoped radii, the focus ring.
- `index.test.ts` — the barrel's exact export list, asserted against a literal list.
- `README.md` — this map.

## Rules

1. A primitive draws what it is given; it reads no store, no clock and no random source.
2. Every colour, size and radius comes from a `--hud-*` token in `../styles/root.css`; the three radii that file does not carry live once, on the `.kit` block of `kit.css`, and the primitives that draw them carry the base `kit` class so the variable always resolves.
3. The drawn box keeps the board's height; the 44 px target is a transparent `::after`, never the visible box.
