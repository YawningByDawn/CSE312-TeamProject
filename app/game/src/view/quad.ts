import { Container, Mesh, MeshGeometry, Shader, UniformGroup } from 'pixi.js';
import { MINE_FRAME } from '../content/map';

// The layers' scene-graph pieces: a rectangle of the world drawn by its own fragment shader (its body: the head declares
// `vW`, the world point, and `o`, the colour out; the view's fields are pictures and tables sampled there), its uniforms,
// a layer's root the pointer passes through, the pit's frame, and a fade.

const VERT = /* glsl */ `#version 300 es
in vec2 aPosition;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
out vec2 vW;
void main() {
  vW = aPosition;
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
}`;
const HEAD = '#version 300 es\nprecision highp float;\nin vec2 vW;\nout vec4 o;\n';

export function quad(name: string, frag: string, rect: readonly [number, number, number, number], resources: Record<string, unknown>): Mesh<MeshGeometry, Shader> {
  const [x, y, w, h] = rect;
  const geometry = new MeshGeometry({ positions: new Float32Array([x, y, x + w, y, x + w, y + h, x, y + h]), uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]) });
  return layerRoot(new Mesh({ geometry, shader: Shader.from({ gl: { vertex: VERT, fragment: HEAD + frag, name }, resources: resources as never }) }));
}

export type Uniforms = UniformGroup & { uniforms: Record<string, number | Float32Array> };
/** A shader's uniforms from their first values: a number an f32, an array a vec of its length. */
export function uniforms(v: Record<string, number | readonly number[]>): Uniforms {
  const u: Record<string, { value: number | Float32Array; type: string }> = {};
  for (const [k, x] of Object.entries(v)) u[k] = typeof x === 'number' ? { value: x, type: 'f32' } : { value: new Float32Array(x), type: `vec${x.length}<f32>` };
  return new UniformGroup(u as never) as Uniforms;
}

/** A layer's container (or mesh) that the pointer passes through. */
export function layerRoot<T extends Container>(c: T): T {
  c.eventMode = 'none';
  return c;
}

/** A container in the mine's frame (the pit, mine units at 1/MINE_FRAME.per) holding `children`. */
export function pit(...children: Container[]): Container {
  const c = layerRoot(new Container());
  c.position.set(MINE_FRAME.x, MINE_FRAME.y);
  c.scale.set(1 / MINE_FRAME.per);
  if (children.length) c.addChild(...children);
  return c;
}

/** `c` at alpha `a`, hidden at 0. */
export function show(c: Container, a: number): void {
  c.visible = a > 0;
  c.alpha = a;
}
