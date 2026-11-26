# HUD — play interface (running handoff)

**UI-2 (current): the mine interface finished.** Owns `src/ui/play/**`, `src/ui/plate.ts`, `src/ui/settings.ts` (look), `src/scenes/front/bonus.ts`, `dev/hud.html`, `e2e/hud-shots.cjs`, `tests/hud/**`, `screenshots/ui6-*`. Kit: `docs/style.md` §7. Decisions: DECISIONS §43 (cards), §44 (scale), §45 (UI-2).
- Files: `index.ts` (mount, layout, render, keys), `rest.ts` (god + goal, powers, pouch, End Night, depth mark), `hand.ts` (hand, draw, the three in the centre), `person.ts`, `gravepanel.ts`, `pay.ts`, `dialogs.ts` (`pickCard` for any scene), `notes.ts`, `dusk.ts`, `record.ts`, `guide.ts` (marks + rules), `words.ts` (all words), `css.ts`, `dom.ts`, `kit/*`. `src/ui/plate.ts` paints the gear and the camera button.
- Scale: `uiZoom` in `src/app/settings.ts`. It is proportional to the view, × 0.84, × Interface size (85/100/115). The guide layer uses the same k.
- Cards: `HudVM.cards: CardsVM` (hand, max, nextFee, draw, offer). Handlers `onDraw`, `onTake(id|null)`, `onDiscard(id)`, `onCardPlay`. `cards` absent or null = nothing at the bottom centre. An open offer blocks End Night.
- Scene builder must, for this piece:
  1. Send `cards` from the bridge (drop `hand`/`hands`/`onHandSkip`). On night 1, send `cards: null`, or `draw: { ready: false }` with an empty hand.
  2. Give/wear: set `CardCommon.carry = { worn: [{ id, name, line, take }], give: [{ id, name, line }] }` from `legal.giveItemWhy/takeItemWhy`. Pass `GraveVM.items[].take`. Wire `onGiveItem(item, unit)` → `{ type: 'giveItem', item, unit }` and `onTakeItem(item)` → `{ type: 'takeItem', item }`.
  3. Out of reach: optionally set `CardCommon.reach` ("In the bunks at night, once your colour touches them"). Without it the slab says one line built from the person's zone.
  4. Depth mark: set `HudVM.depth = { level }` (1-3, or null when not down in the mine), and stop `world.ts:780` `this.depth.draw(...)`.
  5. Hit test: people first. Within a figure-sized screen box of at least 28 px (centre on the figure's body, not its feet) a person wins over the place under them, at any zoom (`world.ts` pick / `render` hit).
  6. Delete the play scene's own `.pl-bonus` picker (`showBonus` in `src/scenes/play/index.ts`, `.pl-bonus` CSS in `styles.ts`). Use `pickCard(this.root, cards, { title })` or the `bonus` scene. Restyle nothing on `.pl-cam`: `src/ui/plate.ts` does it.
- Proof: `node e2e/hud-shots.cjs` (BASE=running server). It plays seed 7 for 4 nights, sets the cards with real ids, and writes `screenshots/ui6-*.png`, `ui6-sheet.png` and `ui6-report.json`. It checks overlap and cut-off at 1600x900 and 1280x720, text of 14 px or more at 1600x900, one guide mark at a time, and console errors.
- Older notes below (v3-v6 calls for PLAY-CORE / FEEL) still describe the scene-side contract.


> **PLAY-CORE — the pending event (Shade "Answer the event first"):** `const i = await hud.event({ id: ev.id, title, body, options: ev.choices.map(c => ({ label: c.label, consequence: c.line, ok: c.ok })) }); sim.answer(ev.id, i)`. Call it as soon as the sim has a pending event (and again after a reload of the night); the card is modal, and if a moment displaces it a standing chip "An event waits: <title>. Answer it to end the night." reopens it. Also put the reason in End Night's preview (`night.endPreview`), not only in a ticker.
> **PLAY-CORE — Enchant:** the HUD enables "Add a line" when `enchantPreview(id).ok && open > 0` and otherwise prints the reason on the button (`why`, or "No open line…"). In `hudbridge.ts` `open` must follow the sim: `open: p.open ? Math.max(1, info?.open ?? 1) : 0` (today it is `c.slots - c.lines.length`, which is 0 when the sim would allow a line).
> **v5 (builder #5) additions — see "Builder #5" at the end:** `hud.offering(list, { driven?, waitFor?: (i) => Promise<void> })` (waitFor: stone i is revealed only after it resolves — the bearer reached the grave; bounded at 3.6 s), FEEL R3b cues (dayNote re-projected, dayNoteHide/Merge, dayFollow, dayCatchUp, offeringSet/Reveal/Best/Done, offerBeat, duskCount, ledger, duskEnd), `CardCommon.about/reasons`, `CrystalVM.sim`, `DayVM.why`, `DawnVM.rows/count`, handler `onFollowDay`.

> **v6 (builder #6) — READ FIRST, for PLAY-CORE's successor:**
> - **Story events go through the event card, not `hud.blessing`:** `void this.ui.event(ev).then((i) => done(sim.act({ type: 'resolveEvent', option: Math.max(0, i) })))` (already in `index.ts`, marked `// HUD`). End Night with an event waiting calls `this.ui.reopenEvent()` instead of ending. The bridge rewrites the sim's rules words to this world's ("Government Suspicion" → "Council heat", "Cult" → "Temple"); the source strings in `src/sim/content/events.ts` should be fixed by SIM too.
> - **"Follow the day":** the HUD handler is `onFollowDay(on)` (bridge → `BridgeVerbs.followDay(on)` → FEEL `followDay`). There is no `onDayFollow`; use `onFollowDay`.
> - **The pay box sums worth, not face value:** the bridge's `payOptions` now reads `SIM.payOptions` and gives each stone its burn worth for this miracle (what `payValue` checks), and the preselection always covers the cost. "2 of 3" with a dead Pay button was the HUD summing face value while the sim charged worth.
> - **The top bar keeps clear of the scene's "Whole world" button** (`.pl-cam` / `[data-action="camera"]` is measured each layout; the bar stops 8 px short of it and wraps).
> - **Town cards (agreed shape with PLAY-SHADE's `ShadeHit`):** on a town hit `{ kind: 'crowd' | 'elite', unit }` the scene sets its card target to `{ kind: 'person', id: hit.unit }` (the crowd id `c01`, never a member `c01#3`; the Elite id `e01`) and refreshes; the bridge opens one card for it — a crowd: name, size, mood, "N gold wicks · mood", "Turn them and N people are yours", Whisper as a group with the sim's odds and their reasons; an Elite: who they are, what turning them gives (PLAY-SHADE `eliteTargets` prize), Resistance / where you stand / what is in the way, Whisper. `kind 'block'` hits open nothing in the HUD yet. The three heat tracks are always in the top bar (three coloured bars beside the danger word); each telegraphed faction move, the exposed and a hostile track are standing warnings under the goal (`threat:<id>`, `exposed`, `hostile:<faction>`), and End Night's preview names the dusk threat.
> - **`dusk: true` is safe now** for the HUD's side. Exact calls the scene keeps: at FEEL's `duskStart` (or when the day film ends its shift), open the strip driven — `this.ui.hud.offering(list, { title, driven: true })` (no `waitFor`: FEEL times the beats); FEEL's `offeringSet/Reveal/Best/Done` and `offerBeat` find each stone **by crystal id** (index only as fallback), so the scene's order need not match FEEL's. FEEL's `ledger` cue draws the ledger and the HUD completes it from the sim through the bridge's `duskLedger` handler (the day's lead line, struck/brought/carted rows, Shade heat rows, the Council's count) — the scene can drop its own `ui.dawn(...)`. FEEL's `duskEnd` toasts the night; FEEL calls `hud.deal()`. What the scene must still do: `nv.offeringDone(...)` when FEEL's offering is done, and the night's input when FEEL's `onEnd` fires.

## PUBLIC INTERFACE (binding for PLAY-v2; additive changes only)

```ts
import { mountHud } from '../../ui/play';          // src/ui/play/index.ts
const hud = mountHud(root /* sc.ui or any positioned element */, handlers, opts?);
```

### `mountHud(root: HTMLElement, handlers: HudHandlers, opts?: HudOptions): Hud`
```ts
interface HudOptions {
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null; // guidance persistence; default localStorage (guarded)
  reduceMotion?: boolean;          // also follows #ui.hg-reduce-motion and prefers-reduced-motion
  hintsEnabled?: boolean;          // settings.showHints (default true)
  rules?: GuideRule[];             // extra guidance rules (added to the built-in set)
  settings?: HudSettingsLike | null; // default: src/app/settings store — showHints, reduceMotion, command 'resetHints' are wired by the HUD itself
}

interface Hud {
  set(vm: Partial<HudVM>): void;           // shallow merge by key; null hides that component; each part diff-renders (no layout shift)
  pulse(id: HudAnchor, o?: { delta?: number; cause?: string }): void; // count + pulse a stat/goal/control; cause = one short line
  ticker(t: TickerVM): void;               // event ticker at the left edge (never over the centre), fades after ~4 s
  toast(t: ToastVM): void;                 // unlock / small news, top-centre under the bar, one at a time, queued
  moment(m: MomentVM): Promise<void>;      // level up / Divinity up / stage / defeat: centred card, resolves on button/Enter/Esc
  modal(m: ModalVM): Promise<number>;      // story event with choices; resolves with the chosen option index
  warn(w: WarningVM): void; clearWarn(id: string): void;  // standing warnings (hunger, follower in danger) under the stat bar
  guide: Guide;                            // guidance engine (below)
  anchor(id: HudAnchor): HTMLElement | null;  // element for FEEL's hud.pulse/pop and for coach marks
  regions(): DOMRect[];                    // screen rects the HUD covers now (camera framing / world hints avoid them)
  key(e: KeyboardEvent): boolean;          // call from scene.onKey; true = consumed. Esc order: hint → modal → send → card → (false: open settings)
  layout(): void;                          // call on app.onLayout; also self-observes root size
  destroy(): void;
  // added (FEEL host compatible: pass `hud` as FeelHost.hud):
  sendAt(x: number, y: number): void;      // move the Send chip cheaply on pointer move (root px)
  pop(id: HudAnchor | string, p?: { text?: string; value?: number; at?: Vec /*world*/ }): void; // brief rising number
  summary(lines: string[], title?: string): void;   // = set({ dawn })
  dayProgress(t01: number, label?: string): void;   // day strip
  busy(on: boolean): void;                 // grey End Night during a once-per-run moment
  visible(on: boolean): void;              // fade the whole HUD (cutscene hand-over)
  readonly el: HTMLElement;
}

type HudAnchor = 'ichor' | 'hunger' | 'nether' | 'crystals' | 'danger' | 'malice' | 'level'
  | 'goal' | 'goal:<lineId>' | 'endNight' | 'miracles' | 'eat' | 'card' | 'card:whisper' | 'card:send'
  | 'day' | 'chronicle' | 'send';
```



## v3.1 INTERFACE (DECISIONS §15.10, §16; spec v2.1 §5, §5b, §7 — ADDITIVE to the v3 block below; builder #3)

### Stable `data-action` names (native on the HUD's own buttons — PLAY-CORE's aliases can go)
`whisper` · `recall` · `lie-low` · `set-routine` [`data-routine`=pray|offer|lieLow; current has class `primary`] · `move` · `end-night` · `eat` (night button, and in the crystal card with `data-crystal`) · `skip-day` · `next-night` (dawn/ledger Continue) · `log` (chronicle) · `crystals` (Grave button) · `set-crystal` / `unset-crystal` / `enchant` / `recombine` [`data-crystal`] · `play-miracle` / `play-evil` (each hand card `[data-card]` and the big card's Play button `[data-card]`) · `skip-miracle` / `skip-evil` · `offer-continue` · `hint-got-it` / `hint-close` · `moment-continue`. Crystal tiles carry `data-crystal` + `data-tier` (0–5); sockets `data-socket`. No Send button exists any more (the follower card has routine + Move only).

### CrystalVM additions (all optional)
```ts
base?: { name; line? } | null;  affinity?: { id /*hunger|malice|faith|fear|blood|shadow|stone|echo|flame*/; name } | null;
mods?: { kind: 'implicit'|'prefix'|'suffix'|'curse'; text; tier?; oneIn? }[];  modsMax?: number;  oneIn?: number | null /*"1 in 48,000"*/;
from?: string | null /*"the east face · level 2"*/;  how?: 'tribute'|'offered' | null;  eat?: number | null /*Hunger off when eaten*/;
hallowed?: { price; hint } | null /*Flame: nightly price + "profane it at a chapel you hold"*/
```
`cut`/`stats` stay (rough state is no longer drawn; `mods` replaces `stats` when present).
### GraveVM additions
```ts
mine?: { tier: string /*"Tier I mine"*/; line?: string } | null;
crafts?: { id: 'enchant'|'recombine'|'facet'|'jewel'|'weights'|'profane'|'draught'|string; name; line; locked; unlock? /*"Take over a forge"*/; cursed? }[] | null;  // default: all seven of spec §7.4
resonance?: { sockets: string[]; affinity: { id; name }; line: string; bad? /*Flame quarrels*/ }[] | null;
items?: { id; name; kind; crystal?; lines; wornBy?; exposure? }[] | null;
```
### FollowerCardVM additions
`worn?: { id; name; line; exposure /*plain words*/ } | null; give?: { id; name; line }[] | null` (Give / Take back are free).
### PlayCardVM additions
`burns?: string | null` (shown on the card at rest — pass `text.cardCost(view)`), `flavour?: string | null` (big card only). `art` or `id` = the sim card id → the card's own inked scene (`src/ui/play/cardart.ts`, all 17 miracles + 13 acts of evil).
### Handlers additions (replace cutChoices / onCut / graftOptions / onGraft, which the HUD no longer calls)
```ts
enchantPreview?(crystalId) → { cost; ok; why; open /*open slots*/; curseChance; canReroll } | null;   onEnchant?(crystalId, modIndex: number | null /*null = add*/);
recombinePreview?(a, b) → { ok; why; rows: [label, value][] /*grade / base / nature / lines odds*/; note? } | null;   onRecombine?(a, b);
facetChoices?(crystalId) → CutChoicesVM | null;  onFacet?(crystalId, choiceId);  onForge?(crystalId, 'ring'|'amulet'|'circlet');  onFacility?(craftId, crystalId);
onGiveJewel?(itemId, unit);  onTakeJewel?(itemId, unit);
onOfferBeat?(beat: 'set'|'reveal'|'best', crystal, index)   // fire VFX offerReveal + audio offeringSet / crystalReveal / stinger('bestFind') in step
```
### Hud additions
`hud.offering(list: { crystal, from?, how?: 'tribute'|'offered' }[])` labels each stone "Unasked tribute" / "Their haul"; the strip = stir → flip → grade named (+ "1 in N" when notable) → best find held; ≤ ~6–8 s; click/Enter = faster.
`hud.crystalMoment(c, kind)` kinds add 'enchant' | 'curse' | 'recombine' | 'facet' | 'forge'.
`hud.cue(name, p?)` — FEEL's named beats (see `handoffs/FEEL.md` §HUD): `dayNote {entry, anchor}` (the day feed, below), `onceInARun {oneIn}`, `tributeArrive/tributeLaid`, `itemGiven`, `facilityGained`, `itemExposed`, `enchant*`, `recombine*`, `offering*`, `cardDealt`; unknown names are ignored.
Day feed (§16): `hud.cue('dayNote', { entry: { id, time, kind, place, who[], text /*already in WRITING's words*/, weight /*0 light … 2 heavy*/ }, anchor: {x,y} root px | FocusTarget })` → a note at the place (≤ 3 on screen, never over the grave — the HUD asks `project({kind:'zone', id:'grave'})`), collected in a feed list; click → `handlers.onFocusNote?(id)`.
DayVM additions: `clock?: string` ("Noon"), `calendar?: { name }` ("Market day"), `weather?: { id; name }` ("Drizzle"), `paused?: boolean`; handler `onDayPause?(on)`; `skip-day` skips to dusk.
Guide `saw()` names added: 'enchanted', 'recombined', 'faceted', 'forged', 'crafted'.

## v3 INTERFACE (DECISIONS §15 — supersedes the "ADDED … card hand + item slots" block below; additive to v1)

### For FRONT (bonus pick) and anyone who needs a card: the generic card component
```ts
import { pickCard, cardFace } from '../../ui/play';      // src/ui/play/index.ts
pickCard(host: HTMLElement, cards: PlayCardVM[], o?: { title?: string; lines?: string[]; sound?(n) }): Promise<string>  // veil, cards fan in, hover lift, click or 1–9 picks; resolves with the card id
cardFace(card: PlayCardVM) → { inner, text }   // the big readable face (art window, name + cost gem, rarity · kind, two lines) to put in your own button
// PlayCardVM = { id, name, kind?: 'miracle'|'evil'|'blessing'|…, art?: icon name | image URL | null, cost, costKind?, rarity: tier, lines: [string, string], details?, ok, why, target? }
```
Inside the play HUD the same faces are used by the hands (`set({ hands })`) and `hud.blessing(cards)`.

### Crystal drawing — NOT owned here
The CRYSTAL builder owns every crystal picture (`src/render/crystal`, `handoffs/CRYSTAL.md`). The HUD draws through one adapter, `src/ui/play/crystal.ts` (`drawCrystal(seed, tier, size, {cut, spurs, cracked})`), which holds a stand-in painter until that module lands; then the adapter calls `crystalIcon`. Do not import the stand-in from outside the HUD. (Old note kept for reference:)
```ts
import { paintCrystal, drawCrystal, CRYSTAL_TIERS, crystalPalette } from '../../ui/play/crystal';
type CrystalTier = 'dull' | 'clear' | 'bright' | 'deep' | 'royal' | 'impossible';      // value 1/2/4/8/16/32
paintCrystal(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, seed: number, tier: CrystalTier,
             o?: { cut?: boolean /*false = rough crust*/; spurs?: number /*grafts grown*/; cracked?: boolean; glow?: number /*0..1*/; time?: number /*s, shimmer*/ }): void
drawCrystal(seed, tier, size /*css px*/, o?) → HTMLCanvasElement   // dpr-aware; same picture as paintCrystal
crystalPalette(tier) → { name, value, lo, mid, hi, glow }          // the six rarity colours
```
Deterministic from (seed, tier, opts): silhouette (shard count, lean, spikes) and facets come from the seed; rarer = stranger (more shards, twists, floating splinters, inner light).

### HudVM additions
```ts
hands?: HandVM[] | null;          // [miracles, evil]: each { id, title, cards (3), plays, playsMax (1), canSkip, skipped?, deal?, aiming? }
grave?: GraveVM | null;           // the grave panel (inventory + sockets)
aim?: AimVM | null;               // the one cursor chip (Move preview, targeted card): { at, ok, line, sub?, chance? } — replaces the Send chip
// StatsVM: ap?: { left: number; max: number }; tally?: { expected; counted; short; word; council: string; line: string }  (StatId 'ap' | 'tally')
// WhisperVM: ap?: number (cost in action points)
// FollowerCardVM: routine?: { current: string; options: { id: 'pray'|'offer'|'lieLow'|string; label; line; ap; ok; why }[] };
//                 stash?: number; move?: { ap: number; ok: boolean; why: string | null; chanceWord?: string }
// PlayCardVM: cost = crystal value when costKind === 'crystals' (pay step), art, rarity (six tiers), lines, details
interface CrystalVM { id; seed; tier: CrystalTier; name; cut: boolean; value; lines: [string, string]; stats: string[] /*1–4 plain lines; [] while rough*/;
  odd?: { name; line } | null; cracked?: boolean; flaw?: boolean; spurs?: number; grafts?: number; graftsMax?: number; set?: boolean; isNew?: boolean; details?: [string, string][] }
interface GraveVM { sockets: { id; crystal: CrystalVM | null; locked?: boolean; why?: string | null }[]; crystals: CrystalVM[]; open?: boolean;
  cutCost: number; canCut: boolean; why?: string | null }
```
### Handlers additions
```ts
onCardPlay?(cardId, at?, burn?: string[] /*crystal ids chosen in the pay step*/): void;  onHandSkip?(handId): void;
payOptions?(cardId) → { need: number; crystals: CrystalVM[]; preselect?: string[] } | null;   // = sim payOptions selector
onRoutine?(unit, routineId): void;  onMoveStart?(unit): void;  onMoveCancel?(): void;
onEat?(crystalId?): void (v1 onEat() still works);  onSet?(crystalId, socketId?): void;  onUnset?(socketId): void;
cutChoices?(crystalId) → { cost: number; crackChance: number; choices: { id; lines: string[]; note?: string }[] } | null;  onCut?(crystalId, choiceId): void;
graftOptions?(targetId) → { donors: { crystal: CrystalVM; parts: { id; label; kind: 'line' | 'odd' }[] }[]; why?: string | null } | null;  onGraft?(targetId, donorId, partId): void;
onGrave?(open: boolean): void;
```
### Hud additions
```ts
offering(list: { crystal: CrystalVM; from?: string }[], o?: { title?: string }): Promise<void>  // dusk reveal strip: one by one, each revealed; click = faster; resolves when closed
blessing(cards: PlayCardVM[], o?: { title?: string; rerolls?: number }): Promise<string>       // pick 1 of 3 (or more); resolves with the card id
crystalMoment(c: CrystalVM, kind: 'cut' | 'crack' | 'flaw' | 'graft' | 'set'): void          // small reveal over the grave panel
deal(): void
// anchors: 'ap' | 'tally' | 'hands' | 'hand:miracles' | 'hand:evil' | `card:<id>` (cards in hand via `hand:<cardId>`) | 'grave' | `socket:<id>` | 'offering'
// guide saw(): 'cardPlayed','handSkipped','paid','graveOpened','eaten','set','cut','grafted','routine','moveStarted','offeringSeen','blessed'
```
`send` / SendVM stay in the types (deprecated, ignored: no Send chip is drawn any more).

### ADDED (builder #2, re-scope): card hand + item slots — `set({ hand, items })`
```ts
type Rarity = 'common' | 'uncommon' | 'rare' | 'mythic';
interface PlayCardVM {                 // one card in the night hand (miracle, act, evil act … generic)
  id: string;                          // instance id (unique in the hand)
  name: string;                        // "Still the Air"
  kind?: string;                       // 'miracle' | 'act' | 'evil' | … → frame tint (evil = red-black)
  art?: string | null;                 // art slot: an icon name from src/ui/icons.ts, an image URL / data URL, or null (sigil by kind)
  cost: number; costKind?: 'nether' | 'ichor' | 'crystals' | 'hunger' | string;   // "3 ◆ Nether"
  rarity: Rarity;
  lines: [string, string];             // two short lines (what it does / the catch)
  details?: [string, string][];        // layer 2, on Details
  ok: boolean; why: string | null;     // can be played now; why not in plain words
  target?: 'none' | 'person' | 'area' | 'point';   // 'none' = click to play; else drag onto the world (or click → scene targets)
  isNew?: boolean;                     // just dealt tonight: a "new" glint
}
interface HandVM {
  cards: PlayCardVM[];                 // 0..7 (shows 5 comfortably; fans tighter beyond)
  plays: number; playsMax: number;     // plays left tonight ("1 of 2 left")
  discards?: number;                   // discards left (0/undefined = no discard button)
  deal?: number;                       // deal counter: when it changes the hand animates a fresh deal
  title?: string;                      // "Tonight's hand"
}
interface ItemVM {                     // crystals and anything else carried
  id: string; name: string; kind?: string;   // 'crystal' | …
  art?: string | null; rarity: Rarity; count?: number;
  lines: [string, string]; details?: [string, string][];
  equipped?: boolean; isNew?: boolean;
  actions?: { id: string; label: string; ok: boolean; why?: string | null }[];   // 'equip' | 'eat' | 'craft' | … (scene decides)
}
interface ItemsVM {
  slots: { id: string; label: string; item: ItemVM | null; locked?: boolean }[];  // equip slots (always visible, small)
  bag: ItemVM[];                        // carried, shown in the bag drawer
  open?: boolean;                       // bag drawer open (HUD toggles it itself; this forces it)
  capacity?: number;
  craft?: { ok: boolean; line: string; why: string | null } | null;  // "Fuse 3 commons → 1 uncommon"
}
// HudHandlers (added, all optional)
onCardPlay?(cardId: string, at?: { x: number; y: number } /*root px drop point, for targeted cards*/): void;
onCardDiscard?(cardId: string): void;
onCardAim?(cardId: string | null, at?: { x: number; y: number }): { ok: boolean; line: string } | null; // live drag preview over the world
onItemAction?(itemId: string, action: string): void;
onEquip?(itemId: string, slotId: string): void; onUnequip?(slotId: string): void;
onCraft?(): void; onBag?(open: boolean): void;
// Hud (added)
hud.deal(): void                     // replay the deal animation (also automatic when hand.deal changes)
// HudAnchor (added): 'hand' | `hand:${cardId}` | 'items' | `slot:${slotId}` | 'bag'
// guide saw(): 'cardPlayed', 'cardDiscarded', 'cardDetails', 'bagOpened', 'equipped', 'itemUsed', 'crafted'
```
Follower card is reduced (owner: "too many commands"): one primary command (Send, or Recall while away) and nothing else in layer 1; Lie low moves to Details as a small toggle when `canLieLow`.

### Handlers (all optional; the scene wires the ones it supports)
```ts
interface HudHandlers {
  onWhisper?(unit: string): void;
  onSendStart?(unit: string): void;        // "Send" pressed on a follower card → scene enters send mode
  onSendConfirm?(): void; onSendCancel?(): void;
  onRecall?(unit: string): void;
  onLieLow?(unit: string, on: boolean): void;
  onCardClose?(): void;
  onFocus?(t: FocusTarget): void;          // goal line, ticker, warning, chronicle line clicked → camera there + pulse ground
  onEndNight?(): void;
  onMiracle?(id: string): void;            // scene handles targeting if the miracle needs one
  onEat?(): void;
  onEvil?(act: string, unit?: string): void;
  onDaySpeed?(speed: 1 | 2 | 4): void; onDaySkip?(): void;
  onDawnDone?(): void;
  project?(t: FocusTarget): { x: number; y: number } | null;  // world → root-local CSS px (null = off screen); used by coach marks
  sound?(name: 'uiHover' | 'uiClick' | 'uiDenied' | 'uiOpen' | 'uiClose'): void;
}
type FocusTarget = { kind: 'zone'; id: string } | { kind: 'unit'; id: string } | { kind: 'point'; x: number; y: number };
```

**Source of truth for every type: `src/ui/play/types.ts`** (the copy below may lag by a field).

### What the scene must report to the guide (the HUD reports its own buttons)
`hud.guide.saw('converted')` after a successful whisper (HUD already sends 'whispered' on the button), `saw('sent')` when a Send is confirmed by a world click (HUD sends it only for its touch Confirm button), and `hud.guide.facts({ turn, followers, firstMiner, firstFollower, grayNext, guardSeen, discovery, liftSeen, surface })` as they change (FocusTargets). Phase, shown stats, card kind, send mode, miracle hand, danger word, hunger, nether and goal visibility are fed automatically from `set()`.

### View models (`src/ui/play/types.ts` — no sim imports; the scene maps sim selectors to these)
```ts
interface HudVM {
  phase: 'intro' | 'night' | 'day' | 'dawn' | 'over';   // what is interactive
  stats: StatsVM | null;
  goal: GoalVM | null;
  card: CardVM | null;          // the one open card (hover peek = same card with pinned:false)
  send: SendVM | null;          // Send preview chip (follows `at`)
  night: NightVM | null;        // End Night, miracle hand, eat, evil (shown in phase 'night')
  day: DayVM | null;            // day strip (phase 'day')
  dawn: DawnVM | null;          // ≤ 3-line summary (phase 'dawn')
  chronicle: ChronicleVM | null;
}

interface StatsVM {                 // from sim statBar(s); items listed in `show` are visible
  show: StatId[];                   // 'ichor'|'hunger'|'nether'|'crystals'|'danger'|'malice'|'level'
  ichor: number; ichorMax: number;
  hunger: { value: number; word: string } | null;          // 0..100
  nether: number; netherPerNight: number; faith?: number;  // faith only in Details
  crystals: number;
  malice: { value: number; word: string } | null;
  danger: { track: 'cult' | 'gov' | 'public'; name: string; word: 'Calm' | 'Wary' | 'Alarmed' | 'Hostile'; value: number;
            tracks: { id: 'cult' | 'gov' | 'public'; name: string; word: string; value: number;
                      who: string; why: string; next: string }[] };   // plain words per track
  level: { text: string; xp: number; next: number | null };           // "Whisper I → II"
}

interface GoalVM {
  lines: { id: string; text: string; have: number; need: number; done: boolean; next: FocusTarget | null; pctText?: string }[]; // ≤ 2 shown
  nudge?: string | null;            // next-step nudge when the player stalls (scene or guide decides)
}

type CardVM = PersonCardVM | FollowerCardVM | GroupCardVM | EnemyCardVM | AreaCardVM | DiscoveryCardVM;
interface CardCommon { id: string; pinned: boolean; details?: [string, string][] }   // details = layer 2 rows
interface WhisperVM { ok: boolean; why: string | null; odds: number /*0..1*/; oddsWord: string; cost: number; canAfford: boolean; asleep?: boolean }
interface PersonCardVM   extends CardCommon { kind: 'person'; name: string; job: string; line: string; whisper: WhisperVM }
interface FollowerCardVM extends CardCommon { kind: 'follower'; name: string; job: string; line?: string;
  task: { verb: string; where: string; since: string; walking?: boolean };   // "Exploring", "the west tunnel", "since night 2"
  devotion: { value: number; word: string }; lyingLow: boolean; canSend: boolean; canRecall: boolean; canLieLow: boolean }
interface GroupCardVM    extends CardCommon { kind: 'group' | 'elite'; name: string; job: string; line: string;
  headcount?: number; whisper: WhisperVM; matters?: string }                 // Elite: "Turn her and the Council cools"
interface EnemyCardVM    extends CardCommon { kind: 'enemy'; name: string; job: string; does: string; threat: string; line?: string }
interface AreaCardVM     extends CardCommon { kind: 'area'; name: string; state: 'coloured' | 'seen' | 'unknown';
  hold: number; rooted: boolean; anchored?: boolean; followersHere: number; peopleHere: number; residents: number;
  feeds: string[]; pushback: string[]; special: string; discovery: { hint: string; revealed: boolean; text: string } | null }
interface DiscoveryCardVM extends CardCommon { kind: 'discovery'; title: string; text: string; area: string; find: string /*DiscoveryKind*/ }

interface SendVM { unit: string; name: string; at: { x: number; y: number } /*root px*/; ok: boolean; line: string;
                   days: number; cost: number; canAfford: boolean; why: string | null }

interface NightVM {
  canEnd: boolean; endPreview: string[];          // "3 followers set off", "the stain grows"
  actedTonight: boolean;                           // false → End Night warns once (asks a second press)
  miracles: { id: string; name: string; line: string; cost: number; ok: boolean; why: string | null; evil?: boolean; details?: [string,string][] }[] | null;
  miracleCast: boolean;
  eat: { ok: boolean; why: string | null; drop: number /*hunger −N*/ } | null;
  evil: { act: string; name: string; line: string; ok: boolean; why: string | null }[] | null;
}
interface DayVM { day: number; progress: number /*0..1*/; speed: 1 | 2 | 4; label?: string /*"The bell", "Work", "Evening"*/ }
interface DawnVM { title: string; lines: string[] /*≤ 3*/ }
interface ChronicleVM { entries: { turn: number; text: string; tone?: Tone; focus?: FocusTarget }[] }
interface TickerVM { text: string; tone?: Tone; icon?: string; focus?: FocusTarget }
interface ToastVM  { title: string; text?: string; tone?: Tone; icon?: string }
interface MomentVM { kind: 'level' | 'divinity' | 'stage' | 'unlock' | 'defeat' | 'win'; title: string; lines: string[]; button?: string }
interface ModalVM  { title: string; body: string; options: { label: string; consequence: string; ok?: boolean }[] }
interface WarningVM { id: string; text: string; tone?: Tone; focus?: FocusTarget }
type Tone = 'good' | 'bad' | 'warn' | 'info' | 'violet';
```

### Guidance engine (`hud.guide`, `src/ui/play/guide.ts`)
```ts
interface Guide {
  facts(f: Partial<GuideFacts>): void;   // scene pushes facts whenever they change (merged); rules re-evaluate
  saw(ev: string, data?: unknown): void; // player/world did something: 'whispered','converted','sendStarted','sent','endNight','dawn',
                                         // 'miracleCast','ate','cardOpened','dangerOpened','recalled','lieLow','zoomedOut', ...
  dismiss(): void;                       // Esc / programmatic close of the open mark (remembered: never returns)
  reset(): void;                         // Settings "Show hints again"
  setEnabled(on: boolean): void;
  active(): string | null;               // id of the open mark
  seen(id: string): boolean;
}
interface GuideRule {
  id: string; priority?: number;         // higher first; one mark at a time
  when(f: GuideFacts): boolean;          // show when …
  doneOn?: string[];                     // … complete when the player does one of these (saw names)
  doneWhen?(f: GuideFacts): boolean;     // … or when a fact becomes true
  anchor: { control: HudAnchor } | { target: FocusTarget } | { fact: keyof GuideFacts };  // where the mark points
  title: string; body: string;           // ≤ 2 short lines
  beat?: 1 | 2 | 3;                      // the first-night beats (show "1 of 3")
}
interface GuideFacts {                   // plain facts the scene knows; all optional
  turn: number; phase: string; followers: number; firstMiner?: FocusTarget; firstFollower?: FocusTarget;
  grayNext?: FocusTarget; sendMode: boolean; cardKind?: string; hunger: number; dangerWord: string;
  guardSeen?: FocusTarget; discovery?: FocusTarget; miracleReady: boolean; malice?: number;
  liftSeen?: FocusTarget; surface?: FocusTarget; nether: number; whisperCost: number; [k: string]: unknown;
}
```
Persisted under localStorage `hg.hints.v1` (the same store as `src/ui/hints.ts`, which is now a thin facade over this engine) (every access guarded). A mark closes on Got it / its action / Esc / click on its X — always — and is stored as seen whatever closed it.

## Done
- Builder #1: M1–M3 (v1 components, guidance engine, harness, shots script) — see git history.
- Builder #2 (re-scope, §15):
  - hints.ts compile fix; follower card trimmed (v2: one command; v3: routine segments + stash + Move).
  - `crystal.ts` (paintCrystal / drawCrystal / crystalPalette / CRYSTAL_TIERS) — seeded one-of-a-kind shapes, six tiers, rough vs cut, spurs, cracks.
  - `hand.ts` (two hands, fan, hover zoom, drag-to-play, drag-to-target with aim line, keys 1–6, Skip, pay step hook, deal/draw/play/discard animation), `cardface.ts`.
  - `grave.ts` (belt with sockets + Grave button; panel with sockets + crystal grid; crystal card with Eat/Set/Unset/Cut/Graft + Details; cut choices; graft donor/part; hover tip; drag to socket; crystalMoment).
  - `offering.ts` (dusk reveal strip, pay panel, blessing pick).
  - statbar: AP pips (`ap`), Tally (`tally`) with plain tip; whisper shows AP cost.
  - aim chip (`aim` VM) replaces the Send chip (SendVM ignored).
  - styles-cards.ts; words for all new strings (stand-in until WRITING); guide intros: hands, grave, ap, tally.
  - harness states: hands, hands-zoom(-off), hands-details, hands-done, pay, grave, grave-rough, grave-cut, grave-graft, grave-tip, offering, offering-done, blessing, follower3, move, tally, crystals (contact sheet).
  - e2e/hud-shots.cjs PART `cards` (two hands, pay, keys, skip, grave set/cut) + new states in SHOT_ALL_SIZES.

## Done (builder #3, v3.1)
- Cards: bigger (124u), per-card inked art (`cardart.ts`, 30 motifs), miracle = arch frame, evil = notched frame; cost gem, plain line, "Burns N" at rest; flavour on the big card. Send button removed; stable `data-action` names native.
- Grave = home screen: item card (CRYSTAL `drawCrystalInspect`, name, grade·base, affinity sign+word, "1 in N", ordered mods with curses marked, odd effect), verbs Set/Eat/Enchant/Recombine with consequence lines, Enchant + Recombine with previews, Faceting/Jewelry/False weights/Profaning/Black draughts as locked rows with plain unlocks, sort by grade/new/affinity, compare vs set stone on hover, resonance line. Left column steps back while the grave is open.
- Dusk offering strip as a reward beat (stir → flip → grade named → best find held, "Unasked tribute"/"Their haul", ≤ ~6–8 s, skippable, `onOfferBeat`).
- `hud.cue()` implemented (`dayNote` → `feed.ts` notes at the place, ≤3, light/mid/heavy, kept off the grave and panels, clickable list "Today" → `onFocusNote`; `dayStart`, `onceInARun`, tribute/craft → grave pulse, `facilityGained` toast, `itemExposed` warning, `itemGiven` card pulse, enchant/recombine/facet/forge → item-card flare). Day strip: clock, calendar, weather sign + word, pause (P), ×1/×2/×4, skip to dusk. Dawn/dusk ledger moved low-right (tiny: top-left), never over the grave.
- Stale words: top bar shows "Count · <WRITING word>" (expected/counted in the tip via `text.tally`); End Night preview leads with unplayed hands + actions left. Count item now Council cold white (theme §2).
- Layout: card slot always below the top bar; tiny top bar fits (no clipped chevrons/deltas, clear of gear); armed End Night wraps inside its button; tiny chronicle folds while hands are out; tiny day/dawn clear the goal and night controls.

## In progress
- Last re-audit of day/dawn/hands at 1015×240 + 640×300 after the tiny day/dawn fix (`/tmp/hud/f4.log`).

## Files touched (builder #3)
- src/ui/play/{cards,day,chronicle,hand,art,cardface,styles,styles-cards,crystal,grave,index,offering,types,words,statbar,night?}.ts, new cardart.ts, affinity.ts, feed.ts; src/ui/play/dev/harness.ts; e2e/hud-shots.cjs; screenshots/hud-*.png; handoffs/HUD.md; DECISIONS.md.

## Exact next steps
1. Read `/tmp/hud/f4.log`; if tiny day/dawn still overlap, adjust `.hud[data-size="tiny"] .day/.dawn` in styles.ts. Then full run `NODE_PATH=/usr/local/lib/node_modules_global flock /tmp/hg-pw-2.lock node e2e/hud-shots.cjs` (env PARTS/ONLY/SIZES). Known remaining: tiny `cards` part — "hands do not overlap" was fixed by folding the chronicle, but the pay step at 1015×240 times out (Burn never enables: the second tile click misses — check `.pay .it[data-item="k2"]` is visible/inside at tiny).
2. THEME (docs/theme.md §2–4, §10; DECISIONS §17): panel frames/accents use gold and violet as decoration — restyle to ochre/neutral frames with violet only for you/crystal, gold only for Flame things, cold white for Council (count, searches, seals), red only blood/war (hunger pips and evil-card red inner need a non-red treatment). Person cards: wickfolk portrait with the wick (devotion colour) instead of the devotion badge; hood up when lying low. Adopt `src/render/theme/marks.ts` / `palette.ts` pictograms when published (exports at top of handoffs/THEME.md). Words: hearth, chit, knot-cord, the levy, the burning ground, shard-lamp; "people"/"miners"/"followers".
3. WRITING hooks: `text.crystalName({ base, affinity, mods, oneIn })` for item names; pass `ctx.item` to the ledger; facility rows from `text.facilityRow`; day notes via `createNotebook(seed).feed(item)`; `text.calendar` / `text.weather` for the day strip; `text.duskDay` for the dusk ledger.
4. Follower card: worn jewel row + Give / Take back (handlers `onGiveJewel` / `onTakeJewel`, types already declared) with exposure risk line; "new unlock" announced once.
5. M3 guidance: guide3 beats nights 1–3 beside target (never over it or the grave), dismissed by doing the thing, fallback chip, "Got it" always closes; harness strip nights 1–3 + shots.
6. Critic pass on hands / grave / offering / day shots.

## Requests
- PLAY-v2: mount with `mountHud(sc.ui, handlers)`; forward `onKey` to `hud.key(e)` (Esc order: hint → modal → send → popover/chronicle → card → dawn; false = open settings); call `hud.layout()` from `app.onLayout`; report `guide.saw('converted'|'sent')` and the world facts listed above; `handlers.project` maps world → root px.
- WRITING: the HUD's own words are in `src/ui/play/words.ts` (`WORDS` keys + `GUIDE_WORDS`); `setWords({...})` overrides — please supply final text against those keys.

## Self-grade
- Builder #3: 7/10 honest. Worst three: (1) theme colour code not yet applied to frames/accents (gold/violet used decoratively); (2) tiny pay step and day/dawn layout still need a clean full-matrix pass; (3) follower jewel give/take and M3 guidance not built.

## Builder #5 (successor, 2026-11-23) — function first (DECISIONS §19)
### v5 interface additions (additive)
- `CardCommon.about?: { hearth?; wick? /*"low, grieving"*/; now?; ties?: { kind; name }[] } | null` — person / follower / elite cards show Wick · Now · Hearth · Ties (two-column list). Pass LIVING's `person.line` as `line`, `households[p.household].name` as `about.hearth`, ties as `{ kind: 'sister' | 'owes' | 'rival' …, name }`.
- `CardCommon.reasons?: { text; value /*"+12 %"*/; dir?: 'up'|'down' }[] | null` — what moves the whisper odds, strongest first; the card shows three, the rest behind "N more".
- Day feed lives in the left column under the goal (the one place for "what just happened"); `hud.ticker()` during the Day joins the feed. Feed rows / day notes carry a pictogram + owner colour by kind (`marks.ts noteMark`); `weight` 0/1/2 (LIVING 0..1 fractions map ≥0.8 heavy, ≥0.45 mid). Feed header = "Today · <calendar name>".
- Hints: a hint on screen > 1.2 s that yields is marked seen (never returns) — fixes LOOP's "intro:miracle returned after every action".
### Done
- Files whole (tsc clean for src/ui/play). `polish.ts` (installed after skin.ts): hands tuck while the grave is open; hand cards sized to their band side by side (name + Burns, full line on the big card); card slot stops above Eat + End Night (`--bottom-h` now includes the Eat chip); belt keeps only the Grave button under 1440 px wide; hands bounded by an open card; grave chit contrast; verb buttons wrap.
- e2e: size 1280x720 added; audit's overlap list now includes hand cards, grave panel, item card, belt, feed.
### Files touched
src/ui/play/{polish.ts (new), index.ts, hand.ts, feed.ts, marks.ts, cards.ts, types.ts, words.ts, guide.ts}, src/ui/play/dev/harness.ts, e2e/hud-shots.cjs.
### v5 additions, part 2 (FEEL round 3b, CRYSTAL, WRITING r4)
- `hud.cue` now answers: `dayNote {entry, anchor?, shown}` (anchor = FocusTarget or old {zone?,unit?,at?}; none / shown:false = feed only; notes are re-projected every frame and keep their offset from the place), `dayNoteHide {id}`, `dayNoteMerge {id, count, text?}` (line updated + "+N"), `dayFollow {on}` (on:false → "Follow the day" button in the day strip → `handlers.onFollowDay(true)`), `dayCatchUp {on}` / `dayClock {catchUp}` ("Skipping to dusk"), `duskStart`, `offeringSet/Reveal/Best/Done {index}` and `offerBeat {beat, index}` (the first one stops the strip's own clock; Done → total + closes after 1.6 s), `duskCount {stones, tribute}` (a ledger row), `ledger {title?, lines: {text,tone}[]}` (≤ 5 lines, low right), `duskEnd {night}` (toast "Night N").
- `hud.offering(list, { driven: true })` opens the strip without its own clock (FEEL drives it).
- `CrystalVM.sim?: unknown` — pass the sim Crystal; every HUD stone is drawn by `crystalIcon(sim)` / `drawCrystalInspect(sim)`. `CrystalVM.base.id?` additive. Grade frame colours are one violet scale now (no gold).
- `DayVM.why?: string[]` — top 2–3 `text.effectWhy(e, placeName)` lines under "Today".
- Handler `onFollowDay?(on)`.
### Requests
- **PLAY-CORE** (`src/scenes/play/hudbridge.ts`): person card → `line: text.personLine(p.line, p.trait, p.name).line`, `about: { hearth: households[p.household].name, now: <plan step now>, ties: p.ties.slice(0,4).map(t => ({ kind: t.rel ?? t.kind, name })) }`, `reasons:` the whisper odds' terms sorted by |value| (`{ text, value: '+12 %', dir }`); crystals → `sim: crystal`, `base: { id, name, line }`; Day → `why: effects.slice(0,3).map(e => text.effectWhy(e, placeName))`; `onFollowDay: (on) => feel.followDay(on)`; open the dusk strip with `hud.offering(list, { driven: true })` when FEEL's dusk runs; forward every FEEL `hud.cue` (FEEL.md R3b).
- **Shell (src/ui/settings.ts + src/app/settings.ts)**: an **Ambience** volume slider (`ambience: 0..100`, pushed to the audio engine's ambience bus) beside Master / Music / Effects. Text size (Interface size) and Reduce motion exist.
### Status at hand-off (builder #5)
- Full matrix (55 states × 1600×900 + 1280×720, cards, hints, tab) run at 08:2x: cards 21/21 both sizes; hints: 11 closed via Got it / X / Esc, **0 came back after reload**, none shown twice; tab 25/25 with focus rings; **0 console errors/warnings**; min font 12 px, min contrast 5:1. Audit failures left then: hand-zoom states (a hovered card nudged neighbours into the belt / night — fixed: no nudge when side by side), warnings' contrast (gradient with no ground — fixed: background-color), and at 1280 the chronicle's last line narrowing the hand band once a chronicle exists (fixed: `.belt-s.has-hand .chron .last` hidden). The rerun of those states was queued on the shared lock (`/tmp/hud/r10.log`).
- Self-grade (function-first bar, §19): 7.5/10. Worst three: (1) the grave panel still scrolls at 1280×720 (crafting rows below the fold) — dense, not broken; (2) look not yet re-dressed (step 2 deferred by §19); (3) PLAY-CORE does not yet pass `about` / `reasons` / `sim` / `why` / driven offering, so the live game shows the old person card and default stone shapes until the requests land.
### Exact next steps
1. Read `/tmp/hud/r10.log`; if green, run the whole matrix once more: `NODE_PATH=/usr/local/lib/node_modules_global SIZES=1600x900,1280x720 timeout 3500 flock /tmp/hg-pw-2.lock node e2e/hud-shots.cjs` (≈25 min under load).
2. Grave panel at 1280×720: fold Crafting into one row of chips (Enchant / Recombine + locked pictograms) so the crystal grid shows two rows without scrolling.
3. After PLAY-CORE wires the requests, check the live game (`e2e/play*`) at both sizes: person card about/reasons, dusk strip driven by FEEL, follow button, notes re-projected while the camera leans.
4. When §19 lifts: the "world's hand" restyle (knot-cord dividers, notch tallies, clay chits) on top of `skin.ts`/`polish.ts`.
- Rerun of the failing states (r10, r11): all pass at 1600×900 and 1280×720 after the fixes (chronicle open now tucks the hands too).
- Added late, tsc-clean but **not yet shot**: `hud.event()` (+ "An event waits" chip), Enchant "Add a line" enabled on `ok && open > 0` with its reason printed, `hud.offering(list, { waitFor })`. Next builder: add harness states `event-pending` (event then a moment → chip) and `grave-enchant-blocked` (preview ok:false with why) and shoot them.

## Builder #6 (successor, 2026-11-23 09:4x) — the bridge is the HUD's now (`src/scenes/play/hudbridge.ts`)
### Lines added outside my files (marked `// HUD`, smallest possible)
- `src/scenes/play/index.ts`: (1) `pendingChoices()` shows the sim's pending event with `this.ui.event(ev)` (the HUD's event card + "An event waits" chip) instead of `hud.blessing`; (2) `endNight()`: `if (this.pendingChoices()) { this.ui.reopenEvent(); return; }` (End Night brings the event card back); (3) BridgeVerbs `followDay: (on) => feel.feel.followDay(on)`.
### Step 1 — bridge the v5 data (done, headless-tested: `tests/hud/bridge.test.ts`, 8/8; `BRIDGE_DUMP=1 npx vitest run tests/hud/bridge.test.ts -t dump --reporter=verbose` prints what it sends)
- Person card: `line` = `text.personLine(LIVING p.line, p.trait, name)`, `about { hearth (household name), now ("Awake · the west face"), ties ≤ 4 (spouse/child/friend/owes … + name) }`, `reasons` = `conversionOddsFor(s,u).parts` in plain words strongest first (LIVING's whisper add split out as the day's own `effectWhy` line). Follower card gets `line` + `about` too.
- Crystals: `sim` (the sim crystal whole), `base {id,name,line}`, `affinity {id,name}`, `oneIn`, `modsMax`, `from`, `how` (tribute/offered), `eat`.
- Enchant: `open` = the sim's own count; when no slot is open the preview carries `weakest {index,text}` and the main button reads **"Reroll the weakest line — Every slot is full. Replaces: …"** (`data-act="enchant:add"` stays; onEnchant(id, null) on a full stone rerolls that line). Not enough Nether → "Needs 2 Nether (you have 1)." (the sim's "Every slot is filled" is never shown as a refusal).
- End Night preview: "An event waits: <title>. Answer it first." / "Choose a blessing first." first; in Shade "N of yours live and work in the town", "At dusk: <threat>", the exposure line.
- Day strip: `clock` (The bell / Morning / Noon / Afternoon / Evening / Dusk from progress), `calendar` (`text.calendar`), `weather` (`text.weather`), `why` (top 3 `text.effectWhy` of the Day plan's effects). `onFollowDay` → FEEL.
- Dusk ledger (`bridge.dawn`): lead line `text.duskDay(calendar kind, day)`, rows (stones struck by yours, brought to your grave, carted to the Council; in Shade the three heat tracks), `count` = "counted of expected · word" + the Council's line.
- Shade: crowd / Elite cards (headcount, "N gold wicks · mood", what turning them gives — Elites from PLAY-SHADE's `eliteTargets` (prize, where you stand, what is in the way), Resistance in Details, odds + reasons); standing warnings under the goal for every telegraphed threat (`threatsView().line` = describeThreat "At dusk tomorrow: priests ward the well. Answer with …", click → its place), the exposed (`exposure()` from PLAY-SHADE's model), a Hostile track. Top bar: three heat bars (Temple gold / Council cold / Public bone) beside the danger word (`src/ui/play/v6.ts`).
- HUD: `hud.reopenEvent()`; End Night while an event waits reopens its card; `EnchantVM.weakest`.
- Dusk strip: the scene still runs its own strip with `waitFor = world.arrival(unit)` (FEEL's dusk is `dusk: false` in index.ts); `{ driven: true }` only becomes right when PLAY-CORE switches FEEL's dusk on — the HUD is ready for it.
- Also `// HUD` in `src/app/app.ts` (`applySettings`): `if (changed.includes('ambience')) a.setVolume('ambience', v.ambience / 100)` and 'ambience' in the initial apply list. `src/app/settings.ts`: `ambience` (default 75); `src/ui/settings.ts`: Ambience slider under Effects.
### Step 3 — live game (shot loop `--until shade-pushback`, seed 7, `/tmp/hud6/reel1/`, load 24–28, page 0.7–16 fps)
- Built before the fixes below. Present: 1, 3–9, 11, 13, 16, 19, 22, **25 (the Shade night now ends: End Night → Day → dusk)**. Broken: 2 / 14 / 15 / 20 "stuck" under load (fps 0.7–1.7); 10 clock on screen read "The bell" all Day (the clock was only set at refresh) → **fixed: the HUD derives the clock word from progress every frame**; 10 "2 notes placed (hook 6)" → **light notes now stand at their place too (from FEEL's `where`)**; 12 ledger text empty (the box had faded at 1.4 fps; and the count read "6 of 9") → **count reads "counted 6 of 9 expected · word", the ledger fades after 15 s not 9**; 17 enchant: the reroll happened but LOOP's verdict counts modifiers (`__hg.play.crystals[].mods` is a count; a reroll keeps it) → request to LOOP/PLAY-CORE below; 23 the crowd card opens now (name, 13 people, what turning gives, Now, whisper with the sim's refusal) but the debug jump leaves the sim's stage at 'whisper', so the sim refuses a crowd whisper ("Crowds are beyond a Whisper") — not the HUD; 24 Elite not hit-testable (`world.hit` → no person; PLAY-WORLD/PLAY-SHADE).
- Fixed after the run (not yet re-shot live): offering strip plural ("A crystal comes to your grave", "One crystal · worth 2") and placed low-centre (never over the goal); crowd card shows its wicks row ("14 gold wicks · loyal"); hints choose a spot above an open panel instead of over the hand's first card (avoid weight 0.05 → 0.4 + "above the panel" candidates); words: Nether is "to whisper and to enchant crystals" (no "cut"), danger tip names the three bars.
### Requests (builder #6)
- **LOOP** (`e2e/playtest/shots.cjs` beat 17): judge enchant as taken when a modifier's text/value changed, not only the count — every stone is rolled full, so Enchant on it is a reroll (`data-act="enchant:add"` now reads "Reroll the weakest line"). Needs from **PLAY-CORE** `debug.ts`: `crystals[].lines: string[]` (modifier texts) beside `mods` (count).
- **LOOP/PLAY-CORE**: the Shade debug jump (`debugFinale('watershed')`) leaves `sim.stage === 'whisper'`, so crowds refuse a whisper in beat 23; the harness should jump with a real Shade state (PLAY-SHADE's `watershedState(seed)`), or PLAY-CORE's debugFinale should adopt one.
- **PLAY-WORLD / PLAY-SHADE**: beat 24 — `world.hit` at Overseer Varn's drawn feet returns no person.
- **PLAY-CORE**: when FEEL's dusk is switched on (`dusk: true`), open the strip with `hud.offering(list, { driven: true, waitFor })`.

### Builder #6 — orchestrator items (after PLAY-CORE's handoff)
1. Hints off open panels: `guide.ts` place() adds a grid of far candidates (above/below the target, beside every open panel) paid by distance; overlap cost 0.4/px² dominates. A hint's body no longer takes the pointer (only its buttons do): reel2 beat 23 failed because "The surface" hint sat on the crowd the reel clicked. Item 2 verified live in reel2 (the bar stops short of "Whole world" / "My mine").
2. Top bar vs "Whole world": `index.ts` layout measures `.pl-cam`/`[data-action="camera"]` and sets `.top`'s `right` 8 px short of it.
3. Pay box: bridge `payOptions` uses `SIM.payOptions` worth per stone; preselection topped up to cover `need` (test `the miracle pay box sums what the sim sums`). Root cause: the HUD summed face value, the sim charges affinity-weighted worth; SIM's `suggestPay` can also fall a hair short (PLAY-SHADE saw it too).
4. "1 crystals": `offer.count1` / `offer.total1`.
5. Events: `hud.event` + `reopenEvent`; `plainWords()` in the bridge (test `event text uses this world's words`). SIM: please fix the source strings in `src/sim/content/events.ts`.
6. FEEL dusk: offering beats matched by crystal id; `ledger` cue completed by `duskLedger`. `dusk: true` safe (see top).
7. `onFollowDay` is the handler (no `onDayFollow`).
8. Ambience slider (orchestrator, for P3's ambience bus): Settings → Sound "Ambience", key `ambience`, default 80, `app.ts` applies `audio.setVolume('ambience', v / 100)` on change and at start (`// HUD` line). Persisted by the settings store with the other volumes.
9. The count is shown in whole stones (`whole()`): reel3 showed "counted 5 of 8.3 expected" (the sim now carries a fractional expectation). SIM may want to round at source.

### Builder #6 — live proof and status (reel2 / reel3, seed 7, `--until shade-pushback`; harness h2)
- **reel2** (build before the guide/click-through fixes): beats 6–13, 15, 20, 22, 25 present; 14 (miracle effect is mostly camera), 16/18/19 (only the HUD shows the change — the world's grave hoard does not), 17 (enchant "did not take": the reel counts lines and a reroll keeps the count — LOOP request), 21 (world life), 23 (a hint sat on the clicked crowd → fixed: hint bodies click through), 24 (Elite not hit-testable: `world.hit` → personId null — PLAY-WORLD).
- **reel3** (latest code, others mid-edit): the mine lost its on-screen people (6–8: PLAY-WORLD), the Shade stage is now mounted (`mode town`) so 23–25 never reach the HUD (PLAY-CORE/PLAY-SHADE wiring); 12 flagged "counted 5 of 8.3" → fixed (`whole()`). HUD frames: hints off the hands/grave/goal, the top bar clear of "Whole world", 0 console errors.
- **Harness h2** (10 states × 1600×900 + 1280×720, incl. `event-pending`, `grave-enchant-blocked`, `pay`): HUD CHECKS PASS, min font 12 px, min contrast 5. Seen at 1280: the Elite card's Whisper row was cut by the bottom-right stack → the odds + Whisper row is now sticky at the card's bottom edge (`v6.ts`); verifying in h3.
- **Self-grade (live frames): 7.5/10.** Data is right and plain; the HUD reads well at both sizes; what holds it back is the Shade: the live game now routes the town to PLAY-SHADE's own panels, so the HUD's town cards/warnings are proven only headless.

### Builder #6 — WRITING round 5 requests
1. `text.ts pourWords` pours `text.hudWords()` (hand.kind.* / card.kind.* for 14 kinds). The HUD also has its own words for event/story/choice/bonus/threat/answer/favour, and `cardface.ts` / `hand.ts` never print a raw `hand.kind.*` key (they fall back to the capitalised kind).
2. Plural-safe counts: `w()` turns "{n} crystals" / "{n} crystals come" / "{n} stones" singular when n = 1 — covers `grave.count`, `night.miracle.cost`, `card.stash`, `offer.total`, `offer.count` and any later key of that shape.
3. Town moves: the bridge's `threat:<id>` warnings read `text.threatLine({ kind, inDays, faction, answers, floor, place, name, evilName })` (evil = the faction's answering card by name), falling back to the sim's line. Answer buttons are NOT in the HUD: `WarningVM` has no actions and the live game routes the town to PLAY-SHADE's panels. If the HUD is to own them: add `WarningVM.acts?: { id, label, ok, why }[]` and an `onWarnAct(warnId, actId)` handler; the bridge would fill them from `threatsView().answers` with `text.answerWith(by, …).label` / `.none`.
4. Bonus / blessing names (`text.blessing(id)`, `text.bonus(id)`) are set by the scene (`index.ts` builds the bonus and blessing offers), not by the bridge — PLAY-CORE. The record panel is titled "The record" (`chron.title`).
