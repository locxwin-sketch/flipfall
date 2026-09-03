# Flipfall

A one-button precision game. Tap to flip gravity; you fall toward the new surface
under real acceleration rather than snapping to it. Easy for about fifteen seconds.

**Play:** `npm install && npm run dev`, then open http://localhost:5173/

(There was a public build at locxwin-sketch.github.io/flipfall/ — it is offline while
the repo is private, since GitHub Pages needs a public repo on a free plan. The deploy
workflow is intact and disabled, not deleted.)

Space, click, or tap — all the same input. Death restarts on your next tap with no
lockout.

## The one mechanic

A flip reverses gravity and keeps 15% of your vertical speed instead of zeroing it.
Three things fall out of that single line, none of which need explaining in-game:

- Single flips feel immediate.
- **Two flips in quick succession nearly cancel your speed**, so you hover — and
  thread slots a single flip cannot.
- Flipping at terminal velocity keeps more residual momentum and overshoots further,
  so panic-flipping is punished and committed early flips are optimal.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc --noEmit && vite build
npm test         # vitest run
npm run lint
```

Zero runtime dependencies. Vite + TypeScript + Canvas 2D, one bundle, no audio files
(every sound is a synthesized oscillator). The simulation runs on a fixed 120Hz
timestep and is fully deterministic — a run is reproducible from its press schedule
alone, which is what `replay.test.ts` pins.

See `CLAUDE.md` for architecture and `docs/STATE.md` for where the work is.
