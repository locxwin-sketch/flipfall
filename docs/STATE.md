# State

<!-- Owner: PM (main session). 50 lines max. Read this first every session. -->

**Phase**: mvp-build
**Escalation tier**: 1

## Now

- [ ] `playtest-endless` Play the endless run. Is the ramp right? Does it get hard
      too fast, too slow, or in the wrong way?

## Next (in dependency order)

- [ ] `006-juice-pass` Coyote time + input buffering (perceived fairness)
- [ ] `007-persist` Best score in localStorage, wrapped in try/catch
- [ ] `010a-art` Art direction + thumbnails (portal requirement)
- [ ] `011-portal` Portal adapter seam — after the fork is chosen

## Done

- [x] `003a-rng` Seeded RNG (mulberry32 + fork) — 2026-09-04
- [x] `003b-difficulty` Difficulty curve as data — 2026-09-04
- [x] `005-generator` Chunk generator, 12 patterns across 4 tiers, shuffle-bag
      with adjacency fixing — 2026-09-04
- [x] `004-fairness` Survivability probe on generated windows, 6-tick floor — 2026-09-04
- [x] `art-pass` 8-bit backdrop, particles, screenshake, hitstop — 2026-09-03
- [x] `001-prototype` KILL GATE **PASSED** — user cleared the hand-authored level,
      which is the behavioural answer to "do I want to tap again" — 2026-09-03
- [x] `000-scaffold` Vite + TS strict + eslint + vitest, canvas shell — 2026-09-03

<!-- 002 (ship) was DONE and then ROLLED BACK on 2026-09-03. The repo was created
     public, Pages deployed successfully twice, then the repo became private —
     which disables Pages on a free plan, 404s the site, and fails the workflow at
     configure-pages. Decision: local-only for now. The deploy workflow is disabled
     (state: disabled_manually), not deleted; .github/workflows/deploy.yml is intact
     and correct. To resume: make the repo public, POST /pages with
     build_type=workflow, `gh workflow enable "Deploy to Pages"`, push.
     The never-deployed pattern was broken and then un-broken. Worth noticing. -->

## Notes and deferred items

- Working title "Flipfall" is a placeholder. It becomes the repo name and the public
  URL at 002, so decide before then.
- T01 gate passed by the author clearing the level. Never got outside testers; that
  weakness stands and matters more now the game is endless.
- The hand-authored 30s level is GONE. It was a fixture to prove the mechanic, and
  its primitives live on in generator.ts. Endless mode replaced it.
- HARDEST.minSlackTicks is 6, not the plan's 3. 25ms is below human timing and below
  two frames at 60Hz; measurement overruled the plan.
- Portal fork (Track A CrazyGames vs Track B Poki, mutually exclusive for 5 years)
  must be decided before 011. Not yet decided.
- Apply for a Poki developer account on day one either way — forecloses nothing,
  approval timing unverified.
- `minSlackTicks` one-sided vs ± is unresolved; decide at 004, measure at 008.

## Escalation log

<!-- Every tier change, with the reason. -->

- (none)
