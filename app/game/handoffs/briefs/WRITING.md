# Brief — WRITING: every word in the game, and the people behind the names

Handoff/log: `handoffs/WRITING.md`. Headless (no port). Scratch `/tmp/writing/`.
Read: `docs/spec.md` (tone: you are a fallen, hungry god running a cult like a business — dry, dark, a little funny, never purple); `DECISIONS.md` §13.3 (plain names; nothing floats over heads), §13.10 D–F (two short lines, then Details; no jargon), §14 (the loop: Whisper, Send, Recall, Lie low, Hold/the stain, discoveries, the walking threat), §13.11; `src/sim/content/**` and `src/sim/names*` (ids, names, existing strings — read-only); `handoffs/P4.md` (v2 events and selectors); `src/scenes/cutscene/**` text (read-only; send suggestions as requests).

Owner: "the miners don't feel like real people" and "too confusing". Half of feeling real is who they are in a sentence; half of being clear is the words. **You write all of it, in one voice, as data the sim and the interface consume.**

## Build `src/content/` (pure data + tiny deterministic pickers; no sim imports — keyed by ids/kinds/event types as plain strings)
1. **People:** for every named person and for generated ones (by seed): one human line shown on their card ("Sleeps badly since the cave-in. Owes the overseer money."), what they want, what they fear, who they are close to or at odds with (pairs the life director can use), and short lines for moments — heard a whisper, turned, refused, afraid, devoted, caught, grieving — a few variants each by temperament. Elites and enemies get the same, sharper.
2. **Places:** each mine area and town block: a one-line description when seen, another when fully yours; discovery hints (when seen from gray) and reveals (cache, seam, loner, shortcut, relic, danger) — several per kind so no run repeats itself.
3. **The interface's words:** stat names and one-sentence introductions, goal lines, the Send preview sentences per intent ("{name} will explore {place} — {days} — {cost}"), reasons in plain words for every "you can't" (`canWhisper`/`sendPreview` `why` codes), button labels, the first-night guidance beats, just-in-time introductions for every new thing, warnings, unlock lines, End Night summaries, dawn summaries (≤ 3 lines built from the day's events), level and Divinity lines, defeat causes, the ending tease.
4. **The chronicle:** a line per event type with variants, written as the god's dry ledger of the night ("Asel knelt. The West Drift is a third mine.").
5. **Powers and world:** names and two-line descriptions (+ Details wording with number slots) for every miracle, starting bonus, evil act; Temple edicts and Council notices in their own voices; event prose with choices whose consequences are stated plainly.
6. **Rules (tested):** banned jargon list (no "Control", "claim", "zone", "unit", "proc", internal ids); short layer ≤ 2 lines of ≤ 60 characters; no placeholder leaks; every key the sim/HUD can ask for exists; variants never repeat back to back; reading age plain; British or American spelling consistently (match existing strings).

## Interface first
Within your first ten tool calls put the module API (`text.person(id, seed)`, `text.place(id)`, `text.ui(key, slots)`, `text.chronicle(event)`, `text.daySummary(events)`, …) and the key lists at the top of your handoff; the HUD, play-scene and sim builders consume it (the sim keeps its own strings only as fallback).

## Proof and self-grading
`tests/content/**` (the rules above, coverage of every id in `src/sim/content`, determinism); `scripts/content-sample.ts` printing a sample night's worth of text (cards, previews, chronicle, summary) into `handoffs/WRITING-sample.md` — read it aloud in your head after every milestone, cut anything flat or wordy, and follow `handoffs/RULES.md` rule 13.

## Ownership
Yours only: `src/content/**`, `tests/content/**`, `scripts/content-*.ts`, `handoffs/WRITING.md`, `handoffs/WRITING-sample.md`. Append `### WRITING — Voice and text` to `DECISIONS.md`.
