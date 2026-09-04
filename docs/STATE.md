# State

<!-- Owner: PM (main session). 50 lines max. Read this first every session.
     Long-form context and gotchas live in docs/JOURNAL.md, deliberately outside
     the agent read path so these caps stay honest. -->

**Phase**: mvp-build
**Branch**: `main` (feature/pig-explosion points at the same commit)

## Now

- [ ] `replay-both-changes` Play again. The ramp now climbs early and the death is
      green and wet; both landed 09-04, neither seen in motion by anyone.
      `?die=1` previews a death, `?death=coins` the other variant.

## Next (in dependency order)

- [ ] `portal-fork` DECIDE Poki (web-exclusive 5yr) vs CrazyGames. No longer
      constrained by the art: `DEATH_STYLE` in `src/constants/death.ts` flips
      between a green-slime death and a piggy-bank one. Decide on terms.
- [ ] `coyote-buffer` Coyote time + input buffering — the two biggest perceived
      fairness wins left, and both are pure feel
- [ ] `thumbnails` Static + animated thumbnails — a hard portal requirement

## Done

- [x] `death-styles` `DEATH_STYLE` picks slime or coins; shared timings, only colour
      and shape differ. Taunt: "YOU SUCK / DON'T EVEN TRY AGAIN" — 09-04
- [x] `judge-explosion` PASSED on timing, then made wetter by request: pixel-art
      lens splatter, shrapnel, rings, full-frame wash — 09-04
- [x] `playtest-ramp` ANSWERED "flat opening drags". Ease-in → ease-out,
      RAMP_START_PX 2600 → 1200; asserted in `difficulty.test.ts` — 09-04
- [x] `persist-best` Best in localStorage; degrades to 0 when storage is blocked
      (Safari private mode throws on access, not just on write) — 09-04
- [x] Endless mode: seeded RNG, chunk generator, fairness probe — 09-04
- [x] Art pass: 8-bit backdrop, brick, particles, shake, hitstop, pig — 09-03
- [x] KILL GATE **PASSED** — author cleared the hand-authored level — 09-03
- [x] Scaffold: Vite + TS strict + eslint + vitest — 09-03

## Notes and deferred items

- **Hosting is local only.** Repo private; Pages needs public on a free plan.
  `deploy.yml` is disabled, not deleted. Resume steps in JOURNAL.md.
- **No outside playtesters, ever.** Weaker now that content is generated.
- `minSlackTicks` floor is 6 (50ms), not the plan's 3 — measurement overruled it.
  "Flipfall" is a placeholder that already became the repo name.
- Codex quota resets 09-15; Claude subagent spend limit was hit mid-run.

## Escalation log — (none)
