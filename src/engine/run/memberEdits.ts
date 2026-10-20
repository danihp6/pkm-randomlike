import { getMove } from '../../data/dex/moves';
import { MAX_IV, allNatures, statAtLevel } from '../../data/dex/natures';
import { STAT_IDS, getSpecies, type StatId } from '../../data/dex/species';
import { SACRIFICE_REWARDS, TUTOR_MOVES } from '../../data/npcs';
import { randomAbility } from '../battle/randomAbility';
import { hashSeed, Rng } from '../rng';
import { bandForMap } from './floors';
import { MAX_MOVES, editRunPokemon, type RunPokemon } from './progression';
import { speciesPool } from './pool';
import { consumeItem, updatePokemon, type RunState } from './state';

/**
 * The party-edit NPCs (`docs/maps-spec.md` §7, `docs/battle-spec.md` §7): one pure
 * run transaction per member edit — a tutored move, a nature, ability, IV or
 * species re-roll, and the sacrifice that pays a whole bag stack for one of four
 * of them. Every draw is minted inside the function from the run seed and the
 * NPC's own room on the `:npc:` family `npcSpot` already uses, so no map, layout,
 * encounter, roster, passive or battle stream moves (`D11`). No Phaser, no scene,
 * no `src/ui/`, no clock and no storage.
 */

/** The room's own stream family: Rng(hashSeed(`${seed}:npc:${roomIndex}:${npcId}:<op>`)). */
export type MemberEditContext = Readonly<{ roomIndex: number; npcId: string }>;

/** What one member row of the sacrifice pays (`SACRIFICE_REWARDS`). */
export type SacrificeReward = 'nature' | 'second-ability' | 'ivs' | 'species';

/** The line the result card prints; the scene resolves it to a key. */
export type MemberEditLine =
  | Readonly<{ kind: 'tutor'; moveId: string }>
  | Readonly<{ kind: 'nature'; nature: string }>
  | Readonly<{ kind: 'ability'; ability: string }>
  | Readonly<{ kind: 'secondAbility'; ability: string }>
  | Readonly<{ kind: 'ivs' }>
  | Readonly<{ kind: 'species'; speciesId: string }>
  | Readonly<{ kind: 'sacrifice'; itemId: string; reward: MemberEditLine }>;

export type MemberEditRefusal =
  'no-member' | 'no-slots' | 'no-bag' | 'no-species' | 'no-ability' | 'not-a-tutor-move';

export type MemberEdit =
  | Readonly<{ ok: true; run: RunState; memberId: string; line: MemberEditLine }>
  | Readonly<{ ok: false; run: RunState; reason: MemberEditRefusal }>;

/** A resolved edit: the member to write back, or the reason it could not resolve. */
type Resolved =
  | Readonly<{ ok: true; member: RunPokemon; line: MemberEditLine }>
  | Readonly<{ ok: false; reason: MemberEditRefusal }>;

/** The room's stream for one operation; never advances any other stream. */
function streamFor(run: RunState, ctx: MemberEditContext, op: string): Rng {
  return new Rng(hashSeed(`${run.seed}:npc:${ctx.roomIndex}:${ctx.npcId}:${op}`));
}

/** `randomAbility`'s own seed for one operation of the room. */
function abilitySeed(run: RunState, ctx: MemberEditContext, op: string): string {
  return `${run.seed}:npc:${ctx.roomIndex}:${ctx.npcId}:${op}`;
}

/** The party member with `memberId`, then the box's; an unknown id is undefined. */
function memberOf(run: RunState, memberId: string): RunPokemon | undefined {
  return (
    run.party.find((member) => member.fighter.id === memberId) ??
    run.box.find((member) => member.fighter.id === memberId)
  );
}

/** True when a held slot is an OHKO move, so `No Guard` must not be granted beside it. */
function holdsOhko(member: RunPokemon): boolean {
  return member.fighter.moves.some((slot) => getMove(slot.moveId)?.ohko === true);
}

/** The abilities a re-roll must skip: the member's own, plus `No Guard` under an OHKO. */
function excludedAbilities(member: RunPokemon): readonly string[] {
  return holdsOhko(member) ? [member.fighter.ability, 'No Guard'] : [member.fighter.ability];
}

/** Writes a resolved edit back through `updatePokemon`, or comes back by reference. */
function commit(run: RunState, memberId: string, resolved: Resolved): MemberEdit {
  if (!resolved.ok) return { ok: false, run, reason: resolved.reason };
  return { ok: true, run: updatePokemon(run, resolved.member), memberId, line: resolved.line };
}

function resolveNature(member: RunPokemon, rng: Rng): Resolved {
  const natures = allNatures();
  const nature = natures[rng.int(0, natures.length - 1)].name;
  return { ok: true, member: editRunPokemon(member, { nature }), line: { kind: 'nature', nature } };
}

function resolveIvs(member: RunPokemon, rng: Rng): Resolved {
  const rolls: Record<StatId, number> = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  for (const stat of STAT_IDS) rolls[stat] = rng.int(0, MAX_IV);
  return { ok: true, member: editRunPokemon(member, { ivs: rolls }), line: { kind: 'ivs' } };
}

function resolveAbility(
  run: RunState,
  member: RunPokemon,
  ctx: MemberEditContext,
  op: string,
): Resolved {
  const ability = randomAbility(
    member.fighter.speciesId,
    abilitySeed(run, ctx, op),
    excludedAbilities(member),
  );
  if (!ability) return { ok: false, reason: 'no-ability' };
  return {
    ok: true,
    member: editRunPokemon(member, { ability: ability.name }),
    line: { kind: 'ability', ability: ability.name },
  };
}

function resolveSecondAbility(
  run: RunState,
  member: RunPokemon,
  ctx: MemberEditContext,
  op: string,
): Resolved {
  const ability = randomAbility(
    member.fighter.speciesId,
    abilitySeed(run, ctx, op),
    excludedAbilities(member),
  );
  if (!ability) return { ok: false, reason: 'no-ability' };
  return {
    ok: true,
    member: { ...member, secondAbility: ability.name },
    line: { kind: 'secondAbility', ability: ability.name },
  };
}

function resolveSpecies(run: RunState, member: RunPokemon, rng: Rng): Resolved {
  const pool = speciesPool(bandForMap(run.mapIndex), 'wild').filter(
    (speciesId) => speciesId !== member.fighter.speciesId,
  );
  if (pool.length === 0) return { ok: false, reason: 'no-species' };
  const target = getSpecies(pool[rng.int(0, pool.length - 1)]);
  if (!target) return { ok: false, reason: 'no-species' };
  const fighter = member.fighter;
  const maxHp = statAtLevel(target, fighter.level, fighter.nature, fighter.ivs, fighter.evs).hp;
  return {
    ok: true,
    member: {
      ...member,
      fighter: {
        ...fighter,
        speciesId: target.id,
        hp: Math.max(0, Math.min(maxHp, fighter.hp)),
      },
    },
    line: { kind: 'species', speciesId: target.id },
  };
}

/** The reward row resolved on its own `:sacrifice:<op>` substream. */
function resolveReward(
  run: RunState,
  member: RunPokemon,
  ctx: MemberEditContext,
  reward: SacrificeReward,
): Resolved {
  switch (reward) {
    case 'nature':
      return resolveNature(member, streamFor(run, ctx, 'sacrifice:nature'));
    case 'second-ability':
      return resolveSecondAbility(run, member, ctx, 'sacrifice:second-ability');
    case 'ivs':
      return resolveIvs(member, streamFor(run, ctx, 'sacrifice:ivs'));
    case 'species':
      return resolveSpecies(run, member, streamFor(run, ctx, 'sacrifice:species'));
  }
}

/**
 * Teaches `memberId` a move of `TUTOR_MOVES`, into `slot` or appended when there is
 * room. The move keeps its own PP and its id joins `taughtMoves`, so it survives an
 * unequip as a band entry (`learnsetPool`). A member already holding the move is a
 * success that writes no slot. Pure.
 */
export function teachMove(
  run: RunState,
  memberId: string,
  moveId: string,
  slot: number | null,
): MemberEdit {
  const member = memberOf(run, memberId);
  if (!member) return { ok: false, run, reason: 'no-member' };
  const move = getMove(moveId);
  if (!move || !TUTOR_MOVES.includes(move.id)) {
    return { ok: false, run, reason: 'not-a-tutor-move' };
  }
  const taught = [...(member.taughtMoves ?? [])];
  if (!taught.includes(move.id)) taught.push(move.id);
  const equipped = member.fighter.moves.some((entry) => entry.moveId === move.id);
  const moves = member.fighter.moves.map((entry) => ({ ...entry }));
  if (!equipped) {
    const target = slot === null ? moves.length : slot;
    if (!Number.isInteger(target) || target < 0 || target >= MAX_MOVES) {
      return { ok: false, run, reason: 'no-slots' };
    }
    const fresh = { moveId: move.id, pp: move.pp, maxPp: move.pp };
    if (target < moves.length) moves[target] = fresh;
    else moves.push(fresh);
  }
  const next = updatePokemon(run, {
    ...member,
    fighter: { ...member.fighter, moves },
    taughtMoves: taught,
  });
  return { ok: true, run: next, memberId: member.fighter.id, line: { kind: 'tutor', moveId: move.id } };
}

/** Re-rolls the member's nature on `…:nature`; stats are derived, so nothing else moves. */
export function rerollNature(run: RunState, memberId: string, ctx: MemberEditContext): MemberEdit {
  const member = memberOf(run, memberId);
  if (!member) return { ok: false, run, reason: 'no-member' };
  return commit(run, member.fighter.id, resolveNature(member, streamFor(run, ctx, 'nature')));
}

/** Re-rolls the member's primary ability on `…:ability`, never `No Guard` beside an OHKO. */
export function rerollAbility(run: RunState, memberId: string, ctx: MemberEditContext): MemberEdit {
  const member = memberOf(run, memberId);
  if (!member) return { ok: false, run, reason: 'no-member' };
  return commit(run, member.fighter.id, resolveAbility(run, member, ctx, 'ability'));
}

/** Grants a second ability on `…:second-ability`; `fighter.ability` is never touched. */
export function grantSecondAbility(run: RunState, memberId: string, ctx: MemberEditContext): MemberEdit {
  const member = memberOf(run, memberId);
  if (!member) return { ok: false, run, reason: 'no-member' };
  return commit(run, member.fighter.id, resolveSecondAbility(run, member, ctx, 'second-ability'));
}

/** Re-rolls every IV on `…:ivs`, one draw per stat in `STAT_IDS` order. */
export function rerollIvs(run: RunState, memberId: string, ctx: MemberEditContext): MemberEdit {
  const member = memberOf(run, memberId);
  if (!member) return { ok: false, run, reason: 'no-member' };
  return commit(run, member.fighter.id, resolveIvs(member, streamFor(run, ctx, 'ivs')));
}

/**
 * Swaps the member's species for another of the floor's wild pool on `…:species`,
 * keeping level, moves, PP, abilities, IVs/EVs, held item, status and nickname and
 * clamping the HP into the new species' maximum.
 */
export function swapSpecies(run: RunState, memberId: string, ctx: MemberEditContext): MemberEdit {
  const member = memberOf(run, memberId);
  if (!member) return { ok: false, run, reason: 'no-member' };
  return commit(run, member.fighter.id, resolveSpecies(run, member, streamFor(run, ctx, 'species')));
}

/**
 * The sacrifice: one whole bag stack for one member edit. Three draws in a fixed
 * order — the stack, the party member, the reward row — then the reward on its own
 * substream. A reward that cannot resolve costs nothing: the stack stays.
 */
export function sacrifice(run: RunState, ctx: MemberEditContext): MemberEdit {
  if (run.bag.length === 0) return { ok: false, run, reason: 'no-bag' };
  if (run.party.length === 0) return { ok: false, run, reason: 'no-member' };
  const rng = streamFor(run, ctx, 'sacrifice');
  const stack = run.bag[rng.int(0, run.bag.length - 1)];
  const member = run.party[rng.int(0, run.party.length - 1)];
  const reward = SACRIFICE_REWARDS[rng.int(0, SACRIFICE_REWARDS.length - 1)];
  const resolved = resolveReward(run, member, ctx, reward);
  if (!resolved.ok) return { ok: false, run, reason: resolved.reason };
  const paid = updatePokemon(run, resolved.member);
  return {
    ok: true,
    run: consumeItem(paid, stack.itemId, stack.count),
    memberId: member.fighter.id,
    line: {
      kind: 'sacrifice',
      itemId: stack.itemId,
      reward: resolved.line,
    },
  };
}
