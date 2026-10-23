# `src/ui/hud/panels/party/` — the party card (`03b`)

The party window of `D49`: the shipped 250 × 406 card of the right-hand HUD column as a Preact
panel over the `#hud` layer, painting a `PartyPanelView` the route scene builds from `HudState` and
answering in `HudCommand`s. The route scene keeps the panel record (so the quick key, the saved
layout and the collapse still work) and draws no Phaser object at all while the flag is on.

## Layout

- `view.ts` — the panel's value model: `partyPanelBox`, `initialPartyPanelUi` and `partyPanelView`, plus the mirror block of every Phaser constant the card reproduces (`PARTY_PANEL_W`, `PARTY_ROW`, `PARTY_HP_BAR`, …).
- `view.test.ts` — the two docked rects, the header and row geometry, the XP/HP fill arithmetic, the row cap and the cursor clamp, and the pinned constant values, headless.
- `partyPanel.tsx` — the card itself: the highlight, the key chip, the level line, the XP bar and the Pokevial meter, then one pressable row per member.
- `party.css` — the board's party paint — radius 11, hairline, the 1 px highlight, the 26×26 chip, the accent selected row — over the `styles/root.css` tokens.
- `mount.tsx` — `mountPartyPanel`: renders the card into a host element behind a view signal and returns its disposer.
- `index.ts` — the barrel the scene module imports.
- `README.md` — this map.

## Rules

1. The view is data, never the run: the scene projects `HudState` and pushes a new value, the panel paints it.
2. The panel answers `{ type: 'member', memberId }` for a row and `{ type: 'panel', panel: 'party' }` for the chip; the scene owns the run and the toggle.
3. The chip carries the kit's 44 px `::after` hit overlay; the rows are 210 × 48 and need none.
