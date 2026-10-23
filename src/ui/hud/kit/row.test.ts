import { h } from 'preact';
import { describe, expect, it, vi } from 'vitest';
import { Row } from './row';
import { rowClass } from './classes';

describe('Row', () => {
  it('is a plain div when it carries no press handler', () => {
    const vnode = h(Row, { children: 'Potion' });
    expect(vnode.type).toBe(Row);
    const rendered = Row({ children: 'Potion' });
    expect(rendered.type).toBe('div');
    expect(rendered.props.class).toBe(rowClass({ interactive: false }));
  });

  it('is a real button when onPress is present, and only then', () => {
    const rendered = Row({ onPress: () => undefined, children: 'Potion' });
    expect(rendered.type).toBe('button');
    expect(rendered.props.type).toBe('button');
    expect(rendered.props.class).toBe(rowClass({ interactive: true }));
    expect(rendered.props.class).toContain('kit-row--interactive');
  });

  it('marks a selected row with aria-current', () => {
    const selected = Row({ selected: true, onPress: () => undefined });
    expect(selected.props['aria-current']).toBe('true');
    expect(selected.props.class).toContain('kit-row--selected');
    const plain = Row({ onPress: () => undefined });
    expect(plain.props['aria-current']).toBeUndefined();
  });

  it('disables both the button and its accessible state, and never calls onPress', () => {
    const onPress = vi.fn();
    const rendered = Row({ onPress, disabled: true });
    expect(rendered.props.disabled).toBe(true);
    expect(rendered.props['aria-disabled']).toBe('true');
    expect(rendered.props.class).toContain('kit-row--disabled');
    expect(rendered.props.onClick).toBeUndefined();
  });

  it('passes the handler straight through when enabled', () => {
    const onPress = vi.fn();
    const rendered = Row({ onPress });
    expect(rendered.props.onClick).toBe(onPress);
    expect(rendered.props.disabled).toBe(false);
    expect(rendered.props['aria-disabled']).toBeUndefined();
  });

  it('adds the caller class after the modifiers', () => {
    expect(Row({ class: 'bag-row', onPress: () => undefined }).props.class).toBe(
      'kit-row kit-row--interactive bag-row',
    );
  });
});
