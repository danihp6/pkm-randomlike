/**
 * The hand-rolled PNG codec the art pipelines use lives under `scripts/` and is
 * plain ESM JavaScript, so the one headless test that reads a committed atlas
 * (`src/render/moveFx.test.ts`) needs a type for it without pulling `scripts/`
 * into the TypeScript program. Only the functions that test exercises are
 * declared; extend this if another src test starts importing it.
 */
declare module '*/png-codec.mjs' {
  export type Png = Readonly<{ width: number; height: number; data: Uint8Array }>;
  export function decodePng(buffer: Uint8Array): Png;
  export function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array;
  export function inpaint(
    tile: { width: number; height: number; data: Uint8Array },
    isBad: (r: number, g: number, b: number, a: number) => boolean,
  ): void;
}
