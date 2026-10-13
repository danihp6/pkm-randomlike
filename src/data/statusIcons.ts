import atlasUrl from '../assets/frlg/status-icons.png';
import manifest from './frlg/status-icons.json';

/**
 * The Añil status badges (SLP / PSN / BRN / PAR / FRZ, plus the FNT and PKRS
 * spares), packed into `src/assets/frlg/status-icons.png` by
 * `scripts/frlg/build-status-icons.mjs` from the fangame Pokémon Añil's own
 * `Graphics/UI/statuses.png`, at 32x8 frames. Añil's UI sheet carries no separate
 * badly-poisoned badge, so `tox` keeps sharing the poison frame. Local-only art —
 * see `docs/art-direction.md`.
 */
export const STATUS_ICON_ATLAS_URL = atlasUrl;
export const STATUS_ICON_TEXTURE_KEY = 'frlg:status-icons';
export const STATUS_ICON_W = manifest.width;
export const STATUS_ICON_H = manifest.height;

const FRAMES: Readonly<Record<string, number>> = manifest.statuses;

/** Our status id → the Añil badge key; bad poison shares the poison badge. */
const STATUS_FRAMES: Readonly<Record<string, string>> = {
  brn: 'brn',
  psn: 'psn',
  tox: 'psn',
  par: 'par',
  slp: 'slp',
  frz: 'frz',
};

/** The atlas frame of a status condition's badge, or null for an unknown one. */
export function statusIconFrame(status: string): number | null {
  const key = STATUS_FRAMES[status];
  return key === undefined ? null : (FRAMES[key] ?? null);
}
