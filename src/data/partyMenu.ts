import panelUrl from '../assets/frlg/party-panel.png';
import slotUrl from '../assets/frlg/party-slot.png';
import manifest from './frlg/party-menu.json';

/**
 * The FireRed/LeafGreen party-menu chrome, sliced by
 * `scripts/frlg/build-party-menu.mjs` from `sprite-sources/frlg-ui/pokemon-menu.png`
 * (local-only, never redistributed — see `docs/art-direction.md`): `panel` is the
 * teal scanline tile that fills the PARTY window, `slot` the empty party slot
 * frame (cyan top, navy sides, no baked text) used as each member's row. The
 * measured geometry lives in `src/data/frlg/party-menu.json`.
 */
export const PARTY_PANEL_URL = panelUrl;
export const PARTY_SLOT_URL = slotUrl;
export const PARTY_PANEL_KEY = 'frlg:party-panel';
export const PARTY_SLOT_KEY = 'frlg:party-slot';

/** The window border colour, read from the sheet's screen margin. */
export const PARTY_PANEL_BORDER = manifest.panel.border;
export const PARTY_PANEL_RADIUS = manifest.panel.radius;
export const PARTY_SLOT = { width: manifest.slot.width, height: manifest.slot.height } as const;
