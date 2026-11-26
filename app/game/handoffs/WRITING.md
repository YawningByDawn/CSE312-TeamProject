# WRITING — every word in the game (running handoff)

Builder #1. Brief: `handoffs/briefs/WRITING.md`. Headless. Scratch `/tmp/writing/`.
Owns: `src/content/**`, `tests/content/**`, `scripts/content-*.ts`, `scripts/writing-*.ts`, this file, `handoffs/WRITING-sample.md`, `### WRITING …` sections in DECISIONS.md.

## ROUND 5 — FOR SIM: exact replacement strings for the sim's fallbacks (read-only to WRITING)

The game already shows WRITING's words where it reads `text.bonus` / `text.card` / `text.blessing`. These fallbacks still reach the screen through `blessingView`, `describeAction`, the rank pick in `src/scenes/play/index.ts`, FEEL's Day notes (`e.text`) and `threatsView().line`.

| File · key | Now | Replace with |
|---|---|---|
| `content/bonuses.ts` lingeringThrone name / flavor | Lingering Throne / Something of the old throne remembers the shape of you. | Room in the Shard / I was a colossus once. There is still room in me. |
| bonuses.ts sweetVoice name / flavor | Sweet Voice / Your voice comes to them like a mother’s. | Remembered Voice / Every wick here once burned for me. Some still remember. |
| bonuses.ts gemcutter name / flavor | Gemcutter / You remember the facets of stars. | Old Facets / I was all facets once. I know what a stone wants. |
| bonuses.ts patientHunger flavor | You have starved before. You know how to wait. | I have starved since the Flame came. I know how to wait. |
| bonuses.ts hoardOfTheGrave effect | 3 rough crystals: a Clear, a Bright and a Dull. | 3 crystals in your grave: a Dull, a Clear and a Bright. |
| `content/cards.ts` burnTheLedgers name / line | Burn the Ledgers / Fire in the council hall: … | Burn the Knot-Cords / Fire in the tally house. The Council’s moves fail, and one seal falls from the writ. |
| cards.ts silenceThePreacher line | A priest’s tongue stops in the night: … | A priest goes quiet in the night. The Temple’s moves fail, and the Inquisitor leaves. |
| cards.ts turnTheMob line | A rumour in the right ear: … | A word in the right ear. The crowd’s moves fail; it turns on the Council’s men. |
| `town.ts:274` writTorn (evil) | The ledgers burn, and the writ with them… | The tally house cords burn, and the writ with them${seals > 0 ? ` (${seals} of ${w.max} seals stand on the copies)` : ''}. |
| town.ts:321 | …down the city road with torches… | The crusade comes down the city road with braziers. For three days the Flame’s fires burn wherever your faithful gather. |
| town.ts:382 | …the profaned relic is buried under the Flame’s altar… | ${title}: over the profaned relic hidden under the Flame’s altar, the fire will not light. |
| town.ts:386 | …The order is lost in a drawer. | ${title}: a word in the right ear from one of yours, and the order is lost among the cords. |
| town.ts:457 | ${u.name} loses … in a drawer. | ${u.name} loses ${…title.toLowerCase()} among the cords. |
| town.ts:551 | Make … at the counting house | Make ${name} at the tally house first. |
| town.ts:559 | …can lose it in a drawer (1 action, …) | ${e.name} can lose it among the cords (1 action, ${FAVOUR.devotion} devotion). |
| town.ts:593 describeThreat | capWords(ANSWER_EVIL[…]) gives “Burn The Ledgers” | use the card’s name: EVILS[ANSWER_EVIL[t.faction]].name |
| `content/events.ts:148` | ${u.name} is buried in … | ${u.name} is carried to the burning ground. |
| events.ts:288 | Your followers kneel to the gold … | Your followers bow their wicks to the gold and think of the dark the whole time. Mostly. |
| events.ts:666 | …sits up in bed and asks for bread. | ${v.name}’s child sits up in the sleeping heap and asks for cap-flesh. ${v.name} knows exactly who to thank. |
| events.ts:696 | black beer | black cap-beer |
| events.ts 166/175/195/318/372/536/550/554/557 | brass ledger · the ledger · three coppers … new page in the ledger · The Overseer’s Ledger · ledger open on the desk · Burn the pages · a ledger lost to a lamp | brass weighing bowl · the cords · three chits and a nod. The overseer ties a new cord · The Overseer’s Cords · knot-cords on the tally bench · Burn the cords · a cord lost to a lamp (content’s own copies of these events already say so) |
| `content/maps.ts:142 / 163 / 182 / 186` | lamp, ledger and lash · Ore wagons · Ledgers, seals… · soldiers drill | lamp, cords and lash · Ore carts and the people who push them. · Knot-cords, seals, and the Magistrate’s chair. · The town’s guards drill, drink and wait for the war to call them. |
| `content/discoveries.ts:41 / 59` | keep a ledger of every miner · keeps a ledger of every shift | keep a cord for every miner who passes · keeps a cord for every shift |
| `content/stages.ts` (auditor arrive/leave, crossTexts.government.0) | brass ledger · closes his ledger · brass ledgers · three eyes | brass weighing bowl · coils his cords · brass weighing bowls · drop “three eyes that do not blink in step” (say “eyes that shine back the lamp”) |
| `content/people.ts` 69/126/140/157/186/216/226/228/234/238/240 | margins of the ledger · shirts for coin · wagon · bucket · barracks boots · ore wagons · linen / sheets · Yoked buckets · Old money · kneel · Ink-stained | content’s own `src/content/people.ts` lines (same ids) are the replacements; for the crowds: ore carts · wraps / sleeping hides · Yoked gourds · Old chits in tall shells · bow their wicks · Cord-calloused |
| `tests/sim/sim-words.test.ts` | `forbiddenIn` | add `maps` to the scanned modules and switch to `forbiddenStrictIn` once the rows above land |

## ROUND 5 INTERFACE — the town's contest (sim v3.3), the real story in the starting bonuses, the opening, HUD words (binding, additive)

Builder: WRITING round 5 (restart successor). New files `src/content/town.ts`, `src/content/hudwords.ts`; content still imports nothing from `src/sim`.
```ts
import { text } from '../content';
// ---- the factions' announced moves (ThreatKind: writ levy rite ward burning crusade) ----
text.threat(kind, { place?, name?, building?, n?, max?, inDays? }, variant?)
     → { name /* "The Naming" */, faction /* "the Temple" */, rule, details, what, announce, looms, landed, ledger }
text.threatLine({ kind, inDays, answers?: AnswerId[], answered?: AnswerId, faction?, floor?, evilName?, place?, name?, building?, n?, max? })
     → "At dusk tomorrow: priests ward the Rows. Answer: a profaned relic, a Temple Elite's favour, Silence the Preacher or cool the Temple below 25."
text.answerWith(by: AnswerId, { elite?, faction?, floor?, heat?, card? }) → { name, label /* button */, line, answers, none /* why you cannot */ }
text.writ(seals, max) → { name, line, rule, warn }      text.favour({ elite?, faction?, left? }) → { name, label, line, cost, status }
text.townRule(id: TOWN_RULES id) → { title, text }
text.townNote(ev, { name?(unit), place?(zone), building?(facility), writ? }, variant = turn) → Day-feed line in the faction's voice ('' for other kinds)
text.townLedger(ev, ctx) → one dusk-ledger line or ''      // also wired into voice.chronicle + the dusk summary (ledger31)
// ---- the opening ----
text.cutscene('cutscene.memory' | 'cutscene.flame' | 'cutscene.fall' | 'cutscene.hunger' | 'cutscene.digging') → { voice, text, alt }
// ---- HUD words ----
text.hudWords() → { 'hand.kind.<k>': word, 'card.kind.<k>': word }   // k: miracle evil act blessing bonus event story choice facet threat answer favour item crystal
text.count('crystal', n) → "1 crystal" | "3 crystals"     text.plural(n, 'crystal comes', 'crystals come')
```
Exported: `THREAT_TEXT`, `ANSWER_TEXT`, `TOWN_RULE_TEXT`, `TOWN_EVENT_KINDS`, `whenWord`, `CUTSCENE_LINES`, `CUTSCENE_KEYS`, `HUD_WORDS`, `CARD_KINDS`, `COUNT_NOUNS`. Reason codes `noThreat wrongAnswer answered notElite favourSpent` are in `REASONS`. Defeat causes gain `sealed`, `ichor`. `text.bonus(id)` now returns the v3 blessing (line2 = the god's line; caller slots ignored; numbers tested against `BONUS_NUMBERS`).
Display name proposals: `burnTheLedgers` → **"Burn the Knot-Cords"** (id kept). Strict word list: `forbiddenStrictIn(s)` in `tests/content/theme.ts` (adds ledger, desk, drawer, ink, page, margins, coppers, quill, counting house, Government, Cult).

### Round 5 status
- Done. 1: every v3.3 id has words. There are 3 acts of evil with name, line, cost, flavour, details and a past-tense line. 6 moves × 9 slots: name, faction, rule, details, what, announce ×2–3, looms ×2, landed ×2, ledger. 7 answers × 6 slots: name, label, line, answers, why-you-cannot, and blunted. There are lines for the writ and the favour, 11 town rules, 5 reason codes and defeat causes `sealed` / `ichor`. All 10 events have a Day-feed line; the dusk-ledger lines are wired into `voice.chronicle` and the dusk summary.
  - `tests/content/v33.test.ts` reads the sim's own tables (EVIL_IDS, THREAT_KINDS, ANSWER_NAMES, TOWN_RULES, BLESSING_IDS, BONUS_NUMBERS, the ReasonCode union in types3.ts). A new id without words fails with the id named.
  - Coverage: 16 evils × 6 slots, 6 moves × 9, 7 answers × 6, 11 rules × 2, 10 events × (feed + ledger where one lands), 20 blessings × 4 (+ text.bonus equal), 51 reason codes, 14 card kinds × 2 HUD keys.
- Done. 2: the starting bonuses tell the broken-colossus story, with numbers tested against BONUS_NUMBERS. `text.bonus` (FRONT's pick) now returns the blessing. The SIM table is above.
- Done. 3: the opening's five lines have keys (`cutscene.*`) and one alternative each. Three lines changed, and `script.ts` LINES carry them (strings only). A test checks the order, the voices, the windows and the reading budget.
- Done. 4: `hand.kind.*` / `card.kind.*` × 14, `text.count`, `text.plural`. The strict word sweep of content is down to 0 offenders.
  - Report: `npx tsx scripts/writing-forbidden.ts`. It scans 8,965 exported, 4,531 generated and 807 sim strings, plus string literals.
  - Content: 0. Sim: 2 base, 15 strict, 45 literal lines (table above).
- Done. 5: the read-through is at the top of `handoffs/WRITING-sample.md` (`npx tsx scripts/writing-sample5.ts 11`). Fixed from reading it:
  - "a voice they buried";
  - "One more lamp burns" (now a wick), and the conversion tail repeating every night (3 → 6 variants);
  - "the rows turns out" (capital);
  - "Deepwell is yours" said twice in the ending;
  - "came to nothing" opening every blunted line;
  - the evil answer told three times in one night;
  - a crowd's death in the singular;
  - the miracle and event-choice lines.
- Tests: `npx vitest run tests/content` 123 green (7 files). tsc is clean for src/content, tests/content, scripts/writing-*.

### Round 5 self-grade: 8/10
The read-through holds one voice from the opening to the ending tease. The town's three sides now sound different: the Council's notices, the Temple's warmth, the well's rumour. There are no throne and no stars, and no ledger or desk anywhere in content.
The three worst:
- Much of what the player sees in the town is still the sim's fallback text, until FEEL, HUD and PLAY-CORE read `text.townNote` / `text.threatLine` / `text.blessing`. The live game shows "lost in a drawer" and "Burn the Ledgers" until then.
- The sample's nights 1–3 come from a bot that turns three people a night. Conversion lines still dominate the chronicle, and the hints arrive four at a time in print (one at a time in the game).
- The "Cool them" answer line is mechanical ("The Temple is at 43. Below 25 by dusk…"). It is plain but not in any voice.

### Requests (round 5), exact
- **SIM:** the table above. Also `townHardens` text → "The town has had enough of you. Now they move every day, and the Council presses its writ whatever it costs."
- **HUD** (`src/ui/play/text.ts` pourWords): add `const hw = call<Record<string, string>>('hudWords'); if (hw) Object.assign(m, hw);` before `setWords(m)`. This stops "HAND.KIND.EVENT".
  - Plurals: `words.ts` 'grave.count', 'night.miracle.cost', 'card.stash' and 'offer.total' print "1 crystals". Render them with `text.count('crystal', n)`, e.g. `'grave.count': '{n}'` filled with `text.count('crystal', n)`.
  - The standing warning for a move: `text.threatLine({ kind, inDays, answers: v.answers.map(a => a.by), answered, faction, floor, evilName: text.card(ANSWER_EVIL[faction]).name, place, name, building })` in place of `threatsView().line`.
  - Answer buttons: `text.answerWith(by, { elite, faction, floor, heat }).label`; when `ok` is false, `.none`.
- **FEEL** (`src/feel/notes.ts` notesFor): for `threatAnnounced threatLooms threatAnswered threatBlunted threatLanded writSealed writTorn favourCalled facilityLost townHardens`, use `text.townNote(e, { name: unitName, place: zoneName, building: (f) => text.facility(f).building, writ: s.writ, threat: (id) => s.threats.find(t => t.id === id) }, turn) || e.text`.
  - `src/feel/day.ts:554`: `+${crystals} crystals brought to you.` → `` `+${text.count('crystal', crystals)} brought to you.` ``
- **PLAY-CORE** (`src/scenes/play/index.ts:473`, the rank pick): `const t = text.blessing(o.id); name: t.name || o.name, lines: [t.line || o.line, t.flavour]`. The modal title 'Choose what survived the fall' is right.
- **FRONT** (`src/scenes/front/adapter.ts:292`): `facts.bonus = text.blessing(bonusId).name || …`. In `bonusWords`, the `per` slot map is no longer read and can go.
- **AUDIO** (comment only): `src/audio/beds/scenes.ts:806` quotes the old first line. It is now "Once, every wick in this land burned for me."
- **DOCS:** nothing; the README names no bonus or opening line.

## ROUND 4 INTERFACE — the wickfolk's words (docs/theme.md §10) and LIVING merged (binding, additive)

Builder: WRITING round 4. New files are `src/content/world.ts` (LIVING's event pools, the work notes and the life pools) and `src/content/days.ts` (calendar, weather, dusk, night, effect reasons and person cards). `living.ts` now builds on both. Content still imports nothing from `src/sim`.

```ts
import { text, createNotebook } from '../content';
import { keyOf, noteVariants } from '../content/living';     // scripts/tests only
// ---- the Day feed (HUD/FEEL: use this, not item.text) ----
const nb = createNotebook(runSeed);           // one per run
nb.feed(item: FeedItem): string               // keyOf(item) → our pool (walks every variant before repeating), else item.text
keyOf(item): string                           // textKey + case: 'event.paySettled.unpaid', 'event.inspectorLeaves.bad',
                                              //   'event.childFound.mine' (place in the pit), 'event.smuggleRun.fog',
                                              //   'event.washGossip.follower', 'event.procession.rain',
                                              //   'weather.<kind>.turn' when time > 0.05 (dawn note otherwise),
                                              //   'life.work.<tradeId>' from 'life.work' + slots.tradeId
// ---- the frame ----
text.calendar(kind) / text.weather(kind)      // { name, line ≤ 60, rule }
text.duskDay(kind, dayIndex)                  // workday has 7 lines, so a week never repeats a dusk; other kinds 3
text.night(dayIndex)                          // 7 lines, black night, the town asleep (the player's turn)
text.effectWhy({ kind, value, source?, target? }, placeName?) // ≤ 60 chars; reads source 'event:x' | 'weather:x' | 'calendar:x' first
text.personCard({ name, role, at, hearth, size, with[], tie?, trait }) → { line, trait }
text.personLine(livingPersonLine, trait?, name) → { line, trait }   // re-voices LIVING's p.line ("owes X money" → "owes X three knots")
```
**Keys (all exported):** `WORLD_NOTES` (105 LIVING event ids, 4–5 lines each, plus 6 case pools), `WORK_NOTE_KEYS` (`life.work.<tradeId>` × 75, 4–5 each), `LIFE_NOTES` (25 activities: queue liftDown break wash tavern family chapel market × 10; service well visit rounds sell school eat pay × 6; liftUp play beg mourn shelter preach drill tend work × 4), `CALENDAR_DAYS`, `WEATHER_DAYS` (dawn × 6, turn × 6), `NIGHT_LINES`, `EFFECT_WHY`, `EFFECT_SOURCE_WHY`, `TRAIT_LINES`, `PLACE_WORDS`, `LIVING_NOTE_ALIAS` (a verbatim copy; `NOTE_ALIAS` = it + the writer's 17 retired ids).
**Slots** for event notes are name, name2, place, n, child, c, back, r1, r2 and list (built from b…f). Life notes take name, name2 and place. A variant whose slots are missing is skipped. 'someone' and 'a neighbour' count as missing.
**Place words.** `PLACE_WORDS` re-voices LIVING's place names in notes: the bakehouse becomes the cake ovens, the chandlery the fuel-cake yard, the pawn shop the knot-lender's, the alehouse the cap-beer shed, the gate inn the gate lodge, the scriptorium the cord room, the ropewalk the cord walk, the stables the beast pens, and the graveyard the burning ground. It stays until LIVING renames them at source.
**Theme guard.** `tests/content/theme.ts` holds the forbidden list from §10 (about 180 human-world words and phrases). The test scans every string every content module exports. LIVING, SIM, HUD and FEEL may import `forbiddenIn(s)` for their own text.

### Round 4 status
- Done. Theme sweep of all of src/content: roles farmer → Gardener, soldier → Guard, gravedigger → Ash keeper; trades renamed, e.g. ratcatcher → skitter catcher; gem base "Bell" → "Bowl"; crystal name pools re-voiced.
- Done. LIVING merged: 105/105 ids with own pools; aliases merged; case pools.
- Done. 75 trades × ≥ 4 work notes.
- Done. Life pools, effect reasons (13 kinds + 35 source lines), person cards (8 traits × 3), calendar / weather / dusk / night.
- Tests: `tests/content` 98 green (13 new in theme.test.ts), tsc clean for my paths.
- A real fortnight (seed 1) through the notebook has 0 fallbacks, 0 forbidden words and 0 lines twice in a week. `scripts/writing-week.ts` over 21 days for seeds 2–5 also has 0 repeats in a week.
- Sample: `handoffs/WRITING-sample.md` (seed 1, 7 days) — `npx tsx scripts/writing-week.ts 1 7 --stats --md handoffs/WRITING-sample.md`.

### Round 4 self-grade: 8/10
The sample reads like one people in one bowl. It has burnings, hearths, chits, cap-beer, eel, shard-lamps, the levy and the inspector, with chains that carry across days (old Lalt dies → is burned; the midwife → a child → its wick lit at the chapel). There is no human-world word and no line twice in the week.

It is not 9 for three reasons:
- Work notes appear only because the script adds them; LIVING does not emit them yet.
- Several of LIVING's place names fight the notes ("the old face by the grave", "down the rail junction").
- A few trade lines are still flat ("Tube works the bellows at the forge").

### Requests (round 4)
- **LIVING**
  - Emit `life.work.<tradeId>`, or `life.work` with `slots.tradeId`, about 3 a day for people seen at work; the key list is `WORK_NOTE_KEYS`. Also emit `life.liftDown` and `life.liftUp`.
  - Send `slots.outcome` for paySettled (`unpaid`), inspectorLeaves (`bad`), childFound (`mine`), smuggleRun (`fog`), washGossip (`follower`) and procession (`rain`). Until then the case is guessed from the fallback text or place.
  - Rename places at source:
    - bakehouse, chandlery, pawn shop, alehouse, gate inn, scriptorium, ropewalk, stables and graveyard (see PLACE_WORDS);
    - "the old face by the grave": the dead are burned, so there is no grave.
  - Drop the human words in fallback texts and trade lines: bread/bakehouse, coat and pot, needles and sweets, wagons, letters, the soldier trade, candles, rope, coffins, boots, horses, money, bell ringer.
  - `person.line` should say "owes X three knots", not "owes X money" (re-voiced on our side for now).
  - The `refugees` slot `b` carries an id (p123), not a name (filtered on our side).
- **SIM**
  - Display names still say 'the graveyard', 'Farmer', 'Soldier', 'Gravedigger' and the gem base 'Bell'. Content uses the burning ground, Gardener, Guard, Ash keeper and Bowl (tests map them in `THEMED`).
  - maps.ts: "The town buries its dead shallow".
  - discoveries: "graves", "Soldiers drill".
  - roles: "Buries the town's dead…".
  - Old rulings not yet applied: Grafter → "Stone Wedding"; the Gemcutter fallbacks.
- **HUD / FEEL**
  - Read notes through `createNotebook(runSeed).feed(item)`. src/feel/notes.ts still shows `item.text`.
  - Show the top 2–3 `text.effectWhy(e, placeName)` lines as "Today".
  - Use `text.personLine(p.line, p.trait, p.name)` for person cards.
  - Use `text.night(dayIndex)` for the night's first line, and `text.duskDay(kind, dayIndex)` for dusk.

## LIVING TEXT — the lived-in world (spec v2.1 §5b, DECISIONS §16; binding, additive)

`src/content/living.ts`. Keyed by LIVING's ids as plain strings (TradeId, WeatherKind, CalendarKind) and by `FeedItem.textKey`.
A note says what happened and where, ≤ 70 characters with a long name and place (tested), ≤ 74 at the longest place.

```ts
import { text, createNotebook } from '../content';
// ---- the day's notes ----
const notes = createNotebook(runSeed);        // one per run: each key walks all its variants before repeating one
notes.feed(item: FeedItem): string            // { textKey, slots, text } → our line, or item.text if the key is unknown
notes.note(textKey, slots?): string           // same, from a key
text.note(textKey, slots?, seed?): string     // stateless (variant from the seed); '' for an unknown key
text.noteVariants(textKey): readonly string[]
//   textKey families:  'event.<kind>'  66 world events × 3 variants (EVENT_NOTE_IDS below)
//                      'sim.<kind>'    the sim's own Day events: strike.dull|clear|bright|deep|royal|impossible, kept, carted,
//                                      skimmed, count.full|short|searching, search.clean|found, tribute, offerWalk, offerSpotted,
//                                      followerEvil, moved, lift, converted
//                      'life.<activity>' market tavern chapel wash family visit play beg mourn queue rounds shelter
//                      'weather.<kind>' / 'calendar.<kind>'  a morning note for the day's weather / calendar day
//   slots: name (who), name2 (a second person), place (a place name, "the well"), n; LIVING's who / who2 / where also work.
// ---- trades, days, weather ----
text.trade(id: TradeId): { name /* "lift winder" */; plural; line /* what they do */; gift /* what they can do for you */ }   // all 75
text.calendar(kind: CalendarKind): { name /* "The Flame's day" */; line; rule /* "Half the diggers go down; the Temple watches closer." */ }
text.weather(kind: WeatherKind): { name; line; rule /* "Guards and searches see less." */ }
text.duskDay(kind: CalendarKind, seed?): string   // the dusk ledger's first line for the day kind (text.dusk(where, turn) is unchanged)
```
Event kinds drafted against spec §5b (LIVING's `EVENT_KINDS` not yet published): wedding birth funeral death sickness recovery
lostChild childFound courtship quarrel reconciled newcomer leaving brawl debtCalled theft drunk gambling feud fire rumour
ghostStory propCollapse injury sickBeast rats flooding gas liftJam cartBroken newSeam overseerDrunk guardRotation guardBribed
inspector payStrike strikeEnds cartsLeave peddler caravan warNews conscription soldierHome marketBustle breadPrice wellFoul
festival procession preacher sermon alms bellCracked washday childrenPlay dogLost smuggler arrest councilNotice tavernSong
apprentice promotion dismissed fortune sleepwalker strangeLights missing.
**LIVING:** use these as your kind ids where they fit; for any id of yours that differs, tell WRITING and it goes into
`NOTE_ALIAS` (`'event.yourId': 'event.ourId'`). Anything unmapped falls back to your `text`.

## ROUND 3 INTERFACE — spec v2: mining, long-tail crystals, crafting by facility, items (binding, additive)

Builder: WRITING round 3. Keyed by the sim's v3.1 ids (`handoffs/P4.md` "v3.1 CHANGES"; tables in `src/sim/content/gems.ts`, `src/sim/types3.ts`). Content still imports nothing from `src/sim`; tests read the sim's tables at runtime and check every id has text.
Player words: a modifier is a **line** on the stone ("Add a line", "3 of 4 lines"); a curse is a **cursed line** with **a price**; "1 in N" is the rarity number; the sim's `deep` is still "Blazing".

```ts
// ---- crystals v3.1 (src/content/gems.ts) ----
text.affinity(id: AffinityId): { id; name; word /* "dense" */; line; details; leans }   // the spec's 9, incl. flame (sim v3.1 AFFINITY_IDS)
text.flame(key: 'hallowed'|'price'|'profaned'|'quarrel'|'profanedName', slots?): string   // Flame's special lines
text.resonance(affinity, count: 2 | 3): { title; line; details }    // two of a kind / three wake a set power
text.base(id: BaseId, inherent?): { id; name; line; inherent; details }   // all 35 sim bases; a drift test keeps BASE_MIRROR equal to the sim's table
text.mod(m: { id: ModId; tier?: 1..5; value?: number; curse?: boolean }): { id; name; word; line; tier; price: string | null; details }
text.modTier(tier): string                       // Faint, Fair, Strong, Fierce, Perfect
text.oneIn(n: number): { text /* "1 in 48,000" */; word /* "Very rare" */; line /* spoken */; scale: 0..6 }   // Everyday <25, Unusual <250, Scarce <2,500, Rare <25,000, Very rare <100,000, Once in a run <1M, Never seen
text.tailReveal(n: number, variant?): string | null   // spoken over a stone at 1 in 250 or rarer; null below
text.crystalName(seed, rarity, effect?, extra?: { base?, affinity?, mods?: (ModId | {id})[], oneIn? }): string
     // OR text.crystalName({ seed, rarity, base, affinity, mods, effect, oneIn }) — the generator on base + affinity + grade + lead line + effect
text.crystal({ seed, rarity, base?, affinity?, mods?: {id,tier?,value?,curse?}[], slots?, effect?, oneIn?, curse?, facets?, stats?/*old*/ })
     : { name; title /* "Bright tooth · Hunger · 1 in 340" */; lines; effect; details; oneIn; base; affinity; price: string[] }
// ---- crafting (src/content/craft.ts) ----
text.enchant(p: { name; cost; open?: number; slot?: ModId | null; affinity?; curseOneIn? }): { title; line; confirm; risk; details }
text.enchantResult(kind: 'added'|'changed'|'curse', slots, variant?): string
text.recombine(p: { a; b; baseA; baseB; baseOdds; affA; affB; affOdds; grade; up; cap }): { title; lines: string[]; confirm; warn }
text.recombineResult({ name, a, b, graded }, variant?): string
text.facility(id: FacilityId | 'vault'): { id; name; building; master; craft; verb; line; locked; lockedLine; gained; details }
text.facet(p: { name; cost }): { title; line; pick }     text.facetChoice(c: { kept: number; dropped: number; change: number /* ×0.8–1.4 */ }): string
text.jewel(form: 'ring'|'amulet'|'circlet'): { name; line; gift }   text.craftItem(kind: 'weights'|'relic'|'draught'): { name; verb; line; worn; gift; done }
text.item(p: { kind; form?; crystalName?; heat?; curse?; wearer? }): { name /* "Widow's Fang Ring" */; title /* "Ring · cursed" */; line; worn; warn; warnDetails; gift }
text.give(p: { item; to; follower; gift?: boolean }): { label; line; done }   text.takeBack(p): { label; done }
text.exposure(slots, variant?): string           // the search finds an item on a follower
// ---- mining (src/content/mining.ts) ----
text.depth(d: 0..3): { name; line; sealed? }    text.vein(level: 1..15): { text /* "Vein 2 · the lower workings" */; line }
text.mineTier(t: 1..5): { name; short /* "Tier I — the lowest" */; line; tease }
text.routine(id) also: 'delve' | 'skim' | 'preach' | 'standWatch'
text.rankUnlock(rank: 1..6): { rank /* "Whisper II" */; title; line; once }   // once-only announcement per minor rank (§8)
text.tribute(kind: 'tribute'|'contributed'): { label /* "Brought unasked" | "As you asked" */; line }
// ---- urges and the opposition (src/content/mining.ts) ----
text.urge(id: 'hungry'|'starving'|'starved'|'starvedAlone'|'restless'|'seething'|'lashingOut', slots?, variant?): { title; line }
text.answer(faction: 'council'|'temple'|'public' (|'government'|'cult'), rung: 0..3, slots?): { title; line; chronicle; means }   // §10 ladders
// ---- voice (per run) ----
voice.chronicle(ev): + enchanted recombined facetOffered faceted itemMade itemGiven itemTaken itemExposed facilityGained kindled tithed vaultOpened crystalLost, offered{tribute}
voice.react(person, + 'tribute' | 'tailFind' | 'exposed' | 'neighbourWears')
voice.reveal(rarity, crystal?: { seed, effect?, oneIn?, base?, affinity?, mods? })   // tail finds use the "1 in N" lines
```
Exported lists: `AFFINITY_TEXT_IDS`, `BASE_TEXT_IDS`, `MOD_TEXT_IDS`, `CURSE_TEXT_IDS`, `MOD_TIERS`, `ONE_IN_SCALES`, `FACILITY_IDS`, `RANK_UNLOCKS`, `ANSWERS`, `URGE_TEXT`, `REACT3_KINDS`, `LEDGER31_KINDS`.

### Retired (round 3)
`text.cut`, `text.cutResult`, `text.graft`, `crystalAct('cut' | 'graft')`, HUD words `rough` / `roughLine`, unlocks `cut` / `graft`, guide beats about rough stones, cutting and grafting (the HUD calls these through a guarded adapter: missing = its stand-in). Cut choices became Faceting text (`text.facet`, `text.facetChoice`). Reason codes `cutPending isRough notRough graftCap graftSame nothingToGraft lineTaken` keep a plain line (never emitted).

### Round 3 status (update after every milestone)
- [x] M1 gems.ts (affinities, resonance, bases, modifiers, curses, 1 in N, tail reveals, name generator) + tests (`tests/content/v31.test.ts`, 73 pass); rough / cut / graft strings retired; Gemcutter / Grafter (shown "Stone Wedding") re-pointed
- [x] M2 `craft.ts` (enchant, recombine, 5 facilities + vault, faceting, jewelry, cursed items, give / take back, exposure), `mining.ts` (depth, vein, mine tiers, tribute labels, rank unlocks, urges, the §10 answer ladders — `text.urge` / `text.answer` live here, not in a pushback.ts), `loop.ts` (Delve / Skim / Preach / Stand watch, 8 new reason codes, guide re-cut to §11, new unlocks, HUD words)
- [x] M3 `ledger31.ts` (13 new event kinds + tribute + dusk-ledger lines), `reactions.ts` (tribute / tailFind / exposed / neighbourWears × 8 temperaments + crowds), tail-aware `voice.reveal`; round-2 strings re-checked (rarity Details by spec grades; no rough / cut / graft left in player text). 76 tests pass.
- [x] M5 the lived-in world (DECISIONS §16): `living.ts` — 66 world events × 3 (198 lines), 21 sim Day-event notes, 12 life notes, 75 trades, 5 calendar days, 8 weathers, dusk ledger by day kind; `Notebook`; `tests/content/living.test.ts` (8 tests; 84 content tests pass)
- [x] M4 sample: `tests/content/sample31.ts` → the round-3 section at the top of `handoffs/WRITING-sample.md` (40 real-roll crystal cards incl. 18 at 1 in 10,000 or rarer with "1 in N", every scale, 9 affinities + resonance, 30 bases, a page of lines + every curse, every craft and facility, items / give / exposure, mine words, rank unlocks, urges, answer ladders, the first three nights with day notes, a week of notes, every event, trades, calendar, weather). `scripts/content-sample.ts` rewritten for v3.1: a real seeded 5-night run (appended to the section).
- Fixes found by the real run: "the The …" after an article (`theName`), the count's decimals rounded, plural places ("Yours now: the bunks"), tribute no longer double-counted at dawn, enchant lines keep "Nether" capitalised, ring/amulet reactions now say "the jewel", `wornFull` used a missing `{they}` slot, `delve` / `skim` unlock words, Jewelry → Jewellery.

### Round 3 self-grade (rule 13): 8/10
What earns it: every sim id in v3.1 (9 affinities, 35 bases, 92 lines incl. 8 curses, 12 strange; 6 facilities) has words, with numbers and prices that are tested against the sim's tables. Names hold up over 5,000 real rolls. The tail finds read as events ("1 in 8.1 billion. Nobody has ever held one. Now you do."). There are 198 day-note lines, none over 70 characters, and a week never repeats. 84 content tests pass.
What holds it at 8: the three nights are scripted, not played (the real run shows the v3.1 Day mostly but with a naive policy). Living notes are drafted against spec §5b until LIVING publishes its EVENT_KINDS. Resonance set powers and the Flame's nightly price are words ahead of the rules. A few base Details lean on the sim's numbers via a mirror rather than live reads.

### Requests (round 3)
- **SIM:** rename the blessing 'Grafter' → "Stone Wedding" in your fallback text; the 'Gemcutter' / hoard fallbacks still say cutting / grafts / rough. No set power yet for 3-of-a-kind (text proposes names via `text.resonance(id, 3)`). No Flame nightly price / profaned flag (text slots n = 1). Routines `delve` / `skim` / `preach` / `standWatch` need to be in RoutineId for `text.routine`. Put `oneIn` (and base / affinity / mods) on the crystal that `ctx.crystal(id)` returns, so tail reveals and "the find of the day" fire. Fractional `tally.expected` is shown rounded.
- **HUD / PLAY:** call `text.crystalName` with the extra { base, affinity, mods, oneIn }; give the ledger `ctx.item(id)` so item lines name the jewel; take the facility rows from `text.facilityRow(id, owned)`; the day film's notes come from `createNotebook(runSeed).feed(item)`, the morning line from `text.calendar` / `text.weather`, and the dusk line from `text.duskDay(kind)`.
- **LIVING:** publish `EVENT_KINDS`; use our event ids where they fit (list above) or send the differences for `NOTE_ALIAS`; slots `name` / `name2` / `place` (a place *name*) / `n` (or `who` / `who2` / `where`). `MINE_EVENT_IDS` lists the events written for a gallery.

## ROUND 2 INTERFACE — the crystal loop (DECISIONS §15; binding, additive)

Builder: WRITING round 2. Additive to the round-1 API below (except the retired Send strings, see "Retired").
Keyed by the sim's v3 ids (`handoffs/P4.md` "v3 API contract"; rules in `src/sim/crystals.ts`, `src/sim/content/cards.ts`, `src/sim/content/bonuses.ts`).
**Players read "the count", never "Tally"** (retired name, §13.3). `text.tally` keeps the code name.

```ts
import { text, createVoice } from '../content';
// ---- crystals ----
text.rarity(id: RarityId | number | 'blazing'): { id; tier; name; value; line; details }   // Dull Clear Bright Blazing Royal Impossible ('deep' → "Blazing")
text.rarities(): RarityText[]
text.crystalName(seed, rarity, effect?: OddEffectId | null): string   // stable per seed; the effect swaps one word ("Widow's Lamp" → "Widow's Double")
text.crystal({ seed, rarity, effect?, rough?, stats?: {id,value}[], cracked?, flawed?, grafts?, maxGrafts? })
     : { name; title /* "Bright crystal · rough" */; lines: string[]; effect: OddText | null; details }
text.statLine(id: StatLineId, value): string      // "+2 Nether each night", "All heat 6 % lower", "+1 action each night" ('' for unknown ids)
text.statName(id): string
text.oddEffect(id: OddEffectId, slots?): { id; name; line; details }   // Details numbers default to the sim's EFFECT values
// ---- cards ----
text.card(id: MiracleId | EvilId, slots?): { id; kind: 'miracle'|'evil'; name; line; cost; flavour; details; target; pick }
     // cost: "Burn 4 worth of crystal" / "Hunger −35 · Malice −12 · the Public and the Temple notice"; pick: "Pick a place." etc.
     // pass { cost } from cardView for Shade's ×1.5; other slots override the Details defaults
text.cardCost(cardView): string                   // "Burn 4 worth of crystal" | "Hunger −40 · Malice −20 · Public heat +6"
text.blessing(id: BlessingId, slots?): { id; name; line; flavour; details }
text.hand('miracle' | 'evil'): { title; line; skip; empty }
// ---- followers ----
text.routine('pray' | 'offer' | 'lieLow'): { id; label; line; crystals; status }
text.move({ name, place, chance: 0..1 | 'likely'|'risky'|'unlikely', why?: MoveWhyKey | string, cost, their? }): [string, string]
     // "Ask for Ket to be moved to the crystal gallery?" / "Risky · 45 % · off his path · 1 action"
text.moveWhy(movePreview /* {offPath, far} */ | MoveWhyKey | ReasonCode, slots?): string   // keys: onPath near offPath far guarded full
text.moveResult(ok, { name, place, them? }, variant?): string
text.ap('left' | 'none' | 'cost' | 'free' | 'gain' | 'intro' | 'more', { n }?): string      // "No actions left tonight"
text.reason(code: ReasonCode): string | null      // all 38 v3 reason codes; text.why(sentence, slots, code) now tries these first
// ---- the count and searches ----
text.tally(tallyView | { expected, counted, short?, tolerance?, word?, level? }): { name; word; line; council; next; details }
     // line: "Expected 14 · counted 11 · 3 short"; word = the sim's word (Content / Grumbling / Counting twice / Searching)
text.tallyLevel(0..3): { word; council; next }
text.search('announced'|'clean'|'found'|'caught'|'taken'|'lyingLow', { name, n?, them? }, variant?): string
// ---- the grave ----
text.offering({ names, count, best? }): { title; lines }
text.crystalAct('eat'|'burn'|'set'|'unset'|'cut'|'graft', { hunger?, value?, cost?, name?, card? }): { label; line; done }
text.cut({ name, nether?, crack?, flaw? }): { title; line; pick; risk; riskDetails }
text.cutResult('clean'|'crack'|'flaw', { to?, effect? }, variant?): string
text.graft({ from, to, what, left }): { title; line; confirm; left; done }
text.sockets({ used, max }): string               // "2 of 3 set"
text.hud('ap'|'inventory'|'sockets'|'stash'|'stashNone'|'caught'|'echo'|'value'|'totalValue'|'rough'|'roughLine'|'odds', slots?): string
// ---- goals and guidance ----
text.goal3('mine'|'surface'|'grow'|'feed'|'crystal'|'count'|'town'|'gate', slots?): string
text.guide3(): { id; night: 0|1|2|3; when; title; body }[]   // nights 1–3 (strike → dusk → decide), then just-in-time (night 0);
     // `when` = 'night' | 'day' | an event kind ('strike','offered','dealt','cut','tally','search','followerEvil','blessingOffered','ravenous')
     //          | a reason code ('noAp','noSocket') | an unlock id ('routines','miracles','graft') | 'rare'
text.unlock3(id: UnlockId): { title; line }      // v3 unlock ids; falls back to round-1 unlocks
text.ui('area.special.count' | 'area.face' | 'area.noFace', …)   // new area-panel words (areaLine maps the sim's new sentence)
// ---- per run ----
const voice = createVoice(seed);
voice.chronicle(ev, ctx)   // + every v3 event kind (see LEDGER3_KINDS / LEDGER3_SILENT in ledger.ts); ctx.crystal?(id) → { seed, rarity, effect } lets lines name stones
voice.daySummary(events, ctx)   // ≤ 3 lines, now with the search, the count, the offering, kept crystals, followers' own evil
voice.react(person, 'found'|'foundRare'|'offered'|'short'|'searched'|'caught'|'neighbourEvil'|'moved'): string   // by temperament; crowds too
voice.reveal(rarity, crystal?: { seed, effect? }): { name; line }   // spoken as each stone is set down at dusk: "Bright. Someone hid that well."
```
Exported lists: `RARITY_IDS`, `STAT_LINE_IDS`, `ODD_EFFECTS`, `MIRACLE_CARDS`, `EVIL_CARDS`, `BLESSINGS`, `ROUTINE_IDS`, `REASON_CODES`, `REACT_KINDS` (from `src/content`).

### Retired (round 2)
Removed (nothing outside `src/content` used them): `text.sendPreview`, UI keys `btn.send`, `btn.sendConfirm`, `btn.recall`, every `send.*`, unlocks `send`, `recall`, `intent:*`, guide beats `beat.send` (now `beat.offer`) and `hint.sendMode`. Deprecated, kept: `text.task` / `TASKS` (use `text.routine(id).status`), the ledger lines for `sent` / `recalled` (no longer emitted). The HUD's own `src/ui/play/words.ts` still has `send.*` words (HUD's file).

### Round 2 status (update after every milestone)
- [x] M1 `src/content/crystals.ts` (rarities, name generator, stat lines, odd effects), `cards.ts` (17 miracles, 13 evils, 20 blessings, hand), `loop.ts` (routines, Move, actions, 38 reason codes, the count, searches, offering, eat/burn/set/cut/graft, goals, guide for nights 1–3, unlocks, HUD words), `reactions.ts` (8 kinds × 8 temperaments + crowds), `ledger.ts` (v3 chronicle + dawn summary); wired into `index.ts` / `chronicle.ts`; `tests/content/v3.test.ts` + `corpus3.ts` + `rules.ts`.
- [x] M2 text aligned to the sim's real rules and numbers (`src/sim/crystals.ts` ODD_EFFECTS/EFFECT/STAT_LINES, `src/sim/content/cards.ts`, `src/sim/content/bonuses.ts`); a test now checks names, targets, costs, Malice and Hunger against the sim's tables at runtime.
- [x] M3 Send/intent/recall strings retired; `tests/content/sample3.ts` → `WRITING-sample.md` round-2 section; self-grade below. `npx vitest run tests/content`: 60 pass (2 files).

### Round 2 self-grade: 8 / 10
Read `handoffs/WRITING-sample.md` (round 2) cold as a new player: the loop comes through from the words alone. Three rough crystals are "your food and your money"; whisper; set the follower to Offer; a glint is a strike and "your followers keep theirs"; at dusk each stone is revealed with a line; then eat, cut, set or burn; the count is "missing what your followers keep" and the Council searches when it runs short; lie low is the answer. Every contract id has text (tested against the sim's own tables at runtime), and every line passes the length, jargon, spelling and reading-age rules.
What a hostile critic would still say, and what to do:
1. The sample's three nights are scripted v3 events, not a seeded sim run (the v3 sim would not load yet). Next: swap `tests/content/sample3.ts` onto `createGame`/`endNight` once SIM-v3 M2 lands.
2. A few cards and effects read alike because the sim's rules are alike (Sabotage vs Rob the Cart; Prophet = Third Hand; Loaded = Second Chance). That is a design request for SIM, not a wording fix.
3. Night 1 has six guide beats (three at nightfall, three triggered). The HUD should show one at a time; if playtests find it heavy, `n1.crystals` can merge into `n2.decide`.

### Round 2 requests
To SIM (`src/sim`):
- `deep` is shown as **Blazing**; please use `RARITY_NAME.deep = 'Blazing'` in fallbacks so the two never disagree.
- Fallback strings still say "Tally", "Devotion", "Resistance", "AP", "action point" (crystals.ts STAT_LINES/ODD_EFFECTS, cards.ts lines): retired or jargon in player text. Ours replace them; keep yours plain if they are ever shown.
- `tallyView.word` values are keyed exactly ('Content', 'Grumbling', 'Counting twice', 'Searching'); tell WRITING if they change.
- Export `STAT_LINE_IDS`, `ODD_EFFECT_IDS`, `MIRACLE_IDS`, `EVIL_IDS`, `BLESSING_IDS` from `src/sim/index.ts` too (the content test reads them from their modules today).
- Please give `evilPlayed` a `zone` when its target is a person (the ledger names the place; `followerEvil` already has one).
To HUD / PLAY:
- Card text from `text.card(id, { cost: view.cost })`; cost line `text.cardCost(view)`; blockers `text.why(view.why, undefined, view.code)`.
- Pass `ctx.crystal(id)` to `voice.chronicle` so lines say "the Widow's Lamp", not "a Bright crystal".
- Crystal name: `text.crystalName(c.seed, c.rarity, c.rough ? null : c.effect)` (rough stones do not show their effect yet; the name keeps all but one word when it appears).
- Guide: `text.guide3()`; show a beat the first time its `when` happens on its night (0 = any night).

## PUBLIC INTERFACE (binding; additive changes only)

`src/content/` is pure data plus tiny deterministic pickers. **It imports nothing from `src/sim`**: everything is keyed by plain strings (zone ids, unit ids, role/trait ids, event kinds). Every string it returns is already typeset (curly apostrophes, real dashes) and in British spelling with -ize (Oxford: colour, grey, terrorize).

```ts
import { text, createVoice, UI_KEYS, WHY_CODES } from '../content';      // src/content/index.ts
// types also exported: ChronicleLine, NameCtx, PersonRef, AnyEvent, Tone, PersonText, PersonInfo, Tie, EnemyText,
// MomentKind, Temperament, PlaceText, UiKey, WhyCode, StatId, GuideBeat, PowerText, EventText, Slots, Text

// ---- stateless lookups (pure) ----
text.ui(key: UiKey, slots?: Slots): string                 // every interface string; UiKey = keyof UI, so unknown keys fail to compile
text.has(key: string): key is UiKey
text.stat(id: StatId, slots?: Slots): { name; intro; details }   // 'ichor'|'hunger'|'nether'|'crystals'|'danger'|'malice'|'level'|'faith'|'colour'
text.why(simWhy: string | null, slots?: Slots, simCode?: string | null): string | null
                                                           // the sim's blocker sentence (or its whyCode, more reliable) -> a plain "you can't" line; null passes through
text.whyCode(simWhy: string | null): WhyCode | null        // the code behind a sentence (see WHY_CODES)
text.sendPreview(p: { name: string; intent: string | null; place: string; days: number; cost: number; ok: boolean; why?: string | null }): [string, string]
                                                           // two short lines: "Ket will explore the west tunnel." / "There in 2 days · 4 Nether · finds what it hides"
text.place(zoneId: string): PlaceText                      // { id, name, district, districtName, seen, yours }
text.district(id: string): { name; seen; yours }
text.discovery(zoneId: string, kind: string, seed: number): { hint; reveal; title }   // kind: cache|seam|loner|shortcut|relic|danger|none
text.person(id: string, seed = 0, info?: PersonInfo): PersonText
    // { id, line, wants, fears, ties: Tie[], temperament } — hand-written for every named id (g01–g28, t01–t30, c01–c20, e01–e05, Wen, Sefa, Hob),
    // generated by seed for anyone else (info = { name, role?, trait?, zone?, kind? } required then)
text.ties(): readonly Tie[]                                // { a, b, kind: 'kin'|'close'|'love'|'owes'|'odds'|'rival', line }
text.enemy(kind: string): { name; job; does; threat; line }   // 'auditor'|'cantor'|'guard'|'overseer'|'priest'|'soldier'
text.miracle(id: string, slots?: Slots): PowerText         // { id, name, line, line2, details (slots filled), evil }
text.bonus(id: string, slots?: Slots): PowerText
text.evil(act: string, slots?: Slots): PowerText           // 'terrorize'|'sacrifice'|'desecrate'
text.event(id: string, slots?: Slots): EventText | null    // { id, title, body, options: [{ label, consequence, outcome, outcomes }], effect, outcome, outcomes, proposed }
text.faction(track: string)                                // 'cult'|'government'|'public' -> { name, who, levels: [{ word, notice, why, next }] x5 }
text.factionAction(id: string, slots?: ActionSlots): { title; text }
text.hunter(kind: string, moment: 'arrive'|'leave'|'buried', where: 'mine'|'town'): string
text.level(level: number): { title; line; gain }           // 2..7
text.levelTitle(level: number): string
text.stage(slots?: { merged?: number; apostles?: readonly string[] }): { title; lines: string[] }   // the pull-back moment
text.surface(slots?: Slots): { title; lines: string[] }    // the first one of yours reaches the town
text.defeat(cause: string, where: 'mine'|'town' = 'mine'): { title; lines: string[] }
text.ending(route?: string | null): { title; lines: string[]; button }   // route 'keep'|'temple'|'market'|null
text.guide(): readonly GuideBeat[]                         // { id, title, body, beat?: 1|2|3 } — first-night beats + just-in-time intros
text.unlock(id: string): { title; line }                   // every UnlockId
text.task(kind: string, slots?: Slots): { verb; doing }    // 'Exploring' / 'explores the west tunnel'
text.role(id: string): { name; plural; line }
text.trait(id: string): { name; line; details }
text.areaLine(simLine: string): string                     // one of the sim's areaPanel lines in our words
text.devotionWord(value: number): string                   // Doubting / Listening / Faithful / Devoted / Yours entirely
text.dusk(where: 'mine'|'town', turn: number, seed = 0): string   // never the same line two nights running

// ---- stateful, per run (deterministic from the seed and the call order) ----
const voice = createVoice(seed: number): Voice
voice.pick(key: string, variants: readonly string[], slots?: Slots): string   // never the same variant twice in a row for a key
voice.moment(person: PersonRef, moment: MomentKind): string   // heard|refused|turned|afraid|devoted|caught|grieving|sent|lyingLow|lost
voice.chronicle(ev: AnyEvent, ctx: NameCtx): ChronicleLine | null   // { text, tone: 'good'|'bad'|'warn'|'info'|'violet', focus? } or null when not worth a line
voice.daySummary(events: readonly AnyEvent[], ctx: NameCtx & { turn: number }): { title: string; lines: string[] }   // <= 3 lines
interface NameCtx { name(unitId: string): string; person?(unitId: string): PersonRef | undefined; follower?(unitId: string): boolean }
interface PersonRef { id: string; name: string; trait?: string; kind?: 'person'|'group'|'elite' }
type AnyEvent = { kind: string; [k: string]: unknown }
```

Slots: `{name}` plain, `{^name}` capitalised first letter, `{n|crystal|crystals}` plural by number. In moment lines `{their}` `{them}` `{themself}` are filled from the person's pronoun set (named people: she / he / they as their own text uses; generated people, groups and crowds: they). Subject "they" is plain text.

### Key lists (exported)
- `UI_KEYS` (every `UiKey`) and `WHY_CODES` from `src/content` (`index.ts`).
- In the modules, for tests and tools: `CHRONICLE_KINDS` (event kinds that get a ledger line) and `CHRONICLE_SILENT` (kinds left out on purpose) in `chronicle.ts`; `MOMENT_KINDS`, `TRAIT_OF`, `PEOPLE`, `LONERS`, `TIES`, `ENEMIES`, `PRONOUN_SLOTS` in `people.ts`; `FIND_KINDS`, `FIND_POOL`, `FIND_KIND_OF`, `PLACES`, `DISTRICTS` in `places.ts`; `MIRACLES`, `BONUSES`, `EVIL_ACTS` in `powers.ts`; `EVENTS` in `events.ts`; `TRACKS`, `FACTIONS`, `ACTIONS`, `HUNTERS` in `factions.ts`; `LEVELS`, `DEFEAT_CAUSES` in `story.ts`; `ROLE_TEXT`, `TRAIT_TEXT` in `roles.ts`; `UI`, `STATS`, `WHY`, `SIM_WHY`, `TASKS`, `DUSK`, `GUIDE`, `UNLOCKS` in `ui.ts`.

## Status
- [x] people, places, discoveries
- [x] ui keys, why codes, send previews, guide beats
- [x] chronicle + day summary
- [x] powers, events, factions, level/defeat/ending
- [x] tests/content + scripts/content-sample.ts + WRITING-sample.md (`npx vitest run tests/content`: 34 pass; `npx tsx scripts/content-sample.ts 7 5` regenerates the sample)
- [x] pronouns: `pronoun?: 'she'|'he'|'they'` on every named person's text; moment lines fill `{their}` `{them}` `{themself}`

## Requests
To SIM:
- Rename the minehead discovery loner Hob (duplicates t01 Hob).
- Drop "crest", "three eyes", "zone", "Resistance" from fallback strings.
- Call `text.discovery(zone, kind, seed)` at createGame so hints vary by seed.
- Consider the six proposed town events and the proposed faction actions.
- Give events such as `ravenous` and `taken` enough fields for `whyCode`.

To HUD/PLAY:
- Consume `text.*` and always pass `whyCode` to `text.why`.

## Self-grade
Self-grade: 8 (text, tests, API)

Three weakest spots:
1. Generic `GROUP_GEN` lines: crowds without a hand-written card fall back to two stock lines.
2. Repetitive "set off to explore" ledger rows when many followers are sent in a run.
3. A flat dawn-summary line when little happened ("A quiet day. The colour crept on anyway.").

## Follow-up (after LIVING's follow-up) — done
- `text.trade('fence')` is now "stone broker" / "stone brokers". All 75 trade ids: name and plural equal LIVING's own `TRADES` (tested), 4–5 work notes each.
- `life.liftUp` 4 → 12 variants, `life.liftDown` 10 → 12 (slots name, place; ≤ 80 characters with the longest name and place). Eight days of daily use never repeat a line (tested).
- Outcomes: `keyOf` reads `slots.outcome` first and ignores the fallback text when it is present (`OUTCOMES` is exported: `paySettled` paid|unpaid, `inspectorLeaves` good|bad, `childFound` town|mine, `smuggleRun` clear|fog, `washGossip` plain|follower, `procession` dry|rain). The plain outcome reads the base pool, the second reads `<key>.<outcome>`; 4 variants each way. The old text guess stays for items with no slot.
- `PLACE_WORDS` is now `{}` (the export stays). LIVING's place names carry the theme words themselves.
- Tests: `tests/content/followup.test.ts` (10): every trade id, key and slot over 60 days × seeds 1–3 resolves, no raw key, no fallback; outcome lines agree with the slot (marker regexes on both sets); no line twice within 3 days over 14 days × seeds 1–3; `forbiddenIn` over all of it. `npx vitest run tests/content tests/living` 146 green; tsc clean for src/content and tests/content.
- Nothing LIVING emits is without text. Unmapped keys over the three runs: none.
