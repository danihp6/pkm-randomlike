import { describe, expect, it } from 'vitest';
import { previewRequested } from './preview';

describe('previewRequested', () => {
  it('is true only when both flags ask for this slug', () => {
    for (const search of [
      '?hud=dom&hudFixture=02-options',
      '?hudFixture=02-options&hud=dom',
      '?hud=dom&hudFixture=02-options&extra=1',
      '?extra=1&hud=DOM&hudFixture=02-OPTIONS',
    ]) {
      expect(previewRequested(search), search).toBe(true);
    }
  });

  it('is false without both flags or for another frame', () => {
    for (const search of [
      '',
      '?hud=dom',
      '?hudFixture=02-options',
      '?hud=dom&hudFixture=03-route-hud',
      '?hud=dom&hudFixture=m02-options',
      '?hud=dom&hudFixture=02 options',
      '?hud=dom&hudFixture=02%20options',
      '?hud=game&hudFixture=02-options',
    ]) {
      expect(previewRequested(search), search).toBe(false);
    }
  });
});
