# State

<!-- Owner: PM (main session). 50 lines max. Read this first every session.
     Long-form context and gotchas live in docs/JOURNAL.md, deliberately outside
     the agent read path so these caps stay honest. -->

**Phase**: mvp-build
**Branch**: `feature/pig-explosion` (main is identical; nothing was moved)

## Now

- [ ] `playtest-ramp` Play the endless run in a real browser. Does difficulty
      arrive too fast, too slow, or in the wrong way? Nothing else should start
      until this is answered — everything below is tuning in the dark otherwise.
- [ ] `judge-explosion` Same session: does the death read as dramatic or sluggish?
      Only ever seen as frozen stills. Knobs are in `src/constants/feel.ts`.

## Next (in dependency order)

- [ ] `coyote-buffer` Coyote time + input buffering — the two biggest perceived
      fairness wins left, and both are pure feel
- [ ] `persist-best` Best score in localStorage, wrapped in try/catch
- [ ] `portal-fork` DECIDE Poki (web-exclusive 5yr) vs CrazyGames. Must precede
      any adapter work or the work is wasted
- [ ] `thumbnails` Static + animated thumbnails — a hard portal requirement

## Done

- [x] Pig sprite + shatter/ring death explosion, reduced-motion support — 09-04
- [x] Endless mode: seeded RNG, difficulty curve, chunk generator, fairness
      probe on generated content — 09-04
- [x] Art pass: 8-bit backdrop, brick, particles, screenshake, hitstop — 09-03
- [x] KILL GATE **PASSED** — author cleared the hand-authored level, which is the
      behavioural answer to "do I want to tap again" — 09-03
- [x] Scaffold: Vite + TS strict + eslint + vitest — 09-03

## Notes and deferred items

- **Hosting is local only.** Repo went private; Pages needs public on a free plan.
  `deploy.yml` is correct and disabled, not deleted. Resume steps in JOURNAL.md.
- **No outside playtesters, ever.** Weaker now that content is generated.
- `minSlackTicks` floor is 6 (50ms), not the plan's 3. Measurement overruled it.
- "Flipfall" is a placeholder that already became the repo name.
- Codex quota resets 09-15; Claude subagent spend limit was hit mid-run.

## Escalation log

- (none)
