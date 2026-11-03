import type { TypeName } from './dex/types';
import { LEAGUE_LEVEL } from './region';

/**
 * The League's five fights — the four Elite Four members in order, then the
 * Champion — and the endless tower behind them (`docs/region-spec.md` §1, §3).
 * Every row fights at `LEAGUE_LEVEL` (`src/data/region.ts`), the only level an
 * engine ever passes to the League; the tower's row carries no leader, no badge
 * and no fixed party, because its streak's rung decides the fight. The eight
 * gyms live beside this file in `src/data/gyms.ts`.
 */

export type LeagueTitle = 'elite' | 'champion';

/** One League fight: the four Elite Four members, then the Champion. */
export type LeagueRow = Readonly<{
  /** 1..5, the member order; 5 is the Champion. */
  index: number;
  title: LeagueTitle;
  /** The member's own name, e.g. `Nival`. */
  name: string;
  /** The class the HUD prints, e.g. `Elite Four` or `Champion`. */
  className: string;
  /** A `TRAINER_ARCHETYPES` id — the sprite, AI flags and money base it fights as. */
  archetypeId: string;
  /** The row's single type theme, a `TYPE_NAMES` entry; distinct across the five. */
  type: TypeName;
  /** How many party members the fight fields. */
  partySize: number;
  /** The level every member of the fight carries: `LEAGUE_LEVEL` (60) on every row. */
  level: number;
}>;

export const LEAGUE: readonly LeagueRow[] = [
  {
    index: 1,
    title: 'elite',
    name: 'Winter',
    className: 'Elite Four',
    archetypeId: 'lass',
    type: 'Ice',
    partySize: 5,
    level: LEAGUE_LEVEL,
  },
  {
    index: 2,
    title: 'elite',
    name: 'Grave',
    className: 'Elite Four',
    archetypeId: 'psychic',
    type: 'Ghost',
    partySize: 5,
    level: LEAGUE_LEVEL,
  },
  {
    index: 3,
    title: 'elite',
    name: 'Kata',
    className: 'Elite Four',
    archetypeId: 'blackbelt',
    type: 'Fighting',
    partySize: 5,
    level: LEAGUE_LEVEL,
  },
  {
    index: 4,
    title: 'elite',
    name: 'Vega',
    className: 'Elite Four',
    archetypeId: 'psychic',
    type: 'Psychic',
    partySize: 5,
    level: LEAGUE_LEVEL,
  },
  {
    index: 5,
    title: 'champion',
    name: 'Aurum',
    className: 'Champion',
    archetypeId: 'ace',
    type: 'Dragon',
    partySize: 6,
    level: LEAGUE_LEVEL,
  },
];

/** The tower behind the Champion: no leader, no badge and no fixed party. */
export type TowerRow = Readonly<{
  key: 'tower';
  leaderId: null;
  /** The tower's fights start at the League's level and the streak raises them. */
  level: number;
  /** No fixed party: the streak's rung decides it. */
  partySize: null;
  /** No badge is awarded and no cap applies. */
  badge: null;
}>;

export const TOWER: TowerRow = {
  key: 'tower',
  leaderId: null,
  level: LEAGUE_LEVEL,
  partySize: null,
  badge: null,
};
