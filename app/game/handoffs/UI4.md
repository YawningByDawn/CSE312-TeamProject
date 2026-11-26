# UI4 — the town's Night in the approved UI2 kit (awaiting the owner)

Page: `dev/ui4.html?v=night|crowd|elite|building|threat|ledger|card|sheet[&w=1280&h=720]` (vite). Code: `src/ui/mock4/**` only.
Shoot: `flock /tmp/hg-pw-2.lock env NODE_PATH=/usr/local/lib/node_modules_global node src/ui/mock4/shoot.cjs` (prints the checks).
Frame: `src/ui/mock4/grab.cjs` grabs the town from `dev/shade.html` with the HUD and old ground rings hidden (game source untouched).

Shots (1600×900, each also `-1280x720`): `screenshots/ui4-town-night`, `-crowd`, `-elite`, `-building`, `-threat`, `-ledger`; `ui4-cards.png` (hand at 2×); `ui4-sheet.png` (all six beside rejected frame 4).

- Rest: UI2's own god, wicks, pouch and End Night (`build()`, town numbers); five painted town cards (Sermon of Ash, Gilded Tongue, Creeping Dark, Riot, Assassinate).
- Crowd: "The smelter crew / 30 people", three wicks (Yours / The Flame's / Undecided), three painted actions with chance in words.
- Elite: Petra's portrait, "Guild Master", what she wants, what turning her gives, one action.
- Building: the forge painted half-violet, what it gives, how much is yours, how to take it, one action.
- Threat: Council wick flares; banner "The Writ" with the seals drawn, one sentence, two moons for nights left, three answers.
- Dusk: one parchment, four lines, the biggest first; "To the night" in its foot.

Hard checks (all six screens): same kit yes; five things at rest yes; ≤6 words per label, no jargon yes (longest 6);
ink contours, 3–4 tones, marks, §4 palette yes; text ≥16 px yes at 1600×900; nothing overlapping or cut off at both sizes yes (by DOM checker; cards overlap each other by design).

Weak, said plainly:
- At 1280×720 text is 13.8 px on screen (the same 0.86 zoom as the approved UI2).
- "Burn the Knot-Cords" is condensed ×0.77 on the threat screen.
- The Gilded Tongue tongue reads more like a violet ribbon than a tongue.
- Petra's office (hood, chain) barely reads in the portrait; the Elite ground ring is small at 1280.
- The town frame still carries the in-world gold ward pentagrams.
- `flame` and the card recipe are copied from mock2; share them when this goes into the game.
