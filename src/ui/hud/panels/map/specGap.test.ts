import { describe, expect, it } from 'vitest';
import fixture from '../../../../../design/fixtures/03o-panels-map-routes.json';
import screenSpec from '../../../../../design/screens/03o-panels-map-routes.json';
import type { MapView } from '../../../mapView';
import { GAP_TOLERANCE, gapFor, gapIsEmpty, type ScreenSpec, type SpecBox } from '../../specGap';
import { buildView, slug } from '../../specGap.views/map';
import { mapPanelBox, mapPanelView } from './view';

/**
 * The `03o Panels · map routes` frame measured against the panel's own view model: the
 * adapter that answers for this slug, the region map the frame draws and the floor
 * minimap the game ships, the empty claim the delta forces, and the title line the card
 * prints that the board does not carry.
 */

const SPEC = screenSpec as unknown as ScreenSpec;
const DESKTOP = { width: 1280, height: 800 };

/** The frame's `map.view`, pasted as data by the fixture. */
const mapView = fixture.map.view as unknown as MapView;

type FrameText = Readonly<{ name: string; characters: string }>;

const TEXT = screenSpec.text as unknown as readonly FrameText[];

const fold = (line: string): string => line.trim().toUpperCase();

const textOf = (name: string): string => TEXT.find((node) => node.name === name)?.characters ?? '';

const frameBox = (name: string): SpecBox => {
  const box = SPEC.boxes.find((entry) => entry.name === name);
  if (box === undefined) throw new Error(`the frame draws no box named "${name}"`);
  return box;
};

const view = (): ReturnType<typeof mapPanelView> => mapPanelView(mapView, fixture.map.title, DESKTOP);

describe('the 03o adapter', () => {
  it('answers for the board frame it is named after', () => {
    expect(slug).toBe('03o-panels-map-routes');
    expect(SPEC.slug).toBe(slug);
  });

  it('measures a frame of 35 boxes, 4 text nodes and 18 colours', () => {
    expect(SPEC.boxes).toHaveLength(35);
    expect(SPEC.text).toHaveLength(4);
    expect(SPEC.colours).toHaveLength(18);
  });

  it('claims no box, no string and no colour over the shipped card', () => {
    expect(buildView(SPEC)).toStrictEqual({ boxes: [], strings: [], colours: [] });
  });

  it('reports an empty gap against its own spec', () => {
    expect(gapFor(buildView(SPEC), SPEC)).toStrictEqual({
      missing: [],
      moved: [],
      strings: [],
      colours: [],
    });
    expect(gapIsEmpty(gapFor(buildView(SPEC), SPEC))).toBe(true);
  });

  it('builds the same view twice: no clock, no rng, no store', () => {
    expect(buildView(SPEC)).toStrictEqual(buildView(SPEC));
  });
});

describe('the premise: a region map drawn where the game docks a minimap', () => {
  it('draws the card, its highlight, its chip and the ROUTE/MAP toggle', () => {
    expect(frameBox('map routes panel')).toMatchObject({ x: 928, y: 24, width: 304, height: 198 });
    expect(frameBox('map routes highlight')).toMatchObject({
      x: 942.59,
      y: 36,
      width: 280,
      height: 1,
    });
    expect(frameBox('key map')).toMatchObject({ x: 942.59, y: 36, width: 29.18, height: 24 });
    expect(frameBox('view route')).toMatchObject({ x: 1096, y: 36, width: 54, height: 20 });
    expect(frameBox('view map')).toMatchObject({ x: 1156, y: 36, width: 44, height: 20 });
  });

  it('carries the four strings of the board card, none of them the run title', () => {
    expect(TEXT.map((node) => node.characters)).toStrictEqual(['M', 'ROUTE', 'MAP', 'VIRIDIAN FOREST']);
  });

  it('docks the shipped card at 8, 8, 216, 250: dx -920, dy -16, dw -88, dh +52', () => {
    expect(mapPanelBox(DESKTOP)).toStrictEqual({ x: 8, y: 8, w: 216, h: 250 });
    const shipped = mapPanelBox(DESKTOP);
    const frame = frameBox('map routes panel');
    const delta = {
      dx: shipped.x - frame.x,
      dy: shipped.y - frame.y,
      dw: shipped.w - frame.width,
      dh: shipped.h - frame.height,
    };
    expect(delta).toStrictEqual({ dx: -920, dy: -16, dw: -88, dh: 52 });
    for (const step of Object.values(delta)) expect(Math.abs(step)).toBeGreaterThan(GAP_TOLERANCE);
  });

  it('draws the highlight 12 px inside the card, at 20, 20, 192, 1 in the viewport', () => {
    const card = view();
    expect(card.highlight).toStrictEqual({ x: 12, y: 12, w: 192, h: 1 });
    expect({
      x: card.box.x + card.highlight.x,
      y: card.box.y + card.highlight.y,
      w: card.highlight.w,
      h: card.highlight.h,
    }).toStrictEqual({ x: 20, y: 20, w: 192, h: 1 });
  });
});

describe('the shipped card the frame does not draw', () => {
  it('prints the run title, which the board title cannot carry after the fold', () => {
    expect(view().title.text).toBe('Map 1 · Viridian Forest');
    expect(textOf('map routes title')).toBe('VIRIDIAN FOREST');
    expect(fold(view().title.text)).not.toBe(fold(textOf('map routes title')));
    expect(buildView(SPEC).strings).toStrictEqual([]);
  });

  it('draws the floor it has: one room, one link, one entry opening', () => {
    const card = view();
    expect(card.empty).toBeNull();
    expect(card.rooms).toHaveLength(1);
    expect(card.links).toHaveLength(1);
    expect(card.links[0]).toMatchObject({ from: 0, to: 1 });
    const room = card.rooms[0]!;
    expect(room.id).toBe(0);
    expect(room.current).toBe(true);
    expect(room.markers.map((marker) => marker.kind)).toEqual(['capture']);
    expect(room.openings).toHaveLength(1);
    expect(room.openings[0]).toMatchObject({ edge: 'E', kind: 'entry' });
    expect(room.openings[0]!.d).toBe('M 90.4 101.995 V 127.339');
  });
});
