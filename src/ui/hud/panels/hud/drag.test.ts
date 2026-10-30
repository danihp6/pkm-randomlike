import { describe, expect, it } from 'vitest';
import { defaultHudLayout, type HudPanelLayout } from '../../../../data/hudLayout';
import { DEFAULT_KEYBINDS } from '../../../../data/keybinds';
import { badgeDrag, badgeLayout, DRAG_SLOP, type BadgeDragStart } from './drag';
import { STRIP_PHONE_SLOTS, STRIP_CHIP_SIZE, stripView, type StripInput } from './view';

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

/** A gesture that starts on the phone's BAG badge (38, 551) with nothing saved. */
function phoneStart(overrides: Partial<BadgeDragStart> = {}): BadgeDragStart {
  return {
    pointerX: 200,
    pointerY: 600,
    dx: 0,
    dy: 0,
    originX: STRIP_PHONE_SLOTS.bag.x,
    originY: STRIP_PHONE_SLOTS.bag.y,
    ...overrides,
  };
}

/** The desk's BAG dock (the right column's second row) with nothing saved. */
const DESK_BAG = { x: 928, y: 42 };

function deskStart(overrides: Partial<BadgeDragStart> = {}): BadgeDragStart {
  return {
    pointerX: 940,
    pointerY: 50,
    dx: 0,
    dy: 0,
    originX: DESK_BAG.x,
    originY: DESK_BAG.y,
    ...overrides,
  };
}

describe('DRAG_SLOP', () => {
  it('is the shipped 3 px the cards already use', () => {
    expect(DRAG_SLOP).toBe(3);
  });
});

describe('badgeDrag', () => {
  it('is a press, not a drag, for a travel the slop still calls a tap', () => {
    const start = phoneStart();
    for (const travel of [
      { x: 0, y: 0 },
      { x: DRAG_SLOP - 1, y: -(DRAG_SLOP - 1) },
      { x: DRAG_SLOP - 1, y: 0 },
    ]) {
      const result = badgeDrag(
        start,
        { x: start.pointerX + travel.x, y: start.pointerY + travel.y },
        PHONE,
        STRIP_CHIP_SIZE,
      );
      expect(result.moved, `${travel.x},${travel.y}`).toBe(false);
      expect({ dx: result.dx, dy: result.dy }).toEqual({ dx: 0, dy: 0 });
    }
  });

  it('counts the slop itself as a drag, on either axis', () => {
    const start = phoneStart();
    expect(
      badgeDrag(start, { x: start.pointerX + DRAG_SLOP, y: start.pointerY }, PHONE, STRIP_CHIP_SIZE)
        .moved,
    ).toBe(true);
    expect(
      badgeDrag(start, { x: start.pointerX, y: start.pointerY - DRAG_SLOP }, PHONE, STRIP_CHIP_SIZE)
        .moved,
    ).toBe(true);
  });

  it('adds the travel to the saved offset on a phone that has room for it', () => {
    const result = badgeDrag(phoneStart(), { x: 240, y: 560 }, PHONE, STRIP_CHIP_SIZE);
    expect(result).toEqual({ dx: 40, dy: -40, moved: true });
  });

  it('adds a second drag to the offset it is handed, so a badge keeps its place', () => {
    const result = badgeDrag(
      phoneStart({ dx: 40, dy: -40 }),
      { x: 240, y: 540 },
      PHONE,
      STRIP_CHIP_SIZE,
    );
    expect({ dx: result.dx, dy: result.dy }).toEqual({ dx: 80, dy: -100 });
  });

  it('clamps a phone drag so origin + offset never leaves 390 × 844 less the badge', () => {
    const far = badgeDrag(phoneStart(), { x: 3_200, y: -3_200 }, PHONE, STRIP_CHIP_SIZE);
    expect(far.dx).toBe(PHONE.width - STRIP_CHIP_SIZE - STRIP_PHONE_SLOTS.bag.x);
    expect(far.dy).toBe(-STRIP_PHONE_SLOTS.bag.y);

    const back = badgeDrag(
      phoneStart({ dx: 300, dy: 200 }),
      { x: -3_000, y: 3_000 },
      PHONE,
      STRIP_CHIP_SIZE,
    );
    expect(back.dx).toBe(-STRIP_PHONE_SLOTS.bag.x);
    expect(back.dy).toBe(PHONE.height - STRIP_CHIP_SIZE - STRIP_PHONE_SLOTS.bag.y);
  });

  it('maps the same gesture onto a desk, where the origin is the docked slot', () => {
    const docked = badgeDrag(deskStart(), { x: 980, y: 10 }, DESKTOP, STRIP_CHIP_SIZE);
    expect(docked).toEqual({ dx: 40, dy: -40, moved: true });
    expect(DESK_BAG.x + docked.dx).toBe(968);
    expect(DESK_BAG.y + docked.dy).toBe(2);

    const clamped = badgeDrag(
      deskStart({ originX: 1200, originY: 780 }),
      { x: 3_000, y: 3_000 },
      DESKTOP,
      STRIP_CHIP_SIZE,
    );
    expect(clamped.dx).toBe(DESKTOP.width - STRIP_CHIP_SIZE - 1200);
    expect(clamped.dy).toBe(DESKTOP.height - STRIP_CHIP_SIZE - 780);
  });

  it('keeps the start offset on a window too small to clamp against, still moved', () => {
    const start = phoneStart({ dx: 12, dy: 8 });
    const pointer = { x: start.pointerX + 40, y: start.pointerY - 40 };
    expect(badgeDrag(start, pointer, { width: 0, height: 0 }, STRIP_CHIP_SIZE)).toEqual({
      dx: 12,
      dy: 8,
      moved: true,
    });
    expect(badgeDrag(start, pointer, { width: -5, height: 844 }, STRIP_CHIP_SIZE).moved).toBe(true);
  });

  it('is pure: the same gesture yields the same result and no input is mutated', () => {
    const start = phoneStart();
    const snapshot = { ...start };
    const viewport = { ...PHONE };
    const pointer = { x: 240, y: 560 };
    expect(badgeDrag(start, pointer, viewport, STRIP_CHIP_SIZE)).toEqual(
      badgeDrag(start, pointer, viewport, STRIP_CHIP_SIZE),
    );
    expect(start).toEqual(snapshot);
    expect(viewport).toEqual(PHONE);
    expect(pointer).toEqual({ x: 240, y: 560 });
  });
});

describe('the record a badge hands its panel', () => {
  it('is that panel’s id and the offset over the flag it started with, unchanged', () => {
    const input: StripInput = {
      open: true,
      slots: [{ id: 'bag', x: 38, y: 422, dx: 0, dy: 0, collapsed: true }],
      keybinds: DEFAULT_KEYBINDS,
    };
    const chip = stripView(input, PHONE).chips[0];
    const calls: { id: string; next: HudPanelLayout }[] = [];
    const onLayout = (id: string, next: HudPanelLayout): void => {
      calls.push({ id, next });
    };

    const result = badgeDrag(
      {
        pointerX: 200,
        pointerY: 600,
        dx: chip.dx,
        dy: chip.dy,
        originX: chip.box.x,
        originY: chip.box.y,
      },
      { x: 240, y: 560 },
      PHONE,
      STRIP_CHIP_SIZE,
    );
    onLayout(chip.id, badgeLayout(chip.collapsed, result));

    expect(calls).toEqual([{ id: 'bag', next: { dx: 40, dy: -40, collapsed: true } }]);
  });
});

describe('badgeLayout', () => {
  it('commits the clamped offset and leaves the collapsed flag as it was', () => {
    const result = badgeDrag(phoneStart(), { x: 240, y: 560 }, PHONE, STRIP_CHIP_SIZE);
    expect(badgeLayout(true, result)).toEqual({ dx: 40, dy: -40, collapsed: true });
    expect(badgeLayout(false, result)).toEqual({ dx: 40, dy: -40, collapsed: false });
  });

  it('writes the same three fields the card’s own frame writes', () => {
    const record = defaultHudLayout().bag;
    expect(Object.keys(badgeLayout(record.collapsed, { dx: 1, dy: 2, moved: true })).sort()).toEqual(
      Object.keys(record).sort(),
    );
  });
});
