import { h } from 'preact';
import { describe, expect, it, vi } from 'vitest';
import { PrimaryButton } from './primaryButton';

describe('PrimaryButton', () => {
  it('is a real button', () => {
    const vnode = h(PrimaryButton, { onPress: () => undefined });
    expect(vnode.type).toBe(PrimaryButton);
    const rendered = PrimaryButton({ onPress: () => undefined, children: 'Continue' });
    expect(rendered.type).toBe('button');
    expect(rendered.props.type).toBe('button');
    expect(rendered.props.class).toBe('kit kit-button');
    expect(rendered.props.children).toBe('Continue');
  });

  it('calls onPress when enabled', () => {
    const onPress = vi.fn();
    const rendered = PrimaryButton({ onPress });
    expect(rendered.props.disabled).toBe(false);
    rendered.props.onClick();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('honours disabled and drops the handler', () => {
    const onPress = vi.fn();
    const rendered = PrimaryButton({ onPress, disabled: true });
    expect(rendered.props.disabled).toBe(true);
    expect(rendered.props.onClick).toBeUndefined();
  });
});
