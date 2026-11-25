import { BufferImageSource, CompressedSource, getSupportedCompressedTextureFormats, ImageSource, parseDDS, Texture, type Renderer } from 'pixi.js';
import { fetched } from './tables';

// Baked pictures in: fetched, decoded off the main thread (createImageBitmap), made textures with GPU mipmaps (the
// LOD between a picture's baked levels), and uploaded during load, so the first frame uploads nothing.

/** A picture fetched and decoded off the main thread. */
export const decode = async (url: string): Promise<ImageBitmap> => createImageBitmap(await (await fetched(url)).blob());

/** A tiling picture of values, not colours: decoded exact (no colour conversion, no premultiplied alpha), wrapped. */
export const decodeData = async (url: string): Promise<ImageBitmap> =>
  createImageBitmap(await (await fetched(url)).blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });

/** A mipmapped, linearly filtered texture of a decoded picture, uploaded now; `data` for decodeData's tiling values. */
export function upload(renderer: Renderer, bm: ImageBitmap, data = false): Texture {
  const source = new ImageSource({
    resource: bm, autoGenerateMipmaps: true, scaleMode: 'linear', mipmapFilter: 'linear',
    ...(data ? { addressMode: 'repeat', alphaMode: 'no-premultiply-alpha' } as const : {}),
  });
  renderer.texture.initSource(source);
  return new Texture({ source });
}

/**
 * A picture the GPU keeps compressed, from its .bc1 or .bc3 files (gen/bake/dds.cjs: a level's file, then those after
 * it; BC3 premultiplied, BC1 opaque), each fetched and inflated off the main thread, their mips one chain, uploaded now.
 * A GPU without the format throws here.
 */
export async function compressed(renderer: Renderer, urls: readonly string[]): Promise<Texture> {
  const formats = await getSupportedCompressedTextureFormats();
  const parts = await Promise.all(urls.map(async (url) =>
    parseDDS(await new Response((await fetched(url)).body!.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(), formats)));
  const source = new CompressedSource({
    ...parts[0]!, resource: parts.flatMap((p) => p.resource as Uint8Array[]), scaleMode: 'linear', mipmapFilter: 'linear',
    alphaMode: 'premultiplied-alpha',
  });
  renderer.texture.initSource(source);
  return new Texture({ source });
}

/**
 * A w x h RGBA byte texture the view writes (a field worked out from baked tables), linearly filtered, made on the GPU
 * now so its first showing uploads nothing; `send` uploads what was written.
 */
export function dataTexture(renderer: Renderer, w: number, h: number): { bytes: Uint8Array; tex: Texture; send(): void } {
  const bytes = new Uint8Array(w * h * 4);
  const source = new BufferImageSource({ resource: bytes, width: w, height: h, format: 'rgba8unorm', scaleMode: 'linear', alphaMode: 'no-premultiply-alpha' });
  renderer.texture.initSource(source);
  return { bytes, tex: new Texture({ source }), send: () => source.update() };
}

/** Tiles of at most TILE px: no picture outgrows the smallest GPU's texture size. */
const TILE = 2048;

/** A big picture as tiles of at most TILE px, each uploaded; `x`, `y` are the tile's px in the whole. */
export async function tiles(renderer: Renderer, url: string): Promise<{ tex: Texture; x: number; y: number }[]> {
  const whole = await decode(url);
  const cols = Math.ceil(whole.width / TILE), rows = Math.ceil(whole.height / TILE);
  const tw = Math.ceil(whole.width / cols), th = Math.ceil(whole.height / rows);
  const cut: Promise<ImageBitmap>[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) cut.push(createImageBitmap(whole, x * tw, y * th, Math.min(tw, whole.width - x * tw), Math.min(th, whole.height - y * th)));
  }
  const bms = await Promise.all(cut);
  whole.close();
  return bms.map((bm, i) => ({ tex: upload(renderer, bm), x: (i % cols) * tw, y: Math.floor(i / cols) * th }));
}
