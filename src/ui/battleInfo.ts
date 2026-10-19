import { activeFighter } from '../engine/battle/state';
import type {
  BattleState,
  FieldConditionId,
  SideConditionId,
  SideId,
  TerrainId,
  WeatherId,
} from '../engine/battle/state';
import { BOOST_IDS, type BoostId } from '../engine/battle/fighter';
import { statusAbbreviation } from './metrics';
import { t, type TranslationKey } from '../i18n';

/** One line of the window: the condition's name and its reading. */
export type BattleInfoRow = Readonly<{ label: string; value: string }>;

/** One group of rows under its heading. */
export type BattleInfoGroup = Readonly<{ heading: string; rows: readonly BattleInfoRow[] }>;

/** The field conditions the window lists, in the order it lists them. */
export const FIELD_CONDITION_IDS: readonly FieldConditionId[] = [
  'trickroom',
  'gravity',
  'magicroom',
  'wonderroom',
  'fairylock',
  'mudsport',
  'watersport',
];

/** The per-side conditions the window lists, in the order it lists them. */
export const SIDE_CONDITION_IDS: readonly SideConditionId[] = [
  'reflect',
  'lightscreen',
  'auroraveil',
  'tailwind',
  'luckychant',
  'mist',
  'safeguard',
];

const WEATHER_KEYS: Readonly<Record<WeatherId, TranslationKey>> = {
  sun: 'battle.info.weather.sun',
  rain: 'battle.info.weather.rain',
  sand: 'battle.info.weather.sand',
  snow: 'battle.info.weather.snow',
};

const TERRAIN_KEYS: Readonly<Record<TerrainId, TranslationKey>> = {
  electric: 'battle.info.terrain.electric',
  grassy: 'battle.info.terrain.grassy',
  misty: 'battle.info.terrain.misty',
  psychic: 'battle.info.terrain.psychic',
};

const FIELD_KEYS: Readonly<Record<FieldConditionId, TranslationKey>> = {
  trickroom: 'battle.info.field.trickroom',
  gravity: 'battle.info.field.gravity',
  magicroom: 'battle.info.field.magicroom',
  wonderroom: 'battle.info.field.wonderroom',
  fairylock: 'battle.info.field.fairylock',
  mudsport: 'battle.info.field.mudsport',
  watersport: 'battle.info.field.watersport',
};

const SIDE_KEYS: Readonly<Record<SideConditionId, TranslationKey>> = {
  reflect: 'battle.info.side.reflect',
  lightscreen: 'battle.info.side.lightscreen',
  auroraveil: 'battle.info.side.auroraveil',
  tailwind: 'battle.info.side.tailwind',
  luckychant: 'battle.info.side.luckychant',
  mist: 'battle.info.side.mist',
  safeguard: 'battle.info.side.safeguard',
};

const BOOST_KEYS: Readonly<Record<BoostId, TranslationKey>> = {
  atk: 'battle.info.stat.atk',
  def: 'battle.info.stat.def',
  spa: 'battle.info.stat.spa',
  spd: 'battle.info.stat.spd',
  spe: 'battle.info.stat.spe',
  accuracy: 'battle.info.stat.accuracy',
  evasion: 'battle.info.stat.evasion',
};

/** A stat stage as it is read: `+2`, `-1`, `-6`. */
function stage(stages: number): string {
  return stages > 0 ? `+${stages}` : String(stages);
}

function fieldRows(state: BattleState): readonly BattleInfoRow[] {
  const rows: BattleInfoRow[] = [];
  if (state.weather !== null) {
    rows.push({
      label: t('battle.info.weather'),
      // The stored count, not the effective reading: a weather under Air Lock is
      // still set, and the window reports what is set.
      value: t(WEATHER_KEYS[state.weather], { turns: state.weatherTurns }),
    });
  }
  if (state.terrain !== null) {
    rows.push({
      label: t('battle.info.terrain'),
      value: t(TERRAIN_KEYS[state.terrain], { turns: state.terrainTurns }),
    });
  }
  for (const id of FIELD_CONDITION_IDS) {
    const turns = state.field[id];
    if (turns > 0) rows.push({ label: t(FIELD_KEYS[id], { turns }), value: '' });
  }
  return rows;
}

function sideRows(state: BattleState, side: SideId): readonly BattleInfoRow[] {
  const rows: BattleInfoRow[] = [];
  const conditions = state.sides[side].sideConditions;
  for (const id of SIDE_CONDITION_IDS) {
    const turns = conditions[id];
    if (turns > 0) rows.push({ label: t(SIDE_KEYS[id], { turns }), value: '' });
  }
  const fighter = activeFighter(state, side);
  for (const id of BOOST_IDS) {
    const stages = fighter.boosts[id];
    if (stages !== 0) rows.push({ label: t(BOOST_KEYS[id]), value: stage(stages) });
  }
  if (fighter.status !== null) {
    rows.push({ label: t('battle.info.status'), value: statusAbbreviation(fighter.status) ?? '' });
  }
  return rows;
}

/**
 * The battle's state as grouped rows: the weather and the terrain with their
 * turns, each live field and side condition with its count, each active's stat
 * stages and its non-volatile status. The per-fighter `volatiles` (confusion,
 * Leech Seed, Substitute, Taunt, Encore, Perish Song …), `wishTurns` and the
 * Baton Pass staging field are deliberately **not** listed — they are hidden
 * state — and neither are the entry hazards (Stealth Rock, Spikes, Toxic Spikes,
 * Sticky Web), which the whole engine does not model. Reads the state, draws no RNG.
 */
export function battleInfoRows(state: BattleState): readonly BattleInfoGroup[] {
  const field = fieldRows(state);
  const player = sideRows(state, 'player');
  const enemy = sideRows(state, 'enemy');
  const nothing = field.length === 0 && player.length === 0 && enemy.length === 0;
  return [
    {
      heading: t('battle.info.field'),
      rows: nothing ? [{ label: t('battle.info.nothing'), value: '' }] : field,
    },
    { heading: t('battle.info.player'), rows: player },
    { heading: t('battle.info.enemy'), rows: enemy },
  ];
}

/**
 * The lines a list window draws for those groups: each heading as it is, each row as
 * `${label}  ${value}` (two spaces), or the label alone when the value is empty; a group
 * with no rows contributes nothing.
 */
export function battleInfoLines(groups: readonly BattleInfoGroup[]): readonly string[] {
  return groups.flatMap((group) =>
    group.rows.length === 0
      ? []
      : [
          group.heading,
          ...group.rows.map((row) => (row.value === '' ? row.label : `${row.label}  ${row.value}`)),
        ],
  );
}
