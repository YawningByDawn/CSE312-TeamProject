# Balance — bot players on 500 seeds each

## The rebuilt sim (src)

Run: `python tools/bots.py -- 500 all --md` (scripts/bots/table.ts: seeds 1–500 per bot, 3 worker threads in one process,
the live clock, at most 100 days a run; 4,739 s on the shared box). Days, not turns. Rules: no action points, every action
limited only by the Nether it costs (DECISIONS §118).

| bot | runs | won | lost (mine / town) | stalled | reached Shade | Shade day p10/med/p90 | won on day p10/med/p90 | lost on day p10/med/p90 | days without a crystal / card decision | stones mined per run (Du/Cl/Br/Bl/Ro/Im) | peak followers | whispers | threats announced / landed / answered | losses by cause | refused |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| decent | 500 | 49 % | 51 % (0 / 253) | 0 % | 100 % | 12 / 14 / 18 | 13 / 18 / 30 | 25 / 32 / 49 | 0.8 / 0.0 | 7.81/4.37/1.63/0.51/0.09/0.01 | 89 | 160 | 35.3 / 23.5 / 9.2 | sealed 251, ichor 2 | 0 |
| cautious | 500 | 25 % | 71 % (0 / 356) | 4 % | 98 % | 13 / 18 / 38 | 14 / 27 / 55 | 30 / 44 / 67 | 0.8 / 0.0 | 5.84/2.87/1.20/0.31/0.06/0.01 | 78 | 151 | 47.6 / 42.9 / 2.4 | sealed 336, ichor 20 | 0 |
| random | 500 | 0 % | 76 % (2 / 380) | 24 % | 86 % | 38 / 58 / 82 | — | 53 / 75 / 92 | 0.4 / 0.0 | 2.64/1.40/0.47/0.15/0.01/0.00 | 13 | 101 | 77.8 / 74.6 / 1.1 | sealed 374, ichor 8 | 0 |

The same seeds and bots with the action cap (3 + rank a day; commit be00f2d9, 3,486 s):

| bot | runs | won | lost (mine / town) | stalled | reached Shade | Shade day p10/med/p90 | won on day p10/med/p90 | lost on day p10/med/p90 | days without a crystal / card decision | stones mined per run (Du/Cl/Br/Bl/Ro/Im) | peak followers | whispers | threats announced / landed / answered | losses by cause | refused |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| decent | 500 | 91 % | 9 % (0 / 46) | 0 % | 100 % | 14 / 18 / 27 | 15 / 21 / 32 | 31 / 42 / 65 | 0.8 / 0.0 | 8.89/4.72/1.91/0.55/0.08/0.00 | 48 | 63 | 16.0 / 11.0 / 2.9 | sealed 46 | 0 |
| cautious | 500 | 52 % | 44 % (0 / 218) | 4 % | 99 % | 14 / 20 / 49 | 15 / 24 / 53 | 35 / 51 / 74 | 0.8 / 0.0 | 7.52/3.86/1.51/0.48/0.06/0.01 | 61 | 99 | 36.8 / 32.3 / 2.3 | sealed 208, ichor 10 | 0 |
| random | 500 | 0 % | 84 % (1 / 420) | 16 % | 89 % | 30 / 47 / 72 | — | 45 / 65 / 87 | 0.4 / 0.0 | 3.10/1.50/0.55/0.17/0.02/0.00 | 15 | 96 | 71.8 / 68.8 / 1.0 | sealed 411, ichor 10 | 0 |

Without the cap the bots whisper about 2.5 times as often (decent 63 → 160 a run): they reach Shade sooner (decent median
day 18 → 14) and turn more (peak 48 → 89 followers), but the powers' heat follows and the writ seals far more runs (decent
wins 91 % → 49 %, cautious 52 % → 25 %). The bots' strategies are unchanged and were tuned under the cap; no number was
retuned. No action a bot sent was refused.

## The old game (src/)

Run: `npm run bots -- 500 all --md` (= `npx tsx scripts/sim-bots.ts 500 all --md`; seeds 1–500 per bot, 6 worker processes,
deterministic; every run cached per seed under `/tmp/sim5/cache/<hash of src/sim>/`, so an interrupted run resumes). Rules as of
SIM v3.3 (DECISIONS §15.14: the town's contest — announced faction moves, the writ, favours, answers, the town losing patience,
rooted out), LIVING on (copy-on-write `planDay`), max 100 turns a run. 2026-11-23, 30 min wall on the shared 4-core box under load ~20.
(Text-only edits to the sim's fallback strings landed after this run; outcomes are unchanged.)

## Results

| bot | runs | won | lost (mine / town) | stalled | reached Shade | Shade turn p10/med/p90 | won on turn p10/med/p90 | lost on turn p10/med/p90 | mine % @15 | nights without a crystal / card decision | crystals mined per run (Du/Cl/Br/Bl/Ro/Im) | vault opened |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| sensible | 500 | 68 % | 32 % (1 / 159) | 0 % | 100 % | 14 / 17 / 20 | 31 / 40 / 50 | 34 / 39 / 51 | 62 | 0 / 0 | 45/30/14/5/0.97/0.08 | 98 % |
| greedy | 500 | 16 % | 84 % (9 / 409) | 0 % | 98 % | 13 / 14 / 17 | 25 / 31 / 49 | 25 / 31 / 40 | 73 | 0 / 0 | 63/43/20/8/1/0.13 | 64 % |
| cautious | 500 | 67 % | 31 % (0 / 153) | 2 % | 100 % | 15 / 18 / 21 | 40 / 51 / 67 | 38 / 49 / 67 | 60 | 0 / 0 | 37/21/9/3/0.51/0.05 | 95 % |
| random | 500 | 0 % | 94 % (321 / 149) | 6 % | 31 % | 37 / 48 / 66 | — | 36 / 51 / 76 | 28 | 8 / 0 | 10/6/2/0.58/0.10/0.01 | 3 % |

"Stalled" = alive at turn 100 without the ending. Losses split by cause (500 runs each): sensible 145 Ichor / 15 sealed;
greedy 343 Ichor / 77 sealed; cautious 84 Ichor / 69 sealed; random 378 Ichor / 92 sealed. Rooted out: 0 in 2000 runs (the
grave's seep and the mine's crowds keep someone in reach; the check exists so a stuck player sees the end).
Threats per run (announced / landed / blunted by an answer, a hide or cooling): sensible 19.6 / 9.5 / 8.5; greedy 18.0 / 10.5 / 5.9;
cautious 32.3 / 16.0 / 14.5. Seals set per run: sensible 0.8, greedy 2.0, cautious 1.9.

## Against the targets (CLAUDE.md "Done" and the v3.3 brief)

| target | result | verdict |
|---|---|---|
| A decent strategy reaches Shade in about 15–25 turns | sensible: 14 / 17 / 20 (p10 / median / p90), 100 % reach it | met (p10 one turn early) |
| … and finishes Shade in about 40–60 | sensible wins at 31 / 40 / 50 | median met at the low edge; p10 early |
| sensible wins 55–70 % | 68 % | met |
| greedy wins 15–35 % | 16 % | met, at the floor |
| cautious usually survives (≥ 70 %), median win ≤ 60, stalls ≤ 10 % | survives 69 % (wins 67 %, stalls 2 %), median win 51 | survival 1 point short; the rest met |
| random usually loses (≥ 75 %) | loses 94 %, never wins | met |
| No strategy dominates (no bot over 75 %) | best is sensible at 68 %; caution wins as often but slowly | met |
| No turn is dead | every night of every scripted bot has a crystal and a card decision; random 8 nights in 500 runs without a crystal decision | met |
| Shade has a second way to lose | the writ: 15 / 77 / 69 / 92 runs sealed (sensible / greedy / cautious / random) | met |

## What was tuned in v3.3, and why

| change | why |
|---|---|
| Announced moves replace the town's random Hostile strikes; the writ (4 seals) as a second way to lose; favours, items, acts of evil, hiding and cooling as answers | the brief: Shade had one way to die and no way to strike back |
| The naming cannot be hidden from (answers: relic, Temple favour, Silence the Preacher, cooling) | with hiding allowed the bots dodged 57 of 68 namings for one action each; the Temple's main move never landed |
| The town loses patience after 12 Days in Shade: factions rest 1 Day, floors −15, the writ pressed whatever the Council's heat | slow, safe play (cautious 78 %) out-waited a town that never escalated; this costs dawdling, not speed |
| Favour cooldown 8 → 9 nights; crusade as an announced move at Shade III; vault found open +25 Council; town crackdown takes at most 2 and adds a seal | sensible sat at 72–82 % at 50 seeds |
| XP +1 per point of soul value for eaten / miracle-paid crystals (thresholds are pinned by the formula tests) | wins came after turn 60 without it |
| Bots: all three keep one answering item; cautious whispers in town at ≥ 20 % odds; a laid-low follower stays down ≥ 2 nights | the Pray / Lie low flip-flop; greedy fell under 15 % once favours slowed |

Note on noise: at 50 seeds a bot's win rate moved ±8 points between identical-rule runs on different seed blocks; only the
500-seed table above is a verdict.

## Speed

A whole sensible run (≈ 42 turns) costs about 1.2–1.7 s CPU on the shared box under load ~20 (≈ 1.2–1.6 s per 40 turns; the
target was ≤ 1 s — not met on this box; it was not measured idle). Memoised per read scope: conversion odds, resistance,
wariness, noticed followers, presence, units by zone; `mods()` cached across states; LIVING's copy-on-write `planDay` landed
(−15 % a run). 500 seeds × 4 bots: 30 min wall on 6 workers under load; a 50-seed smoke of all four bots 3–4 min.

## Trace — the sensible bot, seed 1, nights 1–12

`npx tsx scripts/sim-bots.ts --trace=1 --days=12` prints finds by grade, stones offered, the count (expected / counted, short,
heat), stones eaten / burnt / set / crafted, AP spent, Hold per mine area and the pit head, followers, Nether, Ichor, Hunger,
Malice, heat and every action of the night. Night 1: 3 whispers, 3 stones set; night 2: the first miracle (Creeping Dark on the
crystal gallery) paid with 3 stones; nights 3–5: the count runs short (5–6 against a tolerance of ~5) and the Council warms; night
6: four diggers lie low and the next count comes in over; nights 8–12: the shanties and the pit head colour, 9 → 14 followers, the
pit head reaches 100 on night 11.
