# State

<!-- Owner: PM (main session). 50 lines max. Read this first every session.
     Long-form context and gotchas live in docs/JOURNAL.md, deliberately outside
     the agent read path so these caps stay honest. -->

**Phase**: mvp-build
**Branch**: `main` (feature/pig-explosion points at the same commit)

## Now

- [ ] `playtest-gauntlet` Play BOTH modes (tap/hold). Ramp, deaths, coins, Flow —
      nothing since 09-03 seen in motion. `?mode=gauntlet`

## Next (in dependency order)

- [ ] `gauntlet-b` Moving hazards (plan `eager-knuth` Phase B). Motion phase must be
      a function of DISTANCE, not tick — the probe has no tick origin
- [ ] `gauntlet-c` Surface gaps (Phase C) — the only change reaching inside
      `stepPlayer`; last, and only once B is green
- [ ] `portal-fork` DECIDE Poki (web-exclusive 5yr) vs CrazyGames. Art no longer
      constrains it — `DEATH_STYLE` flips slime/piggy-bank. Decide on terms.
- [ ] `coyote-buffer` Coyote time + input buffering — pure feel, biggest wins left
- [ ] `thumbnails` Static + animated thumbnails — a hard portal requirement

## Done

- [x] `flow` Combo multiplier: streak of near-misses multiplies coins/grazes,
      resets on landing not a timer. Codex's first design (pay a graze out only
      later, on a coin) was rejected — see JOURNAL. 91 → 98 tests — 09-05
- [x] `gauntlet-a` Second mode, hold-to-start. Per-mode curves and bests, coins,
      near-miss grazing, coin-spill death, rotating taunts, `hazardCount` made
      real. Fairness probe extended to cover it. 62 → 91 tests — 09-05
- [x] `death-styles`/`judge-explosion` DEATH_STYLE slime/coins; PASSED on
      timing, then made wetter: splatter, rings — 09-04
- [x] `playtest-ramp` ANSWERED "flat opening drags"; ease-in → ease-out — 09-04
- [x] `persist-best` Best in localStorage; degrades to 0 when blocked — 09-04
- [x] Endless mode: seeded RNG, chunk generator, fairness probe — 09-04
- [x] Art pass: 8-bit backdrop, brick, particles, shake, hitstop, pig — 09-03
- [x] KILL GATE **PASSED** — author cleared the hand-authored level — 09-03
- [x] Scaffold: Vite + TS strict + eslint + vitest — 09-03

## Notes and deferred items

- **No hosted URL**, but the blocker is gone: repo is PUBLIC. `deploy.yml` disabled.
- **No outside playtesters, ever.** Weaker now that content is generated.
- `minSlackTicks` floor is 6 (50ms) in every mode. "Flipfall"/"Gauntlet" are placeholders.
- Codex quota resets 09-15; Claude subagent spend limit was hit mid-run.

## Escalation log — (none)
