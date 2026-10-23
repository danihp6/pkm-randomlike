import { h } from 'preact';
import { describe, expect, it } from 'vitest';
import { Meta } from './meta';

describe('Meta', () => {
  it('is a span', () => {
    const vnode = h(Meta, { children: 'Lv. 12' });
    expect(vnode.type).toBe(Meta);
    const rendered = Meta({ children: 'Lv. 12' });
    expect(rendered.type).toBe('span');
    expect(rendered.props.children).toBe('Lv. 12');
  });

  it('defaults to the muted tone', () => {
    expect(Meta({}).props.class).toBe('kit-meta kit-meta--muted');
  });

  it('names one modifier per tone', () => {
    for (const tone of ['primary', 'secondary', 'muted', 'faint', 'warning', 'accent'] as const) {
      expect(Meta({ tone }).props.class).toBe(`kit-meta kit-meta--${tone}`);
    }
  });
});
