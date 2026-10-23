import { h } from 'preact';
import { describe, expect, it } from 'vitest';
import { Panel } from './panel';
import { panelClass } from './classes';

describe('Panel', () => {
  it('is a section whose class comes from its helper', () => {
    const vnode = h(Panel, { title: 'Options' });
    expect(vnode.type).toBe(Panel);
    const rendered = Panel({ title: 'Options' });
    expect(rendered.type).toBe('section');
    expect(rendered.props.class).toBe(panelClass());
  });

  it('adds the caller class through the helper, never inline', () => {
    expect(Panel({ class: 'options' }).props.class).toBe(panelClass({ class: 'options' }));
    expect(Panel({ class: 'options' }).props.class).toBe('kit-panel options');
  });

  it('renders the header only when a title or an aside is given', () => {
    const bare = Panel({});
    expect(bare.props.children[0]).toBeNull();
    const titled = Panel({ title: 'Bag' });
    expect(titled.props.children[0].type).toBe('header');
    expect(titled.props.children[0].props.class).toBe('kit-panel__header');
  });

  it('puts the title at the title type size and the aside at the meta one', () => {
    const header = Panel({ title: 'Bag', aside: '3/6' }).props.children[0];
    const [title, aside] = header.props.children;
    expect(title.type).toBe('h2');
    expect(title.props.class).toBe('kit-panel__title');
    expect(title.props.children).toBe('Bag');
    expect(aside.type).toBe('span');
    expect(aside.props.class).toBe('kit-panel__aside');
    expect(aside.props.children).toBe('3/6');
  });

  it('renders the children after the header and never an extra node', () => {
    const rendered = Panel({ title: 'Bag', children: 'body' });
    expect(rendered.props.children).toHaveLength(2);
    expect(rendered.props.children[1]).toBe('body');
  });
});
