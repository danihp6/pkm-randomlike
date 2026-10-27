import { describe, expect, it } from 'vitest';
import frame from '../../../../../design/frames/04-starter-pick.json';
import phoneFrame from '../../../../../design/frames/m04-starter-pick.json';
import fixture from '../../../../../design/fixtures/04-starter-pick.json';
import { getSpecies } from '../../../../data/dex';
import { isHudState } from '../../fixtures';
import { portraitCrop } from '../../portrait';
import { fixtureStarterView, starterBoard } from './index';

type Node = Readonly<{
  name?: string;
  type?: string;
  properties?: Readonly<{
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    characters?: string;
  }>;
  children?: readonly Node[];
}>;

type Frame = Readonly<{ slug: string; geometry: readonly Node[]; text: readonly Node[] }>;

type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;

function nodesOf(tree: readonly Node[]): readonly Node[] {
  const out: Node[] = [];
  const walk = (node: Node): void => {
    out.push(node);
    for (const child of node.children ?? []) walk(child);
  };
  for (const node of tree) walk(node);
  return out;
}

function named(frame: Frame, tree: 'geometry' | 'text', name: string): readonly Node[] {
  return nodesOf(frame[tree]).filter((node) => node.name === name);
}

/** The frame's own rect for a uniquely named node; a missing node fails loudly with -1s. */
function rectOf(frame: Frame, name: string): Rect {
  const properties = named(frame, 'geometry', name)[0]?.properties ?? {};
  return {
    x: properties.x ?? -1,
    y: properties.y ?? -1,
    w: properties.width ?? -1,
    h: properties.height ?? -1,
  };
}

function textOf(frame: Frame, name: string): string {
  return named(frame, 'text', name)[0]?.properties?.characters ?? '';
}

/** The box a printed string sits in: the text node that carries it, then its rect. */
function printedRect(frame: Frame, characters: string): Rect {
  const node = nodesOf(frame.text).find((entry) => entry.properties?.characters === characters);
  expect(node, `no text node prints ${JSON.stringify(characters)}`).toBeDefined();
  const properties = node!.properties ?? {};
  const rect = named(frame, 'geometry', node!.name ?? '').find(
    (entry) => entry.properties?.x === properties.x && entry.properties?.y === properties.y,
  );
  expect(rect, `no geometry node under ${JSON.stringify(characters)}`).toBeDefined();
  const box = rect!.properties ?? {};
  return { x: box.x ?? -1, y: box.y ?? -1, w: box.width ?? -1, h: box.height ?? -1 };
}

/** A payload cloned from the fixture with one mutation applied. */
function payloadWith(edit: (starter: Record<string, unknown>) => void): unknown {
  const clone = JSON.parse(JSON.stringify(fixture)) as { starter: Record<string, unknown> };
  edit(clone.starter);
  return clone;
}

const desktop = frame as Frame;
const phone = phoneFrame as Frame;

describe('design/fixtures/04-starter-pick.json', () => {
  const view = fixtureStarterView(fixture);

  it('carries a snapshot state that passes isHudState unchanged', () => {
    expect(isHudState(fixture.state)).toBe(true);
    expect(Object.keys(fixture.state)).toEqual(['party', 'bag', 'money', 'route', 'battle', 'notice']);
  });

  it('draws the frame’s title, its three cards, the share line and the hint', () => {
    expect(view).not.toBeNull();
    expect(view!.title).toBe(textOf(desktop, 'starter title'));
    expect(view!.cards.map((card) => card.speciesId)).toEqual(['bulbasaur', 'charmander', 'squirtle']);
    expect(view!.cards.map((card) => card.name)).toEqual([
      textOf(desktop, 'name 1'),
      textOf(desktop, 'name 2'),
      textOf(desktop, 'name 3'),
    ]);
    expect(view!.share).toBe(textOf(desktop, 'share line'));
    expect(view!.hint).toBe(textOf(desktop, 'seed reroll hint'));
    expect(view!.selected).toBe(0);
  });

  it('agrees with the dex on the cards’ numbers and types', () => {
    for (const card of view!.cards) {
      const species = getSpecies(card.speciesId);
      expect(species, card.speciesId).toBeDefined();
      expect(card.num).toBe(species!.num);
      expect(card.types).toEqual(species!.types.map((type) => type.toLowerCase()));
    }
    expect(view!.cards[0]!.types).toEqual(['grass', 'poison']);
  });

  it('reads each card’s portrait cell from its own species', () => {
    expect(view!.cards.map((card) => card.portrait)).toEqual(
      view!.cards.map((card) => portraitCrop(card.speciesId)),
    );
    for (const card of view!.cards) expect(card.portrait).not.toBeNull();
  });

  it('pins the desktop board to the frame’s own rects', () => {
    const board = starterBoard('desktop');
    const first = rectOf(desktop, 'card 1');

    expect(board.title).toEqual(rectOf(desktop, 'starter title'));
    expect(board.card).toEqual({
      x: first.x,
      y: first.y,
      w: first.w,
      h: first.h,
      pitch: rectOf(desktop, 'card 2').x - first.x,
    });
    expect(rectOf(desktop, 'card 3').x - rectOf(desktop, 'card 2').x).toBe(board.card.pitch);

    const name = rectOf(desktop, 'name 1');
    expect(board.name).toEqual({
      dx: name.x - first.x,
      dy: name.y - first.y,
      w: name.w,
      h: name.h,
    });
    expect(rectOf(desktop, 'name 2').y).toBe(first.y + board.name.dy);
    expect(rectOf(desktop, 'name 3').y).toBe(first.y + board.name.dy);

    const grass = rectOf(desktop, 'type GRASS');
    const poison = rectOf(desktop, 'type POISON');
    expect(grass.w).toBe(board.badge.size);
    expect(grass.h).toBe(board.badge.size);
    expect(grass.x - first.x).toBe(board.badge.dx);
    expect(grass.y - first.y).toBe(board.badge.dy);
    expect(poison.x - grass.x - board.badge.size).toBe(board.badge.gap);
    expect(poison.y).toBe(grass.y);
    // The row is centred, so a two-type card starts where the frame's first badge
    // does and a one-type card centres its single badge: card 2 at 510 → 628, card 3
    // at 802 → 920.
    expect(board.badge.dx).toBe(
      Math.round((board.card.w - (board.badge.size * 2 + board.badge.gap)) / 2),
    );
    const single = Math.round((board.card.w - board.badge.size) / 2);
    expect(rectOf(desktop, 'type FIRE').x - rectOf(desktop, 'card 2').x).toBe(single);
    expect(rectOf(desktop, 'type WATER').x - rectOf(desktop, 'card 3').x).toBe(single);
    expect(rectOf(desktop, 'type FIRE').y - rectOf(desktop, 'card 2').y).toBe(board.badge.dy);
    expect(rectOf(desktop, 'type WATER').y - rectOf(desktop, 'card 3').y).toBe(board.badge.dy);

    expect(board.share).toEqual(rectOf(desktop, 'share line'));
    expect(board.hint).toEqual(rectOf(desktop, 'seed reroll hint'));
  });
});

describe('the phone frame (m04)', () => {
  it('pins the narrow board to the m04 rects', () => {
    const board = starterBoard('narrow');
    const first = rectOf(phone, 'm card 243');
    const second = rectOf(phone, 'm card 359');
    const third = rectOf(phone, 'm card 475');

    expect(board.title).toEqual(printedRect(phone, 'CHOOSE YOUR STARTER'));
    expect(board.card).toEqual({
      x: first.x,
      y: first.y,
      w: first.w,
      h: first.h,
      pitch: second.y - first.y,
    });
    expect(third.y - second.y).toBe(board.card.pitch);

    const name = printedRect(phone, 'BULBASAUR');
    expect(name.x - first.x).toBe(board.name.dx);
    expect(name.y - first.y).toBe(board.name.dy);
    expect(name.h).toBe(board.name.h);
    // The phone frame prints each name in its own box; the board carries the room.
    expect(name.w).toBeLessThanOrEqual(board.name.w);
    expect(printedRect(phone, 'CHARMANDER').y - second.y).toBe(board.name.dy);
    expect(printedRect(phone, 'SQUIRTLE').y - third.y).toBe(board.name.dy);

    // The phone frame draws bulbasaur's duplicate badge on the first one, so only
    // the first badge of each card carries a position.
    const grass = rectOf(phone, 'type GRASS');
    expect(grass.w).toBe(board.badge.size);
    expect(grass.h).toBe(board.badge.size);
    expect(grass.x - first.x).toBe(board.badge.dx);
    expect(grass.y - first.y).toBe(board.badge.dy);
    expect(rectOf(phone, 'type POISON').x).toBe(grass.x);
    expect(rectOf(phone, 'type FIRE').y - second.y).toBe(board.badge.dy);
    expect(rectOf(phone, 'type WATER').y - third.y).toBe(board.badge.dy);

    expect(board.share).toEqual(printedRect(phone, 'SHARE: PKRL-1-f-1a2b3c'));
    expect(board.hint).toEqual(printedRect(phone, 'TAP FOR NEW SEED'));
  });
});

describe('fixtureStarterView guards', () => {
  it('rejects a payload without a starter block', () => {
    expect(fixtureStarterView(null)).toBeNull();
    expect(fixtureStarterView('04-starter-pick')).toBeNull();
    expect(fixtureStarterView({ slug: '04-starter-pick' })).toBeNull();
    expect(fixtureStarterView({ starter: 'nope' })).toBeNull();
    expect(fixtureStarterView([])).toBeNull();
  });

  it('rejects a missing or wrongly typed field', () => {
    expect(
      fixtureStarterView(
        payloadWith((starter) => {
          delete starter.title;
        }),
      ),
    ).toBeNull();
    expect(
      fixtureStarterView(
        payloadWith((starter) => {
          starter.share = null;
        }),
      ),
    ).toBeNull();
    expect(
      fixtureStarterView(
        payloadWith((starter) => {
          starter.hint = 12;
        }),
      ),
    ).toBeNull();
    expect(
      fixtureStarterView(
        payloadWith((starter) => {
          (starter.cards as Record<string, unknown>[])[0]!.num = '1';
        }),
      ),
    ).toBeNull();
    expect(
      fixtureStarterView(
        payloadWith((starter) => {
          (starter.cards as Record<string, unknown>[])[1]!.name = '';
        }),
      ),
    ).toBeNull();
    expect(
      fixtureStarterView(
        payloadWith((starter) => {
          starter.cards = [];
        }),
      ),
    ).toBeNull();
  });

  it('rejects a card whose types is not a string array', () => {
    for (const types of ['grass', ['grass', 3], null, { grass: true }]) {
      const payload = payloadWith((starter) => {
        (starter.cards as Record<string, unknown>[])[0]!.types = types;
      });
      expect(fixtureStarterView(payload), JSON.stringify(types)).toBeNull();
    }
  });

  it('rejects a cursor outside the cards', () => {
    for (const selected of [3, -1, 1.5, '0', null]) {
      const payload = payloadWith((starter) => {
        starter.selected = selected;
      });
      expect(fixtureStarterView(payload), String(selected)).toBeNull();
    }
  });

  it('accepts any cursor inside the cards', () => {
    for (const selected of [0, 1, 2]) {
      const payload = payloadWith((starter) => {
        starter.selected = selected;
      });
      expect(fixtureStarterView(payload)!.selected).toBe(selected);
    }
  });
});
