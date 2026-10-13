import { describe, expect, it } from 'vitest';
import { getMove } from '../../../data/dex';
import { ITEMS, getItem, type ItemDef } from '../../../data/items';
import { Rng } from '../../rng';
import { createFighter, type BattleFighter } from '../fighter';
import { activeFighter, createBattle, type BattleState } from '../state';
import { takeTurn } from '../turn';
import {
  getEffect,
  makeContext,
  runFractionalPriority,
  runModifyAccuracy,
  runModifyCritRatio,
  runModifyDamage,
  runModifySpe,
  runResidual,
  type EffectContext,
} from './registry';
import { UNMODELLED_ITEMS } from './items';

function fighter(id: string, speciesId: string, heldItem?: string): BattleFighter {
  return createFighter({
    id,
    speciesId,
    level: 20,
    ...(heldItem ? { heldItem } : {}),
  });
}

function battle(playerHeld?: string, rngSeed = 99): BattleState {
  return createBattle({
    player: [
      createFighter({
        id: 'player',
        speciesId: 'charmander',
        level: 20,
        moves: ['ember'],
        ...(playerHeld ? { heldItem: playerHeld } : {}),
      }),
    ],
    enemy: [
      createFighter({
        id: 'enemy',
        speciesId: 'bulbasaur',
        level: 18,
        moves: ['tackle'],
      }),
    ],
    rng: new Rng(rngSeed),
    isWild: true,
  });
}

function playerContext(state: BattleState): EffectContext {
  return makeContext(state, 'player', {
    source: activeFighter(state, 'player'),
    target: activeFighter(state, 'enemy'),
  });
}

const held = (id: string): ItemDef => {
  const item = ITEMS.find((entry) => entry.id === id);
  if (!item) throw new Error(`missing item ${id}`);
  return item;
};

const heldItem = (state: BattleState, side: 'player' | 'enemy'): string | null =>
  activeFighter(state, side).heldItem;

describe('held item effects', () => {
  it('registers every modelled held item and leaves the no-op ones unregistered', () => {
    for (const item of ITEMS) {
      if (item.kind !== 'held') continue;
      const effect = getEffect(item.id);
      if (UNMODELLED_ITEMS.includes(item.id)) expect(effect, item.id).toBeUndefined();
      else expect(effect?.kind, item.id).toBe('item');
    }
  });

  it('names every unmodelled id as a held catalogue row, exactly once', () => {
    expect(new Set(UNMODELLED_ITEMS).size).toBe(UNMODELLED_ITEMS.length);
    for (const id of UNMODELLED_ITEMS) expect(getItem(id)?.kind, id).toBe('held');
  });

  it('keeps a Mega Stone registered without handlers, since the Mega command is its effect', () => {
    const stone = ITEMS.find((item) => item.mega !== undefined);
    expect(stone).toBeDefined();
    expect(getEffect(stone!.id)?.kind).toBe('item');
    expect(getEffect(stone!.id)?.handlers).toEqual({});
  });

  it('never pairs a type boost with a damage boost', () => {
    for (const item of ITEMS) expect(Boolean(item.typeBoost && item.damageBoost), item.id).toBe(false);
  });

  it('restores 1/16 max HP each residual with Leftovers', () => {
    const state = battle('leftovers');
    const player = activeFighter(state, 'player');
    player.hp = Math.floor(player.maxHp / 4);
    const before = player.hp;

    runResidual(playerContext(state));

    expect(player.hp).toBe(before + Math.floor(player.maxHp / 16));
    expect(player.heldItem).toBe('leftovers');
  });

  it('does not fire Leftovers at full HP', () => {
    const state = battle('leftovers');
    const player = activeFighter(state, 'player');
    runResidual(playerContext(state));
    expect(player.hp).toBe(player.maxHp);
    expect(player.heldItem).toBe('leftovers');
  });

  it('heals a berry only below half and consumes it once', () => {
    const state = battle('sitrusberry');
    const player = activeFighter(state, 'player');
    player.hp = Math.floor(player.maxHp / 2) + 1;

    runResidual(playerContext(state));
    expect(player.heldItem).toBe('sitrusberry');

    player.hp = Math.floor(player.maxHp / 2);
    const before = player.hp;
    runResidual(playerContext(state));

    expect(player.hp).toBe(before + Math.floor(player.maxHp / 4));
    expect(player.heldItem).toBeNull();
  });

  it('cures a status with Lum Berry and is consumed', () => {
    const state = battle('lumberry');
    const player = activeFighter(state, 'player');
    player.status = 'brn';

    runResidual(playerContext(state));

    expect(player.status).toBeNull();
    expect(player.heldItem).toBeNull();
  });

  it('leaves Lum Berry alone when there is nothing to cure', () => {
    const state = battle('lumberry');
    runResidual(playerContext(state));
    expect(activeFighter(state, 'player').heldItem).toBe('lumberry');
  });

  it('cures only the status the berry names', () => {
    const state = battle('cheriberry');
    const player = activeFighter(state, 'player');
    player.status = 'brn';

    runResidual(playerContext(state));
    expect(player.status).toBe('brn');
    expect(player.heldItem).toBe('cheriberry');

    player.status = 'par';
    runResidual(playerContext(state));
    expect(player.status).toBeNull();
    expect(player.heldItem).toBeNull();
  });
});

describe('type-boost items', () => {
  it("multiplies only the holder's moves of the matching type", () => {
    const state = battle('charcoal');
    const ctx = playerContext(state);

    expect(runModifyDamage(ctx, getMove('ember')!, 100)).toBe(120);
    expect(runModifyDamage(ctx, getMove('tackle')!, 100)).toBe(100);
  });

  it('ignores a defender-held type item', () => {
    const state = createBattle({
      player: [fighter('player', 'charmander')],
      enemy: [fighter('enemy', 'bulbasaur', 'charcoal')],
      rng: new Rng(7),
      isWild: true,
    });

    expect(runModifyDamage(playerContext(state), getMove('ember')!, 100)).toBe(100);
  });
});

describe('damage items', () => {
  it('gates the category boosters to their own category', () => {
    expect(runModifyDamage(playerContext(battle('muscleband')), getMove('scratch')!, 100)).toBe(110);
    expect(runModifyDamage(playerContext(battle('muscleband')), getMove('ember')!, 100)).toBe(100);
    expect(runModifyDamage(playerContext(battle('choicespecs')), getMove('ember')!, 100)).toBe(150);
    expect(runModifyDamage(playerContext(battle('choicespecs')), getMove('scratch')!, 100)).toBe(100);
  });

  it('boosts a super-effective hit with an Expert Belt and a plain one without', () => {
    const ctx = playerContext(battle('expertbelt'));
    expect(runModifyDamage(ctx, getMove('ember')!, 100, 2)).toBe(120);
    expect(runModifyDamage(ctx, getMove('ember')!, 100, 1)).toBe(100);
  });

  it('multiplies any damaging hit with a Life Orb', () => {
    expect(runModifyDamage(playerContext(battle('lifeorb')), getMove('ember')!, 100)).toBe(130);
  });

  it('spends a Normal Gem on the boosted hit', () => {
    const state = battle('normalgem');
    expect(runModifyDamage(playerContext(state), getMove('ember')!, 100, 2)).toBe(130);
    expect(heldItem(state, 'player')).toBeNull();
    expect(state.log.some((event) => event.kind === 'text' && event.text.includes('used up'))).toBe(true);
  });

  it('ignores a defender-held booster', () => {
    const state = createBattle({
      player: [fighter('player', 'charmander')],
      enemy: [fighter('enemy', 'bulbasaur', 'lifeorb')],
      rng: new Rng(7),
      isWild: true,
    });
    expect(runModifyDamage(playerContext(state), getMove('ember')!, 100)).toBe(100);
  });
});

describe('resist berries', () => {
  function defenderHolds(itemId: string): BattleState {
    return createBattle({
      player: [fighter('player', 'charmander')],
      enemy: [fighter('enemy', 'bulbasaur', itemId)],
      rng: new Rng(7),
      isWild: true,
    });
  }

  it('halves a super-effective hit of its own type and is spent', () => {
    const state = defenderHolds('occaberry');
    expect(runModifyDamage(playerContext(state), getMove('ember')!, 100, 2)).toBe(50);
    expect(heldItem(state, 'enemy')).toBeNull();
  });

  it('stays put on a neutral or wrong-type hit', () => {
    const state = defenderHolds('occaberry');
    const ctx = playerContext(state);
    expect(runModifyDamage(ctx, getMove('ember')!, 100, 1)).toBe(100);
    expect(runModifyDamage(ctx, getMove('tackle')!, 100, 2)).toBe(100);
    expect(heldItem(state, 'enemy')).toBe('occaberry');
  });

  it('lets the Chilan Berry halve an unboosted Normal-type hit', () => {
    const state = defenderHolds('chilanberry');
    expect(runModifyDamage(playerContext(state), getMove('tackle')!, 100, 1)).toBe(50);
    expect(heldItem(state, 'enemy')).toBeNull();
  });

  it('never fires for the attacker holding it', () => {
    const state = battle('occaberry');
    expect(runModifyDamage(playerContext(state), getMove('ember')!, 100, 2)).toBe(100);
    expect(heldItem(state, 'player')).toBe('occaberry');
  });
});

describe('Focus Sash and Focus Band', () => {
  function defenderHolds(itemId: string): BattleState {
    return createBattle({
      player: [fighter('player', 'charmander')],
      enemy: [fighter('enemy', 'bulbasaur', itemId)],
      rng: new Rng(7),
      isWild: true,
    });
  }

  it('leaves a full-HP Focus Sash holder at 1 HP once', () => {
    const state = defenderHolds('focussash');
    const enemy = activeFighter(state, 'enemy');
    expect(runModifyDamage(playerContext(state), getMove('ember')!, enemy.hp + 50, 2)).toBe(enemy.hp - 1);
    expect(enemy.heldItem).toBeNull();
  });

  it('does not fire for a Focus Sash holder that is already hurt', () => {
    const state = defenderHolds('focussash');
    const enemy = activeFighter(state, 'enemy');
    enemy.hp = enemy.maxHp - 1;
    expect(runModifyDamage(playerContext(state), getMove('ember')!, enemy.hp + 50, 2)).toBe(enemy.hp + 50);
    expect(enemy.heldItem).toBe('focussash');
  });

  it('leaves a hit that would not KO alone', () => {
    const state = defenderHolds('focusband');
    const enemy = activeFighter(state, 'enemy');
    expect(runModifyDamage(playerContext(state), getMove('ember')!, 1, 2)).toBe(1);
    expect(enemy.heldItem).toBe('focusband');
  });
});

describe('status, speed, accuracy and priority items', () => {
  it('burns the holder with a Flame Orb and never spends it', () => {
    const state = createBattle({
      player: [fighter('player', 'bulbasaur', 'flameorb')],
      enemy: [fighter('enemy', 'charmander')],
      rng: new Rng(11),
      isWild: true,
    });
    const player = activeFighter(state, 'player');

    runResidual(playerContext(state));

    expect(player.status).toBe('brn');
    expect(player.heldItem).toBe('flameorb');
    expect(state.log.some((event) => event.kind === 'status' && event.status === 'brn')).toBe(true);
  });

  it('badly poisons the holder with a Toxic Orb', () => {
    const state = createBattle({
      player: [fighter('player', 'charmander', 'toxicorb')],
      enemy: [fighter('enemy', 'bulbasaur')],
      rng: new Rng(11),
      isWild: true,
    });
    const player = activeFighter(state, 'player');

    runResidual(playerContext(state));

    expect(player.status).toBe('tox');
    expect(player.statusCounter).toBe(1);
  });

  it('raises one stat with a pinch berry at 1/4 HP and consumes it', () => {
    const state = battle('liechiberry');
    const player = activeFighter(state, 'player');
    player.hp = Math.floor(player.maxHp / 3);
    runResidual(playerContext(state));
    expect(player.boosts.atk).toBe(0);
    expect(player.heldItem).toBe('liechiberry');

    player.hp = Math.floor(player.maxHp / 4);
    runResidual(playerContext(state));

    expect(player.boosts.atk).toBe(1);
    expect(player.heldItem).toBeNull();
    expect(state.log.some((event) => event.kind === 'boost' && event.stat === 'atk')).toBe(true);
  });

  it('raises Speed with a Salac Berry', () => {
    const state = battle('salacberry');
    const player = activeFighter(state, 'player');
    player.hp = Math.floor(player.maxHp / 4);

    runResidual(playerContext(state));

    expect(player.boosts.spe).toBe(1);
  });

  it('scales Speed with a Choice Scarf and an Iron Ball', () => {
    expect(runModifySpe(playerContext(battle('choicescarf')), 100)).toBe(150);
    expect(runModifySpe(playerContext(battle('ironball')), 100)).toBe(50);
    expect(runModifySpe(playerContext(battle()), 100)).toBe(100);
  });

  it('multiplies the hit chance with a Wide Lens', () => {
    expect(runModifyAccuracy(playerContext(battle('widelens')), 0.8)).toBeCloseTo(0.88);
  });

  it('adds a crit stage with a Scope Lens', () => {
    const state = battle('scopelens');
    expect(runModifyCritRatio(playerContext(state), getMove('ember')!, 0)).toBe(1);
    expect(runModifyCritRatio(playerContext(state), getMove('ember')!, 1)).toBe(2);
  });

  it('acts last with a Lagging Tail', () => {
    expect(runFractionalPriority(playerContext(battle('laggingtail')))).toBe(-1);
    expect(runFractionalPriority(playerContext(battle()))).toBe(0);
  });
});

describe('held items in the turn loop', () => {
  const fight = { type: 'fight', moveIndex: 0 } as const;

  it('leftovers heal lands at the end of a real turn', () => {
    const control = battle();
    takeTurn(control, fight, fight);
    const controlHp = activeFighter(control, 'player').hp;

    const state = battle('leftovers');
    takeTurn(state, fight, fight);
    const player = activeFighter(state, 'player');

    expect(player.hp - controlHp).toBe(Math.floor(player.maxHp / 16));
  });

  it('Life Orb recoil lands at the end of a real turn', () => {
    const control = battle();
    takeTurn(control, fight, fight);
    const controlHp = activeFighter(control, 'player').hp;

    const state = battle('lifeorb');
    takeTurn(state, fight, fight);
    const player = activeFighter(state, 'player');

    expect(controlHp - player.hp).toBe(Math.floor(player.maxHp / 10));
    expect(state.log.some((event) => event.kind === 'text' && event.text.includes('Life Orb'))).toBe(true);
    expect(
      state.log.some(
        (event) => event.kind === 'damage' && event.side === 'player' && event.amount > 0,
      ),
    ).toBe(true);
  });

  it('a resist berry halves the incoming hit at the end of a real turn', () => {
    const control = battle();
    takeTurn(control, fight, fight);
    const controlPlayer = activeFighter(control, 'player');
    const incoming = controlPlayer.maxHp - controlPlayer.hp;

    const state = battle('chilanberry');
    takeTurn(state, fight, fight);
    const player = activeFighter(state, 'player');

    expect(player.heldItem).toBeNull();
    expect(incoming).toBeGreaterThan(1);
    expect(player.hp).toBe(player.maxHp - Math.max(1, Math.floor(incoming / 2)));
  });

  it('rejects a held item used from the Bag', () => {
    const state = battle('leftovers');
    state.bag.push({ item: held('leftovers'), count: 1 });
    expect(() =>
      takeTurn(state, { type: 'bag', itemId: 'leftovers' }, fight),
    ).toThrow(/Held items/);
  });
});

function itemBattle(
  holderSpecies: string,
  ability: string,
  itemId: string,
  enemySpecies = 'bulbasaur',
  enemyAbility = 'Overgrow',
): BattleState {
  return createBattle({
    player: [
      createFighter({ id: 'player', speciesId: holderSpecies, level: 20, ability, heldItem: itemId, moves: ['ember'] }),
    ],
    enemy: [
      createFighter({ id: 'enemy', speciesId: enemySpecies, level: 20, ability: enemyAbility, moves: ['tackle'] }),
    ],
    rng: new Rng(99),
    isWild: true,
  });
}

describe('berry abilities (batch 7)', () => {
  it('Ripen doubles the berry heal', () => {
    const state = itemBattle('applin', 'Ripen', 'sitrusberry');
    const player = activeFighter(state, 'player');
    player.hp = Math.floor(player.maxHp / 4);
    const before = player.hp;

    runResidual(playerContext(state));

    expect(player.hp).toBe(before + 2 * Math.floor(player.maxHp / 4));
    expect(player.heldItem).toBeNull();
  });

  it('Cheek Pouch heals a third of max HP when a berry is eaten', () => {
    const state = itemBattle('greedent', 'Cheek Pouch', 'sitrusberry');
    const player = activeFighter(state, 'player');
    player.hp = Math.floor(player.maxHp / 4);
    const before = player.hp;

    runResidual(playerContext(state));

    expect(player.hp).toBe(before + Math.floor(player.maxHp / 4) + Math.floor(player.maxHp / 3));
    expect(player.heldItem).toBeNull();
  });

  it('Unnerve stops the foe from eating its berry', () => {
    const state = itemBattle('charmander', 'Blaze', 'sitrusberry', 'ekans', 'Unnerve');
    const player = activeFighter(state, 'player');
    player.hp = Math.floor(player.maxHp / 4);
    const before = player.hp;

    runResidual(playerContext(state));

    expect(player.hp).toBe(before);
    expect(player.heldItem).toBe('sitrusberry');
    expect(state.log.some((event) => event.kind === 'text' && event.text.includes('Unnerve'))).toBe(true);
  });
});
