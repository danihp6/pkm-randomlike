export type Tile = { x: number; y: number };
export type Pixel = { x: number; y: number };

export class Grid {
  readonly tileSize: number;

  constructor(tileSize = 24) {
    this.tileSize = tileSize;
  }

  tileToPixel(tile: Tile): Pixel {
    return { x: tile.x * this.tileSize, y: tile.y * this.tileSize };
  }

  pixelToTile(pixel: Pixel): Tile {
    return {
      x: Math.floor(pixel.x / this.tileSize),
      y: Math.floor(pixel.y / this.tileSize),
    };
  }

  tileCenter(tile: Tile): Pixel {
    const origin = this.tileToPixel(tile);
    const half = this.tileSize / 2;
    return { x: origin.x + half, y: origin.y + half };
  }
}
