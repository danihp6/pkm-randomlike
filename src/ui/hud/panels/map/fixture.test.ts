import { describe, expect, it } from 'vitest';
import fixture from '../../../../../design/fixtures/03o-panels-map-routes.json';
import type { MapView } from '../../../mapView';
import { isHudState } from '../../fixtures';
import { mapPanelView } from './view';

const DESKTOP = { width: 1280, height: 800 } as const;

/** The fixture's `map.view` is the frame's own `MapView`, pasted as data. */
const mapView = fixture.map.view as unknown as MapView;

describe('design/fixtures/03o-panels-map-routes.json', () => {
  it('carries a bare HudState the store accepts unchanged', () => {
    expect(fixture.slug).toBe('03o-panels-map-routes');
    expect(isHudState(fixture.state)).toBe(true);
  });

  it('paints the frame: its title, one room, one link, the capture ball', () => {
    const view = mapPanelView(mapView, fixture.map.title, DESKTOP);
    expect(view.title.text).toBe('Map 1 · Viridian Forest');
    expect(view.box).toEqual({ x: 8, y: 8, w: 216, h: 250 });
    expect(view.empty).toBeNull();
    expect(view.rooms).toHaveLength(1);
    expect(view.links).toHaveLength(1);
    const room = view.rooms[0]!;
    expect(room.id).toBe(0);
    expect(room.current).toBe(true);
    expect(room.markers.map((marker) => marker.kind)).toEqual(['capture']);
    expect(room.openings).toHaveLength(1);
    expect(room.openings[0]).toMatchObject({ edge: 'E', kind: 'entry' });
    expect(room.openings[0]!.d).toBe('M 90.4 101.995 V 127.339');
    expect(view.links[0]).toMatchObject({ from: 0, to: 1 });
  });
});
