# Hungry God Inc. — Gameplay Spec

Living version (with charts): https://claude.ai/artifact/NPHiuvmPoWa9NXTr6Au6hF
As of 2026-11-23 (version 2.1: the mining loop in a living world).

How to read this: **[Owner]** = said by the owner, binding. **[Spec]** = from the first version of this spec, approved. **[Design]** = worked out to make the owner's intent playable; open to the owner's correction, binding on builders until corrected. Exact tuning numbers live in `DECISIONS.md` (the sim's tables) and `BALANCE.md`; the numbers here are targets.

## 1. Overview
[Spec] Turn-based strategy game in the style of Plague Inc. You play an evil god descended upon an alien civilization that is at war with another civilization.
- Progress by influencing people with evil powers and performing evil miracles.
- Main power source: consuming soul crystals (crystallized souls) that the civilization mines up.
- Start inside one civilization; once you take it over, the game becomes a campaign across the universe.
- Start as a fallen, weak god influencing the lowliest people one by one; zoom out until you control civilizations.

[Owner] **The entire game is about mining.** The core loop is mining crystals. Crystals have rarity, are eaten, spent on miracles, equipped on your grave and crafted. You also feed by eating people and by acts of evil. Miracles and acts of evil come as cards every round. You command people in only a few ways.

**The one-sentence game:** a mine digs up the souls you are made of and sends them to your enemies; turn the miners, one whisper at a time, until the mine's crystals flow to your grave instead — then follow the crystals upward.

## 2. The world and what you see
- [Owner] **One seamless open world**, not a line of levels. The mine sits inside the town's pit; the camera zooms freely from one miner to the whole town from the first turn. "It should just be a mine with a name." Places and people have plain names; nothing floats over heads.
- [Spec] Visibility: **Active** = full colour; **Sensed** = grayscale, obscured; **Void** = pure black (never explored).
- [Owner] **Colour is your influence.** "Anywhere your influence has reached and permeated enough should be coloured. That doesn't mean a dude has to be there."
- [Design] Every area has a **Hold** from 0 to 100: the share of that area that is in colour. Colour creeps outward at dawn from where it already is — along floors and walls, from your grave, from where followers live, pray and dig, from crystals of Shadow affinity set in your grave, from some miracles. It recedes when the Temple purges. The spec's **Influence** (map value) is the sum of Hold; **Presence** (reach and odds) grows with it: you can whisper to anyone standing on or next to your colour, or beside a follower.
- [Owner] No visible band, rim or glow at any fog boundary. Void is exact black.

## 3. People
- [Spec] Stats: Devotion, Strength, Intelligence, Cunning, Health. Role (job; decides actions), Trait (one quirk; decides which miracles work best), Standing (rank: Mortal / Elite / Blessed / Demigod / God).
- [Owner] They must feel like real people, not pieces. They do not stand still. They go to the surface. "It should be a real world you conquer, with many professions, many people and events, daily life going about." "People you influence in the mine should be able to go aboveground."
- [Design] Everyone has a home, a household, a job, a work place and a shift. **Nobody lives in the mine:** miners live in the rows above the pit, ride the lift down at dawn and up at dusk, and spend their evenings and rest days in the town — at table, at the tavern, at the market, at the Flame's chapel, at the wash-place, with their children. What you see them doing is what the rules say they are doing. A person's name, a line about who they are, and their ties to others are on their card, never over their head.
- [Design] **Your followers carry you up with them.** A follower's home, their table at the tavern, the bench where they pray become seeds of your colour above ground, and the people beside them there come within reach of your whispers — long before the watershed. A follower can be Moved to a surface place as well as to a face.
- [Design] **Many people, many trades.** The mine is worked by some 60 people in 20 or more trades (diggers, haulers, sorters, timbermen, lampmen, pumpmen, powder men, cart boys, farriers of the pit beasts, water carriers, cooks, a surveyor, a clerk, a chaplain of the Flame, overseers, guards, a peddler who comes down on paydays…). The town holds some 400 more in 40 or more trades (cutters, smelters, smiths, carters, porters, tally clerks, bakers, brewers, tavern keepers, washers, weavers, cobblers, apothecaries, midwives, gravediggers, lamplighters, priests and acolytes, magistrates and scribes, guards and their sergeants, smugglers, beggars, children, elders…). Trades differ in what they see, where they go, whom they know and what they can do for you: a hauler touches every cart, a lamplighter walks every street at dusk, a midwife is let in everywhere.
- [Spec] Devotion value: V(D) = 5x + 25(x − 0.4)³ + 1.6, x = D/100 (worth more at both ends, top end most; max 12, flattest at 40).
- [Spec] Devotion gain: Gain = Base / (1 + 10(x − 0.4)²) (harder at both ends, hardest at top; 0→100 ≈ 193 base points).
- [Spec] Zooming out: groups replace individuals; key people (high Standing or Devotion) stay individual. [Design] In the town, ordinary people act as groups with a headcount; Elites, your oldest followers and anyone wearing one of your items stay individuals.

## 4. The god
| Name | Type | Role |
|---|---|---|
| Divinity | Stat (XP) | Level, Whisper to God |
| Presence | Stat | Influence reach and success odds |
| Faith | Stat | Power of miracles; feeds Nether |
| Nether | Resource | Spent to influence new people, direct followers and enchant |
| Ichor | Resource (HP) | Lowered only by losing Influence, or certain weapons/enemy factions |
| Soul Crystals | Items | Mined by the civilization; eaten, burnt for miracles, set in your grave, crafted |
| Hunger | Urge | Manage down by eating crystals or people |
| Malice | Urge | Manage down by committing evil (benefits you, raises Suspicion/opposition) |
| Influence | World value | Power in the world: the sum of Hold |
| Suspicion | World value | Per faction: the Temple (cult), the Council (government), the Public |
| Actions | Per night | How many whispers and orders you can give |

- [Design] **Hunger** rises every night, faster as you grow (target: from sated to starving in about 8 nights without eating). At the top you **starve**: each night you eat one of your own followers unasked, and lose Ichor if you have none.
- [Design] **Malice** rises every night (target: about 10 nights from calm to the top). The higher it is, the more often your followers do evil on their own (§9). At the top you **lash out**: a random act of evil plays itself at full Suspicion.
- [Design] **Ichor** is lost when your colour is purged from an area, when a hunter reaches your grave or a relic of yours is destroyed, and when you starve. At zero the run ends.

### Faith and Nether [Spec]
- Faith = Σ V(Dᵢ) / N^0.15 (N = followers; ×10 followers ≈ ×7 Faith)
- Nether = Faith × 1.5^(L−1) × (4/3)^floor((L−1)/3) (L = Divinity level 1–15)
- Nether multiplier: ×1.5 per level, ×2 at each new stage; ×4.5 at Shade 1, ×20.3 Omen 1, ×91.1 Deity 1, ×410 God 1, ≈×923 at God 3.

### Divinity progression [Spec]
5 stages × 3 minor realms = 15 levels.

| Stage | Highest rank you can influence | Who | Playing field |
|---|---|---|---|
| Whisper | Mortal | Normal individuals | Small area |
| Shade | Elite | Groups, stronger mortals | Settlements |
| Omen | Blessed | Smaller settlements, small leaders, supernatural figures | City |
| Deity | Demigod | Cities, big leaders, demigods | Country/region |
| God | God | Countries, country leaders, opposing gods | Civilization |

- Miracles get steadily stronger; each new stage is a watershed that unlocks new miracles or fundamentally upgrades old ones.
- [Design] **Divinity XP** comes, in order of weight, from the soul value you consume (crystals eaten or burnt, people devoured), from Hold gained, from people turned (more for higher Standing), and from acts of evil. Each minor rank gives: +1 action a night, +1 socket in your grave, a blessing (pick 1 of 3), wider card pools, and one new thing to do (§8).

## 5. The turn
[Owner] There must be a loop you can see. "Ending a turn is like a fast forward of watching people do stuff in the day, and as they happen flavor text/notifications appear, and then you get the card at end-of-turn."
[Design] One turn is one day:
1. **Night — your move.** Everyone sleeps. You spend your actions (§8), play from the cards in your hand (§9) and handle your crystals (§7). **No time passes by itself:** each action point you spend fast-forwards its share of the night (three points, a third each), and when the last is spent, or when you hold the clock, it is dawn (DECISIONS §118). Random events can happen in the night's hours.
2. **The day — a fast-forward.** The sun comes up and the whole world runs in front of you at speed, dawn to dusk in 6 seconds (a small clock; the owner will say what the day becomes): colour creeps where your Hold grew; people wake, eat, walk to work, ride the lift; picks swing, strikes glint, carts roll, the count is taken; the market fills and empties; your followers do what you set them to; the opposition walks its rounds; weather passes over. **As things happen, short notes appear where they happen** — a strike ("Ket struck a Bright stone"), a search, a quarrel, a wedding, a rumour, rain coming in — and collect in a feed you can click to jump to. Rare finds and bad news slow the film and take the camera.
3. **Dusk — the end of the turn.** The shift ends and people go home. Followers come to your grave with crystals: unasked tribute and contributed hauls (§6); each stone is set down and revealed — the reward of every turn. A short ledger says what the day gave and cost. Then **your cards are dealt** for the night (§9).

No turn may be dead: every night has at least one crystal decision and one card decision, and every day shows the player something they have not seen before.

## 5b. The living world
[Owner] "Make the game feel way more lived in and fleshed out… many professions, many people and events, daily life going about… Rain and weather appropriately too. All the zooms as well."
[Design]
- **The calendar.** A week of seven days with its own rhythm: work days, **payday** (drink, debts, the peddler, loose talk), **market day** (the town fills; strangers; carts from the city), **the Flame's day** (sermons, processions, the chapel full — and the mine half empty), a **rest day**. The count, the guards' rounds and the crystal carts to the city follow the calendar, and you learn to use it.
- **Weather.** Clear, overcast, drizzle, rain, storm, fog, wind, the still cold before dawn — changing through the day and from day to day, seen at every zoom and heard. It matters: rain drives people indoors, hides a procession and floods the lower workings (less digging there, more seepage, pumps manned); fog blinds watchers and searches; a storm stops the lift early; wind carries bells and rumours. People dress and behave for it.
- **Events.** Every day things happen that are not about you: a wedding, a birth, a funeral, a brawl, a debt called in, a lost child, a collapsed prop, a sick pit beast, rats in the stores, a guard rotation, an inspector from the city, a caravan, news from the war, a preacher, a strike over pay, a festival. Each is seen in the world, noted in the day's feed in a line of plain flavour, and most open a small door for you (a grieving widow is easier to turn; a brawl draws the guards from the lift; a festival crowds the chapel and empties the rows) or close one. Some chain over several days. Your own doings join the same stream.
- **Every zoom is alive.** Close in: one person's hands, breath, glance. The mine: a shift at work. The pit head: the lift, the queue, the count. The town: smoke, lit windows, crowds as moving specks, carts on the roads, weather crossing it. Furthest out: the town in its valley — the road, the fields, the caravans that carry the crystals away toward the city, the weather coming in. Zooming never cuts, never shows a dead picture, and never shows a band.

## 6. Mining
- [Owner] **Everyone who works a rock face digs**, yours or not. During the shift each digger may **strike**: a strike frees one crystal. [Design] An ordinary miner strikes about once every two to three days; followers more often with the right blessings, items and crystals.
- [Owner] **Rarity is luck.** Which area of a mine a face is in does not matter.
- [Owner] **Depth matters:** deeper parts of a mine give rarer crystals. **The mine matters most:** mines have **tiers**; larger, more powerful mines give far rarer crystals. **This mine is tier I, the lowest.** Different mines also have slightly different weights — some types are more common in one mine than another.
- [Design] **Vein level.** Every face has a vein level = (mine tier − 1) × 3 + depth, with depth 1–3 inside a mine — so vein levels run 1–15, the same ladder as your Divinity. Vein level sets the odds of each grade, which bases can appear, and how high a modifier's tier can roll (§7). This mine has vein levels 1–3: the upper galleries (1), the lower workings (2), and the Deep (3), which starts sealed.
- [Design] **Going deeper is something you do**: the lower workings are gray at the start and thinly worked; the Deep is opened by followers digging toward it (the **Delve** routine, §8) or by a discovery. Deeper is richer, darker, less watched, and more dangerous.
- [Design] **Where the crystals go.** A miner who is not yours puts the crystal in the cart; carts roll to the lift; the lift takes the load up to the tally house. A follower **pockets** theirs (a hidden stash on their person).
- [Owner] **Tribute.** "Miners automatically give tribute randomly. You can also have them contribute crystals." [Design] Each dusk, every follower who is holding a find may bring you one, unasked — more likely the more devoted they are. A follower told to **Offer** brings everything they hold, every dusk.
- [Design] **The count.** At shift end the overseer counts what came up against what the mine should yield. Stones your followers kept are missing. A count that is a little short is forgiven; a count that is badly short raises the Council's Suspicion and brings **searches** at the lift. A search that finds a stash takes the stones and marks the follower; a search that finds one of your items is far worse (§7.6). Greed is the risk you manage.
- [Design] The mine does not run dry in this slice.

## 7. Crystals
[Owner] "Each crystal should have random stats. Many rarities and odd effects… most give stats… Each should be a different, strange shape." "Gems should also have affinities." "Gems should have crazy rarity scaling — many random modifiers and types and bases which can get as rare as .001 %."

### 7.1 What a crystal is [Design]
Every crystal is rolled once, from its seed, in layers. Each layer has its own long-tailed table.
- **Grade** — how much it can hold and how much raw soul is in it: Dull, Clear, Bright, Blazing, Royal, Impossible (worth 1 / 2 / 4 / 8 / 16 / 32 when eaten or burnt; 1, 1–2, 2, 2–3, 3–4, 4–5 modifiers). Target odds at vein level 1: about 62 % / 27 % / 8.5 % / 2.2 % / 0.28 % / 0.02 %; each vein level shifts weight upward, each mine tier shifts it much more.
- **Base** — its species of form, which is also its shape family and gives one inherent property. Dozens of bases, from everyday (Chip, Shard, Tooth, Bead, Plate, Needle) through uncommon (Knot, Twin, Geode, Cage, Spiral) to things that should not be stone (Eye, Hand, Heart, Seed, Crown, Door). Weights run from above 10 % down to **0.001 %**; the rarest bases only exist at higher vein levels, with a sliver of a chance below.
- **Affinity** — its nature: whose soul it was, in effect. It colours the stone and its light, decides which modifiers it can roll, which miracles it pays for best and what it resonates with.
  | Affinity | Leans toward | 
  |---|---|
  | Hunger | feeding, eating better, slower Hunger |
  | Malice | acts of evil, slower Malice, followers' own evil |
  | Faith | devotion, Nether, tribute |
  | Fear | lower Suspicion, guards who look away, easier whispers to the frightened |
  | Blood | Ichor, sacrifice, devouring |
  | Shadow | colour spreading, reach, stealth |
  | Stone | strike rate, strike luck, delving |
  | Echo | copies, rerolls, extra choices, luck |
  | Flame | the enemy god's own — rare, strong, and **hallowed**: it burns in your grave (a price each night) until it is profaned at a chapel you hold (§7.5) |
  Each mine has its own affinity weights. This mine leans Stone and Hunger; Flame is rare everywhere the Temple is strong.
- **Modifiers** — prefixes and suffixes drawn from the affinity's pool: most are plain stats (Nether a night, slower Hunger, whisper odds, strike luck, strike rate, miracle power, lower Suspicion, Ichor, devotion a day, colour spread, an extra action on the rarest), some are strange. Each modifier comes in tiers; higher tiers need higher vein levels; weights run down to 0.001 %.
- **Odd effect** — the rarest layer, a rule-bending property. [Owner] examples: one "can summon copies of people who are twice as likely to raise suspicion", one "can give you another blessing choice or a reroll". The sim keeps a long list (22 and growing); every one must change how a run is played.
- **Curse** — some stones, and some enchantments, carry a strong modifier with a price.
- **How rare it is** — every crystal shows the real odds of its roll as a number: "1 in 48,000". The reveal, the sound and the effect scale with that number, not only with the grade. A 1-in-100,000 stone is a once-in-a-run event and looks like nothing else in the game.
- **Name** — each stone has its own short name from its base, affinity, grade and effect ("Widow's Lantern", "Double Without Wax").

### 7.2 What you do with one [Owner + Design]
The same stone can only go one way:
- **Eat it** — Hunger falls by its worth (free, any night). Hunger-affinity stones feed more.
- **Burn it** — pay for a miracle (§9). A stone whose affinity matches the miracle's nature counts for half again its worth.
- **Set it in your grave** — [Owner] crystals are equipped on the grave. Its modifiers and odd effect work while it is set. 3 sockets at the start, +1 at each minor rank. **Resonance:** two set stones of one affinity strengthen each other; three wake a set power of that affinity; Flame beside anything quarrels.
- **Craft with it** (§7.3–7.5).

### 7.3 Crafting at the grave [Owner: "only enchanting a crystal or recombining for now"]
- **Enchant** [Design]: spend Nether (more for higher grades) to add one random modifier from the stone's affinity pool to an open slot, or to reroll one modifier you name. A small chance it comes out as a curse.
- **Recombine** [Design]: merge two crystals into one new crystal. Its base comes from one parent and its affinity from one (you see the odds), its modifiers are drawn from both up to the cap, its grade is the higher of the two with a small chance of one step up. Both parents are gone.

### 7.4 Facilities [Owner]
"Faceting unlocks when you take over a gem workshop and crafting into jewelry when you take over a forge. Similarly other buildings grant you their facilities to create cursed items."
[Design] A building is **yours** when its area is fully in your colour (Hold 100) or its master is turned. Its craft then appears in your grave's crafting panel; until then it is shown locked with what would unlock it.

| Building (town) | Master | Facility | What it makes |
|---|---|---|---|
| Gem workshop | the master cutter | **Faceting** | Re-cut a crystal: choose 1 of 3 offered cuts that reshape its numbers and decide which modifiers stay; its shape changes |
| Forge | the forgemaster | **Jewelry** | Set a crystal into a ring, amulet or circlet — an item a person wears |
| Tally house | the tally-master | **False weights** | A cursed set of weights: the count forgives much more while it sits on the scales |
| Chapel of the Flame | the high priest | **Profaning** | Turn a Flame crystal or a holy thing into a profaned relic: strong, and a wound to the Temple |
| Apothecary | the apothecary | **Black draughts** | One-use cursed drinks: slip one to a person for a strong short effect |
| The Council's vault | the magistrate | the prize | Holds a guaranteed Impossible crystal, and everything the mine ever sent up |

Later stages add more buildings and more crafts in the same way (mint, scriptorium, armoury, cathedral…).

### 7.5 Items [Owner + Design]
- Things made at facilities are **items**: jewelry, weights, relics, draughts. Jewelry keeps its crystal's affinity, modifiers and effect and turns them into powers for a person.
- [Owner] "You can also give cursed items to followers for free to grant them buffs and stuff but if they're exposed the risk is higher." Giving or taking back an item costs no action and no Nether. A follower wears one item (an Elite two). While worn it works: luckier or faster digging, a second hidden pocket, help with whispers to their neighbours, devotion that never drops, guards who look past them…
- **Exposure:** an item is evidence. If a search, an informer or a hunter catches a follower wearing one, Suspicion rises far more than for a pocketed stone — more for higher grades and curses — the item is lost, and the follower is taken.
- [Design] **Cursed gifts:** an item can also be given to someone who is not yours, by the hand of a follower who lives or works beside them (1 action). On them it is a curse: easier to turn, or poisoned trust between factions, or a slow ruin — by item.

## 8. Actions and orders
- [Owner] "Actions are capped by your rank. Starts at 3, rises by 1 every minor rank; some actions may cost more, like 2 or 3." Actions pay for whispers and for follower routines.
- [Spec] Nether pays for influencing new people and directing followers; crystals pay for miracles.
  Draft (not approved): Influence = 6 · S^0.85 · T · (1 + Resistance/50); Direct = S^0.85 · T.
  S = target size (group headcount, or 25% of a leader's command). T: Mortal 1, Elite 4.5, Blessed 20, Demigod 91, God 410. Typical action ≈ 15–30% of a turn's Nether at every stage.
- [Design] **Whisper** — 1 action and the Influence cost in Nether. A chance to turn one person (or group) in reach; the odds are shown before you commit, and say why. Failed whispers still soften the target.
- [Owner] **Routines** — "You can command people to do way too many things." A follower has exactly one standing routine; changing it costs 1 action (and the Direct cost in Nether):
  - **Pray** — the default. Prays between shifts: Nether, and colour where they are. Gives tribute at random.
  - **Offer** — contributes everything they dig, every dusk, by a small ritual at your grave. More stones, more risk on the way.
  - **Lie low** — hands finds in at the count, keeps their head down: no stones, no heat, hard to catch.
- [Owner] **Move** — a one-off: get them reassigned to another area. "Chance to succeed in influencing them, lower chance if it's more out of their standard path." 1 action, 2 if far.
- [Owner] "More actions unlocked later." [Design] One new thing at each minor rank, never more:
  | Rank | Unlocks |
  |---|---|
  | Whisper I | Whisper, Pray / Offer / Lie low, Move, eating, sockets, Enchant, Recombine |
  | Whisper II | **Delve** (routine): dig toward the next depth; slow, risky, opens richer veins |
  | Whisper III | **Skim** (routine, for haulers and sorters): lift stones from the carts before the count |
  | Shade I | groups and Elites can be whispered to; **Preach** (routine): turn neighbours slowly without your actions |
  | Shade II | **Stand watch** (routine): warn others of searches and hunters |
  | Shade III | the vault can be opened |

## 9. Cards
[Owner] "Where's the miracle and acts you can perform every round? They should come in cards." "Draw 3 miracles, play 1 or skip." "3 draws for blessing, which gives you a buff or interesting action, and 3 draws for act of evil." Eating a person is a card.
- Cards are dealt at the end of the turn, at dusk, after the offering (§5), and are played during the night.
- **Miracles** — each night you draw 3; play 1 or skip. [Spec] Pool and rarity depend on Divinity; each costs a different number of soul crystals; Faith sets power. Approved examples: Dream Directive (drives followers to infiltrate something); Bless Their Bodies (raises devotion, makes them more effective). [Design] The cost is in crystal worth and you choose which stones burn. Miracles serve the mine: richer strikes at a face, a cart that takes a wrong turn to your grave, an overseer who miscounts, colour soaking into a place, a sleeper made easy to turn.
- **Acts of evil** — each night you draw 3; play 1 or skip. An act of evil quiets Malice, gives something real (food, stones, fear, a rival removed) and is noticed by someone. **Devour a Person** is one of them: Hunger falls hard and their soul is yours. Others: sabotage a cart, foul the water, a cave-in, a framing, a sacrifice, a riot, an assassination.
- [Owner] **Followers' own evil** — "Followers may, based on your own malice, randomly decide to commit evil, which only sates your malice half as much as you yourself causing it." It is noticed all the same.
- **Blessings** — a lasting buff or an interesting new action. [Design] Pick 1 of 3 at the start of a run (the starting bonus) and at every minor rank. Some crystals add a choice or a reroll.
- Card pools widen and gain rarer cards with each rank; a new stage upgrades old cards.

## 10. Suspicion and the opposition
[Spec] Enemy factions come from existing opposing gods. Each tracks Suspicion: cults, government, public. Events change it (e.g. "the government exposes you"). High enough → crusades or invasions depending on the god's affinity. God battles later.
[Design] In this civilization the opposing god is **the Flame**. Three factions watch you, each watching something different, each answering with people you can see walking the world:
| Faction | Watches | Answers, as its Suspicion rises |
|---|---|---|
| The Council (government) | the count, missing stones, missing people, sabotage | searches at the lift → more guards → an area locked down → occupation of the pit head |
| The Temple of the Flame (cult) | your colour, prayer to you, rites, relics | wards that stop colour → purges that burn it out (you lose Ichor) → an inquisitor who hunts toward your grave → a crusade |
| The Public | fear, deaths, the missing, things that cannot be explained | rumours (whispers get harder) → informers → a mob |
Suspicion cools slowly when you give it nothing. The first serious pushback comes in the town: a lockdown, the inquisitor, and a crusade gathering as you near the vault.

## 11. Run start
[Spec] A new run starts at the fall of a crystal shard of the fallen, weak god (god alone, no miner): it falls through the dark and the rock and lands, and the starting bonus follows on that frame: choose 1 of 3 random offers.
[Design] The cutscene's last shot is the first gameplay view, with no cut. The starting bonus is the first blessing: 1 of 3. The first three nights teach the loop one step at a time: whisper to the sleeper by your grave → watch a strike → receive a stone at dusk → decide what to do with it → draw your first cards → see the count.

## 12. The slice: mine, watershed, town, ending
- [Owner] Build from the opening cutscene to the end of the Shade stage (the town). It is a slice: the late game only has to run.
- **Whisper stage — the mine** (tier I). Turn miners, go deeper, feed, keep the count quiet. A decent strategy reaches the watershed in about 15–25 turns.
- **The watershed** — when you reach Shade (Divinity level 4) and the pit head is fully your colour: the camera pulls back, the mine shrinks into a glowing point in the pit, and the town opens around it, mostly gray and black. The lift's load rises with the camera: you are following the crystals.
- **The town is defined in `docs/town.md` (binding; it replaces "people are groups" below and in §5: every townsperson is one simulated person, every building is a real place with its own screen).**
- **Shade stage — the town** — where the crystals go: the tally house, the gem workshop, the forge, the chapel, the apothecary, the Council's vault. People are groups; the masters of those buildings are Elites. Take buildings to gain their crafts; turn the crystals' route, link by link; survive the first real pushback. A decent strategy finishes in about 40–60 turns in total.
- **The ending beat** — at the top of Shade, with the vault open: the town's gate, the road, and far off the city — and the greater mines that feed it. Tier II waits.

## 13. Winning and losing
- The slice is won at the ending beat.
- The run is lost when Ichor reaches zero, or when you have no followers, no colour beyond your grave and no way to whisper (rooted out).

## 14. How it must feel and read
- [Owner] Lively: the world moves whether or not you act. Every moment of the loop has its own effect and its own sound — a strike by rarity, pocketing, the cart, the count, the offering and each reveal, eating, burning, enchanting, a curse, recombining, setting a stone, each card, devouring, an exposure.
- [Owner] Simple words. Tooltips and stats are short: two plain lines, then Details for the numbers. Hints teach one thing, sit beside what they point at, and disappear when you have done it. Nothing ever covers the grave.
- [Owner] Settings (volume and the rest) are always reachable; nothing is cut off at any window size.

## 15. Art direction
**[Owner → Design] The theme is written out in `docs/theme.md` (the world bible): the wickfolk, the colour code, the three building languages, the land, the things they make, the sound and the words. It is binding on every piece and overrides older handoffs.** **The town's visual target is `docs/refs/town-target.png` with the corrections in `DECISIONS.md` §18.**

[Spec] Flat 2D top-down, hand-drawn with dark outlines and soft shading; muted teal, ochre, violet.

Visibility:
- Active (Presence or territory): full color. Starting mine always has a small active area.
- Sensed (anywhere followers have been near; crowds reveal more; always a ring around active): grayscale, obscured.
- Void (never explored): pure black.

References (in `docs/refs/`):
- `mine.png` (Whisper) — the lighting reference: crystal glow, gold shrine light, glowing color/gray edge, palette, black void.
- `town.png` (Shade/Omen) — layout, density, sprite scale; ignore human-looking sheds (buildings should be alien, organic) — but take everything else from it: big lumpy buildings in a three-quarter view, packed along dirt lanes, clutter against every wall, an even light in which every form reads (see `docs/theme.md` §5).
- `region.png` (Deity/God) — fog following borders, war front; ignore text labels, castle, red territory (player = violet).

[Owner] `mine.png` is the only benchmark for the mine: rock as rounded, stacked masses with real close-up detail; nothing rudimentary when you zoom in.

## 16. Beyond the slice [Design]
- **More mines.** Tier II–V mines (a working mine, a great mine, a crown mine, a god's grave), each with its own affinity weights, its own bases and its own overseers. Vein levels 4–15.
- **More facilities**, each a new craft for cursed items.
- **Omen, Deity, God**: cities, countries, the war between the civilizations as something you feed on, opposing gods and their affinities, god battles.
- **The campaign across the universe.**

## 17. Still open
Exact numbers (in `DECISIONS.md` / `BALANCE.md`): strike rates, grade odds per vein level, base and modifier tables, tribute chance, the count's tolerance, Hunger and Malice rates, XP thresholds, card costs, Suspicion thresholds. Everything marked [Design] above is the orchestrator's and open to the owner's correction.
