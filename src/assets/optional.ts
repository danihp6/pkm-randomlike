/**
 * The URL of a packed atlas, or the committed placeholder of the same pixel size
 * when the ripped art is absent from this checkout.
 *
 * The ripped atlases are gitignored and packed locally by `npm run assets:pack`
 * from the private `pkrl-assets` store; `src/assets/placeholders/` carries a
 * blank of every atlas's real size so a clone without that store still builds,
 * boots and draws something, and the frame grids the manifests describe stay
 * valid.
 */
export function packedAtlasUrl(
  urls: Readonly<Record<string, string>>,
  path: string,
  placeholder: string,
): string {
  return urls[path] ?? placeholder;
}
