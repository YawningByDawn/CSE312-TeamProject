import { Container, Matrix, Rectangle, Sprite, Texture, type Renderer } from 'pixi.js';
import type { Activity, GameEvent, Layer, Person, PlaceId, Query, RoleId, UnitId, ViewModel } from '../../types';
import { AT, MINE_FRAME, SHAFT, spotsOf, way } from '../../content/map';
import { ROLES } from '../../content/roles';
import { below, frameOf } from '../camera';
import { decode, upload } from '../pictures';
import { pickable } from '../hits';
import type { Atlas } from '../atlas';
import { StateSeen } from '../moved';
import { Stamps } from './stamps';
import { Body, PART, bucket, type Hold, type Series } from './rig';
import { holdIds, type HoldIds } from './ids';
import { BONE, CLIP, FALL, FIGURE_H, GOLD, HOVER, LOW_DETAIL_PX, Look, MINE_RIG, PAGES, PAINT_FADE, PALE, PICK_TICK, REACT, RING_ASPECT, SMALL_PX, TOWN_RIG, VIOLET, areaOf, familyOf, hash, inMine, mx, my, type LookData, type PoseData, type Shown } from './looks';
import peopleUrl from '../../../assets/people/people.json?url';
import posesUrl from '../../../assets/poses/poses.json?url';

// Everyone in frame (#76-81): each person from the baked parts of their look (a mine hand one of their family's, a
// townsperson their trade's own), posed by what the rules say they do, walking their route by the tick and `alpha`,
// their wick in their allegiance's paint with its light pooled at their feet, the marks of yours, the picked and the
// hovered under them. A person in the void, indoors or off screen costs nothing. The low-detail pictures come in pages:
// the mine looks' at load, the town looks' once the surface is fetched (a townsperson shows from then); a look's full
// atlas is fetched the first time a figure is shown large enough to want it, the low one standing in meanwhile.

export class People implements Layer {
  readonly name = 'people';
  /** its own render group: a walker's re-sort or a figure culled re-collects the people, not the whole world */
  readonly root = new Container({ isRenderGroup: true });
  private readonly looks = new Map<string, Look>();
  private readonly byFamily = new Map<string, Look[]>();
  private series: Series[] = [];
  private holds: Hold[] = [];
  private holdIdList: HoldIds[] = [];
  private roles: Record<string, Record<string, number>> = {};
  /** the pages of the looks' low-detail pictures as they load, and the town looks' (loaded once the surface is) */
  private readonly pages: (Texture | undefined)[] = [];
  private pageNames: string[] = [];
  private townPages: number[] = [];
  private readonly shown = new Map<UnitId, Shown>();
  private readonly vis = new Map<PlaceId, boolean>();
  private readonly seen = new StateSeen();
  private readonly m = new Matrix();
  private readonly at = { a: 0, e: 0, f: 0 };
  private readonly view = { x0: 0, y0: 0, x1: 0, y1: 0 };
  /** what the last frame was placed for: render time, camera, the picked and the hovered */
  private readonly last = { time: -1, x: 0, y: 0, zoom: -1, w: 0, h: 0, focus: null as ViewModel['focus'], hover: null as ViewModel['hover'], stamp: 0 };
  /** the people shown at the last full placing */
  private readonly on: Shown[] = [];
  /** people shown last frame */
  private count = 0;

  private life!: Atlas;
  private stamps!: Stamps;

  /** the marks on the ground under everyone, the figures in depth order, the light on the picked and the hovered: one batch each */
  private readonly ground = new Container();
  private readonly figures = new Container();
  private readonly glow = new Container();

  constructor(private readonly q: Query, private readonly renderer: Renderer, private readonly screen: { w: number; h: number }, private readonly dpr: number) {
    this.figures.sortableChildren = true;
    this.root.eventMode = this.figures.eventMode = 'passive';
    this.root.addChild(this.ground, this.figures, this.glow);
  }

  /** The looks, the poses and the mine looks' low-detail pictures; the life atlas (the pools and rings) as it comes. */
  async load(life: Promise<Atlas>): Promise<void> {
    const [looks, poses] = await Promise.all([
      fetch(peopleUrl).then((r) => r.json() as Promise<LookData[]>),
      fetch(posesUrl).then((r) => r.json() as Promise<PoseData>),
    ]);
    this.series = poses.series.map((s) => ({ ...s, f: Float32Array.from(s.f) }));
    this.holds = poses.holds.map((h) => ({ near: h[0] as string | null, far: h[1] as string | null, back: h[2] as string | null, cart: !!h[3], ground: h[4] as string | null, gx: h[5] as number, gy: h[6] as number, twoHand: !!h[7] }));
    this.holdIdList = this.holds.map(holdIds);
    this.roles = poses.roles;
    this.stamps = new Stamps(this.renderer);
    const town = new Set<number>(), mine = new Set<number>();
    looks.forEach((d) => {
      const look = new Look(d, this.pages, poses.lo.at[d.id]!, poses.looks[d.id]!);
      (ROLES[d.role as RoleId]?.side === 'town' ? town : mine).add(look.loAt[2]);
      this.looks.set(d.id, look);
      const fam = this.byFamily.get(d.role) ?? [];
      fam.push(look);
      this.byFamily.set(d.role, fam);
    });
    for (const i of mine) town.delete(i);
    this.pageNames = poses.lo.pages;
    this.townPages = [...town];
    await Promise.all([...mine].map((i) => this.loadPage(i)));
    this.life = await life;
    for (const c of [this.ground, this.glow]) c.eventMode = 'none';
  }

  /** The town looks' pages of low-detail pictures: their townspeople show from when each arrives. */
  async loadTown(): Promise<void> {
    await Promise.all(this.townPages.map((i) => this.loadPage(i)));
  }

  private async loadPage(i: number): Promise<void> {
    const tex = upload(this.renderer, await decode(PAGES[`../../../assets/poses/${this.pageNames[i]!}`]!));
    this.pages[i] = tex;
    this.stamps.page(i, tex);
    // everyone is placed again: a townsperson on this page shows now
    this.last.zoom = -1;
  }

  frame(vm: ViewModel): boolean {
    const s = vm.state, b = below(vm.camera.zoom), c = vm.camera, L = this.last;
    const stateMoved = this.seen.moved(vm);
    if (stateMoved) {
      this.vis.clear();
      for (const e of vm.fresh) this.react(e, vm.time);
    }
    const looked = c.x !== L.x || c.y !== L.y || c.zoom !== L.zoom || this.screen.w !== L.w || this.screen.h !== L.h;
    if (!stateMoved && !looked && vm.time === L.time && vm.focus === L.focus && vm.hover === L.hover) return false;
    L.time = vm.time; L.x = c.x; L.y = c.y; L.zoom = c.zoom; L.focus = vm.focus; L.hover = vm.hover; L.w = this.screen.w; L.h = this.screen.h;
    frameOf(c, this.screen.w, this.screen.h, this.at);
    const a = this.at.a, v = this.view, pad = 40;
    v.x0 = -this.at.e / a - pad; v.y0 = -this.at.f / a - pad; v.x1 = (this.screen.w - this.at.e) / a + pad; v.y1 = (this.screen.h - this.at.f) / a + pad;
    const stamp = ++L.stamp, on = this.on;
    let n = 0;
    if (stateMoved || looked) {
      // who shows can change only with the state or the view: everyone is placed, and the shown are kept
      for (const id in s.people) if (this.place(s.people[id]!, vm, b, a, stamp)) n++;
      on.length = 0;
      for (const sh of this.shown.values()) if (sh.stamp !== stamp) this.hide(sh); else on.push(sh);
    } else {
      // only time moved: the shown move on, nobody hidden comes into view
      for (const sh of on) if (this.place(s.people[sh.id]!, vm, b, a, stamp)) n++;
      for (const sh of on) if (sh.stamp !== stamp) this.hide(sh);
    }
    this.stamps.flush();
    const changed = n > 0 || this.count > 0;
    this.count = n;
    return changed;
  }

  /** Place one person; their Shown when they show. */
  private place(p: Person, vm: ViewModel, b: number, a: number, stamp: number): Shown | null {
    const sh0 = this.shown.get(p.id);
    const t = vm.time;
    if (p.gone && !(sh0 && t - sh0.fellAt < FALL)) return this.hide(sh0);
    const w = p.at;
    let x: number, y: number, mine: boolean, facing: number, doing: Activity, place: PlaceId;
    let routeU = -1;
    if ('place' in w) {
      place = w.place;
      mine = inMine(place);
      const spots = spotsOf(place, w.doing);
      if (!spots) return this.hide(sh0);
      const i = (w.spot % (spots.length / 3)) * 3;
      x = spots[i]!; y = spots[i + 1]!; facing = spots[i + 2]!;
      if (mine) { x = mx(x); y = my(y); }
      doing = w.doing;
    } else {
      routeU = Math.min(1, Math.max(0, (vm.state.tick + vm.alpha - w.from) / Math.max(1, w.to - w.from)));
      place = w.route[Math.min(w.route.length - 1, Math.floor(routeU * (w.route.length - 1)))]!;
      mine = inMine(place);
      x = 0; y = 0; facing = 1;
      doing = w.doing;
    }
    if (b <= 0 && mine && routeU < 0) return this.hide(sh0);
    if (b >= 1 && !mine && routeU < 0) return this.hide(sh0);
    const area = areaOf(place);
    let seen = this.vis.get(area);
    if (seen === undefined) this.vis.set(area, (seen = this.q.visibility(vm.state, area) !== 'void'));
    if (!seen) return this.hide(sh0);
    const sh = sh0 ?? this.make(p);
    if (!sh.look.lo) return this.hide(sh);
    let dist = 0, dx = 0, dy = 0;
    if (routeU >= 0) {
      if (sh.route !== (w as { route: PlaceId[] }).route) this.build(sh, (w as { route: PlaceId[] }).route);
      const L = sh.line, total = L[(sh.lineN - 1) * 4 + 2]!, d = routeU * total;
      let i = 0;
      while (i < sh.lineN - 2 && L[(i + 1) * 4 + 2]! < d) i++;
      const o = i * 4, seg = Math.max(1e-6, L[o + 6]! - L[o + 2]!), k = Math.min(1, (d - L[o + 2]!) / seg);
      dx = L[o + 4]! - L[o]!; dy = L[o + 5]! - L[o + 1]!;
      x = L[o]! + dx * k; y = L[o + 1]! + dy * k;
      // on the shaft, the half it is in
      mine = (k < 0.5 ? L[o + 3] : L[o + 7]) === 1;
      dist = d;
      if (Math.abs(dx) > 0.18 * Math.hypot(dx, dy)) facing = dx > 0 ? 1 : -1;
      else facing = sh.facing;
    }
    const alpha = mine ? b : 1 - b;
    const scale = (mine ? MINE_RIG / MINE_FRAME.per : TOWN_RIG) * sh.look.body.hk;
    if (alpha <= 0 || x < this.view.x0 || x > this.view.x1 || y < this.view.y0 - 40 * scale || y > this.view.y1 + 40 * scale) return this.hide(sh);
    sh.stamp = stamp;
    sh.root.visible = true;
    sh.root.alpha = alpha;
    const hit = sh.root.hitArea as Rectangle;
    hit.x = -12 * scale; hit.y = -44 * scale; hit.width = 24 * scale; hit.height = 46 * scale;
    sh.root.position.set(x, y);
    sh.root.zIndex = y;
    if (facing !== sh.facing) { sh.facing = facing; sh.turnAt = t; }
    // pose: the loop for what they do, a walk's stride by the distance walked
    const body = sh.body, role = this.roles[sh.role]!;
    const walking = routeU >= 0 && doing === 'walk';
    let u: number;
    if (walking) {
      const len = Math.hypot(dx, dy) || 1, uy = dy / len;
      const dir = uy < -0.5 ? 'u' : uy > 0.5 ? 'd' : 'h';
      const key = p.routine === 'lieLow' || role[`walk:own:${dir}`] === undefined ? `walk:none:${dir}` : `walk:own:${dir}`;
      body.play(key, this.series[role[key]!]!, t);
      u = dist / scale / (10.3 / 19) / (1 - 0.35 * Math.abs(uy));
    } else {
      const clip = p.gone ? 'collapse' : doing === 'work' || (doing === 'guard' && sh.role === 'guard') ? 'work' : CLIP[doing];
      body.play(clip, this.series[role[clip] ?? role.idle!]!, p.gone ? sh.fellAt : t);
      u = t - body.start + (p.gone ? 0 : sh.v * body.series!.dur);
    }
    if (p.follower !== sh.follower) { sh.follower = p.follower; sh.paintAt = t; }
    const k = Math.min(1, (t - sh.paintAt) / PAINT_FADE), to = p.follower ? 1 : 0;
    const devPx = a * scale * this.dpr;
    // the facing narrows through a turn
    const tu = (t - sh.turnAt) / 0.22;
    const xs = tu >= 1 || tu < 0 ? sh.facing : tu < 0.5 ? -sh.facing * (0.28 + 0.72 * (1 - 2 * tu)) : sh.facing * (0.28 + 0.72 * (2 * tu - 1));
    sh.figure.scale.set(xs * scale, scale);
    this.marks(sh, p, vm, scale, x, y, alpha, a);
    // a small figure is one sprite of its stamp, stepping through its loop's baked steps: a step it already shows at
    // this size is not stamped again
    const s = body.series!, small = devPx * FIGURE_H < SMALL_PX, px = bucket(devPx);
    sh.figure.visible = !small;
    sh.whole.visible = small;
    if (small) {
      if (sh.slot < 0) { sh.slot = this.stamps.take(); sh.key = -1; }
      this.stamps.place(sh.whole, sh.slot, px, xs * scale, scale);
      let key = -1;
      if (k === 1 && body.steady(t)) {
        const step = Math.floor((((u / s.dur) % 1) + 1) % 1 * s.n);
        key = step * 2 + to;
        if (key === sh.key && body.name === sh.keyName && px === sh.keyPx) return sh;
        u = ((step + 0.5) / s.n) * s.dur;
      }
      sh.key = key;
      sh.keyName = body.name;
      sh.keyPx = px;
    } else this.unstamp(sh);
    body.hood = p.routine === 'lieLow';
    body.evaluate(t, u, !p.gone, this.holds, this.holdIdList, sh.look.body, vm.state.weather, sh.facing, sh.v);
    body.layout(sh.look.body, k < 1 ? 1 - to : to, to, k, devPx, t, sh.v);
    if (small) this.stamp(sh, px);
    else this.parts(sh, devPx);
    return sh;
  }

  /** The figure's slot given back. */
  private unstamp(sh: Shown): void {
    if (sh.slot < 0) return;
    this.stamps.give(sh.slot);
    sh.slot = -1;
  }

  /** The body's laid-out parts into its stamp's slot at `px` stamp px per rig unit, from the look's low-detail atlas. */
  private stamp(sh: Shown, px: number): void {
    const look = sh.look, P = sh.body.parts, K = look.d.k.lo, cells = look.d.cells.lo, page = look.loAt[2];
    this.stamps.wipe(sh.slot);
    for (let i = 0; i < sh.body.n; i++) {
      const o = i * PART, ci = look.cell(P[o]!, P[o + 1]!, 0);
      if (ci < 0) continue;
      const pa = P[o + 3]!, pb = P[o + 4]!, pc = P[o + 5]!, pd = P[o + 6]!, c = ci * 6, ox = cells[c + 4]!, oy = cells[c + 5]!;
      this.stamps.ink(sh.slot, page, px, cells[c]! + look.loAt[0], cells[c + 1]! + look.loAt[1], cells[c + 2]!, cells[c + 3]!,
        pa * K, pb * K, pc * K, pd * K, pa * ox + pc * oy + P[o + 7]!, pb * ox + pd * oy + P[o + 8]!, P[o + 2]!);
    }
  }

  /** Where `unit` stands on screen this frame (town units): feet, figure height, the crown's height; false when not shown. */
  where(unit: UnitId, out: { x: number; y: number; h: number; crown: number }): boolean {
    const sh = this.shown.get(unit);
    if (!sh || !sh.root.visible) return false;
    const s = sh.figure.scale.y;
    out.x = sh.root.x; out.y = sh.root.y; out.h = FIGURE_H * s; out.crown = -sh.body.lampY * s;
    return true;
  }

  /** The body's laid-out parts as sprites of the look's atlas. */
  private parts(sh: Shown, devPx: number): void {
    const look = sh.look, body = sh.body, P = body.parts, m = this.m;
    let lod: 0 | 1 = 0;
    if (devPx >= LOW_DETAIL_PX && look.wantHi(this.renderer)) lod = 1;
    const K = lod ? look.d.k.hi : look.d.k.lo, cells = lod ? look.d.cells.hi : look.d.cells.lo;
    let n = 0;
    for (let i = 0; i < body.n; i++) {
      const o = i * PART, ci = look.cell(P[o]!, P[o + 1]!, lod);
      if (ci < 0) continue;
      let sp = sh.sprites[n];
      if (!sp) { sp = sh.sprites[n] = new Sprite(); sh.figure.addChild(sp); }
      n++;
      sp.visible = true;
      sp.texture = look.texture(lod, ci);
      const pa = P[o + 3]!, pb = P[o + 4]!, pc = P[o + 5]!, pd = P[o + 6]!, ox = cells[ci * 6 + 4]!, oy = cells[ci * 6 + 5]!;
      m.set(pa * K, pb * K, pc * K, pd * K, pa * ox + pc * oy + P[o + 7]!, pb * ox + pd * oy + P[o + 8]!);
      sp.setFromMatrix(m);
      sp.alpha = P[o + 2]!;
    }
    for (let i = n; i < sh.sprites.length; i++) sh.sprites[i]!.visible = false;
  }

  /**
   * Under the feet: the wick's light pooled (violet for yours, brighter with devotion; gold the Flame's; pale the
   * Council's), the rings of the picked (pulsing, four ticks outward, PICK_TICK screen px long) and the hovered.
   */
  private marks(sh: Shown, p: Person, vm: ViewModel, scale: number, x: number, y: number, alpha: number, px: number): void {
    const picked = !!vm.focus && 'unit' in vm.focus && vm.focus.unit === p.id;
    const hover = !picked && !!vm.hover && 'unit' in vm.hover && vm.hover.unit === p.id;
    const pool = sh.pool, ring = sh.ring, beam = sh.beam, s = scale, pulse = picked ? 0.85 + 0.15 * Math.sin(vm.time * 3.2) : 1;
    pool.visible = !p.gone;
    pool.tint = p.follower ? VIOLET : sh.look.d.tally ? PALE : GOLD;
    pool.alpha = alpha * (p.follower ? 0.3 + 0.5 * Math.min(1, p.stats.devotion / 100) : 0.18);
    const pr = ((p.follower ? 16 : 11) * s) / 32;
    pool.scale.set(pr, pr * 0.35);
    pool.position.set(x, y);
    ring.visible = picked || hover || p.follower;
    if (ring.visible) {
      ring.tint = picked ? BONE : hover ? HOVER : VIOLET;
      ring.alpha = alpha * (picked ? 0.95 * pulse : hover ? 0.7 : 0.45);
      ring.scale.set((13 * s) / 48);
      ring.position.set(x, y);
    }
    const rx = 13 * s * 1.08, ry = rx * RING_ASPECT, len = PICK_TICK / px, w = 2 / px;
    sh.ticks.forEach((tk, i) => {
      tk.visible = picked;
      if (!picked) return;
      tk.tint = BONE;
      tk.alpha = 0.9 * alpha * pulse;
      tk.rotation = (i * Math.PI) / 2;
      tk.position.set(x + (i === 0 ? rx : i === 2 ? -rx : 0), y + (i === 1 ? ry : i === 3 ? -ry : 0));
      tk.setSize(i % 2 ? len * 0.5 : len, w);
    });
    beam.visible = picked || hover;
    if (beam.visible) {
      beam.tint = picked ? BONE : HOVER;
      beam.alpha = alpha * (picked ? 0.22 : 0.12);
      beam.scale.set((24 * s) / 320, (46 * s) / 1000);
      beam.position.set(x, y);
    }
  }

  private hide(sh: Shown | undefined): null {
    if (sh && sh.root.visible) {
      sh.root.visible = sh.pool.visible = sh.ring.visible = sh.beam.visible = false;
      for (const tk of sh.ticks) tk.visible = false;
      this.unstamp(sh);
    }
    return null;
  }

  private make(p: Person): Shown {
    const own = this.looks.get(p.id);
    const look = own ?? (() => {
      const fam = this.byFamily.get(familyOf(p.role, p.id))!;
      return fam[Math.floor(hash(p.id + '/look') * fam.length)]!;
    })();
    const root = pickable(new Container(), { unit: p.id });
    root.interactiveChildren = false;
    const figure = new Container();
    const glow = (name: string, ax: number, ay: number): Sprite => {
      const sp = this.life.sprite(name);
      sp.anchor.set(ax, ay);
      sp.blendMode = 'add';
      return sp;
    };
    const pool = glow('glow-0.2', 0.5, 0.5), ring = glow('ring-8-1.1', 0.5, 0.5), beam = glow('beam', 0.5, 1);
    const ticks = [0, 1, 2, 3].map(() => glow('cap-1.4', 0, 0.5));
    const whole = new Sprite();
    root.addChild(figure, whole);
    this.ground.addChild(pool, ring, ...ticks);
    for (const tk of ticks) tk.visible = false;
    this.glow.addChild(beam);
    const sh: Shown = {
      id: p.id, look, role: look.d.role, root, figure, sprites: [], whole, slot: -1, pool, ring, beam, ticks, body: new Body(), v: hash(p.id), facing: 1, turnAt: -99,
      follower: p.follower, paintAt: -99, fellAt: -99, route: null, line: new Float64Array(64), lineN: 0, stamp: 0, key: -1, keyName: '', keyPx: 0,
    };
    this.shown.set(p.id, sh);
    // the figure's own box is what a click takes (sized each frame for the region it is in)
    root.hitArea = new Rectangle();
    this.figures.addChild(root);
    return sh;
  }

  /** A route's polyline in town units: the ways between its places, the shaft between the mine and the pit head. */
  private build(sh: Shown, route: PlaceId[]): void {
    sh.route = route;
    let n = 0, len = 0, px = 0, py = 0;
    const add = (x: number, y: number, mine: boolean): void => {
      if (n > 0) len += Math.hypot(x - px, y - py);
      if ((n + 1) * 4 > sh.line.length) { const g = new Float64Array(sh.line.length * 2); g.set(sh.line); sh.line = g; }
      const o = n++ * 4;
      sh.line[o] = px = x; sh.line[o + 1] = py = y; sh.line[o + 2] = len; sh.line[o + 3] = mine ? 1 : 0;
    };
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i]!, b = route[i + 1]!, am = inMine(a), bm = inMine(b);
      if (am !== bm) {
        const [ax, ay] = AT[a]!, [bx, by] = AT[b]!;
        if (am) { add(mx(ax), my(ay), true); add(mx(SHAFT.mine[0]), my(SHAFT.mine[1]), true); add(SHAFT.town[0], SHAFT.town[1], false); add(bx, by, false); }
        else { add(ax, ay, false); add(SHAFT.town[0], SHAFT.town[1], false); add(mx(SHAFT.mine[0]), my(SHAFT.mine[1]), true); add(mx(bx), my(by), true); }
        continue;
      }
      const line = way(a, b);
      for (let k = 0; k < line.length; k += 2) add(am ? mx(line[k]!) : line[k]!, am ? my(line[k + 1]!) : line[k + 1]!, am);
    }
    if (n === 1) add(px, py, sh.line[3] === 1);
    sh.lineN = n;
  }

  /** An event on a person: the reaction it puts on them, or their fall. */
  private react(e: GameEvent, t: number): void {
    const kind = e.kind, ok = 'ok' in e ? e.ok : true;
    const sh = e.unit ? this.shown.get(e.unit) : undefined;
    if (!sh) return;
    if (kind === 'devour' || kind === 'lost' || kind === 'gone') { sh.fellAt = t; return; }
    const r = REACT[kind === 'whisper' && !ok ? 'refused' : kind === 'moved' && !ok ? 'startle' : kind === 'search' || kind === 'exposed' ? 'fear' : kind];
    if (!r) return;
    const ix = this.roles[sh.role]![r[0]];
    if (ix !== undefined) sh.body.reactTo(r[0], this.series[ix]!, t, r[1]);
  }
}
