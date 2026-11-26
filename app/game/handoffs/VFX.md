# VFX — every effect in the world (handoff / log)

## >>> Round 6 (successor 6) — STATUS (newest first; read this block first)

### Requests (exact calls) — PLAY-WORLD / PLAY-CORE
PLAY-WORLD already did its half (`src/scenes/play/fx.ts`: `FxAdapter.onSimEvent(ev)` with `places()` from the hoard's
`seatOf / whereIs / stoneOf`, and `graveState(hoard.sockets())` every frame). Nothing in the scene CALLS `onSimEvent` yet,
and `index.ts moment()` still hand-wires the grave effects at the grave's centre — so in the live game today the set /
enchant / recombine light lands on the cluster's middle, not on the stone, and a second, never-ended `aura` stands there.

1. **PLAY-CORE, `src/scenes/play/realsim.ts` `RealNight.stage()`** — first line inside `for (const e of events) {`:
   `this.hk.simEvent?.(e);` and add `simEvent?(e: GameEvent): void` to `NightHooks` (`src/scenes/play/night.ts`).
2. **PLAY-CORE, `src/scenes/play/index.ts`** — in the hooks object next to `moment: (k, p) => this.moment(k, p),`:
   `simEvent: (e) => { if (VFX_SIM.has(e.kind)) this.fx.onSimEvent(e); },` with
   `const VFX_SIM = new Set(['crystalSet', 'crystalUnset', 'enchanted', 'recombined', 'crystalEaten', 'crystalBurnt', 'devoured']);`
   (the whisper / turn / cards stay on FEEL's recipes for now; widen the set kind by kind as FEEL hands them over).
3. **PLAY-CORE, `index.ts moment()`** — delete the hand-wired effects the router now plays, keep the sound and HUD lines:
   `this.fx.raw('eatCrystal', …)`, `this.fx.raw('socket', …); this.fx.raw('aura', …)` (the aura is the router's, ended on unset),
   `this.fx.raw(kind, …)` in enchant/curse, `this.fx.raw('recombine', …)`, `this.fx.raw('burn', …)`, `this.fx.raw('devour', …)`.
   The exact patch is `/tmp/vfx6/patch.py` (applied to a scratch copy only; I did not edit `src/scenes/**`): tsc-clean, and the
   `vfx-live-wired-*.png` strips are filmed from that build.

### New interface (additive)
```ts
// ONE call per sim event: the right kind(s), params and world points; persistent effects kept by the router.
fx.onSimEvent(ev: GameEvent, places: SimPlaces): FxHandle[];       // [] for a deliberately silent kind
fx.graveState(sockets: (SimStone & { id?: string } | null)[], places): void; // idempotent: one aura per set socket (call on load / each frame)
fx.resetSim(): void;                                                   // end every persistent effect the router holds
import { SIM_ROUTES, SIM_SILENT, type SimPlaces, type SimStone } from 'src/render/fx';
interface SimPlaces {
  grave: Pt;                                   // the grave's mouth (world units)
  unit?(id): Pt | null;  crown?(id): Pt | null; // feet / crown (default feet raised 0.95 figure)
  zone?(id): Pt | null;  socket?(i): Pt | null; // a zone's anchor / socket i's seat
  hoard?(crystalId): Pt | null;                 // where a loose stone lies — read BEFORE the action (parents, eaten)
  crystal?(id): SimStone | null;                // { rarity|tier, grade?, affinity?, oneIn? }
  face?(zone); cart?(zone); lift?: Pt; enemy?(id); dawnPath?: Pt[];
  cardFrom?: Pt;          // the card's canvas px → cardPlay (tears off the hand) instead of cardFx
  drawsStones?: boolean;  // the caller draws/moves the grave's stones itself → grave effects draw light only (body: false)
}
```
`src/render/fx/sim.ts` `ROUTES: { [K in GameEventKind]: route | { silent: reason } }` — tsc fails on a sim kind with no entry;
`tests/vfx/simroutes.test.ts` checks every kind in the sim's unions (parsed from `src/sim/types.ts` / `types3.ts`) is routed or silent,
that each routed kind spawns a registered effect with finite points, and the main moments' kinds and places.
New kinds: `unsocket { x, y, rarity, body? }`. New params: `socket { from?, body? }`, `aura { socket?, body? }`, `enchant|curse|recombine { body? }`.
Grave moments (round 6, `kinds/grave.ts`): socket / enchant / curse / recombine all inhale (dark pool) then flood the chamber floor
with the stone's light (≥ 190 px wash, shock ring to ≥ 250 px, column of light ≥ 110 px on the lock); the standing `aura` is a
breathing pool (≥ 40 px), a slow broken ring, low orbiting motes and a soft pulse ring every 3.4 s.


Owner: VFX builder. Port 5223. Scratch `/tmp/vfx/`. Files: `src/render/fx/**`, `dev/fx.html`, `e2e/fx-shots.cjs`, `screenshots/fx-*.png`, this file.

## Public interface (binding; additive only from here)

```ts
import { createFx } from './render/fx';           // src/render/fx/index.ts
import type { Fx, FxHost, FxLayer, FxKind, FxParams, FxHandle, Pt } from './render/fx';

const fx: Fx = createFx({ seed?: number, reduceMotion?: boolean, maxParticles?: number /* default 900 */ });
const h: FxHandle = fx.spawn(kind, params);   // returns at once; effect starts this frame (anticipation first)
fx.update(dt);                                // dt in seconds (clamped to 0.1); deterministic for a given seed + dt sequence
fx.draw(g, host, 'ground');                   // call after terrain/stain, before people
fx.draw(g, host, 'above');                    // call after people, before HUD
fx.setReduceMotion(on); fx.clear(); fx.count(); fx.particleCount();

interface FxHost {
  toScreen(wx: number, wy: number): { x: number; y: number };  // world (town units) -> canvas px
  scale: number;                       // canvas px per world unit (zoom); far forms switch on below ~0.6
  time: number;                        // seconds, for shimmer only (effects run on their own clock)
  visibilityAt(wx: number, wy: number): number | 'void' | 'sensed' | 'active';
                                       // <= 0 or 'void' = Void: nothing is drawn there (pixel-checked)
  reduceMotion?: boolean;              // overrides fx.setReduceMotion when given
}
type FxLayer = 'ground' | 'above';
interface FxHandle {
  readonly id: number; readonly alive: boolean;
  end(): void;                         // graceful settle-out (persistent effects: route, hunger, lieLow, lockdown, sendRoute)
  kill(): void;                        // immediate removal
  resolve(outcome: 'turned' | 'refused'): void;   // whisper only: thread coils & ripples, or frays to ash
  move(x: number, y: number): void;    // re-target the effect's anchor (whisper target walking, lamp sweep following)
}
type Pt = { x: number; y: number };    // world units (town units; mine positions pre-converted with mineToWorld)
```

Common optional params on every kind: `delay?: number` (s), `scale?: number` (size multiplier, default 1), `seed?: number`.

### Effect kinds and params (`FxParams[kind]`)

God (violet / ink)
| kind | params | what it is |
|---|---|---|
| `whisper` | `{ from: Pt /*grave*/, to: Pt /*person's feet*/, outcome?: 'turned'\|'refused', hold?: number /*s before auto-resolve, default: wait for resolve(), max 6 s*/ }` | living tendril leaves the grave, searches (wanders), finds the person, coils at their feet; then `resolve()` |
| `heard` | `{ x, y }` | the person hears: a tight coil + ink ring pulse at the feet |
| `turned` (alias `ripple`) | `{ x, y, radius?: number /*world units, default 46*/ }` | colour ripples across the ground from the feet: violet ink rings + vein splinters, settles into a stained patch that fades |
| `refused` | `{ x, y, from?: Pt }` | the thread frays and falls as ash flakes |
| `prayer` | `{ from: Pt /*person*/, to: Pt /*grave*/, count?: number }` | pale violet wisps drift on a curving path into the grave |
| `nether` | `{ x, y /*grave*/, amount?: number }` | motes gathering inward and sinking into the grave, inked spiral |
| `ichor` | `{ x, y, count?: number }` | dark red-violet pips that bead up and drop |
| `hunger` | `{ x, y, level?: number /*0..1*/ }` persistent until `end()` | grave dims, cracks pulse like a heartbeat |
| `eat` | `{ x, y, count?: number }` | crystal shards drawn in, crushed with a bite flash |
| `levelUp` | `{ x, y, level?: number }` | rising inked sigil column + ground ring |
| `divinityUp` | `{ x, y, rank?: number /*1..5*/ }` | once-per-rank: dark gathering, a burst of violet veins racing out to the far zoom, rank glyph burns into the ground |

Stain
| `veinTips` | `{ x, y, to: Pt, count?: number }` | thin violet vein tips race ahead from (x,y) toward `to` (front of a Hold creep) |
| `rootBloom` | `{ x, y, radius?: number }` | an area roots: veins thicken and bloom out, flower of light |
| `wither` | `{ x, y, radius?: number }` | stain recedes: veins blacken, curl back, gray dust |
| `seep` | `{ x, y, to: Pt }` | seepage through a passage mouth: inky trickle flowing from mouth toward `to` |
| `pitHead` | `{ x, y, radius?: number }` | the pit head takes colour: a ring of veins climbing the shaft collar, beacon at far zoom |

Followers' work
| `sendRoute` | `{ path: Pt[], dest?: 'explore'\|'spread'\|'crystals'\|'lift'\|'dark' }` persistent until `end()` | inked dashes march along the path on the ground; destination mark per dest |
| `sendPreview` | `{ path: Pt[], dest?: ... }` persistent | same, fainter, no march (hover preview) |
| `arrive` | `{ x, y }` | arrival mark: ink tick stamped at feet |
| `lampSweep` | `{ x, y, radius?: number, angle?: number }` persistent until `end()` | ochre lamp cone sweeping into gray while exploring |
| `discover` | `{ x, y, kind: 'cache'\|'seam'\|'loner'\|'shortcut'\|'relic'\|'danger'\|'none', to?: Pt /*shortcut far end*/ }` | reveal flourish, one look per kind |
| `carry` | `{ from: Pt, to: Pt /*grave*/, count?: number }` | crystal glints carried along and poured into the grave |
| `spreadWord` | `{ from: Pt, to: Pt }` | small violet sigils passing between two people |
| `lieLow` | `{ x, y }` persistent until `end()` | the follower's light pulls in: a dim ink hush ring at the feet, very low |
| `mark` | `{ x, y, glyph: 'tick'\|'cross'\|'eye'\|'crystal'\|'flame'\|'crown'\|'star' }` | brief result mark at feet (STAIN contract kind) |

Miracles & evil acts
| `miracle` | `{ id: 'dreamDirective'\|'blessTheirBodies'\|'soothingMurmur'\|'crystalBloom'\|'nightTerror'\|'veinSight'\|'borrowedTongue'\|'marrowFeast'\|'blackDew', x, y, radius?: number, to?: Pt /*caster/grave for unit miracles*/ }` | one distinct effect per miracle |
| `evil` | `{ act: 'terrorize'\|'sacrifice'\|'desecrate', x, y, radius?: number }` | heavy and wrong: screen-weight darkness, red-black ink |
| `tremor` / `falseDawn` / `sickness` / `visions` | `{ x, y, radius?: number }` | generic area miracle looks (used by events / town later) |

World pushback (ochre lamp-world, steel-blue Council, kiln-orange Temple)
| `ward` | `{ x, y, radius?: number, against?: Pt }` | ward flares gold against the stain, violet ink scorched back |
| `guardNotice` | `{ x, y, angle?: number /*rad, facing*/, to?: Pt, range?: number }` | lantern swing then a hard steel-blue/ochre cone, "!" -free: the cone snaps and holds 1.2 s |
| `purge` | `{ x, y, radius?: number }` | purge fire: kiln-orange flames licking across ground, ash |
| `bell` | `{ x, y, rings?: number }` | Temple bell: kiln-orange concentric inked rings, one per ring |
| `inquisitor` | `{ x, y, angle?: number }` persistent until `end()` | a hard white-gold light carried; sweeping disc |
| `lockdown` | `{ x, y, w: number, h: number }` persistent until `end()` | steel-blue bars stamped over a block |
| `crusade` | `{ x, y }` | banners of flame at the gate, gold column |
| `caveIn` | `{ x, y, radius?: number }` | dust burst and falling grit |
| `caught` | `{ x, y }` | follower caught: steel clamp ring snapping shut, violet thread snapped |

Turn rhythm
| `dusk` | `{ x, y, radius?: number }` | dusk settling: ink dark flows in from the edges toward (x,y) |
| `dawn` | `{ path: Pt[] /*deep mine -> shaft -> pit head*/, width?: number }` | the dawn bell wave travelling through the mine and up the shaft |


### Round 3 additions (DECISIONS §15.10; additive — binding from here)
Every crystal kind (`strikeGlint`, `crystalStrike`, `pocket`, `cartDrop`, `cartGlow`, `offerReveal`, `eatCrystal`, `crystalAbsorb`, `burn`, `socket`, `aura`, `tribute`, `enchant`, `curse`, `recombine`, `forgeJewel`, `giveItem`) also takes:
`affinity?: AffinityId` (`'hunger'|'malice'|'faith'|'fear'|'blood'|'shadow'|'stone'|'echo'|'storm'|'frost'`, any other string = neutral) — the light colour and the character (form) of the burst; `depth?: number` (0 shallow … 1 deepest face) — a darker, richer register; `oneIn?: number` (the crystal's "1 in N") — ≥ 10 000 plays the once-in-a-run tail moment on strike and on reveal. Grade (`rarity`) still sets intensity, size, hold and rays.
`grade?: Rarity` (FEEL, round 3): the stone's REAL grade. When given, the light colour follows `grade` (and `affinity` when given) while scale / ceremony / rays follow the staged `rarity`. A 1-in-12,000 Deep is Deep-coloured with a big ceremony.
Time scale (spec v2.1 §5b, DECISIONS §16 — the Day fast-forwards at ×1/×2/×4): `fx.setTimeScale(k)` scales every effect's clock (default 1); a spawn may also take `speed?: number` (its own multiplier). Under many close effects the load governor sheds washes and secondary particles first.
`FX_TIMING` adds `offerBreak[tier]` (the husk breaks), `tallyStart` (first stroke), `tallyTick` (s per stroke), `absorbArrive` (the stone reaches the grave), `devourOpen` (the maw opens).
`setAffinityLook(id, { light, core, ink, form })` (index export) lets the CRYSTAL palette replace the stand-in table; `affinityLook(id)` reads it.

| id | params | moment |
|---|---|---|
| `enchant` | `{ x, y /*the stone at the grave*/, rarity?, affinity?, slot?: number }` | a modifier takes hold: threads of affinity light spiral into the stone, a new mark burns in on it, a small settle ring |
| `curse` | `{ x, y, rarity?, affinity? }` | the enchant that comes out wrong: the same threads, then the light turns sickly-beautiful, a black vein crawls through the stone, a slow sour pulse |
| `recombine` | `{ x, y /*result*/, a: Pt, b: Pt /*the two parents*/, rarity?, affinity?, aRarity?, bRarity? }` | two stones drawn together, orbit, fuse in a flash, the new one rises in its grade's light |
| `tribute` | `{ from: Pt /*follower*/, to: Pt /*grave*/, rarity?, affinity? }` | a lone follower's furtive single stone at dusk: a quick low dart along the ground, one wink as it is left, the grave's small acknowledgement (not the Offer procession) |
| `facilityGained` | `{ x, y /*building*/, radius?, facility?: 'workshop'\|'forge'\|'tallyHouse'\|'chapel'\|'apothecary' }` | a building becomes yours: violet veins climb its footprint, its door-light turns, a ground seal; far form a beacon |
| `forgeJewel` | `{ x, y, rarity?, affinity?, item?: 'ring'\|'amulet'\|'circlet' }` | crafting into jewellery at the forge: the stone set into a glowing band, hammer sparks, the band cools from orange to its affinity |
| `giveItem` | `{ from: Pt, to: Pt /*the person's feet*/, rarity?, affinity?, cursed?: boolean }` | an item handed over: a small glint passes hand to hand, a brief ring at the feet (cursed: a sour flicker) |
| `itemTell` | `{ x, y /*feet*/, affinity?, cursed?: boolean }` persistent, `move()` | a worn cursed item's faint tell on a follower: an occasional low glint at the hip, never over the head |
| `itemExposed` | `{ x, y /*feet*/, affinity? }` | a worn item found in a search: a hard steel cone snaps on, the item's light flares and is torn away, the Council's steel ring |
| `tailFind` | `{ x, y, rarity?, affinity?, oneIn: number }` | the once-in-a-run moment on its own (also played by `strikeGlint`/`offerReveal` when `oneIn ≥ 10 000`): the room goes dark, a needle of light, a slow-turning star |

Mine stage (§15.10 A): `cut`, `crack`, `flaw`, `graft` are no longer called in the mine; they stay registered (`cut` = the town's Faceting).

### Event → effect (v3 contract; FEEL and PLAY-WORLD wire by lookup)
World points: a unit's feet, a face's rock point, its cart, the lift, the grave (all in town units). Crystal kinds always pass `rarity` (staged), plus `grade`, `affinity`, `depth` (face depth 0..1), `oneIn` when the sim has them. During the Day call `fx.setTimeScale(speed)`.

| event (time) | effect(s) |
|---|---|
| `bell` (0.00) | `dawn { path: deep faces → shaft → pit head }` |
| `strike` | `pickStrike { x, y: rock, angle }` on the swing, then `strikeGlint { x, y: rock, rarity, grade, affinity, depth, oneIn }`; then `kept` → `pocket { x, y: feet, rarity, from: rock }`, else `cartDrop { x, y: cart, rarity, from: rock }` |
| `skimmed` | `pocket { x, y: feet, rarity, from: cart }` |
| `crystalFound { how: 'soul' }` | `crystalStrike { x, y: unit, rarity, … }` (the stone pops free); other `how` add nothing (the strike already showed it) |
| `effectTriggered` | `heard { x, y: unit or zone }` (a small coil); `echoSummoned` → `turned { x, y: the copy }` |
| `carted` | `cartGlow` per face (persistent; set `params.load = count / 12`, `params.rarity` = best of `byRarity`); `diverted: true` → `cartDiverted { x, y: cart, mode: 'divert', grave }` |
| `followerEvil` | `followerEvil { x, y: unit, family }` (family from `CARD_TABLE[card]`) |
| `holdChanged` / `rooted` / `receded` | `veinTips { x, y, to }` / `rootBloom` / `wither` |
| `discovered` | `discover { x, y, kind }` |
| `tally` (0.76) | `tally { x, y: lift, count: counted, short }` (`covered` → `short: 0`) |
| `search` (0.78) | `guardNotice { x, y: guard, to: unit }`; `caught` → `caught { x, y: unit }`; a worn item found → `itemExposed { x, y: unit, from: guard }` |
| `thresholdCrossed` / `factionAction` | Temple: `bell` / `ward` / `purge` / `crusade`; Council: `lockdown` / `guardNotice`; `hunterArrived` → `inquisitor` (persistent, `move()`, `end()` on `hunterLeft`) |
| `offered` (0.94–0.99) | first per unit `offerArrive { from: unit, to: grave }`; each `offerReveal { x, y: grave, rarity, grade, affinity, oneIn, delay: order × 0.6 + 0.2 × tier }` |
| tribute (§15.10 B, when the sim emits it) | `tribute { from: unit, to: grave, rarity, affinity }` |
| `offerSpotted` | `guardNotice { x, y: guard, to: unit }` |
| `dusk` (1.00) | `dusk { x, y: grave }` |
| `routineResult` | pray → `prayer { from: unit, to: grave }`; lieLow → `lieLow` (persistent, `end()` next dawn) |
| `hungerChanged` | `hunger { x, y: grave, level }` (persistent; mutate level / `end()` when sated) |
| `levelUp` / `blessingChosen` / `surfaceReached` | `levelUp` / `blessing` / `pitHead` |
| night: `whisper` → `converted` / failed | `whisper` then `resolve('turned')` (+ `turned`) / `resolve('refused')` |
| night: `miraclePlayed` | `cardPlay { fromScreen, to: target or grave, id: card, grave }`; each `crystalBurnt` → `burn { x, y: grave, rarity, to: target }` |
| night: `evilPlayed` / `devoured` | `cardPlay { …, id: card, evil: true }` (devour plays `devour`; hide the figure at `FX_TIMING.devourGone`) |
| night: `crystalEaten` | `eatCrystal { x, y: grave, rarity, grade, affinity }` |
| night: `crystalSet` / `crystalUnset` | `socket { x, y: socket, rarity }` then `aura` (persistent) / `aura.end()` |
| night: enchant / curse / recombine (v3.1) | `enchant { x, y: stone, rarity, affinity, reroll? }` / `curse` / `recombine { x, y, a, b, rarity, aRarity, bRarity }` |
| facility gained / forge / give item (v3.1) | `facilityGained { x, y, radius, facility }` / `forgeJewel { x, y, rarity, affinity, item }` / `giveItem { from, to, cursed }` (+ `itemTell` persistent on a cursed wearer) |
| `cut` (town: Faceting) | `cut { x, y, rarity }` |
| `moveAttempt` | success → `arrive { x, y: unit }`; fail → `refused { x, y: unit }` |

Cards: `CARD_TABLE` (exported) lists all 30 v3 ids — own effects: the 9 original miracles, `creepingDark`, `blindEye`, `divertedCart` (`cartDiverted` divert), `theCalling`, `devour`, `terrorize`, `sacrifice`, `desecrate`, `caveIn`, `robTheCart` (`cartDiverted` rob), `sabotage` (`cartDiverted` sabotage); families: quickening light, mend growth, sermonOfAsh fire, gildedTongue light, badWater sickness, frame fear, madness fear, bloodRite blood, riot fire, assassinate blood.
DEPRECATED: `sendRoute` / `sendPreview` (§15 removed Send) — still registered only because old callers may exist; not maintained, no strips.

### Round 4 additions (theme §3; additive — binding from here)
The wick effects. `(x, y)` = the **crown point** (where the wick sits on the head, world units), not the feet; `move()` follows a walking figure.
| id | params | moment |
|---|---|---|
| `wickTurn` | `{ x, y, from?: 'flame'\|'pale' }` | turning a follower: the old light gutters and nearly dies (0–0.8 s), a dark beat and a curl of smoke, relights pale (1.1), catches violet with a ring and rising motes (`FX_TIMING.wickTurnViolet` 1.55), holds |
| `wickGutter` | `{ x, y, devotion?, hold?: s }` | fear: the light ducks and shrinks, a hard irregular strobe, the bud bent over, drops of light falling off |
| `wickFlare` | `{ x, y, devotion? }` | prayer: a column of the wick's colour climbs off the crown, a ring opens round the head, motes rise |
| `wickOut` | `{ x, y, devotion? }` | death: a last flare, it pinches to a point (`FX_TIMING.wickOutGone` 0.7), one spark, a pale thread of smoke climbs |
| `wickHood` | `{ x, y }` | Lie low: the violet light shies, a felt hood comes down, a violet slit under the brim, then nothing (`FX_TIMING.wickHoodOn` 0.85) |
**Round 5 additions (additive; every round-4 call keeps working):** each wick kind also takes `feet?: Pt` (the ground point under the figure; default crown + 0.95 figure heights down), `grave?: Pt` (where yours goes home; also read from `FxHost.grave?: Pt` when the param is absent — PLAY-WORLD: set it once on the host). `wickGutter` takes `near?: Pt[]` (neighbours' crown points: their wicks flicker in sympathy) and `nearDevotion?`; `wickHood` takes `cloth?: string` (the figure's cloth colour; default felt). Each draws a ground / light form under the figure that is floored in screen px (rings ≥ 3 px line and ≥ 40 px radius, pools ≥ ~30 px) so it reads at play zoom and at whole-mine zoom. New kinds spawned by them (callable on their own): `wickPool { x, y /*feet*/, devotion?, hold?: s, grave? }` (the person's pool of light in its new colour, stays ~6 s, veins toward the grave when `yours`), `wickStain { x, y /*feet*/, hold?: s }` (unlit ground where a light went out). `offerReveal` takes `best?: boolean` (the dusk's best stone: the break floods the whole grave chamber; staged Royal+ do it anyway). Harness: `e2e/vfx-shots.cjs ladder` (env `LADDER='tag=name|name@t;…'`), `Q=…&stand=1` forces the stand-in stone.
`devotion` = `'flame' | 'pale' | 'yours'` (type `WickDevotion`). **Caller contract:** while the handle is alive the effect owns the light — draw the figure's own wick out (`wick: { state: 'dead' }`) and switch to the final state when `alive` goes false (turn → `devotion: 'yours'`; out → `state: 'dead'`; hood → `hood: true` from `wickHoodOn`). The effect never fades its bud, so the hand-back does not pop.
Event → effect: `converted` → `wickTurn { crown, from }` (with `turned` at the feet); fear / `terrorize` targets → `wickGutter`; `routineResult` pray → `wickFlare { devotion: 'yours' }` (with `prayer`); death / `devoured` / `unitGone` → `wickOut`; lieLow → `wickHood` (with `lieLow`).
`dayMark` `{ at | x,y, variant: 'heavy'|…, amount?, owner?: 'yours'|'flame'|'council'|'blood'|'life', kind?: string }` — FEEL's mark for a Day note that stands in the world: a small ground ring at the place in the owner's colour (violet / gold / cold white / red / tan), heavy notes add an outward pulse ring, fades over 2.2 s, drawn only where visibility is 'active'. Without `owner` it guesses from `kind` (`markOwnerOf`, keywords), default daily life.
Dusk offer beats (FEEL `film.onOfferBeat`, once PLAY-CORE routes it): `arrive` → `offerArrive { from: unit, to: grave }`; `set` → nothing extra (the husk is part of the reveal); `reveal` → `offerReveal { x, y: grave, rarity: grade, grade, affinity, oneIn }`; `best` → `offerReveal { …, rarity: max(grade, 'royal'), grade }` — staged one ceremony up (room darkens, column of light) with the real grade's colour: the loudest moment of the dusk.
Hosts: `toScreen` may return one reused object (the draw context copies each point).
Colour: every effect colour comes from `src/render/fx/pal.ts` (`FXP`, `GRADE_INK`, `AFFINITY_INK`, `WICK`), derived from `src/render/theme`; `tests/vfx/palette.test.ts` rejects any colour literal elsewhere.

### The mining loop (DECISIONS §15) — effect ids for FEEL and the play scene (round 2; additive)
`Rarity = 'dull' | 'clear' | 'bright' | 'deep' | 'royal' | 'impossible'` or `0..5` (aliases kept: common=0, uncommon=2, rare=4, legendary=5).
Six colours: Dull gray-violet `#a8a2b4`, Clear ice `#cfe0ff`, Bright violet `#a873ff`, Deep indigo `#7a86ff`, Royal rose `#ff7ad9` (+gold sparks), Impossible white `#fff0d8` with violet (exported as `RARITY_LIGHT`).
Every tier escalates on four axes at once: colour, size, ceremony length (a held beat from Bright, the room darkens from Royal, Impossible stops the room for ~1.6 s), rays 0/0/3/4/6/16.
Crystal bodies are drawn through ONE thin adapter, `src/render/fx/shape.ts` (`setCrystalDrawer(fn)`; the drawer gets a `state`: `'rough'|'reveal'|'cut'|'crack'|'graft'|'shatter'|'socket'`). The CRYSTAL builder owns the crystal drawing (`src/render/crystal`, handoffs/CRYSTAL.md); until it lands the stand-in is `defaultShard` (seeded faceted shard, stranger with rarity). VFX owns everything around the crystal. `FxParams.seed` picks the shape.

| id | params | moment |
|---|---|---|
| `pickStrike` | `{ x, y /*rock point*/, angle? }` | every swing: sparks, grit, a dust puff, a pinprick flash (cheap) |
| `strikeGlint` | `{ x, y, rarity }` | the strike glints in the rock by rarity: Dull a wink … Impossible stops the room |
| `crystalStrike` | `{ x, y, rarity, angle? }` | strike + the stone pops free and reveals (for close-ups / cutscene) |
| `pocket` | `{ x, y /*follower feet*/, rarity?, from?: Pt /*rock*/ }` | a follower's quick hide: stone flicks to the hip, an inked hush, one violet wink |
| `cartDrop` | `{ x, y /*cart*/, rarity?, from?: Pt }` | an unconverted miner drops it in the cart: arc, clink sparks, a glint of its colour |
| `cartGlow` | `{ x, y, load?: 0..1, rarity? }` persistent, `move()`, mutate `params.load/rarity` live | the cart's glow by load |
| `tally` | `{ x, y /*the lift*/, count, short?: number }` | the overseer's chalk tally, one stroke per crystal in fives; a short count ends in a wrong, sour slash + gray-green flash + the Council's steel ring |
| `offerArrive` | `{ from: Pt, to: Pt /*grave*/ }` | a follower on Offer reaches the grave: mote trail, the grave stirs |
| `offerReveal` | `{ x, y /*set down at the grave*/, rarity, index? }` | THE reward beat: the rough husk is set down, the grave inhales (darkness, motes, cracks of light), the husk breaks, the stone rises and reveals; Royal+ a column of light; Impossible white-and-violet rays, the room darkened. Stagger several with `delay` |
| `eatCrystal` | `{ x, y /*grave*/, rarity?, from?, count? }` | the grave takes it (spiral in, gulp, cracks drink the light), then Hunger eases: red cools to quiet violet, two slow inward rings |
| `crystalAbsorb` | `{ x, y, rarity?, from?, count? }` | the take alone (no exhale) |
| `burn` | `{ x, y, rarity?, count?: 1..4, to?: Pt /*the miracle's target*/ }` | burning stones for a miracle: violet fire, the stones dissolve upward as embers that fly to `to`, ash |
| `cut` | `{ x, y, rarity }` | three blade lines across the husk, facets shear off, light opens, reveal |
| `crack` | `{ x, y, rarity /*before*/ }` | a jagged ink crack with a white snap, a dull puff, the colour drains to the tier below |
| `flaw` | `{ x, y, rarity }` | an ink spiral wakes inside the stone, sickly teal shimmer, glints orbit backwards |
| `graft` | `{ x, y /*target*/, donor: Pt, rarity?, donorRarity? }` | donor shatters, a line of light arcs across, the target grows a spur |
| `socket` | `{ x, y, rarity }` | set into a grave socket: drop, four prongs bite shut, lock flash, shock ring |
| `aura` | `{ x, y, rarity?, radius? }` persistent, `move()` | the standing aura of a set crystal: low dashed ring + orbiting motes below the knees |
| `craft` | `{ x, y, rarity?, inputs? }` | (kept) several stones circle in and fuse |
| `blessing` | `{ x, y /*grave*/ }` | a blessing chosen: gold, violet and pale lights spiral down into one bloom |
| `followerEvil` | `{ x, y, family? }` | a follower's own evil seen in the Day: small, muted red-black splash and veins |
| `cardPlay` | `{ fromScreen, fromSize?, to, id?, family?, evil?, chain?, radius?, caster?, grave? }` | the card tears off the hand, arcs over (UI space), burns into the ground; then plays `cardFx` |
| `cardFx` | `{ x, y, id?, family?, radius?, to?, grave? }` | a miracle/act by card id: its own effect if it has one (9 miracles, terrorize/sacrifice/desecrate, `devour`), else its family: `light` `growth` `sickness` `fear` `fire` `silence` `blood`. `setCardFamily(id, family)` registers new ids; `cardEffect(id)` tells you what plays |
| `devour` | `{ x, y /*feet*/, grave?: Pt }` | devouring a person: darkness pools, cracks race out, a jagged maw opens, tendrils clutch and drag down, red-black spray, the essence goes home to the grave. Hide the figure at `FX_TIMING.devourGone` (1.05 s) |

`FX_TIMING` (index.ts): `strikeHit[tier]`, `strikeReveal[tier]`, `cardLand` 0.55, `devourGone` 1.05, `socketLock` 0.34, `craftFuse` 1.0.
Dropped per §15: `sendRoute` / `sendPreview` (still registered so old callers do not break; not maintained, no strips).

Far zoom: every important kind (`turned`, `discover`, `rootBloom`, `wither`, `divinityUp`, `levelUp`, `ward`, `guardNotice`, `purge`, `bell`, `lockdown`, `crusade`, `miracle`, `evil`, `dawn`, `crystalStrike` (rare+), `devour`, `cardPlay`, `pitHead`, `caught`) has a far form drawn at a fixed screen size (a pulsing beacon) when `host.scale` is small.

## Status (round 2, successor builder) — REPORTED
- [x] round 1 module (all kinds in the first table), gallery `dev/fx.html`, `e2e/fx-shots.cjs`.
- [x] the mining loop (§15) kinds in `kinds/crystal.ts` + `kinds/loop.ts` (table above), six rarity tiers, `FX_TIMING`, card-id dispatcher with seven families, crystal body behind one adapter (`shape.ts`).
- [x] void check rebuilt (diff against a no-effect render; footprint-Void pixels only) and every primitive margin-tested (`D.visR`): **103/103 demos clean** (8 frames × zoom 3 / 1 / far), 0 console errors/warnings (`/tmp/vfx/run4.log`).
- [x] headless: all 67 kinds spawn/update 10 s with no NaN; particle cap holds at 896/900 with everything at once (`npx tsx /tmp/vfx/headless.ts`).
- [x] perf (1600×900, s=6, update + both draws, forced flush; control 0.0 ms): stress dawn (78 effects, 758 particles) **27.9 ms**; realistic dawn (dawn wave, turned, refused, a Royal offering reveal, a Bright strike glint, a pick strike, prayer; 15 effects, 368 particles) **5.9 ms**; load 5.0–5.3. A/B on the stress dawn: no glows −8 ms, no ribbons −8…−12 ms, no particles −2.5 ms, nothing at all 2.2–2.5 ms — fill-rate bound on this software-rendered box. NOT within the brief's 1.5 ms.
- Strips: `screenshots/fx-*.png` (103) and `screenshots/fx-sheet.png`.

## Files touched (round 2)
- src/render/fx/{core,ink,index,types,shape}.ts, src/render/fx/kinds/{crystal,loop,work}.ts (new: shape.ts, crystal.ts, loop.ts), src/render/fx/dev/{gallery,demos}.ts, e2e/fx-shots.cjs, screenshots/fx-*.png, handoffs/VFX.md, DECISIONS.md (VFX round 2 note).

## Next steps (exact)
1. Perf: render glows at most once per (effect, frame) and cap wash glows' screen radius; draw ribbons of one effect into one path (as drawVeins does now); consider a half-res light layer for additive glows composited once. Measure with `/tmp/vfx/perfab.cjs` (DBG toggles in `ink.ts`, remove them after) and `e2e/fx-shots.cjs perf`.
2. Round-1 looks: DONE this round — removed the in-world clip-art glyphs (falseDawn sun, lockdown crown, guard's eye, bell glyph, the floating hand, tongue, mouth); rings wider than 60 px clamp their wobble to 0.02 (no lasso). STILL TO DO: veinSight's big eye, the discover danger triangle and relic/levelUp rune letters, crusade's big central flame glyph — replace with inked light/ground marks; strips for those kinds were not regenerated after this change (run `e2e/fx-shots.cjs strips miracle ward bell lockdown guardNotice levelUp`).
3. When `handoffs/CRYSTAL.md` lists `drawCrystal(ctx, crystal, {x, y, size, time, light, glow, state})`, wrap it as a `CrystalDrawer` in `shape.ts` (map ShardStyle.tier → crystal rarity, seed → crystal, state passes through) and re-run the crystal strips.
4. When `handoffs/P4.md` lists the v3 event names (strike, carted, tally, search, offered…), add a name → effect table at the top of this file for FEEL.

## Requests
- FEEL / PLAY-v2: call the ids in the table above; hide a devoured person's figure at `FX_TIMING.devourGone`; stagger several `offerReveal`s with `delay` (≈ 0.6 s + more for rarer); `cardPlay.fromScreen` is the card's canvas px (same space as `toScreen`).
- CRYSTAL: please export a drawer usable at ~4–80 px tall with a `state` and a `lit` (0..1 inner light) input; VFX passes `'rough'` for the unrevealed husk.

## Self-grade (round 2): 7/10
Bar: a shipped indie game. The new crystal-loop set reads well and escalates (offering reveal Dull → Impossible is unmistakable; strike glint, tally, pocket/cart, cut/crack/flaw/graft are each distinct), void-clean everywhere, no console errors.
Three worst faults a hostile critic would name:
1. Performance: 5.9 ms for a realistic dawn and 27.9 ms for the stress dawn against a 1.5 ms budget.
2. Round-1 effects still use clip-art glyphs in the world (sun, flames, crown, eye, warning triangle) and loose wobbly rings — they read as icons, not inked light.
3. The crystal body is a stand-in shard (CRYSTAL owns the real one); at zoom 1 several small effects (pocket, cartDrop, socket) are only a few pixels and lean on their far beacons.
What I would do next: the perf pass and the icon/ring pass above (both in `ink.ts` + `kinds/{god,miracles,world,work}.ts`).


## Status (round 3, successor builder) — HANDOFF (context cap reached)
Done: faults 1–5 implemented (perf machinery, real crystal + grade/affinity lights, pins at zoom 1, icon glyphs replaced + CARD_TABLE for 30 ids + own kinds, event→effect table above). §15.10 kinds (enchant, curse, recombine, tribute, facilityGained, forgeJewel, giveItem, itemTell, itemExposed, tailFind) and FEEL's requests (grade vs rarity, FX_TIMING keys, setTimeScale/speed) done. fx tsc clean.
Not done: fault 6 (real mine harness check via renderer.addLayer); stress ≤ 8 ms not yet met; the full fx-shots run (log /tmp/vfx/run-r3a.log) launched but strips for cartDiverted/creepingDark/blindEye/theCalling/veinSight r3/discover danger+relic/levelUp/crusade NOT yet looked at.

Perf (software Chrome, load ~17.5, 0.1 ms timer; med / p90): realistic 11 fx + 183 parts 3.0 / 7.8 ms (target 2.5); hero Impossible reveal 0.7 / 1.7 ms (target 4, met); stress 52 fx + 376 parts 11.4 / 24.4 ms (target 8, NOT met — governor is on but rings/ribbons dominate). Re-measure at low load: `node /tmp/vfx/perf3.cjs`.

Files touched (round 3): src/render/fx/{ink,core,index,types,shape}.ts; kinds/{crystal,loop,miracles,world,work}.ts; NEW kinds/craft.ts, kinds/cards.ts; dev/{gallery,demos}.ts; handoffs/VFX.md; DECISIONS.md.

Next steps (exact):
1. Read the tail of /tmp/vfx/run-r3a.log: void check must be clean, errs []. If it is gone, rerun `flock /tmp/hg-pw-0.lock env NODE_PATH=/usr/local/lib/node_modules_global node e2e/fx-shots.cjs all`.
2. Downscale and look at the strips listed under "Not done"; fix anything that reads as an icon or a cheap shape.
3. Stress: at GOV level 2, also drop ring ink entirely, cap live rings at 12 (oldest/faintest first), and stride secondary particles by 3 → re-measure to ≤ 8 ms; check realistic ≤ 2.5 at lower load (it may already pass; load inflates numbers 2–3×).
4. Fault 6: in dev/mine.html add the fx layer via renderer.addLayer, fire strike/offerReveal/devour/creepingDark; check the Void pixels are exact #000, there is no band at the edges, and nothing floats over heads.
5. Tribute reads too quiet and the Dull reveal is weak; raise their pin cores a little.

Requests: CRYSTAL — publish an affinity palette, then call setAffinityLook (the fallbacks are in shape.ts). SIM — affinity ids, tribute/enchant/recombine/facility events in the "v3.1 changes" block.

## Self-grade (round 3): 7/10 (honest; handoff, not final)
Worst three: (1) the stress case is 11.4 ms, against 8; (2) the real mine harness has not been checked (fault 6); (3) the new card and icon-replacement strips have been regenerated but not inspected.

## Status (round 4, successor 4) — REPORTED (owner §19: "just get something in place for now")
Done:
1. Palette re-key: every effect colour from `src/render/fx/pal.ts` (theme kit only). `tests/vfx/palette.test.ts` (6 tests) rejects hex / rgb( / hsl( literals under src/render/fx (allow-list: dev/gallery.ts). Grades violet by brightness/rays; affinity inner only; evil = violet→black (terrorize's blood sparks removed); Temple gold; Council cold white.
2. Wick effects `wickTurn`, `wickGutter`, `wickFlare`, `wickOut`, `wickHood` registered (types, FX_TIMING keys, demos with THEME wickfolk stand-ins at close zoom). Strips: screenshots/vfx-wick*.png.
3. Real mine harness (dev/vfx.html + src/render/fx/dev/mineFx.ts) FIXED: it reused one toScreen point, so every effect drew at scale 0 (core now copies the point). `e2e/vfx-shots.cjs` modes strips,sheet,void,draw (comma list). Sheet: screenshots/vfx-sheet.png (139 effects on the real mine).
4. Draw check: 143/143 demos draw on the real mine; zero console errors.
5. `dayMark` (FEEL round 3b) + offer-beat mapping (interface block).
Void check: 138/143 clean; leaks of 4–308 px over 8 frames × 3 zooms in rootBloom, soothingMurmur, bell, crusade, card family silence — all from `ring` (noRing → 0). See the last run for whether they fall in Void areas or on black the renderer paints inside visible areas.
Not done (deferred by §19): perf pass (last numbers: realistic 3.0 / 7.8 ms med/p90, stress 11.4 ms med under load ~17 — no realistic frame over 16 ms), far-zoom refinements, strip-by-strip polish.

Requests:
- PLAY-WORLD (`src/scenes/play/fx.ts`): `dayMark` arrives with `{ at, unit, zone, variant }` (not native, no x/y) and falls to `default: break` — add `case 'dayMark': S('dayMark', { x: at.x, y: at.y, variant: p.variant, amount: p.amount, owner: (p as any).owner, kind: (p as any).kind }); break;`. Also wire the wick effects at the crown point (event table in the interface block) and honour the caller contract (figure wick out while the handle lives).
- FEEL: pass `owner: 'yours'|'flame'|'council'|'blood'|'life'` (or the note `kind`) on `dayMark`, else it guesses from `kind` and falls back to tan. Offer beats per the interface block.
- THEME: a way to draw a figure with no wick (`wick: null` in FolkOpts) so wick effects own the light cleanly (stand-in today: `state: 'dead'`, an ash nub).
- CRYSTAL: RARITY_LOOK glows are still six hues; effects draw the violet stand-in shard until they are violet-hearted (`crystalThemed()` in shape.ts switches automatically).


## Status (round 5, successor 5) — REPORTED (feedback visible at play zoom)
Done (tsc clean for fx; tests/vfx 10/10 incl. new `tests/vfx/wick.test.ts`; void 139/144 all kinds — the 5 flagged change only renderer-black pixels inside visible areas, 0 in Void, as round 4 — and 22/22 on every kind touched after; draw 22/22; zero console errors):
1. Wick GROUND forms (`kinds/wickGround.ts`, used by `kinds/wick.ts`), floored in screen px (rings ≥ 3 px line, ≥ 40–46 px radius; pools ≥ 30 px; flick ≥ 150 px; prayer column ≥ 96 px). Turn: gold pool flickers and dies → dark beat → pale → violet flood, two rings spread ~2.6 figures, a flick of light runs toward the grave, then `wickPool` (violet pool + veins pointing home, 6 s). Death: last swell, pool pinches out, pale ring outward, `wickStain` (unlit ground, 4 s). Fear: strobing pool + broken rings of their light pulling IN; neighbours (`near`) flicker. Prayer: column from the floor, pool doubles, ring. Lie low: violet pool flattens to a slit, a ring closes in; hood in `cloth`. Same forms are the far form at whole-mine zoom. Handle lifetimes unchanged (tested).
2. Strike/reveal: per-grade screen-px floors in the shared burst (`revealLight`); below Royal the reveal keeps a dark pool under the stone (floored) and a core star at the break; Royal+ and `best: true` flood the whole grave chamber (`chamberFlood`, loop.ts). Ladders: `screenshots/vfx-ladder-strike.png`, `vfx-ladder-reveal.png`.
3. Crystal: drawn look is violet; `RARITY_LOOK` still hued at `src/render/crystal/looks.ts` LOOKS bright `#52c2ff`/`#3597e2` (l.57–58), deep `#ff3a4a`/`#901a36` (l.63–64), royal `#ffbd45`/`#d39226` (l.69–70), exported l.251. Effects KEEP the stand-in: the real stone via fxCrystalDrawer reads as a dark hook at reveal size (`screenshots/vfx-crystal-ab.png`).
4. Governor: level 1 ring cap 36/frame; level 2 ring cap 14, faint rings (< 0.2) shed, no ring or ribbon ink, ribbons past 2400 pts/frame shed, all veins as hairlines, glow-area budget. Perf (perf3, medians of 3, 1600×900): stress gov 19.9/29.0 and 21.3/44.3 ms (med/p90) vs no-gov 31.2/57.9, 32.4/56.9 at load 15–18; realistic 6.1–6.7 / 11.3–14.7 (level 0, unchanged by the governor). Stress p90 < 16 ms NOT shown at this load.
Proof strips (zoom 3 / zoom 1 / mine): `screenshots/vfx-wickturn-turning-a-follower.png`, `vfx-wickout-death.png`, `vfx-wickgutter-fear.png`, `vfx-wickflare-prayer.png`, `vfx-wickhood-lie-low.png`, `vfx-strikeglint-deep.png`, `vfx-offerreveal-best-bright-staged-royal.png`.

Requests:
- PLAY-WORLD (`src/scenes/play/fx.ts` host): add `grave: <the grave's world point>` to the FxHost (the turn's flick and the pool's veins point at it; without it they spread all round). In `world.ts` wick calls pass `feet: { x: u.x, y: u.y }` (the crown→feet default assumes standing); `wickGutter` may pass `near: [crowns of people within ~2 figures]`; `wickHood` may pass `cloth: <figure's cloth colour>`.
- PLAY-SHADE (`src/scenes/play/shade/fx.ts`): pass `feet: p` (you subtract CROWN from p) and `grave` (or set it on the host).
- FEEL / PLAY-CORE: on the `best` offer beat pass `best: true` to `offerReveal` (the chamber flood; staged Royal+ get it anyway).
- CRYSTAL: (a) the stone via `fxCrystalDrawer` at reveal size reads as a dark curved hook (seed 11, grade bright) — see vfx-crystal-ab.png; (b) `RARITY_LOOK` still exports the old hues (lines above) for UI callers.

Next steps (exact):
1. Perf at lower load: `flock /tmp/hg-pw-0.lock /tmp/vfx/batch4.sh` (or `node /tmp/vfx/perf3.cjs '{"gov":{},"nogov":{"noGov":true}}' real,stress`); if stress p90 stays > 16 at load ≤ 8, lower GOV level-2 threshold (load > 34 → > 26) and `RIBBON_PTS_L2` 2400 → 1600; `turned` is the costliest kind (9.9 ms for six) — merge its rings into one ribbon batch.
2. Dull/Clear reveals in front of the grave cluster are still quiet (by design the lowest rungs); raise the break star to 9 + 4·grade px if a critic cannot tell Dull from Clear.
3. When CRYSTAL fixes the hook look: `setCrystalThemed(null)` default in shape.ts, re-shoot `vfx-crystal-ab.png` with `Q=…&stand=1` vs default.
