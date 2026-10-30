# `src/ui/hud/panels/party/` — the party card (`03b`)

The party window of `D49`: the shipped 250 × 406 card of the right-hand HUD column as a Preact
panel over the `#hud` layer, painting a `PartyPanelView` the route scene builds from `HudState` and
answering in `HudCommand`s. The card **is** the panel and the canvas draws none of it; the route
scene keeps the panel record (so the quick key, the saved layout and the collapse still work), and
`src/main.ts` calls `mountHud` on every boot, `?hud=dom` being an inert alias kept only so old links
still boot.

## Layout

- `view.ts` — the panel's value model: `partyPanelBox`, `initialPartyPanelUi` and `partyPanelView`, plus the mirror block of every Phaser constant the card reproduces (`PARTY_PANEL_W`, `PARTY_ROW`, `PARTY_HP_BAR`, …) and each row's portrait source.
- `view.test.ts` — the two docked rects, the header and row geometry, the XP/HP fill arithmetic, the row cap and the cursor clamp, the pinned constant values and the per-member portrait source, headless.
- `partyPanel.tsx` — the card itself: the highlight, the key chip, the level line, the XP bar and the Pokevial meter, then one pressable, draggable row per member; the drag cell lives in `PartyPanel` (which also drops a carried row on any release outside the card) and the paint in `PartyCard`.
- `partyPanel.test.ts` — the card walked as Preact props: the pointer drag's one `onReorder`, the click it swallows, the press that only asks for the member's detail, the scene's own press and reorder receivers, the portrait style and the flush HP fill, plus the retired CSS inset tokens.
- `party.css` — the board's party paint — radius 11, hairline, the 1 px highlight, the 26×26 chip, the accent selected row — over the `styles/root.css` tokens.
- `mount.tsx` — `mountPartyPanel`: renders the card into a host element behind a view signal, beside the command and reorder callbacks, inside the panel frame that carries its chip and drag, and returns its disposer.
- `index.ts` — the barrel the scene module imports.
- `README.md` — this map.

## Rules

1. The view is data, never the run: the scene projects `HudState` and pushes a new value, the panel paints it.
2. A press on a row is the **detail** path and nothing else: the panel answers `{ type: 'member', memberId }` and the scene opens that member's data panel, so a press never re-leads the squad; the chip answers `{ type: 'panel', panel: 'party' }`.
3. A row dragged **onto** another row reports `onReorder(from, to)` once and swallows the click that follows it; the scene swaps the two members through the run engine. A row dragged **off** the card leaves the whole crossing to the HUD's one member gesture (`src/scenes/panels/detail.ts`), which reads the two cards' `data-hud-panel` markers on release.
4. The chip carries the kit's 44 px `::after` hit overlay; the rows are 210 × 48 and need none.
