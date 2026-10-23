import { h } from 'preact';
import { describe, expect, it, vi } from 'vitest';
import { Sheet } from './sheet';

describe('Sheet', () => {
  it('renders nothing at all while it is closed', () => {
    expect(Sheet({})).toBeNull();
    expect(Sheet({ open: false, title: 'Bag' })).toBeNull();
    const vnode = h(Sheet, { open: false });
    expect(vnode.type).toBe(Sheet);
  });

  it('is a section with the handle once open', () => {
    const rendered = Sheet({ open: true });
    expect(rendered).not.toBeNull();
    expect(rendered?.type).toBe('section');
    expect(rendered?.props.class).toBe('kit kit-sheet');
    const handle = rendered?.props.children[0];
    expect(handle.type).toBe('div');
    expect(handle.props.class).toBe('kit-sheet__handle');
    expect(handle.props['aria-hidden']).toBe('true');
  });

  it('renders the title at the title size', () => {
    const header = Sheet({ open: true, title: 'Bag' })?.props.children[1];
    expect(header.type).toBe('header');
    const title = header.props.children[0];
    expect(title.type).toBe('h2');
    expect(title.props.class).toBe('kit-sheet__title');
    expect(title.props.children).toBe('Bag');
  });

  it('wires the close button only when onClose is given', () => {
    const onClose = vi.fn();
    const withClose = Sheet({ open: true, onClose });
    const close = withClose?.props.children[1].props.children[1];
    expect(close.type).toBe('button');
    expect(close.props.type).toBe('button');
    expect(close.props.class).toBe('kit-sheet__close');
    expect(close.props['aria-label']).toBe('Close');
    expect(close.props.onClick).toBe(onClose);
    expect(Sheet({ open: true })?.props.children[1].props.children[1]).toBeNull();
  });

  it('renders the children after the header', () => {
    const rendered = Sheet({ open: true, children: 'body' });
    expect(rendered?.props.children[2]).toBe('body');
  });
});
