import atlasUrl from '../assets/frlg/status-icons.png';
import manifest from './frlg/status-icons.json';

/**
 * The FRLG status badges (PSN / PAR / SLP / FRZ / BRN, plus the PKRS and FNT
 * spares), packed into `src/assets/frlg/status-icons.png` by
 * `scripts/frlg/build-status-icons.mjs` at 32x8 frames. Both atlases come from
 * the same `type-status-icons.png` source. Our two poison states share the one
 * FRLG badge, which cannot tell poison from bad poison. Local-only art — see
 * `docs/art-direction.md`.
 */
export const STATUS_ICON_ATLAS_URL = atlasUrl;
export const STATUS_ICON_TEXTURE_KEY = 'frlg:status-icons';
export const STATUS_ICON_W = manifest.width;
export const STATUS_ICON_H = manifest.height;

const FRAMES: Readonly<Record<string, number>> = manifest.statuses;

/** Our status id → the FRLG badge key, which only has one poison badge. */
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
