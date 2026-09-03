import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // The determinism fence. Everything under src/lib/game/ must be reproducible
    // from a seed alone: replays, the daily challenge, and the solver's fairness
    // guarantee all depend on it. src/lib/fx/ is render-only and exempt.
    files: ['src/lib/game/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message:
            'Determinism: use the seeded Rng from @/lib/engine/rng. Math.random() is allowed only in src/lib/fx/ (render-only).',
        },
      ],
    },
  },
)
