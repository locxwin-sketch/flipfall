# Journal — how to pick this up again

<!-- NOT part of the agent read path. STATE.md and ARCHITECTURE/CLAUDE.md are capped
     so every agent invocation stays cheap; this file is the opposite — it is the
     long-form record a human (or a fresh session) reads once when resuming. -->

Last updated: 2026-09-04. Branch: `feature/pig-explosion`. HEAD `a8e1662`.

## Where to start

```bash
npm install
npm run dev          # http://localhost:5173  — this is the only way to play it
npm test             # 30 tests, ~10s (the fairness probes dominate)
npm run build        # tsc --noEmit && vite build
npm run lint
```

There is **no hosted URL**. It was live on GitHub Pages twice; the repo then became
private, which disables Pages on a free plan. `.github/workflows/deploy.yml` is
correct and **disabled, not deleted**. To bring it back:

```bash
gh repo edit locxwin-sketch/flipfall --visibility public
gh api -X POST repos/locxwin-sketch/flipfall/pages -f build_type=workflow
gh workflow enable "Deploy to Pages"
```

That is a public-exposure decision, not a technical one.

## Dev affordances worth knowing

Both are `import.meta.env.DEV`-gated and cannot reach a production build.

- `?seed=<n>` — pins the world. Runs are otherwise seeded randomly, so without
  this no screenshot or bug report is reproducible.
- `?skip=<px>` — starts partway in, player mid-corridor. Spawning grounded at an
  arbitrary distance usually lands inside a hazard and dies on frame one.
- `window.__game` — live `run`, `ticksPerSecond`, `queueDepth`, `seed`, `chunks`,
  and `replay()`.

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
4. **Content model is endless, not staged.** Chosen after the kill gate passed.
5. **Art came before the portal work,** not at T10a as planned, because it was asked
   for. No portal adapter exists yet.

## Traps already paid for

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

- **The difficulty ramp has never been playtested.** It is the top item in STATE.md.
- **The explosion's timing** — hitstop 150ms, debris 900ms — has only been seen as
  frozen stills. Numbers live in `src/constants/feel.ts`.
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
