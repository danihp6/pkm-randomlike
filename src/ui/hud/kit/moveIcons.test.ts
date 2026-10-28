import { describe, expect, it } from 'vitest';
import categoryManifest from '../../../data/frlg/move-categories.json';
import typeManifest from '../../../data/frlg/type-icons.json';
import {
  MOVE_ICON_BOX,
  MoveCategoryIcon,
  MoveTypeBadge,
  moveCategorySprite,
  moveTypeSprite,
  spriteBox,
  type MoveIconSprite,
} from './moveIcons';

const TYPES: readonly (readonly [string, number])[] = Object.entries(typeManifest.types);
const CATEGORIES: readonly (readonly [string, number])[] = Object.entries(categoryManifest.categories);

/** The two px numbers of a `"96px 52.5px"` pair. */
function pair(value: string): readonly [number, number] {
  const match = /^(-?[\d.]+)px\s+(-?[\d.]+)px$/.exec(value);
  expect(match, value).not.toBeNull();
  return [Number(match![1]), Number(match![2])];
}

/** The one px number of an `inset(6.75px 0px)` clip. */
function inset(value: string): readonly [number, number] {
  const match = /^inset\((-?[\d.]+)px\s+(-?[\d.]+)px\)$/.exec(value);
  expect(match, value).not.toBeNull();
  return [Number(match![1]), Number(match![2])];
}

/** Where one frame of the packed atlas lands inside the box, in box coordinates. */
function paintedRect(sprite: MoveIconSprite, box: number): readonly [number, number, number, number] {
  const style = spriteBox(sprite, box);
  const [sizeW, sizeH] = pair(style.backgroundSize);
  const [posX, posY] = pair(style.backgroundPosition);
  const frameW = sizeW / sprite.cols;
  const frameH = sizeH / sprite.rows;
  const col = sprite.frame % sprite.cols;
  const row = Math.floor(sprite.frame / sprite.cols);
  return [posX + col * frameW, posY + row * frameH, frameW, frameH];
}

describe('moveTypeSprite', () => {
  it('resolves every type the atlas carries to its own frame, in the 4 x 5 grid', () => {
    expect(TYPES.length).toBe(19);
    for (const [type, frame] of TYPES) {
      expect(moveTypeSprite(type), type).toStrictEqual({
        url: moveTypeSprite(type)!.url,
        frame,
        w: 32,
        h: 14,
        cols: 4,
        rows: 5,
      });
      expect(moveTypeSprite(type)!.url).toMatch(/type-icons/);
    }
  });

  it('takes its case from the accessor, so a dex name and a lowercased one agree', () => {
    expect(moveTypeSprite('Fire')!.frame).toBe(10);
    expect(moveTypeSprite('fire')!.frame).toBe(10);
    expect(moveTypeSprite('FAIRY')!.frame).toBe(18);
    expect(moveTypeSprite('psychic')!.frame).toBe(14);
  });

  it('is null for a type the atlas does not carry', () => {
    expect(moveTypeSprite('nonsense')).toBeNull();
    expect(moveTypeSprite('')).toBeNull();
  });
});

describe('moveCategorySprite', () => {
  it('resolves the three categories to frames 0, 1 and 2 of a one-row atlas', () => {
    for (const [category, frame] of CATEGORIES) {
      expect(moveCategorySprite(category), category).toStrictEqual({
        url: moveCategorySprite(category)!.url,
        frame,
        w: 32,
        h: 14,
        cols: 3,
        rows: 1,
      });
      expect(moveCategorySprite(category)!.url).toMatch(/move-categories/);
    }
    expect(moveCategorySprite('Physical')!.frame).toBe(0);
    expect(moveCategorySprite('Special')!.frame).toBe(1);
    expect(moveCategorySprite('Status')!.frame).toBe(2);
  });

  it('is null for a category the atlas does not name', () => {
    expect(moveCategorySprite('nonsense')).toBeNull();
    expect(moveCategorySprite('physical')).toBeNull();
  });
});

describe('spriteBox', () => {
  it('lays the whole packed atlas out, never one frame', () => {
    const fire = moveTypeSprite('fire')!;
    const style = spriteBox(fire);
    expect(pair(style.backgroundSize)).toStrictEqual([96, 52.5]);
    const [x, y] = pair(style.backgroundPosition);
    expect(x).toBeCloseTo(-48, 2);
    expect(y).toBeCloseTo(-14.25, 2);
    expect(style.backgroundImage).toBe(`url("${fire.url}")`);
    expect(style.backgroundRepeat).toBe('no-repeat');
    expect(style.imageRendering).toBe('pixelated');
  });

  it('scales the three-column category atlas the same way', () => {
    expect(pair(spriteBox(moveCategorySprite('Status')!).backgroundSize)).toStrictEqual([72, 10.5]);
    const [x, y] = pair(spriteBox(moveCategorySprite('Status')!).backgroundPosition);
    expect(x).toBeCloseTo(-48, 2);
    expect(y).toBeCloseTo(6.75, 2);
    expect(pair(spriteBox(moveCategorySprite('Physical')!).backgroundPosition)).toStrictEqual([0, 6.75]);
  });

  it('keeps a frame that is not the atlas s first inside the box', () => {
    for (const [type] of TYPES) {
      const sprite = moveTypeSprite(type)!;
      const [x, y, w, h] = paintedRect(sprite, MOVE_ICON_BOX);
      expect(x, type).toBeGreaterThanOrEqual(-0.01);
      expect(y, type).toBeGreaterThanOrEqual(-0.01);
      expect(x + w, type).toBeLessThanOrEqual(MOVE_ICON_BOX + 0.01);
      expect(y + h, type).toBeLessThanOrEqual(MOVE_ICON_BOX + 0.01);
    }
    const [x, y, w, h] = paintedRect(moveTypeSprite('psychic')!, MOVE_ICON_BOX);
    expect([x, y, w, h]).toStrictEqual([0, 6.75, 24, 10.5]);
  });

  it('clips the band to the frame, so no neighbouring row shows through', () => {
    for (const sprite of [moveTypeSprite('fire')!, moveCategorySprite('Status')!]) {
      expect(spriteBox(sprite).clipPath).toBe('inset(6.75px 0px)');
      expect(inset(spriteBox(sprite).clipPath)).toStrictEqual([6.75, 0]);
    }
    expect(spriteBox(moveTypeSprite('psychic')!).clipPath).toBe('inset(6.75px 0px)');
  });

  it('scales the band and the clip with the box it is drawn in', () => {
    const sprite = moveTypeSprite('fire')!;
    expect(pair(spriteBox(sprite, 48).backgroundSize)).toStrictEqual([192, 105]);
    expect(pair(spriteBox(sprite, 48).backgroundPosition)).toStrictEqual([-96, -28.5]);
    expect(spriteBox(sprite, 48).clipPath).toBe('inset(13.5px 0px)');
    expect(spriteBox(sprite).clipPath).toBe(spriteBox(sprite, MOVE_ICON_BOX).clipPath);
  });
});

describe('MoveTypeBadge', () => {
  it('paints one atlas frame in the board s 24 px box, with no text', () => {
    const icon = MoveTypeBadge({ type: 'fire' });
    expect(icon.type).toBe('span');
    expect(icon.props.class).toBe('kit-move-type');
    expect(icon.props.role).toBe('img');
    expect(icon.props['aria-label']).toBe('fire');
    expect(icon.props.children).toBeUndefined();
    const style = icon.props.style as Record<string, unknown>;
    expect(style.width).toBe('24px');
    expect(style.height).toBe('24px');
    for (const key of [
      'backgroundImage',
      'backgroundSize',
      'backgroundPosition',
      'backgroundRepeat',
      'imageRendering',
      'clipPath',
    ]) {
      expect(style[key], key).toBeDefined();
    }
    expect(style.backgroundImage).toMatch(/type-icons/);
  });

  it('falls back to the word chip for a type with no frame', () => {
    const word = MoveTypeBadge({ type: 'nonsense' });
    expect(word.props.class).toBe('kit-type');
    expect(word.props.children).toBe('nonsense');
    expect(word.props.style).toHaveProperty('background');
  });
});

describe('MoveCategoryIcon', () => {
  it('paints the category glyph in the board s 24 px box, with no text', () => {
    const icon = MoveCategoryIcon({ category: 'Special' });
    expect(icon.type).toBe('span');
    expect(icon.props.class).toBe('kit-move-category');
    expect(icon.props.role).toBe('img');
    expect(icon.props['aria-label']).toBe('Special');
    expect(icon.props.children).toBeUndefined();
    const style = icon.props.style as Record<string, unknown>;
    expect(style.width).toBe('24px');
    expect(style.height).toBe('24px');
    expect(style.backgroundImage).toMatch(/move-categories/);
  });

  it('falls back to the raw word for a category with no frame', () => {
    const word = MoveCategoryIcon({ category: 'nonsense' });
    expect(word.props.class).toBe('kit-move-category-text');
    expect(word.props.children).toBe('nonsense');
  });
});
