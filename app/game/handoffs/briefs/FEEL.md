# Brief — FEEL: game feel, camera and the direction of every moment

Handoff/log: `handoffs/FEEL.md`. Port **5222**. Scratch `/tmp/feel/`.
Read: `DECISIONS.md` §14 (all), §13.10, §13.6; `handoffs/P4.md` (v2 contract: actions and the ordered day events with time 0–1); `handoffs/P6b.md` (world renderer camera API: `CamPose`, `setPose`, `constrainCamera`, `pullBackPath`); `handoffs/briefs/VFX.md`, `handoffs/briefs/P3-r3.md` (sound names, `setPhase`), `handoffs/briefs/HUD.md`, `handoffs/briefs/PLAY-v2.md`.

Owner: "Remake the whole feel." Every click must feel answered, every night must end in visible change, and the day must play like a small film of your mine waking up. **You own how each moment is staged: timing, camera, emphasis, the order of sound and picture.** You do not draw effects (VFX), sounds (audio) or panels (HUD) — you conduct them through a host interface.

## Build `src/feel/`
1. **Motion kit:** springs, tweens, easing set, sequencer/timeline with labels, scrubbing, pause and speed (Settings: day speed, reduce motion), deterministic, frame-rate independent, no allocation churn.
2. **Camera director:** smooth pan/zoom with inertia and soft bounds; zoom to cursor; `frame(target, {pad, zoom, dur})`; follow a walker; two-point framing; cuts vs glides chosen by distance; shake and punch (tiny, capped, off with reduce motion); never fights the player (any player input cancels direction for a few seconds); "whole world" and "my mine" moves; idle drift when nothing happens for a while (a slow breath, a few pixels).
3. **Moment recipes** — one named recipe per game moment, each a short timeline over the host (`camera`, `fx.spawn`, `audio.play`, `hud.pulse/pop`, `people.react`, `time.hitStop`): hover, select, cancel, whisper cast → heard → turned / refused, colour ripple on a conversion, Send preview → confirm → set off, arrival, exploring gray → discovery reveal, crystals delivered to the grave (numbers rise at the grave), prayer tick, eat, miracle (per miracle), Nether/Ichor/Hunger change, unlock, level up, Divinity up, Hold gain creep, area rooted, Hold receding, guard notices, pushback, purge, inquisitor arrives, follower caught/lost, dusk, **dawn**, defeat approaching (hunger heartbeat), End Night press. Each recipe: ≤ 100 ms to first response, clear anticipation → hit → settle, never blocks input longer than 400 ms unless it is a once-per-run moment.
4. **Day director:** `planDay(events) → timeline` — turns the sim's ordered day events into a 6–10 s sequence: what the camera shows when (the biggest colour change, a discovery, an attack; glide between at most 3–4 subjects; otherwise the player's own framing), when creeps start so they overlap pleasingly, when sounds land, where a beat of stillness goes, then a ≤ 3-line summary cue. Skippable and scrubbable; identical input → identical film. Night ↔ day transitions (light opens up at dawn, closes at dusk) as cues for the atmosphere layer.
5. **Pacing guard:** a checker that scans a session log for dead time (> 3 s with nothing moving on screen and no prompt), unanswered inputs, overlapping big moments, and moments that outstay their welcome; used by the playtest harness.

## Interface first
Within your first ten tool calls put the exact host interface (`FeelHost`: camera, fx, audio, hud, people, time, settings) and the recipe names with their parameters at the top of your handoff. The play-scene builder implements the host and calls `feel.play(name, params)` / `feel.day(events)`.

## Proof
- `tests/feel/**`: kit maths, determinism, scrubbing, reduce-motion variants, every recipe's first response ≤ 100 ms, `planDay` properties (length 6–10 s at speed 1, no subject shown < 0.8 s, creeps not all simultaneous).
- `dev/feel.html` + `e2e/feel-shots.cjs`: a mock host over the real world renderer (or the mine renderer) with buttons for every recipe and three sample days; frame strips of each recipe and one full day → `screenshots/feel-*.png`; look at them yourself after every milestone and write what you saw.

## Ownership
Yours only: `src/feel/**`, `tests/feel/**`, `dev/feel.html`, `e2e/feel-shots.cjs`, `screenshots/feel-*.png`, `handoffs/FEEL.md`. Requests to VFX/audio/HUD/people owners go in your handoff, exact. Append `### FEEL — Game feel` to `DECISIONS.md`.
