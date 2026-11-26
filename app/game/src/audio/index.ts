// src/audio, the sound (implements `Audio`). Owns the one AudioContext, its four buses (master, music, sfx, ambience,
// from the settings), the voices and their ducking, and the streamed clips (loop.ts). Reads the view model each frame
// (fresh events, film, camera, title, state), the sim's Query (hour, daylight, part of day, weekday), content's sound tables
// (handed in at boot) and the baked packs of assets/audio (docs/art-pipeline.md). Plays a cue for each fresh event, the
// films' beats, a bed by what is on screen (the title is silent), ambience by where the camera looks, the hour, the
// weekday, the weather and the town's mood. Silent until the first gesture lets the AudioContext run; `?mute=1` makes
// no context at all.
import raw from '../../assets/audio/manifest.json';
import type { Affinity, Audio, Crystal, Film, GameEvent, Query, Settings, SoundCue, SoundTables, ViewModel, Weather } from '../types';
import { Loop, type Clip } from './loop';

interface Sfx { v: Clip[]; mat?: Record<string, Clip[]>; night?: Clip[]; minGap: number; maxVoices?: number; duck?: number; duckHold?: number }
export interface Manifest {
  packs: { f: string; stream?: boolean }[];
  sfx: Record<string, Sfx>;
  beds: Record<string, Clip>;
  amb: Record<string, Record<string, Clip>>;
  stingers: Record<string, Clip>;
  nightSoft: Record<string, number>;
}
export const MANIFEST = raw as unknown as Manifest;

const URLS = import.meta.glob('../../assets/audio/*.opus', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/** Seconds between ambience and bed mixes; the glides of each. */
const MIX_EVERY = 0.25;
const BED_FADE = 1.6;
const AMB_FADE = 4;
/** dB a stinger takes off the bed while it plays. */
const STINGER_DUCK = -6;
const db = (d: number): number => 10 ** (d / 20);
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** The manifest's crystal material for each affinity. */
const MATERIAL: Record<Affinity, string> = {
  hunger: 'hunger', malice: 'malice', faith: 'faith', fear: 'fear', blood: 'blood', shadow: 'shadow', stone: 'stone', echo: 'echo', flame: 'ember',
};

/** What the mixer knows about the moment, 0..1 each. */
interface Moment { mine: number; town: number; valley: number; day: number; shift: number; evening: number; weather: Weather; market: number; flame: number }

/** Ambience layers and their level law. A layer with moods (crowd, market, tavern) plays the town's mood. */
const AMBIENCE: [string, (m: Moment) => number][] = [
  ['grave', (m) => m.mine * 0.8],
  ['lamps', (m) => m.mine * 0.6],
  ['seep', (m) => m.mine * 0.5],
  ['nether', (m) => m.mine * 0.4],
  ['carts', (m) => m.mine * m.shift],
  ['lift', (m) => (m.mine + m.town * 0.5) * m.shift],
  ['water', (m) => (m.weather === 'rain' || m.weather === 'storm' ? m.mine : 0)],
  ['beasts', (m) => m.mine * (1 - m.day) * 0.6],
  ['crowd', (m) => m.town * m.day],
  ['market', (m) => m.town * m.day * (0.3 + 0.7 * m.market)],
  ['tavern', (m) => m.town * (0.2 + 0.8 * m.evening)],
  ['hymn', (m) => m.town * m.day * m.flame],
  ['council', (m) => m.town * m.day * 0.4],
  ['smelter', (m) => m.town * m.shift * 0.6],
  ['night', (m) => m.town * (1 - m.day)],
  ['road', (m) => m.valley],
  ['wind', (m) => Math.max(m.valley * 0.6, m.weather === 'wind' ? 1 - m.mine : 0)],
  ['rain', (m) => (m.weather === 'rain' || m.weather === 'drizzle' ? 1 - m.mine : 0)],
  ['rainMud', (m) => (m.weather === 'rain' || m.weather === 'storm' ? m.town * 0.6 : 0)],
  ['storm', (m) => (m.weather === 'storm' ? 1 - m.mine * 0.5 : 0)],
  ['fog', (m) => (m.weather === 'fog' ? 1 - m.mine : 0)],
];

/**
 * The sfx name a cue picks for an event (a field of the event, else of its crystal, chooses), or null. A number
 * chooses by its move: `up` or `down` against the event's `was`, or against 0.
 */
export function cueName(cue: SoundCue, e: GameEvent, crystal?: Crystal): string | null {
  if (cue === null || typeof cue === 'string') return cue;
  const ev = e as unknown as Record<string, unknown>;
  const v = ev[cue.by] ?? (crystal as unknown as Record<string, unknown> | undefined)?.[cue.by];
  if (typeof v !== 'number') return cue.names[String(v)] ?? null;
  const d = v - (typeof ev.was === 'number' ? ev.was : 0);
  return d > 0 ? cue.names.up ?? null : d < 0 ? cue.names.down ?? null : null;
}

export function createAudio(q: Query, tables: SoundTables, muted: boolean): Audio {
  return new Player(q, tables, muted);
}

class Player implements Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  /** Beds go through the duck; stingers and the films' beats do not. */
  private bedIn!: GainNode;
  private sfxBus!: GainNode;
  private ambBus!: GainNode;
  private readonly packs = new Map<number, Promise<Blob>>();
  private readonly buffers = new Map<Clip, Promise<AudioBuffer>>();
  /** Every streamed loop by key (`bed.whisper`, `amb.crowd.calm`, `stinger.bestFind`); null while its pack loads. */
  private readonly loops = new Map<string, Loop | null>();
  private readonly loopList: Loop[] = [];
  private readonly lastAt = new Map<string, number>();
  private readonly voices = new Map<string, number>();
  private mixAt = 0;
  private film: Film | null = null;
  private filmT = 0;
  private wanted: Settings | null = null;

  constructor(private readonly q: Query, private readonly tables: SoundTables, private readonly muted: boolean) {}

  async load(): Promise<void> {
    if (this.muted) return;
    const ctx = (this.ctx = new AudioContext());
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.music = ctx.createGain();
    this.music.connect(this.master);
    this.bedIn = ctx.createGain();
    this.bedIn.connect(this.music);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.ambBus = ctx.createGain();
    this.ambBus.connect(this.master);
    if (this.wanted) this.settings(this.wanted);
    const resume = (): void => void ctx.resume();
    window.addEventListener('pointerdown', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });
    MANIFEST.packs.forEach((p, i) => p.stream || void this.pack(i));
  }

  settings(s: Settings): void {
    this.wanted = s;
    if (!this.ctx) return;
    this.master.gain.value = s.master * s.master;
    this.music.gain.value = s.music * s.music;
    this.sfxBus.gain.value = s.sfx * s.sfx;
    this.ambBus.gain.value = s.ambience * s.ambience;
  }

  frame(vm: ViewModel): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const day = this.q.daylight(this.q.hour(vm.state.tick));
    for (const e of vm.fresh) {
      const crystal = 'crystal' in e && e.crystal !== null ? vm.state.crystals[e.crystal] : undefined;
      const name = cueName(this.tables.cues[e.kind], e, crystal);
      if (name) this.sfx(name, day < 0.5, crystal);
    }
    this.beats(vm.film);
    if (ctx.currentTime >= this.mixAt) {
      this.mixAt = ctx.currentTime + MIX_EVERY;
      this.mix(vm, day);
    }
    for (let i = 0; i < this.loopList.length; i++) this.loopList[i]!.tick(day);
  }

  /** The film's beats between the last frame and this one. */
  private beats(f: Film | null): void {
    if (f !== this.film) this.filmT = -1;
    this.film = f;
    if (!f) return;
    for (const b of this.tables.films[f.kind]) {
      if (b.at <= this.filmT || b.at > f.t) continue;
      if (b.sfx) this.sfx(b.sfx, false);
      if (b.stinger) this.stinger(b.stinger);
    }
    this.filmT = f.t;
  }

  private sfx(name: string, night: boolean, crystal?: Crystal): void {
    const ctx = this.ctx!;
    const s = MANIFEST.sfx[name];
    if (!s) throw new Error(`audio: the manifest has no sfx "${name}"`);
    const now = ctx.currentTime;
    const voices = this.voices.get(name) ?? 0;
    if (now - (this.lastAt.get(name) ?? -Infinity) < s.minGap || voices >= (s.maxVoices ?? Infinity)) return;
    this.lastAt.set(name, now);
    this.voices.set(name, voices + 1);
    const set = (crystal && s.mat?.[MATERIAL[crystal.affinity]]) || (night && s.night) || s.v;
    const clip = set[Math.floor(Math.random() * set.length)]!;
    const gain = clip.g * (night ? db(MANIFEST.nightSoft[name] ?? 0) : 1);
    void this.buffer(clip).then((buf) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(g).connect(this.sfxBus);
      src.onended = () => this.voices.set(name, (this.voices.get(name) ?? 1) - 1);
      src.start();
    });
    if (s.duck) this.duck(s.duck, s.duckHold ?? clip.len);
  }

  private stinger(name: string): void {
    const clip = MANIFEST.stingers[name];
    if (!clip) throw new Error(`audio: the manifest has no stinger "${name}"`);
    this.loop(`stinger.${name}`, clip, this.music, (l) => l.once());
    this.duck(STINGER_DUCK, clip.len);
  }

  /** The bed dips by `dB` for `hold` seconds, then comes back. */
  private duck(dB: number, hold: number): void {
    const g = this.bedIn.gain;
    const t = this.ctx!.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(db(dB), t, 0.03);
    g.setTargetAtTime(1, t + hold, 0.4);
  }

  private mix(vm: ViewModel, day: number): void {
    const st = vm.state;
    const film = vm.film?.kind;
    const bed = vm.title ? null
      : film === 'opening' ? null : film === 'watershed' ? 'watershed' : film === 'ending' || st.phase === 'won' ? 'ending'
      : st.phase === 'lost' ? 'defeat' : st.phase === 'bonus' ? 'bonus' : st.stage;
    for (const name in MANIFEST.beds) this.level(`bed.${name}`, MANIFEST.beds[name]!, this.bedIn, name === bed ? 1 : 0, BED_FADE);

    const zoom = vm.camera.zoom;
    const part = this.q.part(st.tick);
    const weekday = this.q.weekday(st.tick);
    const m: Moment = {
      mine: clamp01(2 - zoom), town: clamp01(zoom - 1) - 0.5 * clamp01(zoom - 2), valley: clamp01(zoom - 2), day,
      shift: part === 'shift' ? 1 : 0, evening: part === 'dusk' || part === 'night' ? 1 : 0, weather: st.weather,
      market: weekday === 'market' ? 1 : 0, flame: weekday === 'flame' ? 1 : 0,
    };
    const mood = this.mood(vm);
    for (const [layer, law] of AMBIENCE) {
      const v = vm.title || film === 'opening' ? 0 : law(m);
      const clips = MANIFEST.amb[layer]!;
      for (const k in clips) this.level(`amb.${layer}.${k}`, clips[k]!, this.ambBus, k === mood || !(mood in clips) && k === 'calm' ? v : 0, AMB_FADE);
    }
  }

  /** The town's mood: afraid or uneasy by the highest suspicion, fervent with a dozen followers, else calm. */
  private mood(vm: ViewModel): string {
    const f = vm.state.factions;
    const level = Math.max(f.temple.level, f.council.level, f.public.level);
    if (level >= 3) return 'afraid';
    if (level >= 2) return 'uneasy';
    let followers = 0;
    for (const id in vm.state.people) if (vm.state.people[id]!.follower) followers++;
    return followers >= 12 ? 'fervent' : 'calm';
  }

  /** A loop's level: made on first need (never for silence), glided after. */
  private level(key: string, clip: Clip, out: AudioNode, v: number, fade: number): void {
    const l = this.loops.get(key);
    if (l) l.set(v, fade);
    else if (l === undefined && v > 0) this.loop(key, clip, out, (made) => made.set(v, fade));
  }

  private loop(key: string, clip: Clip, out: AudioNode, then: (l: Loop) => void): void {
    const have = this.loops.get(key);
    if (have) return then(have);
    if (have === null) return;
    this.loops.set(key, null);
    void this.pack(clip.p).then((blob) => {
      const l = new Loop(this.ctx!, URL.createObjectURL(blob.slice(clip.b[0], clip.b[1], 'audio/ogg')), clip, out);
      this.loops.set(key, l);
      this.loopList.push(l);
      then(l);
    });
  }

  private pack(p: number): Promise<Blob> {
    let got = this.packs.get(p);
    if (!got) {
      const url = URLS[`../../assets/audio/${MANIFEST.packs[p]!.f}`]!;
      got = fetch(url).then((r) => r.blob());
      this.packs.set(p, got);
    }
    return got;
  }

  /** A one-shot: its slice of the pack is a whole Ogg Opus stream, decoded once. */
  private buffer(clip: Clip): Promise<AudioBuffer> {
    let got = this.buffers.get(clip);
    if (!got) {
      got = this.pack(clip.p).then((b) => b.slice(clip.b[0], clip.b[1]).arrayBuffer()).then((a) => this.ctx!.decodeAudioData(a));
      this.buffers.set(clip, got);
    }
    return got;
  }
}
