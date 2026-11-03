import { describe, expect, it } from 'vitest';
import starterFixture from '../../../../../design/fixtures/04-starter-pick.json';
import spec from '../../../../../design/screens/04-starter-pick.json';
import { fixtureStarterView, STARTER_BOARD } from '.';
import { gapFor, gapIsEmpty, type GapBox, type ScreenSpec } from '../../specGap';
import { buildView, slug } from '../../specGap.views/starter';

/**
 * Frame `04 Starter pick` against the panel's own view model (`D57`): the three
 * card boxes are the shipped board's, and the six strings the board carries are the
 * pick's own copy — so the adapter measures the screen the panel draws instead of
 * reporting a gap nothing could close.
 */

const SPEC = spec as ScreenSpec;

function cardsOf(view: Readonly<{ boxes: readonly GapBox[] }>): readonly GapBox[] {
  return view.boxes.filter((box) => box.name.startsWith('card '));
}

describe('the 04 starter-pick adapter', () => {
  it('answers for the one slug it is keyed to', () => {
    expect(slug).toBe('04-starter-pick');
    expect(SPEC.slug).toBe(slug);
  });

  it('builds the fixture view, never the live run', () => {
    const fixture = fixtureStarterView(starterFixture);
    expect(fixture).not.toBeNull();
    expect(fixture?.cards).toHaveLength(3);
    expect(fixture?.cards.map((card) => card.speciesId)).toEqual([
      'bulbasaur',
      'charmander',
      'squirtle',
    ]);
  });

  it('draws the three cards at the frame’s own rects', () => {
    const cards = cardsOf(buildView(SPEC));

    expect(cards.map((box) => box.name)).toEqual(['card 1', 'card 2', 'card 3']);
    expect(cards.map((box) => [box.x, box.y, box.w, box.h])).toEqual([
      [218, 176, 260, 320],
      [510, 176, 260, 320],
      [802, 176, 260, 320],
    ]);
  });

  it('places them off STARTER_BOARD.card, one pitch apart', () => {
    const cards = cardsOf(buildView(SPEC));

    for (const [index, box] of cards.entries()) {
      expect(box.x).toBe(STARTER_BOARD.card.x + index * STARTER_BOARD.card.pitch);
      expect(box.y).toBe(STARTER_BOARD.card.y);
      expect(box.w).toBe(STARTER_BOARD.card.w);
      expect(box.h).toBe(STARTER_BOARD.card.h);
    }
  });

  it('claims the frame’s six strings and no colour', () => {
    const view = buildView(SPEC);

    expect(view.strings).toEqual([
      'CHOOSE YOUR STARTER',
      'BULBASAUR',
      'CHARMANDER',
      'SQUIRTLE',
      'SHARE: PKRL-1-f-1a2b3c',
      'HOLD R FOR NEW SEED',
    ]);
    expect(view.colours).toEqual([]);
  });

  it('emits no box the frame does not name, so the gap is empty', () => {
    const named = new Set(SPEC.boxes.flatMap((box) => (box.name === null ? [] : [box.name])));

    for (const box of buildView(SPEC).boxes) expect(named.has(box.name), box.name).toBe(true);
    expect(gapIsEmpty(gapFor(buildView(SPEC), SPEC))).toBe(true);
  });
});
