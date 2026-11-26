# Plain-names pass (DECISIONS 13.3) — handoff

## State
The sim strings and the UI strings were already converted by the earlier builder; on audit this pass found nothing left to
change (no new edits were needed). I did not use git, so per-file edit counts are not available; the audit results are below.

## Audit (case-insensitive grep of the retired-name list over src/sim, src/scenes/{whisper,title,defeat,_placeholders}, src/ui, src/app, tests/sim, e2e)
- Every remaining hit is a code identifier or an unrelated substring (`querySelector` matches "lector"):
  `kilnLight`, `kilnshrine`, `kilnkeeper`, `kilnSource`, `BALANCE.kiln*`, `tallyhall`, `kilntemple`, `cartway`, `heartvein`,
  `westdrift`, `lowgallery`, `sump`, `sorting`, HunterKind `'auditor' | 'cantor'`, crest kinds `'kiln' | 'tally'`,
  event ids `tallyInspection` / `kilnFeast` / `auditorTakes` / `cantorSings`, test names/ids in tests/sim and e2e.
- No retired name or mine-chamber proper name appears in any player-facing string (names.test.ts enforces this over a
  random playthrough: people, titles, bios, miracles, orders, events, hunters, log lines, action descriptions).
- Rule 5: (a) `drawZoneLabels` (world.ts) no longer draws area names — it draws only the nameless "SLIPPING" warning;
  no person-name text is drawn in the world (renderer draws none; names appear only in inspector, tooltips, toasts, log).
  (b) HUD shows "Deepwell Mine" once, small, beside the stage name (`.ws-mine`, hud.ts / styles.ts). (c) Inspector zone header
  uses `cap(def.name)`, tooltips use `zoneTitle`, narrate banners use `cap(zoneName(...))`. (d) title, defeat and placeholder
  scenes contain no retired names ("The town of Deepwell waits in the gray.").

## People (28; one short plain name each)
g01 Mara, g02 Pim, g03 Hale, g04 Wren, g05 Bram, g06 Ket, g07 Garr, g08 Odo, g09 Nessa, g10 Rill, g11 Ilsa, g12 Tov,
g13 Lani, g14 Teb, g15 Sela, g16 Dov, g17 Overseer Varn (Elite), g18 Jude, g19 Yara, g20 Osk, g21 Brin, g22 Ada,
g23 Fen, g24 Corm, g25 Hesk, g26 Mott, g27 Rook, g28 Sib. Spare names for new arrivals: SPARE_NAMES in people.ts.

## Unsure / notes
- events.ts line ~608 uses "a whole drift of stolen crystal" ("drift" as a generic mining word, not the retired "West Drift").
- Hunter tooltips say "Hunter of the Temple" / "Hunter of the Council"; the cult hunter is called "the Inquisitor".

## Verification
- `npx tsc --noEmit | grep -v src/render/` : clean (only src/render/art/townBuild.ts errors, another builder's).
- `npx vitest run tests/sim`: 8 files, 153 tests passed (12 s).
- `e2e/whisper-shots.cjs`: first run saved the screenshots, then failed in the long bot playthrough on a
  `page.click` timeout for `[data-action="dawn-continue"]` (element visible/stable; likely an overlay/animation race, not a
  string issue). Second run got through all shot sets (order menu, hand, targeting, dawn report, event, alarm, level-up,
  midgame, settings, defeat run, whisper-1280) and then hit my 400 s wall-clock limit during the final page.goto. Not string related;
  the script is just slow. Screenshot `screenshots/whisper-1280.png` (downscaled) confirms: no labels on the map, no names
  over heads, "Deepwell Mine" once under the stage name in the HUD, inspector titled "Mara · Digger · Your grave".
