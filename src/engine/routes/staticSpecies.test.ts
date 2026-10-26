import { describe, expect, it, vi } from 'vitest';
import { STATIC_GATES, LEGENDARY_SPECIES, STATIC_SPECIES } from '../../data/staticSpecies';
import type { GateKind } from '../../data/gates';
import { createRun, createRunPokemon, type RunState } from '../run';
import { squadLevel } from '../run/state';
import { Rng } from '../rng';
import { gateId, gateRewardId } from './gate';
import { staticGateId, staticGateOpen, staticRoomContent, staticSpeciesId } from './staticSpecies';

const SEED = 'pkm-111';

/** A run whose party is exactly the species the case needs, on a fixed floor. */
function runWith(
  party: readonly string[],
  overrides: Partial<RunState> = {},
  secondAbilities: readonly (string | null)[] = [],
): RunState {
  const members = party.map((speciesId, index) =>
    createRunPokemon({
      id: `member-${index}`,
      speciesId,
      level: 5,
      moves: ['tackle'],
      ...(secondAbilities[index] ? { ability: secondAbilities[index] as string } : {}),
    }),
  );
  const base = createRun({ seed: SEED, starter: members[0] });
  const withSecond = members.map((member, index) =>
    secondAbilities[index] === null || secondAbilities[index] === undefined
      ? member
      : { ...member, secondAbility: secondAbilities[index] as string },
  );
  return { ...base, mapIndex: 4, party: withSecond, ...overrides };
}

/** The two facts `advanceMap` writes that open the legendary branch. */
const FLAWLESS = {
  missionsCompleted: 1,
  mission: { id: 'flawless', progress: 0, completed: false },
} as const;

describe('the static room’s records', () => {
  it('names the seal’s opening exactly as the shipped drafts do', () => {
    expect(staticGateId(3, 7)).toBe('static-3-7');
    expect(staticGateId(0, 0)).toBe('static-0-0');
    expect(staticSpeciesId(3, 7)).toBe('static-mon-3-7');
    expect(staticSpeciesId(0, 0)).toBe('static-mon-0-0');
  });

  it('never collides with the gated leaf’s own ids', () => {
    const foreign = [gateId(3, 7), gateRewardId(3, 7), gateId(0, 0), gateRewardId(0, 0)];
    expect(foreign).not.toContain(staticGateId(3, 7));
    expect(foreign).not.toContain(staticSpeciesId(3, 7));
    expect(foreign).not.toContain(staticGateId(0, 0));
    expect(foreign).not.toContain(staticSpeciesId(0, 0));
  });
});

describe('staticGateOpen', () => {
  const TYPE_GATE = STATIC_GATES.bush;
  const FEATURE_GATE = STATIC_GATES.water;

  it('opens a type gate for a party member of either listed type', () => {
    expect(staticGateOpen(runWith(['caterpie']), TYPE_GATE)).toBe(true);
    expect(staticGateOpen(runWith(['chikorita']), TYPE_GATE)).toBe(true);
  });

  it('refuses a type gate for a party of other types, and for an empty party', () => {
    expect(staticGateOpen(runWith(['squirtle']), TYPE_GATE)).toBe(false);
    expect(staticGateOpen(runWith(['squirtle', 'geodude']), TYPE_GATE)).toBe(false);
    expect(staticGateOpen({ ...runWith(['caterpie']), party: [] }, TYPE_GATE)).toBe(false);
  });

  it('opens a feature gate through a primary ability', () => {
    const run = runWith(['eevee'], { party: [] }, []);
    const member = createRunPokemon({
      id: 'member-0',
      speciesId: 'vaporeon',
      level: 5,
      moves: ['tackle'],
      ability: 'Water Absorb',
    });
    expect(staticGateOpen({ ...run, party: [member] }, FEATURE_GATE)).toBe(true);
  });

  it('opens a feature gate through a second ability too', () => {
    const member = {
      ...createRunPokemon({ id: 'member-0', speciesId: 'eevee', level: 5, moves: ['tackle'] }),
      secondAbility: 'Swift Swim',
    };
    expect(staticGateOpen({ ...runWith(['eevee']), party: [member] }, FEATURE_GATE)).toBe(true);
  });

  it('refuses a feature gate the party does not hold', () => {
    expect(staticGateOpen(runWith(['caterpie']), FEATURE_GATE)).toBe(false);
    expect(staticGateOpen(runWith(['caterpie', 'geodude']), FEATURE_GATE)).toBe(false);
  });
});

describe('staticRoomContent', () => {
  /** `[seed, floor, roomId, obstacle, variant, speciesId]`, pinned verbatim. */
  const CONTENT: readonly (readonly [string, number, number, GateKind, string, string])[] = [
    ['probe-a', 1, 0, 'rock', 'ordinary', 'gible'],
    ['probe-a', 3, 0, 'rock', 'ordinary', 'larvitar'],
    ['probe-a', 4, 0, 'rock', 'ordinary', 'goomy'],
    ['probe-a', 4, 3, 'rock', 'ordinary', 'larvitar'],
    ['probe-a', 4, 7, 'rock', 'ordinary', 'deino'],
    ['probe-a', 6, 7, 'rock', 'ordinary', 'deino'],
    ['probe-b', 4, 0, 'rock', 'legendary', 'moltres'],
    ['probe-c', 4, 3, 'rock', 'legendary', 'mewtwo'],
    ['static-96-0', 4, 5, 'bush', 'legendary', 'moltres'],
    ['static-96-0', 5, 0, 'bush', 'legendary', 'articuno'],
    [SEED, 5, 0, 'bush', 'ordinary', 'frigibax'],
  ];

  it('pins the content of a fixed seed, floor and room, verbatim', () => {
    for (const [seed, floor, roomId, obstacle, variant, speciesId] of CONTENT) {
      const content = staticRoomContent(
        { ...runWith(['caterpie'], FLAWLESS), seed },
        floor,
        roomId,
        obstacle,
      );
      expect({ seed, floor, roomId, variant, speciesId }).toEqual({
        seed,
        floor,
        roomId,
        variant: content.variant,
        speciesId: content.speciesId,
      });
    }
  });

  it('reads the run’s own seed, never the floor alone', () => {
    const asProbeA = staticRoomContent(
      { ...runWith(['caterpie'], FLAWLESS), seed: 'probe-a' },
      4,
      0,
      'rock',
    );
    const asProbeB = staticRoomContent(
      { ...runWith(['caterpie'], FLAWLESS), seed: 'probe-b' },
      4,
      0,
      'rock',
    );
    expect(asProbeA).not.toEqual(asProbeB);
  });

  it('is ordinary by default: a fresh run holds no legendary', () => {
    for (const floor of [1, 3, 4, 6]) {
      const content = staticRoomContent(runWith(['caterpie']), floor, 5, 'bush');
      expect(content.variant, `floor ${floor}`).toBe('ordinary');
      expect(STATIC_SPECIES, `floor ${floor}`).toContain(content.speciesId);
    }
  });

  it('does not flip on the floor’s own losses (reads only advanceMap’s facts)', () => {
    const base = runWith(['caterpie'], FLAWLESS);
    const pin = staticRoomContent({ ...base, seed: 'probe-b' }, 4, 0, 'rock');
    expect(pin.variant).toBe('legendary');
    const hurt: RunState = {
      ...base,
      seed: 'probe-b',
      hpLost: 41,
      floorCasualties: 0,
      stats: { catches: 0, casualties: 2 },
      mission: { ...(base.mission ?? { id: 'flawless', progress: 0, completed: false }), progress: 3 },
    };
    expect(staticRoomContent(hurt, 4, 0, 'rock')).toEqual(pin);
  });

  it('reads the legendary branch only while the run completed exactly one mission', () => {
    const seed = { ...runWith(['caterpie'], FLAWLESS), seed: 'probe-b' };
    expect(staticRoomContent(seed, 4, 0, 'rock').variant).toBe('legendary');
    expect(staticRoomContent({ ...seed, missionsCompleted: 0 }, 4, 0, 'rock').variant).toBe('ordinary');
    expect(staticRoomContent({ ...seed, missionsCompleted: 2 }, 4, 0, 'rock').variant).toBe('ordinary');
  });

  it('reads the legendary branch only on a flawless floor', () => {
    const seed = { ...runWith(['caterpie'], FLAWLESS), seed: 'probe-b' };
    expect(staticRoomContent({ ...seed, mission: null }, 4, 0, 'rock').variant).toBe('ordinary');
    expect(
      staticRoomContent(
        { ...seed, mission: { id: 'something-else', progress: 0, completed: true } },
        4,
        0,
        'rock',
      ).variant,
    ).toBe('ordinary');
  });

  it('never fields a legendary below map 4', () => {
    const seed = { ...runWith(['caterpie'], FLAWLESS), seed: 'probe-b' };
    for (const floor of [1, 2, 3]) {
      const content = staticRoomContent(seed, floor, 0, 'rock');
      expect(content.variant, `floor ${floor}`).toBe('ordinary');
      expect(STATIC_SPECIES, `floor ${floor}`).toContain(content.speciesId);
    }
  });

  it('does not draw the variant stream at all when the floor is ineligible', () => {
    const ineligible = { ...runWith(['caterpie'], FLAWLESS), seed: 'probe-b', missionsCompleted: 0 };
    const eligible = { ...runWith(['caterpie'], FLAWLESS), seed: 'probe-b' };
    const nextSpy = vi.spyOn(Rng.prototype, 'next');
    try {
      nextSpy.mockClear();
      staticRoomContent(ineligible, 4, 0, 'rock');
      const withoutVariant = nextSpy.mock.calls.length;
      nextSpy.mockClear();
      staticRoomContent(eligible, 4, 0, 'rock');
      const withVariant = nextSpy.mock.calls.length;
      expect(withoutVariant).toBe(1);
      expect(withVariant).toBe(2);
    } finally {
      nextSpy.mockRestore();
    }
  });

  it('clamps the floor and reads the squad’s level', () => {
    const seed = { ...runWith(['caterpie'], FLAWLESS), seed: 'probe-a' };
    expect(staticRoomContent(seed, 0, 5, 'bush')).toEqual(staticRoomContent(seed, 1, 5, 'bush'));
    expect(staticRoomContent(seed, 4.9, 5, 'bush')).toEqual(staticRoomContent(seed, 4, 5, 'bush'));
    expect(staticRoomContent(seed, 4, 5, 'bush').level).toBe(squadLevel(seed));
  });

  it('reads the seal’s row from the obstacle kind', () => {
    for (const obstacle of ['bush', 'rock', 'water'] as const) {
      expect(staticRoomContent(runWith(['caterpie']), 5, 1, obstacle).gate).toEqual(
        STATIC_GATES[obstacle],
      );
    }
  });

  it('fields only a list member, on the variant’s own list', () => {
    const legendary = staticRoomContent(
      { ...runWith(['caterpie'], FLAWLESS), seed: 'probe-c' },
      4,
      3,
      'rock',
    );
    expect(LEGENDARY_SPECIES).toContain(legendary.speciesId);
    expect(STATIC_SPECIES).not.toContain(legendary.speciesId);
    for (let roomId = 0; roomId < 12; roomId++) {
      expect(STATIC_SPECIES).toContain(
        staticRoomContent(runWith(['caterpie']), 4, roomId, 'bush').speciesId,
      );
    }
  });

  it('keeps the pre-filter pick for a run whose lines miss the list', () => {
    const content = staticRoomContent(
      { ...runWith(['caterpie'], FLAWLESS), seed: 'probe-a' },
      4,
      0,
      'rock',
    );
    expect(content.speciesId).toBe('goomy');
  });

  it('never fields the line a pikachu run holds, over 20 fixed seeds', () => {
    const held: ReadonlySet<string> = new Set(['pichu', 'pikachu', 'raichu', 'raichualola']);
    for (let i = 0; i < 20; i++) {
      const content = staticRoomContent({ ...runWith(['pikachu']), seed: `held-${i}` }, 4, i, 'bush');
      expect(content.variant, `held-${i}`).toBe('ordinary');
      expect(held.has(content.speciesId), `held-${i}/${content.speciesId}`).toBe(false);
    }
  });

  it('drops a held ordinary line while the rest of the list still draws', () => {
    const held: ReadonlySet<string> = new Set(['larvitar', 'pupitar', 'tyranitar']);
    const picked = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const content = staticRoomContent(
        { ...runWith(['larvitar']), seed: `larvitar-${i}` },
        4,
        i,
        'bush',
      );
      expect(STATIC_SPECIES, `larvitar-${i}/${content.speciesId}`).toContain(content.speciesId);
      expect(held.has(content.speciesId), `larvitar-${i}/${content.speciesId}`).toBe(false);
      picked.add(content.speciesId);
    }
    expect(picked.size).toBeGreaterThan(1);
  });

  it('falls back to the unfiltered list when the run holds every ordinary line', () => {
    const content = staticRoomContent(
      { ...runWith([...STATIC_SPECIES], FLAWLESS), seed: 'probe-a' },
      4,
      0,
      'rock',
    );
    expect(content.variant).toBe('ordinary');
    expect(content.speciesId).toBe('goomy');
  });

  it('falls back to the unfiltered list when the run holds every legendary', () => {
    const content = staticRoomContent(
      { ...runWith([...LEGENDARY_SPECIES], FLAWLESS), seed: 'probe-b' },
      4,
      0,
      'rock',
    );
    expect(content.variant).toBe('legendary');
    expect(content.speciesId).toBe('moltres');
  });

  it('reproduces itself: the same facts always give the same content', () => {
    const run = { ...runWith(['caterpie'], FLAWLESS), seed: 'probe-c' };
    expect(staticRoomContent(run, 4, 3, 'rock')).toEqual(staticRoomContent(run, 4, 3, 'rock'));
  });
});
