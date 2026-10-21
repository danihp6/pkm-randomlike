import { describe, expect, it, vi } from 'vitest';
import { MAX_IV, allNatures, statAtLevel } from '../../data/dex/natures';
import { getSpecies } from '../../data/dex/species';
import { getMove } from '../../data/dex/moves';
import { STAT_IDS } from '../../data/dex/species';
import { SACRIFICE_REWARDS, TUTOR_MOVES } from '../../data/npcs';
import '../battle/effects/abilities';
import { restoreFighter } from '../battle/fighter';
import { learnsetPool, unequipMove } from './learnset';
import {
  grantSecondAbility,
  rerollAbility,
  rerollIvs,
  rerollNature,
  sacrifice,
  swapSpecies,
  teachMove,
  type MemberEdit,
  type MemberEditContext,
  type MemberEditLine,
} from './memberEdits';
import { bandForMap } from './floors';
import { speciesPool } from './pool';
import { MAX_MOVES, createRunPokemon, memberAbilities, type RunPokemon } from './progression';
import { addItem, createRun, itemCount, updatePokemon, type RunState } from './state';

const SEED = 'pkm-93';

function member(
  id: string,
  speciesId = 'charmander',
  level = 20,
  moves: readonly string[] = ['scratch'],
  extra: Partial<RunPokemon> = {},
): RunPokemon {
  return { ...createRunPokemon({ id, speciesId, level, moves }), ...extra };
}

function runWith(party: readonly RunPokemon[], box: readonly RunPokemon[] = []): RunState {
  return { ...createRun({ seed: SEED, starter: party[0] }), party, box };
}

function bagged(run: RunState): RunState {
  return addItem(addItem(run, 'potion', 3), 'pokeball', 5);
}

/** The successful half of an edit, failing the test on a refusal. */
function ok(edit: MemberEdit): Extract<MemberEdit, { ok: true }> {
  expect(edit.ok, edit.ok ? '' : edit.reason).toBe(true);
  return edit as Extract<MemberEdit, { ok: true }>;
}

function refuses(edit: MemberEdit, run: RunState, reason: string): void {
  expect(edit.ok).toBe(false);
  if (edit.ok) return;
  expect(edit.reason).toBe(reason);
  expect(edit.run).toBe(run);
}

function sacrificeLine(edit: MemberEdit): Extract<MemberEditLine, { kind: 'sacrifice' }> {
  const line = ok(edit).line;
  expect(line.kind).toBe('sacrifice');
  return line as Extract<MemberEditLine, { kind: 'sacrifice' }>;
}

describe('teachMove', () => {
  it('appends a tutored move into the free slot with fresh PP', () => {
    const run = runWith([member('a')]);
    const edit = ok(teachMove(run, 'a', 'earthquake', null));
    expect(edit.memberId).toBe('a');
    expect(edit.line).toEqual({ kind: 'tutor', moveId: 'earthquake' });
    const moves = edit.run.party[0].fighter.moves;
    expect(moves.map((slot) => slot.moveId)).toEqual(['scratch', 'earthquake']);
    expect(moves[1]).toEqual({
      moveId: 'earthquake',
      pp: getMove('earthquake')!.pp,
      maxPp: getMove('earthquake')!.pp,
    });
    expect(edit.run.party[0].taughtMoves).toEqual(['earthquake']);
    // Pure: the input run is untouched.
    expect(run.party[0].fighter.moves).toHaveLength(1);
    expect(run.party[0].taughtMoves).toBeUndefined();
  });

  it('replaces the chosen slot and appends past the last real one', () => {
    const run = runWith([member('a', 'charmander', 20, ['scratch', 'growl'])]);
    const replaced = ok(teachMove(run, 'a', 'icebeam', 0));
    expect(replaced.run.party[0].fighter.moves.map((slot) => slot.moveId)).toEqual(['icebeam', 'growl']);
    const appended = ok(teachMove(run, 'a', 'icebeam', 3));
    expect(appended.run.party[0].fighter.moves.map((slot) => slot.moveId)).toEqual([
      'scratch',
      'growl',
      'icebeam',
    ]);
  });

  it('refuses a fifth move without a slot, and a slot outside 0..3', () => {
    const four = ['scratch', 'growl', 'ember', 'smokescreen'];
    const run = runWith([member('a', 'charmander', 20, four)]);
    expect(four).toHaveLength(MAX_MOVES);
    refuses(teachMove(run, 'a', 'earthquake', null), run, 'no-slots');
    refuses(teachMove(run, 'a', 'earthquake', MAX_MOVES), run, 'no-slots');
    refuses(teachMove(run, 'a', 'earthquake', -1), run, 'no-slots');
    refuses(teachMove(run, 'a', 'earthquake', 1.5), run, 'no-slots');
    // A real slot still replaces.
    const replaced = ok(teachMove(run, 'a', 'earthquake', 2));
    expect(replaced.run.party[0].fighter.moves.map((slot) => slot.moveId)).toEqual([
      'scratch',
      'growl',
      'earthquake',
      'smokescreen',
    ]);
  });

  it('accepts only a move of TUTOR_MOVES that the dex resolves', () => {
    const run = runWith([member('a')]);
    expect(TUTOR_MOVES).not.toContain('hydropump');
    refuses(teachMove(run, 'a', 'hydropump', null), run, 'not-a-tutor-move');
    refuses(teachMove(run, 'a', 'not-a-move', null), run, 'not-a-tutor-move');
    refuses(teachMove(run, 'a', '', null), run, 'not-a-tutor-move');
    for (const moveId of TUTOR_MOVES) {
      expect(ok(teachMove(run, 'a', moveId, null)).line).toEqual({ kind: 'tutor', moveId });
    }
  });

  it('refuses an unknown member by reference, and finds a boxed one', () => {
    const boxed = member('b', 'sentret', 5, ['scratch']);
    const run = runWith([member('a')], [boxed]);
    refuses(teachMove(run, 'nobody', 'earthquake', null), run, 'no-member');
    const edit = ok(teachMove(run, 'b', 'roost', null));
    expect(edit.run.box[0].fighter.moves.map((slot) => slot.moveId)).toEqual(['scratch', 'roost']);
    expect(edit.run.party[0].fighter.moves).toHaveLength(1);
  });

  it('records the move even when the member already equips it', () => {
    const run = runWith([member('a', 'charmander', 20, ['earthquake', 'scratch'])]);
    const edit = ok(teachMove(run, 'a', 'earthquake', 2));
    expect(edit.run.party[0].fighter.moves.map((slot) => slot.moveId)).toEqual([
      'earthquake',
      'scratch',
    ]);
    expect(edit.run.party[0].taughtMoves).toEqual(['earthquake']);
  });

  it('keeps the taught id once, and the move survives an unequip in the band', () => {
    const run = runWith([member('a')]);
    const taught = ok(teachMove(run, 'a', 'earthquake', null));
    const again = ok(teachMove(taught.run, 'a', 'earthquake', null));
    expect(again.run.party[0].taughtMoves).toEqual(['earthquake']);
    const removed = unequipMove(again.run, 'a', 1);
    expect(removed.party[0].fighter.moves.map((slot) => slot.moveId)).toEqual(['scratch']);
    const entry = learnsetPool(removed, removed.party[0]).find(
      (candidate) => candidate.moveId === 'earthquake',
    );
    expect(entry).toEqual({ moveId: 'earthquake', source: 'tutor', level: null, tmId: null });
  });
});

describe('the member re-rolls', () => {
  it('re-rolls only the nature', () => {
    const run = runWith([member('a')]);
    const before = run.party[0];
    const edit = ok(rerollNature(run, 'a', { roomIndex: 3, npcId: 'nature' }));
    const after = edit.run.party[0];
    expect(edit.line.kind).toBe('nature');
    const nature = (edit.line as Extract<MemberEditLine, { kind: 'nature' }>).nature;
    expect(allNatures().map((entry) => entry.name)).toContain(nature);
    expect(after.fighter.nature).toBe(nature);
    expect({ ...after.fighter, nature: before.fighter.nature }).toEqual(before.fighter);
    expect(after.taughtMoves).toBeUndefined();
    expect(after.secondAbility).toBeUndefined();
    refuses(rerollNature(run, 'nobody', { roomIndex: 3, npcId: 'nature' }), run, 'no-member');
  });

  it('re-rolls only the primary ability, keeping a second one', () => {
    const base = runWith([member('a')]);
    const run = updatePokemon(base, { ...base.party[0], secondAbility: 'Pickup' });
    const before = run.party[0];
    const edit = ok(rerollAbility(run, 'a', { roomIndex: 3, npcId: 'ability' }));
    const after = edit.run.party[0];
    const ability = (edit.line as Extract<MemberEditLine, { kind: 'ability' }>).ability;
    expect(after.fighter.ability).toBe(ability);
    expect(ability).not.toBe(before.fighter.ability);
    expect(after.secondAbility).toBe('Pickup');
    expect({ ...after.fighter, ability: before.fighter.ability }).toEqual(before.fighter);
    refuses(rerollAbility(run, 'nobody', { roomIndex: 3, npcId: 'ability' }), run, 'no-member');
  });

  it('never rolls No Guard beside an equipped OHKO move', () => {
    const run = runWith([member('a', 'diglett', 20, ['fissure'])]);
    expect(getMove('fissure')?.ohko).toBe(true);
    for (let roomIndex = 0; roomIndex < 40; roomIndex++) {
      const edit = ok(rerollAbility(run, 'a', { roomIndex, npcId: 'ability' }));
      expect(edit.run.party[0].fighter.ability).not.toBe('No Guard');
    }
  });

  it('keeps a member’s permanent treats through the nature re-roll (Task-103)', () => {
    const treats = { atk: 1, hp: 2 };
    const plain = member('a');
    const run = runWith([{ ...plain, fighter: { ...plain.fighter, statTreats: treats } }]);
    const edit = ok(rerollNature(run, 'a', { roomIndex: 3, npcId: 'nature' }));
    const after = edit.run.party[0];
    const nature = (edit.line as Extract<MemberEditLine, { kind: 'nature' }>).nature;
    expect(after.fighter.statTreats).toEqual(treats);
    const restored = restoreFighter(after.fighter);
    expect(restored.stats).toEqual(
      statAtLevel(
        getSpecies(after.fighter.speciesId)!,
        after.fighter.level,
        nature,
        after.fighter.ivs,
        after.fighter.evs,
        treats,
      ),
    );
    expect(restored.maxHp).toBe(restored.stats.hp);
  });

  it('grants a second ability without touching the primary one', () => {
    const run = runWith([member('a')]);
    const before = run.party[0];
    const edit = ok(grantSecondAbility(run, 'a', { roomIndex: 3, npcId: 'ability' }));
    const after = edit.run.party[0];
    const ability = (edit.line as Extract<MemberEditLine, { kind: 'secondAbility' }>).ability;
    expect(edit.line.kind).toBe('secondAbility');
    expect(after.secondAbility).toBe(ability);
    expect(after.fighter).toEqual(before.fighter);
    expect(after.fighter.ability).toBe(before.fighter.ability);
    expect(memberAbilities(after)).toEqual([before.fighter.ability, ability]);
    refuses(grantSecondAbility(run, 'nobody', { roomIndex: 3, npcId: 'ability' }), run, 'no-member');
  });

  it('re-rolls all six IVs, keeping every other stat input and the status', () => {
    const run = runWith([member('a', 'charmander', 20, ['scratch', 'ember'])]);
    const before = run.party[0];
    const edit = ok(rerollIvs(run, 'a', { roomIndex: 3, npcId: 'ivs' }));
    const after = edit.run.party[0];
    expect(edit.line).toEqual({ kind: 'ivs' });
    for (const stat of STAT_IDS) {
      const iv = after.fighter.ivs[stat];
      expect(Number.isInteger(iv), stat).toBe(true);
      expect(iv, stat).toBeGreaterThanOrEqual(0);
      expect(iv, stat).toBeLessThanOrEqual(MAX_IV);
    }
    expect(after.fighter.ivs).not.toEqual(before.fighter.ivs);
    expect({ ...after.fighter, ivs: before.fighter.ivs, hp: before.fighter.hp }).toEqual(before.fighter);
    expect(after.fighter.hp).toBeGreaterThan(0);
    refuses(rerollIvs(run, 'nobody', { roomIndex: 3, npcId: 'ivs' }), run, 'no-member');
  });

  it('swaps the species and keeps every other member word', () => {
    const base = member('a', 'charmander', 20, ['scratch', 'ember'], {
      taughtMoves: ['earthquake'],
      secondAbility: 'Pickup',
    });
    const held: RunPokemon = {
      ...base,
      fighter: { ...base.fighter, heldItem: 'leftovers', status: 'brn', statusCounter: 2 },
    };
    const run = runWith([held]);
    const before = run.party[0];
    const edit = ok(swapSpecies(run, 'a', { roomIndex: 3, npcId: 'species' }));
    const after = edit.run.party[0];
    const speciesId = (edit.line as Extract<MemberEditLine, { kind: 'species' }>).speciesId;
    expect(speciesId).not.toBe('charmander');
    expect(after.fighter.speciesId).toBe(speciesId);
    expect(speciesPool(bandForMap(run.mapIndex), 'wild')).toContain(speciesId);
    expect({ ...after.fighter, speciesId: before.fighter.speciesId, hp: before.fighter.hp }).toEqual(
      before.fighter,
    );
    expect(after.fighter.heldItem).toBe('leftovers');
    expect(after.fighter.status).toBe('brn');
    expect(after.fighter.statusCounter).toBe(2);
    expect(after.taughtMoves).toEqual(['earthquake']);
    expect(after.secondAbility).toBe('Pickup');
  });

  it('clamps the HP into the new maximum and never resurrects a fainted member', () => {
    const overfull: RunPokemon = { ...member('a'), fighter: { ...member('a').fighter, hp: 9999 } };
    const overfullRun = runWith([overfull]);
    const edit = ok(swapSpecies(overfullRun, 'a', { roomIndex: 3, npcId: 'species' }));
    const after = edit.run.party[0];
    expect(after.fighter.hp).toBeGreaterThan(0);
    expect(after.fighter.hp).toBeLessThan(9999);

    const fainted: RunPokemon = { ...member('f'), fighter: { ...member('f').fighter, hp: 0 } };
    const dead = ok(swapSpecies(runWith([fainted]), 'f', { roomIndex: 3, npcId: 'species' }));
    expect(dead.run.party[0].fighter.hp).toBe(0);

    const plain = runWith([member('a')]);
    refuses(swapSpecies(plain, 'nobody', { roomIndex: 3, npcId: 'species' }), plain, 'no-member');
  });

  it('never draws the member current species', () => {
    const pool = speciesPool(bandForMap(1), 'wild');
    const current = pool[0];
    const run = runWith([member('a', current)]);
    expect(pool).toContain(current);
    for (let roomIndex = 0; roomIndex < 80; roomIndex++) {
      const edit = ok(swapSpecies(run, 'a', { roomIndex, npcId: 'species' }));
      expect(edit.run.party[0].fighter.speciesId).not.toBe(current);
      expect(pool).toContain(edit.run.party[0].fighter.speciesId);
    }
  });
});

describe('sacrifice', () => {
  const CTX: MemberEditContext = { roomIndex: 3, npcId: 'sacrifice' };

  const REWARD_OF: Readonly<Record<string, string>> = {
    nature: 'nature',
    secondAbility: 'second-ability',
    ivs: 'ivs',
    species: 'species',
  };

  it('spends exactly one whole bag stack for one member edit', () => {
    const run = bagged(runWith([member('a'), member('b', 'sentret', 5, ['scratch'])]));
    const edit = ok(sacrifice(run, CTX));
    const line = sacrificeLine(edit);
    expect(SACRIFICE_REWARDS).toContain(REWARD_OF[line.reward.kind] as never);
    expect(line.reward.kind).not.toBe('sacrifice');
    // The whole stack leaves; the other one stays untouched.
    const before = itemCount(run, line.itemId);
    expect(before).toBeGreaterThan(1);
    expect(itemCount(edit.run, line.itemId)).toBe(0);
    expect(edit.run.bag).toHaveLength(run.bag.length - 1);
    expect(edit.run.bag).toEqual(run.bag.filter((slot) => slot.itemId !== line.itemId));
    // The member is one of the party's, and the party keeps its size.
    expect(edit.run.party).toHaveLength(run.party.length);
    expect(run.party.map((entry) => entry.fighter.id)).toContain(edit.memberId);
  });

  it('never draws the box and honours the reward it drew', () => {
    const boxed = member('boxed', 'sentret', 5, ['scratch']);
    const run = bagged(runWith([member('a')], [boxed]));
    for (let roomIndex = 0; roomIndex < 40; roomIndex++) {
      const edit = ok(sacrifice(run, { roomIndex, npcId: 'sacrifice' }));
      expect(edit.memberId).toBe('a');
      expect(edit.run.box).toEqual(run.box);
      const reward = sacrificeLine(edit).reward;
      if (reward.kind === 'species') {
        expect(edit.run.party[0].fighter.speciesId).toBe(reward.speciesId);
      }
      if (reward.kind === 'nature') {
        expect(edit.run.party[0].fighter.nature).toBe(reward.nature);
      }
      if (reward.kind === 'secondAbility') {
        expect(edit.run.party[0].secondAbility).toBe(reward.ability);
      }
      expect(edit.run.party[0].fighter.ivs).toBeDefined();
    }
  });

  it('refuses an empty bag before any draw, by reference', () => {
    const run = { ...runWith([member('a')]), bag: [] };
    const edit = sacrifice(run, CTX);
    refuses(edit, run, 'no-bag');
  });

  it('consumes nothing when the reward cannot resolve', async () => {
    const run = bagged(runWith([member('a')]));
    // A context whose sacrifice draws the second-ability row, found with the real
    // rule first: the three draws do not depend on the ability pool.
    let context: MemberEditContext | null = null;
    for (let roomIndex = 0; roomIndex < 200 && context === null; roomIndex++) {
      const probe = sacrifice(run, { roomIndex, npcId: 'sacrifice' });
      if (probe.ok && probe.line.kind === 'sacrifice' && probe.line.reward.kind === 'secondAbility') {
        context = { roomIndex, npcId: 'sacrifice' };
      }
    }
    expect(context).not.toBeNull();

    vi.resetModules();
    vi.doMock('../battle/randomAbility', () => ({ randomAbility: () => undefined }));
    try {
      const fresh = await import('./memberEdits');
      const edit = fresh.sacrifice(run, context!);
      expect(edit.ok).toBe(false);
      if (edit.ok) return;
      expect(edit.reason).toBe('no-ability');
      expect(edit.run).toBe(run);
      expect(edit.run.bag).toEqual(run.bag);
      expect(edit.run.party[0]).toEqual(run.party[0]);
    } finally {
      vi.doUnmock('../battle/randomAbility');
      vi.resetModules();
    }
  });
});

describe('the fixed-seed pins (D11)', () => {
  const CTX = (npcId: string): MemberEditContext => ({ roomIndex: 3, npcId });

  it('pins every Rng-driven edit of one context, and repeats it on a second call', () => {
    const run = bagged(runWith([member('a'), member('b', 'sentret', 5, ['scratch'])]));

    const nature = ok(rerollNature(run, 'a', CTX('nature')));
    expect(nature.line).toEqual({ kind: 'nature', nature: 'Docile' });
    expect(ok(rerollNature(run, 'a', CTX('nature'))).line).toEqual(nature.line);

    const ability = ok(rerollAbility(run, 'a', CTX('ability')));
    expect(ability.line).toEqual({ kind: 'ability', ability: 'Earth Eater' });
    expect(ok(rerollAbility(run, 'a', CTX('ability'))).line).toEqual(ability.line);

    const ivs = ok(rerollIvs(run, 'a', CTX('ivs')));
    expect(ivs.run.party[0].fighter.ivs).toEqual({
      hp: 16,
      atk: 2,
      def: 21,
      spa: 9,
      spd: 25,
      spe: 23,
    });
    expect(ok(rerollIvs(run, 'a', CTX('ivs'))).run.party[0].fighter.ivs).toEqual(
      ivs.run.party[0].fighter.ivs,
    );

    const species = ok(swapSpecies(run, 'a', CTX('species')));
    expect(species.line).toEqual({ kind: 'species', speciesId: 'shelmet' });
    expect(ok(swapSpecies(run, 'a', CTX('species'))).line).toEqual(species.line);

    const offered = sacrificeLine(ok(sacrifice(run, CTX('sacrifice'))));
    expect(offered.itemId).toBe('pokeball');
    expect(offered.reward).toEqual({ kind: 'ivs' });
    expect(sacrificeLine(ok(sacrifice(run, CTX('sacrifice'))))).toEqual(offered);
  });

  it('answers the same edit from the same context and a different one from another room', () => {
    const run = bagged(runWith([member('a')]));
    expect(ok(rerollNature(run, 'a', CTX('nature'))).line).toEqual(
      ok(rerollNature(run, 'a', CTX('nature'))).line,
    );
    const rooms = new Set<string>();
    for (let roomIndex = 0; roomIndex < 12; roomIndex++) {
      rooms.add(
        (ok(rerollNature(run, 'a', { roomIndex, npcId: 'nature' })).line as { nature: string }).nature,
      );
    }
    expect(rooms.size).toBeGreaterThan(1);
  });
});
