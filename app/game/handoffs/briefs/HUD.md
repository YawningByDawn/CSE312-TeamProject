# Brief — HUD: every panel, card and word of guidance on screen

Handoff/log: `handoffs/HUD.md`. Port **5225**. Scratch `/tmp/hud/`.
Read: `DECISIONS.md` §14 (all), **§13.10 C–F** (binding), §13.3, §13.6; `handoffs/P4.md` (v2 contract: `statBar`, `goal`, `areaPanel`, `canWhisper`, `sendPreview`, two-layer texts); `handoffs/P5-fix.md` (shell, settings, layout units `--su`/`--u`, `data-fit`, hints); `src/ui/**` (kit, theme, ink, icons, tooltip, hints — read-only until the shell builder reports); `handoffs/briefs/PLAY-v2.md`, `handoffs/briefs/FEEL.md`, `handoffs/briefs/WRITING.md`.

Owner: "Some of the Got its don't disappear. Some things are too confusing. Tooltips and stats should be more simplified." The play scene is being rewritten; **you build its whole interface as self-contained components** the scene mounts. A first-time player must understand the screen without reading a manual; an expert must never be slowed down.

## Build `src/ui/play/` (DOM/CSS components over plain view-model objects; no sim imports — define the view models in `types.ts`)
1. **Stat bar:** You (Ichor pips, Hunger as a meter that starts to matter visibly) · Spend (Nether with "+N a night", Crystals) · Danger (one indicator that opens to the three heat tracks in plain words: who is worried, why, what happens next). Items appear when first relevant with a one-sentence introduction; changes animate (count, pulse) and point to their cause.
2. **Goal panel:** two plain lines with progress ("Turn the mine to colour — 23 %", "Reach the surface — pit head 0 %"), click = `onFocus(target)`; a next-step nudge when the player stalls.
3. **Cards:** person (name, job, one human line, odds as word + percent, or why not in plain words; **Whisper** button with cost), follower (what they are doing now, where, since when; Recall, Lie low, Send prompt), group/Elite (town), enemy (what they do to you), area (how much is yours, what feeds it, what pushes back, what is here / what might be here), discovery reveal card. Two layers everywhere: two short lines, then **Details** on demand.
4. **Send affordance:** the one-line preview chip that follows the cursor ("Asel will explore the West Drift — 2 days — 3 Nether"), confirm/cancel, invalid reasons in plain words.
5. **Night controls:** End Night (shows what will happen: "3 followers set off, the stain grows"; warns once if nothing was done), miracle hand (compact, one a night, per `handoffs/P5-fix.md`), eat, evil acts when they exist.
6. **Day:** a slim day strip (bell → dusk progress, speed, skip), event tickers at the edge that never cover the action, the ≤ 3-line dawn summary, the chronicle (collapsed; readable history).
7. **Guidance engine (the hints bug dies here):** coach marks anchored to a world point or a control, driven by rules ("show when X, complete when the player does Y, never again"), one at a time, always dismissible, persisted, reset in Settings; the three first-night beats; just-in-time introductions for every new thing (first follower, first gray area, first guard, first discovery, hunger, heat, first miracle, the lift, the surface). Unlock toasts, level-up and Divinity-up moments, event modals (choices with consequences in plain words), warnings (hunger, a follower in danger), defeat reasons.
8. **Quality:** one visual language (inked, dark, violet accent; type scale; 8 px grid; icons from one set), motion on every state change (enter/exit/hover/press ≤ 150 ms), keyboard and touch, focus rings, text ≥ 12 px effective at every layout size, no clipping from 640×300 to 2560×1440 (`e2e/layout-check.cjs` rules), reduce motion honoured, zero layout shift when numbers change.

## Interface first
Within your first ten tool calls put the component list with exact props/view models and events at the top of your handoff (`mountHud(root, handlers) → { set(viewModel), pulse(id), hint(...), … }`). Additive after that.

## Proof
`dev/hud.html` (every component in every state with fake data; a scripted "first night" using the guidance engine over a still image of the mine) + `e2e/hud-shots.cjs` → `screenshots/hud-*.png` at 1600×900, 1366×768, 1015×240, 640×300, 2560×1440; automatic checks: no overflow/clipping, text sizes, contrast ≥ 4.5:1, every hint dismissible and never returning, tab order. Look at the shots yourself and fix what looks amateur.

## Ownership
Yours only: `src/ui/play/**`, `dev/hud.html`, `e2e/hud-shots.cjs`, `screenshots/hud-*.png`, `handoffs/HUD.md`. After the shell builder reports (`handoffs/P5-fix.md` says "REPORTED"; the orchestrator will tell you) you also own `src/ui/**` except `src/ui/settings.ts`. Append `### HUD — Play interface` to `DECISIONS.md`.
