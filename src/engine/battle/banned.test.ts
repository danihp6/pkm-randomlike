import { describe, expect, it } from 'vitest';
import { Rng } from '../rng';
import { switchablePartyIndices, validateCommand } from './commands';
import { createFighter } from './fighter';
import { activeFighter, createBattle, type BattleState } from './state';
import { performSwitch } from './turn';

const fighter = (id: string, speciesId: string, level = 20) =>
  createFighter({ id, speciesId, level, nature: 'serious' });

const battle = (extra: Readonly<{ bannedSpecies?: string | null; noHeal?: boolean }> = {}): BattleState =>
  createBattle({
    player: [fighter('a', 'pidgey'), fighter('b', 'geodude'), fighter('c', 'abra')],
    enemy: [fighter('enemy', 'charmander')],
    rng: new Rng(1),
    isWild: false,
    ...extra,
  });

const feed = (state: BattleState, text: string): boolean =>
  state.log.some((event) => event.kind === 'text' && event.text === text);

describe('the banned-species battle rule', () => {
  it('replaces a barred lead with the first living unbarred member', () => {
    const state = battle({ bannedSpecies: 'pidgey' });
    expect(activeFighter(state, 'player').id).toBe('b');
    expect(state.bannedSpecies).toBe('pidgey');
  });

  it('leaves the lead alone when no species is barred', () => {
    expect(activeFighter(battle(), 'player').id).toBe('a');
    expect(activeFighter(battle({ bannedSpecies: null }), 'player').id).toBe('a');
  });

  it('pushes the rule’s line, after the no-heal one', () => {
    const state = battle({ bannedSpecies: 'pidgey', noHeal: true });
    const texts = state.log.flatMap((event) => (event.kind === 'text' ? [event.text] : []));
    expect(texts[0]).toBe('No items or healing moves can be used in this room!');
    expect(texts[1]).toBe('Pidgey is barred in this room!');
    expect(feed(state, 'Pidgey is barred in this room!')).toBe(true);
  });

  it('books the sends it fielded, in order and deduped', () => {
    const state = battle({ bannedSpecies: 'pidgey' });
    expect(state.usedFighterIds).toEqual(['b']);
    performSwitch(state, 'player', 2);
    expect(state.usedFighterIds).toEqual(['b', 'c']);
  });

  it('omits the barred member from the switchable party', () => {
    const state = battle({ bannedSpecies: 'pidgey' });
    expect(switchablePartyIndices(state, 'player')).toEqual([2]);
  });

  it('refuses a switch to the barred member with its own line', () => {
    const state = battle({ bannedSpecies: 'pidgey' });
    expect(validateCommand(state, 'player', { type: 'switch', partyIndex: 0 })).toBe(
      'That Pokémon is barred in this room.',
    );
    expect(validateCommand(state, 'player', { type: 'switch', partyIndex: 2 })).toBeNull();
  });

  it('bends the ban when the barred species is the only living off-field member', () => {
    const state = battle({ bannedSpecies: 'pidgey' });
    state.sides.player.party[2].hp = 0;
    expect(switchablePartyIndices(state, 'player')).toEqual([0]);
    expect(validateCommand(state, 'player', { type: 'switch', partyIndex: 0 })).toBeNull();
  });

  it('never filters the enemy side', () => {
    const state = battle({ bannedSpecies: 'pidgey' });
    state.sides.enemy.party.push(fighter('enemy-2', 'pidgey'));
    expect(switchablePartyIndices(state, 'enemy')).toEqual([1]);
  });
});
