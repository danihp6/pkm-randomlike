import type { Move } from '../../../data/dex';
import { isGrounded, type BattleFighter, type StatusId } from '../fighter';
import { pushText, type BattleState, type TerrainId } from '../state';
import { normalizeEffectId, registerEffects, type EffectDefinition } from './registry';

export const TERRAIN_TURNS = 5;

const MOVE_TERRAIN: Readonly<Record<string, TerrainId>> = {
  electricterrain: 'electric',
  grassyterrain: 'grassy',
  mistyterrain: 'misty',
  psychicterrain: 'psychic',
};

const START_MESSAGES: Readonly<Record<TerrainId, string>> = {
  electric: 'An electric current ran across the battlefield!',
  grassy: 'Grass grew to cover the battlefield!',
  misty: 'Mist swirled around the battlefield!',
  psychic: 'The battlefield got weird!',
};

export function terrainFromMove(move: Move): TerrainId | null {
  if (!move.terrain) return null;
  return MOVE_TERRAIN[normalizeEffectId(move.terrain)] ?? null;
}

export function setTerrain(state: BattleState, terrain: TerrainId, turns = TERRAIN_TURNS): void {
  state.terrain = terrain;
  state.terrainTurns = turns;
  pushText(state, START_MESSAGES[terrain]);
}

export function clearTerrain(state: BattleState): void {
  if (!state.terrain) return;
  state.terrain = null;
  state.terrainTurns = 0;
  pushText(state, 'The terrain returned to normal.');
}

export function tickTerrain(state: BattleState): void {
  if (!state.terrain) return;
  state.terrainTurns -= 1;
  if (state.terrainTurns <= 0) clearTerrain(state);
}

/** Grassy Terrain heals grounded Pokémon 1/16 max HP at the end of the turn. */
export function terrainHeal(fighter: BattleFighter, terrain: TerrainId | null): number {
  if (terrain !== 'grassy' || fighter.hp <= 0 || !isGrounded(fighter)) return 0;
  return Math.max(1, Math.floor(fighter.maxHp / 16));
}

const TERRAIN_STATUS_BLOCK: Readonly<Partial<Record<TerrainId, readonly StatusId[]>>> = {
  electric: ['slp'],
};

/** Returns a message when the terrain makes `status` illegal, else null. */
export function terrainBlocksStatus(
  terrain: TerrainId | null,
  fighter: BattleFighter,
  status: StatusId,
): string | null {
  if (!terrain || !isGrounded(fighter)) return null;
  if (terrain === 'misty') return `${fighter.name} is protected by the mist!`;
  const blocked = TERRAIN_STATUS_BLOCK[terrain];
  if (blocked?.includes(status)) return `${fighter.name} can't fall asleep on Electric Terrain!`;
  return null;
}

const SURGE_ABILITIES: readonly (readonly [string, TerrainId])[] = [
  ['electricsurge', 'electric'],
  ['grassysurge', 'grassy'],
  ['mistysurge', 'misty'],
  ['psychicsurge', 'psychic'],
];

export function terrainEffects(): readonly EffectDefinition[] {
  return SURGE_ABILITIES.map(([id, terrain]) => ({
    id,
    kind: 'ability' as const,
    handlers: { onSwitchIn: (ctx) => setTerrain(ctx.state, terrain) },
  }));
}

export function registerTerrainEffects(): void {
  registerEffects(terrainEffects());
}

registerTerrainEffects();
