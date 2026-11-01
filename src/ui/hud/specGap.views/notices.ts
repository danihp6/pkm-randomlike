import noticeFixture from '../../../../design/fixtures/03k-panels-notice-item.json';
import { noticesPanelView } from '../panels/notices';
import type { PanelView, ScreenSpec } from '../specGap';

/** The screen this adapter answers for: one slug, one spec, one panel. */
export const slug = '03k-panels-notice-item';

const DESKTOP = { width: 1280, height: 800 };

/**
 * The notice stack's view, built exactly as the running panel builds it, narrowed to the
 * strip the frame draws. The card paints no colour of its own (the glass is the
 * stylesheet's tokens), so the comparison has boxes and one string.
 */
export function buildView(spec: ScreenSpec): PanelView {
  const view = noticesPanelView(
    { notice: noticeFixture.notice.text, area: noticeFixture.area },
    DESKTOP,
  );
  const strip = spec.boxes.some((entry) => entry.name === 'notice strip');
  return {
    boxes: strip
      ? [
          {
            name: 'notice strip',
            x: view.notice?.box.x ?? 0,
            y: view.notice?.box.y ?? 0,
            w: view.notice?.box.w ?? 0,
            h: view.notice?.box.h ?? 0,
          },
        ]
      : [],
    strings: [view.notice?.text ?? ''].filter((line) => line !== ''),
    colours: [],
  };
}
