import { describe, expect, it } from 'vitest';
import { getDexItem, getMove } from '../../../data/dex';
import { itemIconFrame } from '../../../data/itemIcons';
import { ITEMS, getItem, type ItemDef } from '../../../data/items';
import { Rng } from '../../rng';
import { createFighter, type BattleFighter } from '../fighter';
import { activeFighter, createBattle, type BattleState } from '../state';
import { takeTurn, performSwitch, useMove } from '../turn';
import { movePreview } from '../preview';
import {
  getEffect,
  makeContext,
  runFractionalPriority,
  runModifyAccuracy,
  runModifyCritRatio,
  runModifyDamage,
  runModifyMove,
  runModifyMoveType,
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

  it('keeps every G-Max Stone registered without handlers, on the Hard Stone icon', () => {
    const stones = ITEMS.filter((item) => item.gmax !== undefined);
    expect(stones.length).toBe(34);
    const fallback = itemIconFrame('hardstone');
    expect(fallback, 'the atlas carries the Hard Stone fallback').not.toBeNull();
    for (const stone of stones) {
      expect(UNMODELLED_ITEMS, stone.id).not.toContain(stone.id);
      expect(getEffect(stone.id)?.kind, stone.id).toBe('item');
      expect(getEffect(stone.id)?.handlers, stone.id).toEqual({});
      expect(itemIconFrame(stone.id), stone.id).toBe(fallback);
    }
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
    expect(
      state.log.some((event) => event.kind === 'text' && event.key === 'battle.log.item.usedUp'),
    ).toBe(true);
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
    expect(runModifyDamage(playerContext(state), getMove('ember')!, enemy.hp + 50, 2)).toBe(
      enemy.hp - 1,
    );
    expect(enemy.heldItem).toBeNull();
  });

  it('does not fire for a Focus Sash holder that is already hurt', () => {
    const state = defenderHolds('focussash');
    const enemy = activeFighter(state, 'enemy');
    enemy.hp = enemy.maxHp - 1;
    expect(runModifyDamage(playerContext(state), getMove('ember')!, enemy.hp + 50, 2)).toBe(
      enemy.hp + 50,
    );
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
    expect(
      state.log.some(
        (event) =>
          event.kind === 'text' &&
          event.key === 'battle.log.item.lostHp' &&
          event.params?.item === 'lifeorb',
      ),
    ).toBe(true);
    expect(
      state.log.some((event) => event.kind === 'damage' && event.side === 'player' && event.amount > 0),
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
    expect(() => takeTurn(state, { type: 'bag', itemId: 'leftovers' }, fight)).toThrow(/Held items/);
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
      createFighter({
        id: 'player',
        speciesId: holderSpecies,
        level: 20,
        ability,
        heldItem: itemId,
        moves: ['ember'],
      }),
    ],
    enemy: [
      createFighter({
        id: 'enemy',
        speciesId: enemySpecies,
        level: 20,
        ability: enemyAbility,
        moves: ['tackle'],
      }),
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

  it('Ripen doubles the berry heal from the second ability slot', () => {
    const state = createBattle({
      player: [
        createFighter({
          id: 'player',
          speciesId: 'applin',
          level: 20,
          ability: 'Gluttony',
          secondAbility: 'Ripen',
          heldItem: 'sitrusberry',
          moves: ['ember'],
        }),
      ],
      enemy: [createFighter({ id: 'enemy', speciesId: 'bulbasaur', level: 18, moves: ['tackle'] })],
      rng: new Rng(99),
      isWild: true,
    });
    const player = activeFighter(state, 'player');
    player.hp = Math.floor(player.maxHp / 4);
    const before = player.hp;

    runResidual(playerContext(state));

    expect(player.hp).toBe(before + 2 * Math.floor(player.maxHp / 4));
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
    expect(
      state.log.some((event) => event.kind === 'text' && event.key === 'battle.log.item.unnerve'),
    ).toBe(true);
  });
});

describe('item-driven move retypes (D37)', () => {
  const multiattack = getMove('multiattack')!;
  const technoblast = getMove('technoblast')!;
  const naturalgift = getMove('naturalgift')!;
  const judgmentMove = getMove('judgment')!;

  it('retypes Multi-Attack to the held Memory, and to nothing else', () => {
    expect(runModifyMoveType(playerContext(battle('firememory')), multiattack)).toBe('Fire');
    expect(runModifyMoveType(playerContext(battle()), multiattack)).toBe('Normal');
    expect(runModifyMoveType(playerContext(battle('charcoal')), multiattack)).toBe('Normal');
    expect(runModifyMoveType(playerContext(battle('shockdrive')), multiattack)).toBe('Normal');
  });

  it('retypes Techno Blast to the held Drive, and to nothing else', () => {
    expect(runModifyMoveType(playerContext(battle('shockdrive')), technoblast)).toBe('Electric');
    expect(runModifyMoveType(playerContext(battle()), technoblast)).toBe('Normal');
    expect(runModifyMoveType(playerContext(battle('charcoal')), technoblast)).toBe('Normal');
    expect(runModifyMoveType(playerContext(battle('firememory')), technoblast)).toBe('Normal');
  });

  it('finds every Memory on Multi-Attack and every Drive on Techno Blast', () => {
    const memories = ITEMS.filter((item) => item.memory !== undefined);
    expect(memories.length).toBe(17);
    for (const item of memories) {
      const ctx = playerContext(battle(item.id));
      expect(runModifyMoveType(ctx, multiattack), item.id).toBe(item.memory);
      for (const move of [technoblast, judgmentMove, getMove('tackle')!, naturalgift]) {
        expect(runModifyMoveType(ctx, move), `${item.id} ${move.id}`).toBe(move.type);
      }
    }

    const drives = ITEMS.filter((item) => item.drive !== undefined);
    expect(drives.length).toBe(4);
    for (const item of drives) {
      const ctx = playerContext(battle(item.id));
      expect(runModifyMoveType(ctx, technoblast), item.id).toBe(item.drive);
      for (const move of [multiattack, judgmentMove, getMove('tackle')!, naturalgift]) {
        expect(runModifyMoveType(ctx, move), `${item.id} ${move.id}`).toBe(move.type);
      }
    }
  });

  it('reads Natural Gift from the berry, and leaves other holders alone', () => {
    const gift = runModifyMove(playerContext(battle('sitrusberry')), naturalgift);
    expect(gift.type).toBe('Psychic');
    expect(gift.basePower).toBe(80);

    for (const heldItem of [undefined, 'charcoal', 'firememory', 'shockdrive']) {
      expect(runModifyMove(playerContext(battle(heldItem)), naturalgift), heldItem).toBe(naturalgift);
    }
  });

  it('answers every catalogue row its dex pair, or the move itself', () => {
    for (const item of ITEMS) {
      const state = item.kind === 'held' ? battle(item.id) : battle();
      const result = runModifyMove(playerContext(state), naturalgift);
      const gift = getDexItem(item.id)?.naturalGift;
      if (gift && !UNMODELLED_ITEMS.includes(item.id)) {
        expect(result.type, item.id).toBe(gift.type);
        expect(result.basePower, item.id).toBe(gift.basePower);
      } else {
        expect(result, item.id).toBe(naturalgift);
      }
    }
  });

  it('leaves the eleven unmodelled berries unregistered and Natural Gift alone', () => {
    for (const id of [
      'custapberry',
      'enigmaberry',
      'jabocaberry',
      'keeberry',
      'lansatberry',
      'leppaberry',
      'marangaberry',
      'persimberry',
      'rowapberry',
      'starfberry',
      'tamatoberry',
    ]) {
      expect(UNMODELLED_ITEMS, id).toContain(id);
      expect(getEffect(id), id).toBeUndefined();
      expect(runModifyMove(playerContext(battle(id)), naturalgift), id).toBe(naturalgift);
    }
  });

  it('reads the retype through the registry, so Klutz and Magic Room suppress it', () => {
    const klutz = createBattle({
      player: [
        createFighter({
          id: 'player',
          speciesId: 'charmander',
          level: 20,
          ability: 'Klutz',
          heldItem: 'firememory',
          moves: ['ember'],
        }),
      ],
      enemy: [fighter('enemy', 'bulbasaur')],
      rng: new Rng(99),
      isWild: true,
    });
    expect(runModifyMoveType(playerContext(klutz), multiattack)).toBe('Normal');

    const magicRoom = battle('firememory');
    magicRoom.field.magicroom = 5;
    expect(runModifyMoveType(playerContext(magicRoom), multiattack)).toBe('Normal');
  });
});

describe('Natural Gift in a real turn', () => {
  const fight = { type: 'fight', moveIndex: 0 } as const;

  function giftBattle(heldItem?: string): BattleState {
    return createBattle({
      player: [
        createFighter({
          id: 'player',
          speciesId: 'snorlax',
          level: 20,
          moves: ['naturalgift'],
          ...(heldItem ? { heldItem } : {}),
        }),
      ],
      enemy: [createFighter({ id: 'enemy', speciesId: 'caterpie', level: 5, moves: ['tackle'] })],
      rng: new Rng(99),
      isWild: true,
    });
  }

  const usedUp = (state: BattleState): number =>
    state.log.filter(
      (event) =>
        event.kind === 'text' &&
        event.key === 'battle.log.item.usedUp' &&
        event.params?.item === 'sitrusberry',
    ).length;

  it('spends the berry once and deals the damage it powered', () => {
    const control = giftBattle();
    takeTurn(control, fight, fight);
    const controlEnemy = activeFighter(control, 'enemy');
    expect(controlEnemy.maxHp - controlEnemy.hp).toBe(0);

    const state = giftBattle('sitrusberry');
    takeTurn(state, fight, fight);
    const player = activeFighter(state, 'player');
    const enemy = activeFighter(state, 'enemy');

    expect(player.heldItem).toBeNull();
    expect(player.lastItemId).toBe('sitrusberry');
    expect(usedUp(state)).toBe(1);
    expect(enemy.maxHp - enemy.hp).toBeGreaterThan(0);

    takeTurn(state, fight, fight);
    expect(usedUp(state)).toBe(1);
  });

  it('keeps the berry when the move never resolved (the foe protected itself)', () => {
    const state = giftBattle('sitrusberry');
    activeFighter(state, 'enemy').volatiles.protect = 'protect';

    takeTurn(state, fight, fight);

    expect(activeFighter(state, 'player').heldItem).toBe('sitrusberry');
    expect(usedUp(state)).toBe(0);
  });

  it('shows the same type and power in the FIGHT preview', () => {
    const berry = movePreview(giftBattle('sitrusberry'), 'player', 0)!;
    expect(berry.type).toBe('Psychic');
    expect(berry.basePower).toBe(80);
    expect(berry.power).toBeGreaterThan(0);

    const plain = movePreview(giftBattle(), 'player', 0)!;
    expect(plain.type).toBe('Normal');
    expect(plain.basePower).toBe(0);
  });
});

describe('the NPC items', () => {
  it('registers the Smoke Ball on the escape hook', () => {
    const effect = getEffect('smokeball');
    expect(effect?.kind).toBe('item');
    expect(typeof effect?.handlers.onTryEscape).toBe('function');
  });

  it('lets the Smoke Ball holder escape a no-flee wild', () => {
    const state = battle('smokeball');
    const ctx = playerContext(state);
    expect(getEffect('smokeball')?.handlers.onTryEscape?.(ctx)).toBe(true);
  });

  it('raises Attack and Sp. Atk once with the Spiced Stew, then spends it', () => {
    const state = battle('chefstew');
    const player = activeFighter(state, 'player');
    expect(player.hp).toBe(player.maxHp);

    runResidual(playerContext(state));

    expect(player.boosts.atk).toBe(1);
    expect(player.boosts.spa).toBe(1);
    expect(player.heldItem).toBeNull();
    expect(player.lastItemId).toBe('chefstew');

    runResidual(playerContext(state));
    expect(player.boosts.atk).toBe(1);
    expect(player.boosts.spa).toBe(1);
  });
});

describe('the Tera Crystals (Task-103)', () => {
  const crystals = ITEMS.filter((item) => item.teraType !== undefined);

  /** A battle whose lead and bench both hold `held`. */
  function twoMemberBattle(held: string): BattleState {
    return createBattle({
      player: [
        createFighter({
          id: 'lead',
          speciesId: 'bulbasaur',
          level: 20,
          moves: ['tackle'],
          heldItem: held,
        }),
        createFighter({
          id: 'reserve',
          speciesId: 'squirtle',
          level: 20,
          moves: ['tackle'],
          heldItem: held,
        }),
      ],
      enemy: [createFighter({ id: 'enemy', speciesId: 'charmander', level: 18, moves: ['ember'] })],
      rng: new Rng(7),
      isWild: true,
    });
  }

  it('registers an onStart handler for all 18 crystals', () => {
    expect(crystals.length).toBe(18);
    for (const crystal of crystals) {
      const effect = getEffect(crystal.id);
      expect(effect?.kind, crystal.id).toBe('item');
      expect(typeof effect?.handlers.onStart, crystal.id).toBe('function');
    }
  });

  it('replaces the holder’s types on the start hook, pushing no log line', () => {
    const state = twoMemberBattle('teracrystalfire');
    const lead = activeFighter(state, 'player');
    // The start hooks already ran, so the lead is Fire the moment it takes the field.
    expect(lead.types).toEqual(['Fire']);

    lead.types = ['Grass', 'Poison'];
    const before = state.log.length;
    getEffect('teracrystalfire')?.handlers.onStart?.(playerContext(state));
    expect(lead.types).toEqual(['Fire']);
    expect(state.log.length).toBe(before);
  });

  it('applies again on a switch-in', () => {
    const state = twoMemberBattle('teracrystalfire');
    expect(state.sides.player.party[1].types).toEqual(['Water']);
    performSwitch(state, 'player', 1);
    expect(state.sides.player.party[1].types).toEqual(['Fire']);
  });

  it('leaves a holder already of that single type alone', () => {
    const state = createBattle({
      player: [
        createFighter({
          id: 'lead',
          speciesId: 'charmander',
          level: 20,
          moves: ['tackle'],
          heldItem: 'teracrystalfire',
        }),
      ],
      enemy: [createFighter({ id: 'enemy', speciesId: 'bulbasaur', level: 18, moves: ['tackle'] })],
      rng: new Rng(7),
      isWild: true,
    });
    const lead = activeFighter(state, 'player');
    expect(lead.types).toEqual(['Fire']);
    expect(getEffect('teracrystalfire')?.handlers.onStart?.(playerContext(state))).toBeUndefined();
    expect(lead.types).toEqual(['Fire']);
  });

  it('leaves a fainted holder untouched', () => {
    const state = twoMemberBattle('teracrystalfire');
    const lead = activeFighter(state, 'player');
    lead.types = ['Grass', 'Poison'];
    lead.hp = 0;
    getEffect('teracrystalfire')?.handlers.onStart?.(playerContext(state));
    expect(lead.types).toEqual(['Grass', 'Poison']);
  });

  it('never retypes a fighter that is not the holder', () => {
    const state = twoMemberBattle('teracrystalfire');
    const lead = activeFighter(state, 'player');
    lead.types = ['Grass', 'Poison'];
    // The bench holder's crystal, run with the lead as the effect's source.
    const ctx = { ...playerContext(state), owner: state.sides.player.party[1] };
    getEffect('teracrystalfire')?.handlers.onStart?.(ctx);
    expect(lead.types).toEqual(['Grass', 'Poison']);
  });
});

describe('Binding Band (Task-159)', () => {
  it('is registered as an item effect, never a no-op row', () => {
    expect(UNMODELLED_ITEMS).not.toContain('bindingband');
    const effect = getEffect('bindingband');
    expect(effect?.kind).toBe('item');
    expect(effect?.handlers.onModifyTrapDamage).toBeTypeOf('function');
  });

  it('makes a trapped holder pay a sixth instead of an eighth', () => {
    const state = createBattle({
      player: [
        createFighter({
          id: 'player',
          speciesId: 'charmander',
          level: 30,
          moves: ['bind', 'splash'],
        }),
      ],
      enemy: [
        createFighter({
          id: 'enemy',
          speciesId: 'squirtle',
          level: 20,
          heldItem: 'bindingband',
          moves: ['splash'],
        }),
      ],
      rng: new Rng(3),
      isWild: true,
    });
    const enemy = activeFighter(state, 'enemy');
    expect(enemy.maxHp).toBe(53);

    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    const landed = enemy.hp;
    expect(enemy.volatiles.partiallyTrapped?.moveId).toBe('bind');

    takeTurn(state, { type: 'fight', moveIndex: 1 }, { type: 'fight', moveIndex: 0 });
    expect(enemy.hp).toBe(landed - 8);
  });
});
