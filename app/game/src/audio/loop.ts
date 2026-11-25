// A streamed clip (a bed, an ambience layer, a stinger): two media elements over the clip's own Ogg slice, the second
// starting at the loop's start `xfade` seconds before the first reaches its end, so the loop never seams. A `q` clip
// carries four channels, night (1-2) and day (3-4), mixed by `day` (0..1).

export interface Clip { p: number; b: [number, number]; g: number; len: number; loop?: [number, number, number]; st?: boolean; q?: boolean; a?: number }

export class Loop {
  /** The layer's level: what the mixer sets; the clip's own gain is under it. */
  readonly level: GainNode;
  private readonly els: { el: HTMLAudioElement; gain: GainNode }[] = [];
  private cur = 0;
  private playing = false;
  /** A q clip's four channel gains. */
  private readonly quad: GainNode[] = [];

  constructor(private readonly ctx: AudioContext, url: string, private readonly clip: Clip, out: AudioNode) {
    this.level = ctx.createGain();
    this.level.gain.value = 0;
    const clipGain = ctx.createGain();
    clipGain.gain.value = clip.g;
    clipGain.connect(this.level).connect(out);
    let into: AudioNode = clipGain;
    if (clip.q) {
      // channel i goes to side i % 2 through its own gain: 0-1 the night pair, 2-3 the day pair
      const split = ctx.createChannelSplitter(4);
      const merge = ctx.createChannelMerger(2);
      for (let i = 0; i < 4; i++) {
        const g = ctx.createGain();
        split.connect(g, i).connect(merge, 0, i % 2);
        this.quad.push(g);
      }
      merge.connect(clipGain);
      into = split;
    }
    for (let i = 0; i < (clip.loop ? 2 : 1); i++) {
      const el = new Audio(url);
      el.preload = 'auto';
      const gain = ctx.createGain();
      ctx.createMediaElementSource(el).connect(gain).connect(into);
      this.els.push({ el, gain });
    }
  }

  /** Glide the level to `v` over about `s` seconds; a silent loop stops, an audible one plays. */
  set(v: number, s: number): void {
    this.level.gain.setTargetAtTime(v, this.ctx.currentTime, s / 3);
    if (v > 0 && !this.playing) this.start(0);
    else if (v === 0 && this.playing && this.level.gain.value < 1e-3) this.stop();
  }

  /** Each frame: the next pass begins on time; the day share of a q clip follows `day`. */
  tick(day: number): void {
    for (let i = 0; i < this.quad.length; i++) this.quad[i]!.gain.value = i < 2 ? 1 - day : day;
    const loop = this.clip.loop;
    if (!this.playing || !loop) return;
    const a = this.els[this.cur]!;
    if (a.el.currentTime < loop[1] - loop[2]) return;
    this.cur = 1 - this.cur;
    this.start(loop[0]);
    const t = this.ctx.currentTime;
    a.gain.gain.setTargetAtTime(0, t, loop[2] / 3);
  }

  /** A one-shot (a stinger): play the clip once at full level. */
  once(): void {
    this.level.gain.value = 1;
    this.start(0);
  }

  private start(at: number): void {
    const { el, gain } = this.els[this.cur]!;
    const t = this.ctx.currentTime;
    const fade = this.playing ? this.clip.loop?.[2] : undefined;
    gain.gain.setValueAtTime(fade ? 0 : 1, t);
    if (fade) gain.gain.setTargetAtTime(1, t, fade / 3);
    el.currentTime = at;
    void el.play();
    this.playing = true;
  }

  private stop(): void {
    for (const { el } of this.els) el.pause();
    this.playing = false;
  }
}
