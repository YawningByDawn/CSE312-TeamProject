// src/view, the world on the canvas (implements `View`; #6, #72, #129). Owns the one PixiJS renderer and stage, the
// layers in ORDER (one file each: ground, sheen, gray, lights, weather, sky, fog; people,
// effects and the hoard in src/view/life; the films in src/view/film), the camera's transform (camera.ts) and picking
// (hits.ts). Reads the view model each frame, the sim's Query (hour, daylight, sun, visibility), content's map,
// world, clock, crystals and roles, and the baked files under assets/ (docs/art-pipeline.md); writes nothing back.
// The world layers sit in one render group whose matrix is the camera, so pan and zoom are one transform write; each
// layer places baked sprites and picks frames and says when what it shows changed. A frame renders only on a change of
// camera, size or a layer; a frame where nothing changed issues no GL call. Pixi's own ticker is stopped: the app's one
// rAF frame is the only loop. Picking is the scene graph's: the places' disks lie under every layer.
import { Container, Texture, Ticker, WebGLRenderer } from 'pixi.js';
import type { AtlasManifest, Layer, LayerName, Query, View, ViewModel } from '../types';
import { frameOf, scale } from './camera';
import { Ground } from './ground';
import { Lights } from './lights';
import { Atlas } from './atlas';
import { hit, placeHits } from './hits';
import lifeManifest from '../../assets/life/manifest.json';
import lifeUrl from '../../assets/life/life.png?url';
import { People } from './life/people';
import { Ores } from './life/ores';
import { Fog } from './fog';
import { Gray } from './gray';
import { Sky } from './sky';
import { Weather } from './weather';
import { Sheen } from './sheen';
import { Fx, GRAVE_AT, anchor, type Anchor } from './life/fx';
import { Films, filmLength } from './film/films';
import { Opening } from './film/opening';

const ORDER: readonly LayerName[] = ['ground', 'stain', 'props', 'people', 'fx', 'above', 'weather', 'fog', 'lit', 'notes'];

export function createView(canvas: HTMLCanvasElement, dpr: number, q: Query, muted: boolean): View {
  const opening = new Opening(canvas, muted);
  const renderer = new WebGLRenderer();
  const stage = new Container();
  const world = new Container({ isRenderGroup: true });
  stage.addChild(world);
  stage.eventMode = world.eventMode = 'passive';
  const places = placeHits();
  world.addChild(places);
  const layers: Layer[] = [];
  const at = { a: 0, e: 0, f: 0 };
  let ready = false;
  let dirty = true;
  /** the canvas's CSS size */
  const screen = { w: 1, h: 1 };
  const sky = new Sky();
  let films!: Films;
  let people!: People;
  const thing: Anchor = { x: 0, y: 0, u: 0, crown: 0 };

  /** Layers into the world in their order, over the places' hit disks. */
  const add = (...more: Layer[]): void => {
    layers.push(...more);
    layers.sort((a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name));
    world.removeChildren();
    world.addChild(places, ...layers.map((l) => l.root));
    dirty = true;
  };

  return {
    async load() {
      await renderer.init({
        canvas, width: screen.w, height: screen.h, resolution: dpr, autoDensity: false, antialias: false, background: '#000000',
        powerPreference: 'high-performance', hello: false,
        textureGCActive: false, renderableGCActive: false, eventFeatures: { move: false, globalMove: false, click: false, wheel: false },
      });
      Ticker.system.stop();
      // the grade's sheet and the films' veil are Pixi's white texture: on the GPU now, not when first shown
      renderer.texture.initSource(Texture.WHITE.source);
      renderer.events.rootBoundary.rootTarget = stage;
      const ground = new Ground(q);
      const lifeP = Atlas.load(renderer, lifeManifest as unknown as AtlasManifest, lifeUrl);
      people = new People(q, renderer, screen, dpr);
      const fogP = Fog.load(renderer, q);
      const [life, fog, gray, sheen] = await Promise.all([
        lifeP, fogP, fogP.then((f) => Gray.load(renderer, f)), Sheen.load(renderer, q, sky), ground.load(renderer), people.load(lifeP),
      ]);
      films = new Films(people, world, screen, renderer);
      // the sheen lies on the mine's ground, over the lit picture
      add(ground, sheen, gray, new Lights(q, life), new Ores(q, life), people, new Fx(q, life, people), new Weather(q, sky, fog, life, renderer), fog, films);
      ready = true;
      opening.load();
    },

    frame(live: ViewModel) {
      if (!ready) return;
      opening.frame(live);
      const vm = films.view(live);
      let changed = dirty;
      dirty = false;
      const a = at.a, e = at.e, f = at.f;
      frameOf(vm.camera, screen.w, screen.h, at);
      if (at.a !== a || at.e !== e || at.f !== f) {
        world.scale.set(at.a);
        world.position.set(at.e, at.f);
        changed = true;
      }
      sky.step(vm);
      for (const l of layers) if (l.frame(vm)) changed = true;
      if (changed) renderer.render({ container: stage });
    },

    pick: (x, y) => (ready ? hit(renderer, x, y) : null),

    where(target, out) {
      if (!ready || !target || (target !== 'grave' && 'crystal' in target)) return false;
      // the effects' one anchor rule: a person's feet as shown, else the place's point
      if (target === 'grave') thing.x = GRAVE_AT.x, thing.y = GRAVE_AT.y, thing.crown = 0;
      else if (!anchor('unit' in target ? target.unit : undefined, 'place' in target ? target.place : undefined, people, thing)) return false;
      // over its head, as the last frame stood it, in the region the camera shows
      out.x = thing.x * at.a + at.e;
      out.y = (thing.y - thing.crown) * at.a + at.f;
      return out.x >= 0 && out.y >= 0 && out.x <= screen.w && out.y <= screen.h;
    },
    filmLength,
    filmPose: (film, from, out) => films.pose(film, from, out),
    scale,

    resize(w, h) {
      screen.w = w;
      screen.h = h;
      if (ready) renderer.resize(w, h);
      dirty = true;
    },
  };
}
