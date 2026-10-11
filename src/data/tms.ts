import { normalizeId } from './dex/species';

/**
 * The Gen 9 Technical Machines (base Scarlet/Violet), hand-authored because
 * `@pkmn/dex` carries no TM items: the dex only flags which moves a species can
 * learn by TM (`9M`) without a number. The array is indexed in TM order, so
 * `TM_MOVE_IDS[0]` is the move TM001 teaches and the item id `tm001` maps back
 * through `moveIdForTm`.
 *
 * TMs are **reusable** here (the run never spends one), so an item is only a
 * key into this table: the bag holds it and the learnset panel offers its move
 * to every species whose randomized learnset lists that move as a TM (`D17`).
 */
export const TM_MOVE_IDS: readonly string[] = [
  'takedown',
  'charm',
  'faketears',
  'agility',
  'mudslap',
  'scaryface',
  'protect',
  'firefang',
  'thunderfang',
  'icefang',
  'waterpulse',
  'lowkick',
  'acidspray',
  'acrobatics',
  'strugglebug',
  'psybeam',
  'confuseray',
  'thief',
  'disarmingvoice',
  'trailblaze',
  'pounce',
  'chillingwater',
  'chargebeam',
  'firespin',
  'facade',
  'poisontail',
  'aerialace',
  'bulldoze',
  'hex',
  'snarl',
  'metalclaw',
  'swift',
  'magicalleaf',
  'icywind',
  'mudshot',
  'rocktomb',
  'drainingkiss',
  'flamecharge',
  'lowsweep',
  'aircutter',
  'storedpower',
  'nightshade',
  'fling',
  'dragontail',
  'venoshock',
  'avalanche',
  'endure',
  'voltswitch',
  'sunnyday',
  'raindance',
  'sandstorm',
  'snowscape',
  'smartstrike',
  'psyshock',
  'dig',
  'bulletseed',
  'falseswipe',
  'brickbreak',
  'zenheadbutt',
  'uturn',
  'shadowclaw',
  'foulplay',
  'psychicfangs',
  'bulkup',
  'airslash',
  'bodyslam',
  'firepunch',
  'thunderpunch',
  'icepunch',
  'sleeptalk',
  'seedbomb',
  'electroball',
  'drainpunch',
  'reflect',
  'lightscreen',
  'rockblast',
  'waterfall',
  'dragonclaw',
  'dazzlinggleam',
  'metronome',
  'grassknot',
  'thunderwave',
  'poisonjab',
  'stompingtantrum',
  'rest',
  'rockslide',
  'taunt',
  'swordsdance',
  'bodypress',
  'spikes',
  'toxicspikes',
  'imprison',
  'flashcannon',
  'darkpulse',
  'leechlife',
  'eerieimpulse',
  'fly',
  'skillswap',
  'ironhead',
  'dragondance',
  'powergem',
  'gunkshot',
  'substitute',
  'irondefense',
  'xscissor',
  'drillrun',
  'willowisp',
  'crunch',
  'trick',
  'liquidation',
  'gigadrain',
  'aurasphere',
  'tailwind',
  'shadowball',
  'dragonpulse',
  'stealthrock',
  'hypervoice',
  'heatwave',
  'energyball',
  'psychic',
  'heavyslam',
  'encore',
  'surf',
  'icespinner',
  'flamethrower',
  'thunderbolt',
  'playrough',
  'amnesia',
  'calmmind',
  'helpinghand',
  'pollenpuff',
  'batonpass',
  'earthpower',
  'reversal',
  'icebeam',
  'electricterrain',
  'grassyterrain',
  'psychicterrain',
  'mistyterrain',
  'nastyplot',
  'fireblast',
  'hydropump',
  'blizzard',
  'firepledge',
  'waterpledge',
  'grasspledge',
  'wildcharge',
  'sludgebomb',
  'earthquake',
  'stoneedge',
  'phantomforce',
  'gigaimpact',
  'blastburn',
  'hydrocannon',
  'frenzyplant',
  'outrage',
  'overheat',
  'focusblast',
  'leafstorm',
  'hurricane',
  'trickroom',
  'bugbuzz',
  'hyperbeam',
  'bravebird',
  'flareblitz',
  'thunder',
  'closecombat',
  'solarbeam',
  'dracometeor',
  'steelbeam',
  'terablast',
];

/** How many TMs the catalogue holds (TM001 … TM171). */
export const TM_COUNT = TM_MOVE_IDS.length;

/** The item id of the `number`-th TM (1-based): `1` → `tm001`. */
export function tmItemId(number: number): string {
  return `tm${String(Math.floor(number)).padStart(3, '0')}`;
}

/** The TM number an item id names, or null when it is not a TM item. */
export function tmNumber(itemId: string): number | null {
  const match = /^tm(\d{3})$/.exec(normalizeId(itemId));
  if (!match) return null;
  const number = Number(match[1]);
  return number >= 1 && number <= TM_COUNT ? number : null;
}

/** True when `itemId` names one of the catalogue's TMs. */
export function isTmItemId(itemId: string): boolean {
  return tmNumber(itemId) !== null;
}

/** The move a TM item teaches, or null when the id is not a TM. */
export function moveIdForTm(itemId: string): string | null {
  const number = tmNumber(itemId);
  return number === null ? null : TM_MOVE_IDS[number - 1];
}

/** The TM item that teaches `moveId`, or null when no TM carries it. */
export function tmItemIdForMove(moveId: string): string | null {
  const index = TM_MOVE_IDS.indexOf(normalizeId(moveId));
  return index < 0 ? null : tmItemId(index + 1);
}
