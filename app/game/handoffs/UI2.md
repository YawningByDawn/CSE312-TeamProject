# UI2 — the Night interface, one mock-up to docs/style.md §7 (2026-11-23)

The brief changed mid-piece from "three directions" to "build ONE interface exactly as docs/style.md". The three-direction code is gone.

**Where:** `dev/ui2.html?v=night|person|card[&w=1280&h=720]`, `?v=sheet`. Code in `src/ui/mock2/**` (ink.ts = inking kit, art.ts = card paintings / portrait / icons, ui.ts = layout, shoot.cjs = shots + checks). Not loaded by the game.
**Shots:** `screenshots/ui2-night.png`, `ui2-person.png`, `ui2-card.png` (2×), `ui2-card-1600x900.png`, each with `-1280x720`; `ui2-sheet.png` (beside the rejected `hud-hands-1600x900.png`).

**What it is:** five painted slabs over the real mine still: the god top-left (the grave crystal is lit up to how fed you are, rank as lit facets at its rim, "Hungry" on a hide tab, the goal on a parchment strip below), three wicks top-right (Temple, Council, Town; flame height = alarm, one line "The town is talking about you"), the hide pouch bottom-left (dull 14 / clear 7 / bright 3), a fan of five painted cards bottom-centre (Soothing Murmur, Crystal Bloom, Vein Sight; Terrorize, Bad Water), End Night bottom-right (violet-lit slab, carved moon, "2 left" ink badge). A clicked miner gets a slab beside her with a portrait, one line and four illustrated actions.

**Checks (as measured / looked at):** contours 2.5–3.5 px living ink — yes, except the cast figures' own inner lines (accepted characters, now given a ~2.5 px outer silhouette); no gradient on objects — yes (gradients only in glows); a mark on every surface — yes; no brackets/pills/bars/small-caps rows — yes; ≤6 words per label — yes; §4 palette — yes for everything drawn here, the cast figures keep their own skin/cloth colours; text ≥16 px at 1600×900 — yes; nothing cut off or overlapping at 1600×900 and 1280×720 — yes by the shoot script's box check (the fanned cards overlap each other by design).

**Weakest, honestly:** card art is clean storybook, not yet Darkest Dungeon depth (few tones, little atmosphere); the Murmur picture reads weakest; "Soothing Murmur" is set condensed to fit its band at 22 px; the slabs repeat one stone recipe; the pouch labels are small next to the counts.
