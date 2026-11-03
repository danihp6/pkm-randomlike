import { describe, expect, it } from 'vitest';
import fixture from '../../../../../design/fixtures/03o-panels-map-routes.json';
import { isHudState } from '../../fixtures';

/**
 * The `03o Panels · map routes` fixture is the frame's own `HudState`, pasted as data.
 * The card no longer paints a floor minimap from it (the region map comes from the
 * plan now), so this file only guards the store contract the fixture still has to meet.
 */

describe('design/fixtures/03o-panels-map-routes.json', () => {
  it('carries a bare HudState the store accepts unchanged', () => {
    expect(fixture.slug).toBe('03o-panels-map-routes');
    expect(isHudState(fixture.state)).toBe(true);
  });
});
