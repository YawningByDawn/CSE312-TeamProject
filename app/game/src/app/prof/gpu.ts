import { draw, upload } from './probe';

// The GPU's calls, counted where the page makes them: every WebGL and WebGPU draw call and texture upload goes to the
// function on top of the probe stack, and every texture's size to the memory line. The view needs no hook: whatever
// renderer it runs, its calls reach the GPU through these.

/** Live textures and their bytes (level 0, four bytes a pixel; a mip chain counts a third more). */
export const textures = { n: 0, bytes: 0 };
const sized = new WeakMap<object, number>();

function size(tex: object | null, bytes: number): void {
  if (!tex) return;
  const was = sized.get(tex);
  if (was === undefined) textures.n++;
  textures.bytes += bytes - (was ?? 0);
  sized.set(tex, bytes);
}

function drop(tex: object | null): void {
  const was = tex ? sized.get(tex) : undefined;
  if (was === undefined) return;
  textures.n--;
  textures.bytes -= was;
  sized.delete(tex!);
}

type Fn = (...a: unknown[]) => unknown;
/** `after` runs before the call, with its receiver and arguments; the call is the original's. */
function wrap(proto: object | undefined, keys: string[], after: (self: never, a: IArguments) => void): void {
  if (!proto) return;
  const P = proto as Record<string, Fn>;
  for (const k of keys) {
    const o = P[k];
    if (typeof o !== 'function') continue;
    P[k] = function (this: never) {
      after(this, arguments);
      return o.apply(this, arguments as unknown as unknown[]);
    };
  }
}

/** A source's pixels: an image, bitmap, canvas, video or ImageData. */
const px = (s: unknown): number => {
  const o = s as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number; videoWidth?: number; videoHeight?: number } | null;
  if (!o || typeof o !== 'object') return 0;
  return (o.naturalWidth || o.videoWidth || o.width || 0) * (o.naturalHeight || o.videoHeight || o.height || 0);
};

export function wrapGpu(): void {
  const G = globalThis as unknown as Record<string, { prototype: object } | undefined>;
  for (const C of [G.WebGL2RenderingContext, G.WebGLRenderingContext]) {
    const p = C?.prototype;
    wrap(p, ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements'], () => draw());
    // texImage2D(target, level, ifmt, format, type, source) or (target, level, ifmt, w, h, border, format, type, pixels)
    wrap(p, ['texImage2D'], (gl: WebGL2RenderingContext, a) => {
      const bytes = 4 * (a.length === 6 ? px(a[5]) : (a[3] as number) * (a[4] as number));
      upload(bytes);
      if (a[0] === gl.TEXTURE_2D && a[1] === 0) size(gl.getParameter(gl.TEXTURE_BINDING_2D) as object, bytes);
    });
    // texSubImage2D(target, level, x, y, format, type, source) or (target, level, x, y, w, h, format, type, pixels)
    wrap(p, ['texSubImage2D'], (_gl, a) => upload(4 * (a.length === 7 ? px(a[6]) : (a[4] as number) * (a[5] as number))));
    // compressedTexImage2D(target, level, ifmt, w, h, border, data): its bytes as they lie on the GPU
    wrap(p, ['compressedTexImage2D'], (gl: WebGL2RenderingContext, a) => {
      const bytes = (a[6] as ArrayBufferView).byteLength;
      upload(bytes);
      if (a[0] === gl.TEXTURE_2D && a[1] === 0) size(gl.getParameter(gl.TEXTURE_BINDING_2D) as object, bytes);
    });
    wrap(p, ['compressedTexSubImage2D', 'texImage3D', 'texSubImage3D'], () => upload(0));
    wrap(p, ['texStorage2D'], (gl: WebGL2RenderingContext, a) => {
      if (a[0] === gl.TEXTURE_2D) size(gl.getParameter(gl.TEXTURE_BINDING_2D) as object, 4 * (a[3] as number) * (a[4] as number) * ((a[1] as number) > 1 ? 4 / 3 : 1));
    });
    wrap(p, ['deleteTexture'], (_gl, a) => drop(a[0] as object));
  }
  wrap(G.GPURenderPassEncoder?.prototype, ['draw', 'drawIndexed', 'drawIndirect', 'drawIndexedIndirect'], () => draw());
  wrap(G.GPUQueue?.prototype, ['writeTexture', 'copyExternalImageToTexture'], (_q, a) => {
    const e = a[a.length - 1] as number[] | { width: number; height?: number };
    upload(4 * (Array.isArray(e) ? e[0]! * (e[1] ?? 1) : e.width * (e.height ?? 1)));
  });
  const make = G.GPUDevice?.prototype as Record<string, Fn> | undefined;
  const create = make?.createTexture;
  if (make && create) {
    make.createTexture = function (this: unknown, d: { size: number[] | { width: number; height?: number }; mipLevelCount?: number }) {
      const t = create.call(this, d) as object;
      const s = d.size;
      size(t, 4 * (Array.isArray(s) ? s[0]! * (s[1] ?? 1) : s.width * (s.height ?? 1)) * ((d.mipLevelCount ?? 1) > 1 ? 4 / 3 : 1));
      return t;
    } as Fn;
  }
  wrap(G.GPUTexture?.prototype, ['destroy'], (t: object) => drop(t));
}
