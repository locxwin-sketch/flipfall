# State

<!-- Owner: PM (main session). 50 lines max. Read this first every session. -->

**Phase**: mvp-build
**Escalation tier**: 1

## Now

- [ ] `001-prototype` **KILL GATE — awaiting human verdict.** Code complete, 20 tests
      green, level proven clearable AND humanly timeable (7 ticks / 58ms slack).
      Play locally: `npm run dev`. Needs a verdict on "after dying, do I want to
      tap again?" Testers not yet named.
- [ ] `002-ship` REOPENED — see Done. Blocked on a hosting decision, not on code.

## Next (in dependency order)

- [ ] `003a-rng` Seeded RNG
- [ ] `003b-difficulty` Difficulty table + tests
- [ ] `004-solver` Reachability solver + solver.test.ts + measured budget on real Android
- [ ] `005-generator` Generator + patterns + no-repeat rule
- [ ] `006-collide` Collision, death, score

## Done

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
- T01 gate needs **three named people** and a date before it starts. Not yet named.
- Portal fork (Track A CrazyGames vs Track B Poki, mutually exclusive for 5 years)
  must be decided before 011. Not yet decided.
- Apply for a Poki developer account on day one either way — forecloses nothing,
  approval timing unverified.
- `minSlackTicks` one-sided vs ± is unresolved; decide at 004, measure at 008.

## Escalation log

<!-- Every tier change, with the reason. -->

- (none)
