import { hudRequested } from '../mount';

/** What the URL asks the DOM HUD for: whether it mounts, and the frame it is pinned to. */
export type HudFlags = Readonly<{ dom: boolean; fixture: string | null }>;

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Trim, lowercase, then accept only a lower-kebab frame slug; anything else is null. */
export function normaliseSlug(value: string): string | null {
  const slug = value.trim().toLowerCase();
  return SLUG.test(slug) ? slug : null;
}

/** Reads `?hud=dom` and `?hudFixture=<slug>` once. `dom` is `hudRequested(search)`. */
export function parseHudFlags(search: string): HudFlags {
  const dom = hudRequested(search);
  const query = search.startsWith('?') ? search.slice(1) : search;
  let fixture: string | null = null;
  for (const pair of query.split('&')) {
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    if (pair.slice(0, separator).trim().toLowerCase() !== 'hudfixture') continue;
    const slug = normaliseSlug(pair.slice(separator + 1));
    if (slug === null) continue;
    fixture = slug;
    break;
  }
  return { dom, fixture };
}
