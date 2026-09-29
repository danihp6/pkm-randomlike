import type { Move } from '../../../data/dex';
import type { BattleFighter } from '../fighter';
import { pushText, type BattleState, type WeatherId } from '../state';
import {
  normalizeEffectId,
  registerEffects,
  type EffectDefinition,
} from './registry';

export const WEATHER_TURNS = 5;

const MOVE_WEATHER: Readonly<Record<string, WeatherId>> = {
  sunnyday: 'sun',
  raindance: 'rain',
  sandstorm: 'sand',
  snowscape: 'snow',
  hail: 'snow',
};

const START_MESSAGES: Readonly<Record<WeatherId, string>> = {
  sun: 'The sunlight turned harsh!',
  rain: 'It started to rain!',
  sand: 'A sandstorm kicked up!',
  snow: 'It started to snow!',
};

const LABELS: Readonly<Record<WeatherId, string>> = {
  sun: 'harsh sunlight',
  rain: 'rain',
  sand: 'sandstorm',
  snow: 'snow',
};

export function weatherFromMove(move: Move): WeatherId | null {
  if (!move.weather) return null;
  return MOVE_WEATHER[normalizeEffectId(move.weather)] ?? null;
}

export function setWeather(state: BattleState, weather: WeatherId, turns = WEATHER_TURNS): void {
  state.weather = weather;
  state.weatherTurns = turns;
  pushText(state, START_MESSAGES[weather]);
}

export function clearWeather(state: BattleState): void {
  if (!state.weather) return;
  state.weather = null;
  state.weatherTurns = 0;
  pushText(state, 'The weather returned to normal.');
}

export function tickWeather(state: BattleState): void {
  if (!state.weather) return;
  state.weatherTurns -= 1;
  if (state.weatherTurns <= 0) clearWeather(state);
}

const SAND_IMMUNE_TYPES: readonly string[] = ['Rock', 'Ground', 'Steel'];
const SAND_IMMUNE_ABILITIES: readonly string[] = [
  'sandveil',
  'sandrush',
  'sandforce',
  'overcoat',
  'magicguard',
];

export function weatherImmune(fighter: BattleFighter, weather: WeatherId): boolean {
  if (weather !== 'sand') return true;
  if (fighter.types.some((type) => SAND_IMMUNE_TYPES.includes(type))) return true;
  return SAND_IMMUNE_ABILITIES.includes(normalizeEffectId(fighter.ability));
}

/** Chip damage a weather deals at the end of the turn (sand only in Gen 9). */
export function weatherChip(fighter: BattleFighter, weather: WeatherId): number {
  if (fighter.hp <= 0 || weatherImmune(fighter, weather)) return 0;
  return Math.max(1, Math.floor(fighter.maxHp / 16));
}

export function weatherLabel(weather: WeatherId): string {
  return LABELS[weather];
}

const WEATHER_ABILITIES: readonly (readonly [string, WeatherId])[] = [
  ['drizzle', 'rain'],
  ['drought', 'sun'],
  ['sandstream', 'sand'],
  ['snowwarning', 'snow'],
];

export function weatherEffects(): readonly EffectDefinition[] {
  return WEATHER_ABILITIES.map(([id, weather]) => ({
    id,
    kind: 'ability' as const,
    handlers: { onSwitchIn: (ctx) => setWeather(ctx.state, weather) },
  }));
}

export function registerWeatherEffects(): void {
  registerEffects(weatherEffects());
}

registerWeatherEffects();
