import { abilityMoveType } from '../moveType';
import { registerEffects, type EffectDefinition } from './registry';

/** The `hiddenpower` move effect: its type is the holder's IVs (see `../moveType`). */
export function hiddenPowerEffects(): readonly EffectDefinition[] {
  return [
    {
      id: 'hiddenpower',
      kind: 'move',
      handlers: {
        onModifyMoveType: (ctx, move) => {
          if (ctx.owner !== ctx.source) return;
          const type = abilityMoveType(ctx.owner.ability, move, ctx.owner.ivs);
          return type === move.type ? undefined : type;
        },
      },
    },
  ];
}

/** Registers it. Called at module scope, like every other effects module. */
export function registerHiddenPowerEffect(): void {
  registerEffects(hiddenPowerEffects());
}

registerHiddenPowerEffect();
