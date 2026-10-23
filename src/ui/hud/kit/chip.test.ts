import { h } from 'preact';
import { describe, expect, it, vi } from 'vitest';
import { Chip } from './chip';
import { chipClass } from './classes';

describe('Chip', () => {
  it('is always a button whose class comes from its helper', () => {
    const vnode = h(Chip, { letter: 'M', label: 'Moves' });
    expect(vnode.type).toBe(Chip);
    const rendered = Chip({ letter: 'M', label: 'Moves' });
    expect(rendered.type).toBe('button');
    expect(rendered.props.type).toBe('button');
    expect(rendered.props.class).toBe(chipClass());
  });

  it('renders the initial only and keeps the full name in the accessible label', () => {
    const rendered = Chip({ letter: 'M', label: 'Moves' });
    expect(rendered.props.children).toBe('M');
    expect(rendered.props['aria-label']).toBe('Moves');
  });

  it('switches the active modifier and the press handler', () => {
    const onPress = vi.fn();
    const rendered = Chip({ letter: 'S', label: 'Summary', active: true, onPress });
    expect(rendered.props.class).toBe(chipClass({ active: true }));
    expect(rendered.props.class).toContain('kit-chip--active');
    expect(rendered.props.onClick).toBe(onPress);
  });
});
