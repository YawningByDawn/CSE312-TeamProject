// src/view/life, the people and fx layers. Owns every figure (here; looks.ts a look's parts, rig.ts its body a frame,
// stamps.ts small figures as one sprite, ids.ts part ids) and every effect (fx.ts plays clips.ts; hoard.ts the grave's
// stones). Reads the view model (people, crystals, alpha, time, fresh events, focus, hover), the sim's Query, content's
// map, roles, world and crystals, and assets/people, assets/poses and the life atlas.
import { Container, Matrix, Rectangle, Sprite, Texture, type Renderer } from 'pixi.js';
import type { Activity, GameEvent, Layer, Mob, Person, PlaceId, Query, RoleId, UnitId, ViewModel } from '../../types';
import { DAY_TICK_S } from '../../content/clock';
import { HOST } from '../../content/stats';
import { MINE_FRAME, spotsOf, way } from '../../content/map';
import { frameOf } from '../camera';
import { decode, upload } from '../pictures';
import { pickable } from '../hits';
import type { Atlas } from '../atlas';
import { StateSeen } from '../moved';
import { Stamps } from './stamps';
import { Body, PART, bucket, type Hold, type Series } from './rig';
import { holdIds, type HoldIds } from './ids';
import { marks, type Spot } from './marks';
import { CLIP, FALL, FIGURE_H, LOW_DETAIL_PX, Look, MINE_RIG, PAGES, PAINT_FADE, REACT, SMALL_PX, FAMILIES, MOB_FAMILY, areaOf, familyOf, hash, mx, my, type LookData, type PoseData, type Shown } from './looks';
import peopleUrl from '../../../assets/people/people.json?url';
import posesUrl from '../../../assets/poses/poses.json?url';

// Everyone in frame (#76-81; the people layer): each person from the baked parts of their look (one of their family's),
// posed by what the rules say they do, walking their route by the tick and `alpha`,
// their wick in their allegiance's paint with its light pooled at their feet, the marks of yours, the picked and the
// hovered under them. A person in the void or off screen costs nothing. The low-detail pictures come in pages, loaded
// at once; a look's full atlas is fetched the first time a figure is shown large enough to want it, the low one standing in meanwhile.

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
  /** the pages of the looks' low-detail pictures as they load */
  private readonly pages: (Texture | undefined)[] = [];
  private pageNames: string[] = [];
  private readonly shown = new Map<UnitId, Shown>();
  private readonly vis = new Map<PlaceId, boolean>();
  private readonly seen = new StateSeen();
  private readonly m = new Matrix();
  private readonly at = { a: 0, e: 0, f: 0 };
  /** the figure being placed: where, what it does and is */
  private readonly spot: Spot = { x: 0, y: 0, facing: 1, doing: 'idle', walking: false, dist: 0, dx: 0, dy: 0, swing: -1, gone: false, lieLow: false, follower: false, devotion: 0, chosen: false, mob: false, marked: 0 };
  private readonly view = { x0: 0, y0: 0, x1: 0, y1: 0 };
  /** what the last frame was placed for: the tick's fraction, camera, the picked and the hovered */
  private readonly last = { alpha: -1, x: 0, y: 0, zoom: -1, w: 0, h: 0, focus: null as ViewModel['focus'], hover: null as ViewModel['hover'], stamp: 0 };
  /** the people shown at the last full placing */
  private readonly on: Shown[] = [];
  /** people shown last frame */
  private count = 0;
  /** the render time at which the first of the shown next changes its picture by time alone (`Shown.until`) */
  private wake = 0;

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
    const mine = new Set<number>();
    looks.filter((d) => FAMILIES.includes(d.role)).forEach((d) => {
      const look = new Look(d, this.pages, poses.lo.at[d.id]!, poses.looks[d.id]!);
      mine.add(look.loAt[2]);
      this.looks.set(d.id, look);
      const fam = this.byFamily.get(d.role) ?? [];
      fam.push(look);
      this.byFamily.set(d.role, fam);
    });
    this.pageNames = poses.lo.pages;
    await Promise.all([...mine].map((i) => this.loadPage(i)));
    this.life = await life;
    for (const c of [this.ground, this.glow]) c.eventMode = 'none';
  }

  private async loadPage(i: number): Promise<void> {
    const tex = upload(this.renderer, await decode(PAGES[`../../../assets/poses/${this.pageNames[i]!}`]!));
    this.pages[i] = tex;
    this.stamps.page(i, tex);
  }

  frame(vm: ViewModel): boolean {
    const s = vm.state, c = vm.camera, L = this.last, t = vm.time;
    const stateMoved = this.seen.moved(vm);
    if (stateMoved) {
      this.vis.clear();
      for (const e of vm.fresh) this.react(e, t);
    }
    const looked = c.x !== L.x || c.y !== L.y || c.zoom !== L.zoom || this.screen.w !== L.w || this.screen.h !== L.h;
    const whole = stateMoved || looked || vm.focus !== L.focus || vm.hover !== L.hover;
    const ticked = vm.alpha !== L.alpha;
    // time alone changes a picture at its `until`: a still frame before the first of them places no one
    if (!whole && !ticked && t < this.wake) return false;
    L.alpha = vm.alpha; L.x = c.x; L.y = c.y; L.zoom = c.zoom; L.focus = vm.focus; L.hover = vm.hover; L.w = this.screen.w; L.h = this.screen.h;
    frameOf(c, this.screen.w, this.screen.h, this.at);
    const a = this.at.a, v = this.view, pad = 40;
    v.x0 = -this.at.e / a - pad; v.y0 = -this.at.f / a - pad; v.x1 = (this.screen.w - this.at.e) / a + pad; v.y1 = (this.screen.h - this.at.f) / a + pad;
    const stamp = ++L.stamp, on = this.on;
    let n = 0, redone = false;
    if (whole) {
      // who shows can change only with the state or the view: everyone is placed, and the shown are kept
      for (const id in s.people) if (this.place(s.people[id]!, vm, a, stamp)) n++;
      for (const m of s.mobs) if (this.placeMob(m, vm, a, stamp)) n++;
      on.length = 0;
      for (const sh of this.shown.values()) if (sh.stamp !== stamp) this.hide(sh); else on.push(sh);
    } else {
      // only time or the tick's fraction moved: the shown due now move on, nobody hidden comes into view
      for (const sh of on) {
        if (!ticked && t < sh.until) { sh.stamp = stamp; n++; continue; }
        redone = true;
            const p = s.people[sh.id], m = p ? null : s.mobs.find((x) => x.id === sh.id)!;
        if (p ? this.place(p, vm, a, stamp) : this.placeMob(m!, vm, a, stamp)) n++;
      }
      for (const sh of on) if (sh.stamp !== stamp) this.hide(sh);
    }
    this.wake = Infinity;
    for (const sh of on) if (sh.stamp === stamp && sh.until < this.wake) this.wake = sh.until;
    this.stamps.flush();
    const changed = whole ? n > 0 || this.count > 0 : redone;
    this.count = n;
    return changed;
  }

  /** Place one person; their Shown when they show. */
  private place(p: Person, vm: ViewModel, a: number, stamp: number): Shown | null {
    const sh0 = this.shown.get(p.id);
    const t = vm.time;
    if (p.gone && !(sh0 && t - sh0.fellAt < FALL)) return this.hide(sh0);
    const w = p.at;
    let x: number, y: number, facing: number, doing: Activity, place: PlaceId;
    let routeU = -1;
    // the possessed host stands where the sim's body is, not where their routine would have them
    const host = vm.hostAt.on && vm.state.host === p.id ? vm.state.body : null;
    if (host) {
      x = mx(vm.hostAt.x); y = my(vm.hostAt.y); facing = host.face;
      doing = vm.hostAt.moving ? 'walk' : host.ore !== null ? 'dig' : 'idle';
      place = p.work;
    } else if ('place' in w) {
      place = w.place;
      const spots = spotsOf(place, w.doing);
      if (!spots) return this.hide(sh0);
      const i = (w.spot % (spots.length / 3)) * 3;
      x = mx(spots[i]!); y = my(spots[i + 1]!); facing = spots[i + 2]!;
      doing = w.doing;
    } else {
      routeU = Math.min(1, Math.max(0, (vm.state.tick + vm.alpha - w.from) / Math.max(1, w.to - w.from)));
      place = w.route[Math.min(w.route.length - 1, Math.floor(routeU * (w.route.length - 1)))]!;
      x = 0; y = 0; facing = 1;
      doing = w.doing;
    }
    const area = areaOf(place);
    let seen = host !== null || this.vis.get(area);
    if (seen === undefined) this.vis.set(area, (seen = this.q.visibility(vm.state, area) !== 'void'));
    if (!seen) return this.hide(sh0);
    const sh = sh0 ?? this.make(p.id, p.role, p.follower);
    if (!sh.look.lo) return this.hide(sh);
    let dist = 0, dx = 0, dy = 0, swing = -1;
    if (host) {
      [dist, dx, dy] = [vm.hostAt.walked / MINE_FRAME.per, host.dx, host.dy];
      if (host.swing >= 0) [swing, dx, dy] = [host.swing + vm.alpha * DAY_TICK_S, host.ax, host.ay];
    } else if (routeU >= 0) {
      if (sh.route !== (w as { route: PlaceId[] }).route) this.build(sh, (w as { route: PlaceId[] }).route);
      const L = sh.line, total = L[(sh.lineN - 1) * 3 + 2]!, d = routeU * total;
      let i = 0;
      while (i < sh.lineN - 2 && L[(i + 1) * 3 + 2]! < d) i++;
      const o = i * 3, seg = Math.max(1e-6, L[o + 5]! - L[o + 2]!), k = Math.min(1, (d - L[o + 2]!) / seg);
      dx = L[o + 3]! - L[o]!; dy = L[o + 4]! - L[o + 1]!;
      x = L[o]! + dx * k; y = L[o + 1]! + dy * k;
      dist = d;
      if (Math.abs(dx) > 0.18 * Math.hypot(dx, dy)) facing = dx > 0 ? 1 : -1;
      else facing = sh.facing;
    }
    const S = this.spot;
    S.x = x; S.y = y; S.facing = facing; S.doing = doing; S.walking = (routeU >= 0 || host !== null) && doing === 'walk';
    S.dist = dist; S.dx = dx; S.dy = dy; S.swing = swing;
    S.gone = !!p.gone; S.lieLow = p.routine === 'lieLow'; S.follower = p.follower; S.devotion = p.stats.devotion; S.chosen = host !== null; S.mob = false;
    S.marked = this.q.markLeft(vm.state, p.id);
    return this.show(sh, S, vm, a, stamp);
  }

  /** Place one skeleton: where it stands between the last tick and this one, and what it does. */
  private placeMob(m: Mob, vm: ViewModel, a: number, stamp: number): Shown | null {
    const k = vm.alpha, S = this.spot, sh = this.shown.get(m.id) ?? this.make(m.id, MOB_FAMILY, false);
    if (!sh.look.lo) return this.hide(sh);
    const moved = Math.hypot(m.x - m.lx, m.y - m.ly);
    S.x = mx(m.lx + (m.x - m.lx) * k); S.y = my(m.ly + (m.y - m.ly) * k); S.facing = m.face;
    S.walking = moved > 0 && m.swing < 0 && m.down < 0;
    S.doing = S.walking ? 'walk' : 'idle';
    S.dist = (m.walked - moved * (1 - k)) / MINE_FRAME.per; S.dx = m.dx; S.dy = m.dy;
    S.swing = m.swing >= 0 ? m.swing + k * DAY_TICK_S : -1;
    S.gone = m.down >= 0; S.lieLow = false; S.follower = false; S.devotion = 0; S.chosen = false; S.mob = true; S.marked = 0;
    if (S.gone) sh.fellAt = vm.time - m.down - k * DAY_TICK_S;
    return this.show(sh, S, vm, a, stamp);
  }

  /** `sh` shown at its spot: culled off screen, else its pose, its paint, its marks and its parts. */
  private show(sh: Shown, S: Spot, vm: ViewModel, a: number, stamp: number): Shown | null {
    const t = vm.time, { x, y, facing } = S;
    const scale = (MINE_RIG / MINE_FRAME.per) * sh.look.body.hk;
    if (x < this.view.x0 || x > this.view.x1 || y < this.view.y0 - 40 * scale || y > this.view.y1 + 40 * scale) return this.hide(sh);
    sh.stamp = stamp;
    sh.root.visible = true;
    const hit = sh.root.hitArea as Rectangle;
    hit.x = -12 * scale; hit.y = -44 * scale; hit.width = 24 * scale; hit.height = 46 * scale;
    sh.root.position.set(x, y);
    sh.root.zIndex = y;
    if (facing !== sh.facing) { sh.facing = facing; sh.turnAt = t; }
    // pose: the loop for what they do, a walk's stride by the distance walked, a swing by the seconds into it
    const body = sh.body, role = this.roles[sh.role]!;
    const len = Math.hypot(S.dx, S.dy) || 1, uy = S.dy / len, dir = uy < -0.5 ? 'u' : uy > 0.5 ? 'd' : 'h';
    let u: number, timed = false;
    if (S.swing >= 0 && role[`swing:${dir}`] !== undefined) {
      body.play(`swing:${dir}`, this.series[role[`swing:${dir}`]!]!, t);
      u = Math.min(S.swing, body.series!.dur * 0.999);
    } else if (S.walking) {
      const key = S.lieLow || role[`walk:own:${dir}`] === undefined ? `walk:none:${dir}` : `walk:own:${dir}`;
      body.play(key, this.series[role[key]!]!, t);
      u = S.dist / scale / (10.3 / 19) / (1 - 0.35 * Math.abs(uy));
    } else {
      const clip = S.gone ? 'collapse' : S.doing === 'work' || (S.doing === 'guard' && sh.role === 'guard') ? 'work' : CLIP[S.doing];
      body.play(clip, this.series[role[clip] ?? role.idle!]!, S.gone ? sh.fellAt : t);
      timed = true;
      u = t - body.start + (S.gone ? 0 : sh.v * body.series!.dur);
    }
    if (S.follower !== sh.follower) { sh.follower = S.follower; sh.paintAt = t; }
    const k = Math.min(1, (t - sh.paintAt) / PAINT_FADE), to = S.follower ? 1 : 0;
    const devPx = a * scale * this.dpr;
    // the facing narrows through a turn
    const tu = (t - sh.turnAt) / 0.22;
    const xs = tu >= 1 || tu < 0 ? sh.facing : tu < 0.5 ? -sh.facing * (0.28 + 0.72 * (1 - 2 * tu)) : sh.facing * (0.28 + 0.72 * (2 * tu - 1));
    sh.figure.scale.set(xs * scale, scale);
    const pulses = marks(sh, S, vm, scale, x, y, a);
    // a small figure is one sprite of its stamp, a still large one is laid out once: both step through their loop's
    // baked steps, and a step it already shows at this size is not drawn again (a large figure's wick, blink and
    // impact change it by `body.wake`). `end` is when time alone next changes the picture (0: it moves each frame)
    const s = body.series!, small = devPx * FIGURE_H < SMALL_PX, px = small ? bucket(devPx) : devPx;
    sh.figure.visible = !small;
    sh.whole.visible = small;
    if (small) {
      if (sh.slot < 0) { sh.slot = this.stamps.take(); sh.key = -1; }
      this.stamps.place(sh.whole, sh.slot, px, xs * scale, scale);
    } else this.unstamp(sh);
    const steady = k === 1 && body.steady(t);
    // nothing but the loop's step and `body.wake` changes a calm figure; a calm one that no loop plays waits for the tick
    const calm = steady && !pulses && !S.gone && (tu >= 1 || tu < 0);
    let end = calm && !timed ? Infinity : 0, same = false;
    if (steady && (small || (timed && !S.gone))) {
      const phase = (((u / s.dur) % 1) + 1) % 1 * s.n, step = Math.floor(phase), key = (step * 2 + to) * 2 + (small ? 1 : 0);
      if (calm && timed) end = t + (step + 1 - phase) * s.dur / s.n;
      same = key === sh.key && body.name === sh.keyName && px === sh.keyPx && (small || t < body.wake);
      if (!same) {
        u = ((step + 0.5) / s.n) * s.dur;
        sh.key = key;
        sh.keyName = body.name;
        sh.keyPx = px;
      }
    } else sh.key = -1;
    if (!same) {
      body.hood = S.lieLow;
      body.evaluate(t, u, !S.gone, this.holds, this.holdIdList, sh.look.body, vm.state.weather, sh.facing, sh.v);
      body.layout(sh.look.body, k < 1 ? 1 - to : to, to, k, devPx, t, sh.v);
      if (small) this.stamp(sh, px); else this.parts(sh, devPx);
    }
    sh.until = small || end === 0 ? end : Math.min(end, body.wake);
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

  private hide(sh: Shown | undefined): null {
    if (sh && sh.root.visible) {
      sh.root.visible = sh.pool.visible = sh.ring.visible = sh.beam.visible = false;
      for (const tk of [...sh.ticks, ...sh.pips]) tk.visible = false;
      this.unstamp(sh);
    }
    return null;
  }

  /** A figure for `id` of trade `role` (a skeleton: `MOB_FAMILY`, and no one picks it). */
  private make(id: UnitId, role: RoleId, follower: boolean): Shown {
    const own = this.looks.get(id);
    const look = own ?? (() => {
      const fam = this.byFamily.get(role === MOB_FAMILY ? MOB_FAMILY : familyOf(role))!;
      return fam[Math.floor(hash(id + '/look') * fam.length)]!;
    })();
    const root = role === MOB_FAMILY ? new Container() : pickable(new Container(), { unit: id });
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
    const pips = Array.from({ length: HOST.markDays }, () => glow('glyph-diamond-1.2', 0.5, 0.5));
    for (const pip of pips) pip.visible = false;
    this.glow.addChild(beam, ...pips);
    const sh: Shown = {
      id, look, role: look.d.role, root, figure, sprites: [], whole, slot: -1, pool, ring, beam, ticks, pips, body: new Body(), v: hash(id), facing: 1, turnAt: -99,
      follower, paintAt: -99, fellAt: -99, route: null, line: new Float64Array(64), lineN: 0, stamp: 0, until: 0, key: -1, keyName: '', keyPx: 0,
    };
    this.shown.set(id, sh);
    // the figure's own box is what a click takes (sized each frame for the region it is in)
    root.hitArea = new Rectangle();
    this.figures.addChild(root);
    return sh;
  }

  /** A route's polyline in world units: the ways between its places. */
  private build(sh: Shown, route: PlaceId[]): void {
    sh.route = route;
    let n = 0, len = 0, px = 0, py = 0;
    const add = (x: number, y: number): void => {
      if (n > 0) len += Math.hypot(x - px, y - py);
      if ((n + 1) * 3 > sh.line.length) { const g = new Float64Array(sh.line.length * 2); g.set(sh.line); sh.line = g; }
      const o = n++ * 3;
      sh.line[o] = px = x; sh.line[o + 1] = py = y; sh.line[o + 2] = len;
    };
    for (let i = 0; i < route.length - 1; i++) {
      const line = way(route[i]!, route[i + 1]!);
      for (let k = 0; k < line.length; k += 2) add(mx(line[k]!), my(line[k + 1]!));
    }
    if (n === 1) add(px, py);
    sh.lineN = n;
  }

  /** An event on a person: the reaction it puts on them, or their fall. */
  private react(e: GameEvent, t: number): void {
    const kind = e.kind, ok = 'ok' in e ? e.ok : true;
    const sh = e.unit ? this.shown.get(e.unit) : undefined;
    if (!sh) return;
    if (kind === 'devour' || kind === 'lost' || kind === 'gone') { sh.fellAt = t; return; }
    const r = REACT[kind === 'whisper' && !ok ? 'refused' : kind === 'moved' && !ok ? 'startle' : kind === 'search' ? 'fear' : kind];
    if (!r) return;
    const ix = this.roles[sh.role]![r[0]];
    if (ix !== undefined) sh.body.reactTo(r[0], this.series[ix]!, t, r[1]);
  }
}
