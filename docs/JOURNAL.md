# Journal — how to pick this up again

<!-- NOT part of the agent read path. STATE.md and ARCHITECTURE/CLAUDE.md are capped
     so every agent invocation stays cheap; this file is the opposite — it is the
     long-form record a human (or a fresh session) reads once when resuming. -->

Last updated: 2026-09-05. Branch: `main`. HEAD `8411f69`.

## Where to start

```bash
npm install
npm run dev          # http://localhost:5173  — this is the only way to play it
npm test             # 91 tests, ~3s (the fairness probes still dominate)
npm run build        # tsc --noEmit && vite build
npm run lint
```

There is **no hosted URL**. It was live on GitHub Pages twice; the repo then became
private, which disables Pages on a free plan. `.github/workflows/deploy.yml` is
correct and **disabled, not deleted**.

**The repo is public again as of 2026-09-05** — `gh repo view` reports `PUBLIC`, so
the blocker this section described for two days no longer exists. What remains:

```bash
gh api -X POST repos/locxwin-sketch/flipfall/pages -f build_type=workflow
gh workflow enable "Deploy to Pages"
```

Still a public-exposure decision, not a technical one — but the exposure has already
happened, so the remaining choice is only whether the *game* is reachable.

Note the last two runs in `gh run list` show `failure`. Those are the pre-rollback
fairness-timeout runs from 09-03 that `42b52ea` fixed; the fix has never run in CI
because the workflow was disabled immediately afterwards. Expect green, verify by SHA.

## Dev affordances worth knowing

Both are `import.meta.env.DEV`-gated and cannot reach a production build.

- `?seed=<n>` — pins the world. Runs are otherwise seeded randomly, so without
  this no screenshot or bug report is reproducible.
- `?skip=<px>` — starts partway in, player mid-corridor. Spawning grounded at an
  arbitrary distance usually lands inside a hazard and dies on frame one.
- `?die=1` — fires the death fx at boot and sets the dead flag, so a still shows
  the whole death: splatter, wash, vignette, taunt. `--screenshot` cannot run JS,
  which is why this is a URL param and not just `__game.kill()`.
- `?death=slime|coins` — previews either death style without editing the constant.
- `?mode=gauntlet` — the second mode without holding the button. Gauntlet is
  otherwise reachable only by a gesture, which makes bug reports against it awkward.
- `?coins=<n>` — seeds a purse before `?die=1`, so the coin spill is actually in the
  still. Defaults to 8; a death with no coins correctly spills nothing.
- `window.__game` — live `run`, `ticksPerSecond`, `queueDepth`, `seed`, `chunks`,
  `replay()`, and `kill()` (fires the death fx in place, without dying).

**Screenshot recipe.** There is no browser automation configured (deliberately —
see Playwright below), but Chrome headless works and caught two real bugs that
reading the code did not:

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size=960,540 \
  --force-device-scale-factor=6 --virtual-time-budget=900 \
  --screenshot=out.png "http://localhost:5173/?seed=777&skip=11500"
sips -c 420 420 --cropOffset 2740 730 out.png --out zoom.png   # magnify a sprite
```

Caveat: headless virtual time nearly freezes the fx clock, so stills prove effects
*exist and are positioned right* but say nothing about their **timing**. Animation
feel has to be judged in a real browser.

## Decisions that overrode the approved plan

Each of these is a deliberate departure. Do not "restore" them without re-reading why.

1. **`minSlackTicks` floor is 6 (50ms), not the plan's 3 (25ms).** 25ms is below
   trained human timing precision and below two frames on a 60Hz display.
   Measurement overruled the plan. The constant carries the reason inline.
2. **Fairness is measured as "does a *forgiving* line exist", not "does a line
   exist".** See the trap below — this one bit us hard.
3. **The hand-authored 30s level is deleted.** It was a fixture to answer "does
   flipping gravity feel good". It got cleared, so it had done its job; its
   primitives are now the generator's pattern vocabulary.
4. **Content model is endless, not staged** — and as of 09-05 that is half true.
   There are two MODES, but neither is staged: each is one continuous curve with no
   acts, gates or zones. A mode is a curve plus a seed salt, not a chapter.
5. **The difficulty curve eases OUT, not in — this reverses decision 1's sibling.**
   The ramp used to smoothstep (ease-in) from 2600px on the theory that a flat first
   stretch reads as a gentle opening. Playtest on 09-04 called it a drag, and the
   measurement explains why: because `hazardCount` and `maxTier` are rounded, a flat
   toe means *identical content* — one hazard, tier 0 — for the first 37 seconds.
   Now `1 - (1-t)^1.6` from 1200px: a second hazard by 14s, tier 1 by 19s, still ~67s
   to max. `difficulty.test.ts` asserts the experienced ramp, not the raw scalar.
6. **The death is green slime, and it is also a piggy bank.** Asked for directly
   after the timing was judged good, so no *duration* has ever changed — only colour
   and mass. It was red first; green was requested on 09-04 and red is gone. Because
   gore narrows the portal fork (Poki restricts it, CrazyGames does not), both looks
   ship and `DEATH_STYLE` in `src/constants/death.ts` selects one. The fork is a
   business decision again rather than an art one.
7. **Art came before the portal work,** not at T10a as planned, because it was asked
   for. No portal adapter exists yet.
7b. **A second mode arrived before the portal work too,** and for the same reason.
   Gauntlet is not a difficulty setting bolted on: its curve's `easiest` IS Endless's
   `hardest`, so the two are continuous and the second mode opens on the state the
   first spends ~67s climbing to. That join is the design, and `modes.test.ts` pins
   it — retune `HARDEST` without touching `GAUNTLET_CURVE` and Gauntlet silently
   stops being a continuation. Endless salts to seed 0 so its seed→world mapping is
   byte-identical to what it was before modes existed; every screenshot and bug
   report taken so far still means what it said.
8. **There is no `src/lib/game/solver.ts`, and there never was.** The plan's T04
   specified a BFS reachability solver running *at generation time*, re-rolling any
   chunk that failed the margin requirement and emitting `SAFE_CHUNK` on overflow.
   None of that exists: `grep` finds no `SAFE_CHUNK` and no re-roll anywhere in
   `src/`. What shipped instead is a hand-authored pattern vocabulary that is fair
   *by construction*, with a beam-search probe living entirely in
   `generator.test.ts` that asserts it after the fact. This is arguably the better
   trade — a pattern lookup cannot hitch a frame the way a BFS can, which is also
   why the plan's "measure the generation budget on a real Android" never happened
   and no longer matters. But it is a **different guarantee** from the one that was
   approved: generated content is checked, not repaired. A pattern that failed the
   probe would ship broken and turn a test red rather than degrading to a safe
   chunk at runtime. Worth naming because the plan called that file "where the
   fairness guarantee is real or fake".
9. **`hazardCount` was lerped and asserted but never read — now fixed;
   `minSlackTicks` still is not.** For two days both sat in `DifficultyParams`,
   were interpolated in `paramsAt`, and were asserted in `difficulty.test.ts` /
   `generator.test.ts` while no production code path consumed either. Density was
   emergent: however many rects the tier pool's chosen pattern happened to emit.
   This means decision 5's stated reasoning ("because `hazardCount` and `maxTier`
   are rounded…") was half wrong — only `maxTier` and the continuous pinch params
   shaped content. The playtest conclusion held; the mechanism was mis-described.

   As of 09-05 `hazardCount` is real: `addFiller` tops a chunk up to that many
   PLACEMENTS (a pinch counts as one, because that is what the player reads it as)
   with lone spikes, spaced at least `FILLER_SPACING` from anything already there.
   The fairness probe passed unchanged in both modes, which is the only reason it
   shipped. **One thing this broke and had to be fixed immediately: filler was
   filling the `empty` pattern**, whose entire job is to be a breather. A ceiling
   turned into a quota and the game lost its rhythm. Patterns can now declare
   `breather: true` and are exempt. `minSlackTicks` remains deliberately test-only —
   it is a contract on generated output, not an input to it.

## Traps already paid for

- **Pink blood does not work, and the reason generalises.** The obvious way to make
  the death portal-safe is to recolour the fluid. But the pig's body is `#ff9ec4`,
  so pink debris merges with the sprite shatter — which already flings the pig's own
  pink pixels — and stops reading as an effect at all. Worse, pink-on-pink reads as
  *chunks of pig*, which is closer to what a kids' portal objects to than stylised
  red is. `death.test.ts` asserts every style's debris stays >45 RGB units from the
  pig's own palette, which it imports from `sprites.ts` so the guard follows the pig
  if it is ever recoloured. 45 was measured, not guessed: the shipped styles sit 64.7
  away at their closest, pink candidates score 0-25. The lesson: debris must contrast
  with the thing it came out of, or it is not debris.
- **Colours picked without checking them against the backdrop kept disappearing.**
  Three times: banknote green `#7dbf6a` sat on hill green `#4cb04c` and vanished over
  every hill; the gold wash was yellow, the sky's near-complement, and neutralised to
  grey haze; the coins' dark gold measured 40 from the brick floor, so coins that
  landed on the ground half-disappeared. All three were caught by staring at a
  screenshot rather than by reading the palette — so the check is now automated, in
  `death.test.ts`, against every backdrop surface at the same 45-unit threshold.

  This is also *why the slime is an acid yellow-green* rather than a believable one.
  The backdrop is full of greens, and every natural slime colour fails the check:
  emerald measures 32 against hillFar, forest green 40 against bushDark. Shifting
  hard toward yellow was the only way green debris stays visible over a green world.
- **A full-frame wash hides information just as effectively as a bad backdrop
  colour.** The coin spill on death was invisible under the slime style and obvious
  under the coins style — same particles, same code path. Cause: the death wash is a
  0.52-alpha green tint over the entire frame, and gold under it goes olive. This is
  the disappearing-colour trap again, arriving through a tint rather than the
  backdrop, and the usual fix does not apply: no gold survives a heavy green wash, so
  recolouring cannot work. Layering can. Particles now carry an `above` flag and are
  drawn in a second world-space pass after the wash — the same reasoning that already
  put the lens splatter in front of the vignette. **The rule generalises: anything
  that reports what the run earned belongs above the wash; only scenery belongs
  under it.**

- **Never `clearRect` to shape a sprite.** The lens debris is drawn over the world,
  so punching a notch out of a confetti flake with `clearRect` erased the scenery
  behind it. Irregular silhouettes have to be built additively.

- **The fairness metric was wrong in a way that inverted its own results.** The beam
  search returned the *first* clearing schedule, which measured an arbitrary
  knife-edge line. Symptom: widening every gap made the score *worse* (7 ticks → 1).
  It now ranks candidate lines by **clearance** as well as progress. That fix flipped
  three level designs from "unplayable at 8ms" to "fine at 58ms" — the metric had
  been condemning playable content.
- **Clearable ≠ fair.** The first level passed a clearability check with a 17ms
  tightest flip. It was beatable by a machine and impossible for a human. This is
  why `generator.test.ts` asserts tolerance, not just existence.
- **Green locally, red in CI.** The fairness search took 6.7s on a GitHub runner
  against Vitest's 5s default timeout. Fixed with a spatial index and an explicit
  120s timeout. Any search-shaped test needs both.
- **`gh run list --limit 1` right after a push returns the PREVIOUS run.** That made
  me report a successful deploy that had actually failed. Always match on commit SHA.
- **Do not configure Playwright.** It sits installed-but-unconfigured in
  `options-tracker-web` and would become a second dead end. Chrome headless above is
  enough.
- **Drawn shape must equal the collision box.** Hazard silhouettes are exactly their
  rect, with spike teeth as highlights *inside* it. The pig's ears overhang slightly,
  which errs forgiving. Getting this backwards is how the game earned "seems
  impossible" the first time.

## What is genuinely unverified

- **The re-tuned ramp and both death styles have not been seen in motion.** All
  landed 09-04 after a playtest of the *previous* build. The explosion's timing was
  judged good and was deliberately not touched; everything added is colour and mass.
- **The taunt has been read once, by nobody.** "YOU SUCK / DON'T EVEN TRY AGAIN"
  fires on every death, dozens of times a session. The second line is reverse
  psychology and is also still the only instruction there is. One fixed line may
  wear out; a rotating set is the obvious next move if it does.
- **No outside playtesters, ever.** The kill gate was passed by the author clearing
  the level. That was tolerable for a fixed level and is weaker now that the content
  is generated and nobody has seen most of it.
- **Portal fork undecided.** Poki is web-exclusive for 5 years; CrazyGames is not.
  They are mutually exclusive, and the choice must be made *before* any portal
  adapter is written, or the work is wasted.
- **Working title "Flipfall"** is a placeholder that already became the repo name.

## Session limits hit (both reset independently)

- **Codex**: monthly usage limit, reset 2026-09-15. Never produced a review.
- **Claude subagents**: monthly spend limit hit mid-workflow; 4 of 9 agents in the
  level-design run died. Local work (tests, screenshots, builds) costs nothing.
