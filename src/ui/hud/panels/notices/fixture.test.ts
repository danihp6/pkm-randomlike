import { describe, expect, it } from 'vitest';
import fixture from '../../../../../design/fixtures/03k-panels-notice-item.json';
import { t } from '../../../../i18n';
import { isHudState } from '../../fixtures';
import { missionBox, noticeBox, noticesPanelView, type NoticesInput } from './index';

const DESKTOP = { width: 1280, height: 800 };

/** The scene hands the view the lines the run carries, never the fixture object. */
function inputFrom(): NoticesInput {
  return { notice: fixture.notice.text, area: fixture.area, mission: fixture.mission };
}

describe('design/fixtures/03k-panels-notice-item.json', () => {
  it('carries a snapshot state that passes isHudState unchanged', () => {
    expect(isHudState(fixture.state)).toBe(true);
    expect(Object.keys(fixture.state)).toEqual(['party', 'bag', 'money', 'route', 'battle', 'notice']);
  });

  it('stores the frame’s own line as the i18n key already prints it', () => {
    expect(fixture.notice.text).toBe('Obtained Potion!');
    expect(fixture.notice.text).toBe(t('notice.itemObtained', { name: 'Potion' }));
  });

  it('paints the notice on the board’s 720 × 56 strip at (280,24)', () => {
    const view = noticesPanelView(inputFrom(), DESKTOP);
    expect(view.notice).toEqual({ text: fixture.notice.text, box: noticeBox(DESKTOP) });
    expect(view.notice?.box).toEqual({ x: 280, y: 24, w: 720, h: 56 });
  });

  it('draws no mission and no area banner, because the fixture carries neither', () => {
    const view = noticesPanelView(inputFrom(), DESKTOP);
    expect(view.mission).toBeNull();
    expect(view.area).toBeNull();
    expect(missionBox(DESKTOP).h).toBe(32);
  });
});
