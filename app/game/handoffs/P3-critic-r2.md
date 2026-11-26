# P3 audio — blind critic round 2: 6.5/10 (not mergeable)

Measured through the real `AudioCore` chain (offline path) at default volumes with the critic's own BS.1770 loudness, 4× true peak, Welch spectra and cross-correlation. [M] measured, [C] read from the code. Critic's tools and notes: `/tmp/p3-critic-r2/` (may be gone; the numbers below are the record).

## Major
1. **Clicks at the start of every crossfade and on the first volume/mute change [M].** `dsp.ts` `rampTo`/`holdAt` (lines ~92–125) rely on `cancelAndHoldAtTime`, which does not anchor a ramp when the param timeline is empty or its last event is in the past → the following `linearRampToValueAtTime` ramps from the old anchor and the value jumps (isolated test: 1.0 → 0.31 at once). First `setVolume('master', 0)`: −23 → −47 dB in 4 ms (0.11 sample step, burst above 4 kHz at −25 dBFS). Scene crossfades (`beds/base.ts` `fadeOut` ~line 170): outgoing bed drops 5–7 % at once (whisper → watershed: HF burst 26× the local floor; drone alone 61×; rumble alone 191×). Fix: after `cancelAndHoldAtTime` call `setValueAtTime(knownCurrentValue, at)`, or seed every bus/fade gain with `setValueAtTime` at creation; then re-measure every transition and the first volume and mute change.
2. **Every bed is extremely dark [M].** Octave bands relative to 250 Hz: 2 kHz −11…−27 dB, 4 kHz −22…−41 dB, 8 kHz −32…−60 dB; above 2 kHz ≈ 0.1 % of power; centroid 119–315 Hz — also the stars, the town and the "gold light" ending. Sub-bass hogs energy: below 60 Hz = 41–44 % (cutscene), 38 % (defeat), 32 % (Whisper); through a 200 Hz high-pass cutscene and Whisper lose 3.3–4.3 dB vs 1–2 dB for the others. [C] Causes: `glass` low-pass `min(4200, hz*6)`, `bowed` `hz*3.5`, drones 200–320 Hz.
3. **Danger response in the town too weak at mid levels [M].** Danger layer vs mix (seed 5): Shade −13.7 LU at intensity 0.5 + hunger 0.5 (−6.7 at intensity 1, −8.1 at hunger 1, −4.1 both); Whisper −9.2 / −3.0 / −4.2 / −1.3. In Shade at 0.5/0.5 the core duck is only −0.77 dB. Power curves in `params.ts` `intensityMap`/`hungerMap` (exponents 1.3–1.8) push the response to the top end. [C] The tension pulse (64–104 BPM, own clock, `tension.ts:65-83`) is unrelated to Shade's frame-drum grid (1.2 s beat, `scenes.ts:378-422`) → two low drums flam.
4. **The town's form swings too far [M].** Fixed `SHADE_OPENING`: "hush" at ~150–172 s drops to −34 LUFS short-term (14 LU under the bed); "swell" at ~208–224 s rises to −13/−14 LUFS (+7 LU; routine sfx then sit ~8 dB under the music). LRA 8.4–9.4 LU. Cap the swell near −17 LUFS short-term, raise the hush floor.
5. **Audible noise loops [M].** Wind = 7.1 s looping pink buffer, same buffer both sides: correlation 0.55 at 7.1 s, 0.63 at 14.2 s in the hush (0.21–0.29 in busy parts). Rumble (9.7 s brown): 0.39 (Whisper), 0.43 (defeat). [C] Wind gusts/sweeps are fixed-rate sine LFOs; `wander()` exists but is unused for wind.
6. **Sfx coverage misses the town's signature beats [M by name list].** Of 41 `SFX_NAMES`, none for: an Elite turned; group/crowd conversion; the Council's lockdown/occupation; garrison occupation; lie low; a Send arriving; Hold/colour gain. [C] Beds have no hook for the Night/Day turn rhythm (DECISIONS §14.3).

## Minor
- Ending loops on a fixed 28 s progression (`[0,5,1,0]`, 7 s chords, `scenes.ts:768`; correlation 0.80 at 84 s).
- Bed loudness spread 1.7 LU between scene means (target ±1): cutscene −21.75/−21.37, bonus −20.47/−21.23, Whisper −20.44/−21.21/−20.78, watershed −22.48/−22.07, Shade −20.26/−20.94/−21.50, ending −21.46/−21.47, defeat −21.48/−21.9. Bonus → Whisper entry jumps −17 → −23 LUFS momentary; Whisper → watershed leaves a 9 LU hole (−34 LUFS) for ~3 s on a key moment.
- Mixed sfx spam piles up: 200 random effects in 5 s over Shade → +12–14 LU, sample peak pinned at −0.31 dBFS, 340 ms above −3 dBFS; 53 voices at once (priority ≥ 2 bypasses the 24-voice cap); limiter is a `WaveShaper` with `oversample='none'` (`dsp.ts:263`) → aliasing when it engages. (Single-effect repeats are well controlled.)
- The first click is silent [C]: `index.ts:254` drops sfx until `ctx.state === 'running'`, so the effect on the unlocking gesture never plays.
- All seven beds share one key/drone (D/A; D phrygian/aeolian/phrygian dominant) and the same palette; mine vs town contrast mostly by density and register.
- Determinism not bit-exact (−79 dB relative); musically deterministic. Background-tab behaviour not verified. Defaults quiet for web play (~−21 LUFS).

## Good (keep)
Sfx loudness ladder exactly on target (−31 / −26.5 / −22 / −17.5 / −13); peaks safe (beds ≤ −2.3 dBTP, sfx ≤ −1.4 dBTP); music duck ~−4 dB recovering in ~3 s; danger changes timbre without raising loudness (±0.9 LU); long-form variety (self-similarity 0.15–0.45; motif-based writing with real variants); whisper reads as a voice (formant contrast 16–26 dB); pitch applied correctly; engine robust (no context before a gesture, persistence, `?mute=1`, fast scene switching settles to 1 bed, ~5.45 ms/s scheduling, zero console errors, 70/70 tests).

## Five changes that raise the score most
1. Fix ramp anchoring (item 1) and re-measure all transitions.
2. Open the top end (+10–15 dB at 2–5 kHz: cutoffs, bell/crystal partials, breath, a high wind band); trim sub-bass below 60 Hz in cutscene, Whisper, defeat.
3. Replace looped noise (30 s+ or per-instance buffers, or a worklet source); drive wind with `wander()`.
4. Re-curve danger so 0.5/0.5 reads at ≈ −8 LU or better in Shade; lock the tension pulse to the bed's beat grid (or replace it where a drum exists).
5. Tame Shade's swell (~−4 LU), raise the hush floor; add the missing sfx; vary the ending's progression.
