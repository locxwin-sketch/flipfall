// What a death looks like, as data rather than as branches inside main.ts.
//
// Why this exists: the death effect is the one piece of art that constrains which
// portal will take the game. Poki's audience skews young and it restricts gore;
// CrazyGames does not. Rather than let that decide the art, both looks ship and a
// single constant selects one. See docs/STATE.md `portal-fork`.
//
// Neither style is red. Green slime is already a long-standing way to keep a
// splatter effect out of gore territory, so `slime` is the softer default and
// `coins` is the one with nothing to argue about at all.
//
// Every *timing* number is shared and lives in feel.ts — hitstop, debris life, ring
// duration were all judged good in playtest and must not drift apart between the two
// styles. Only colour, mass and shape differ here.

import { PALETTE } from './palette'

export type DeathStyle = 'slime' | 'coins'

/** How lens debris is drawn: a wet blob that runs, or a dry flake that does not. */
export type LensShape = 'blob' | 'chip'

export interface DeathLook {
  /** The two heavy debris bursts, thrown with the sprite's own pixels. */
  chunkA: { color: string; size: number; gravity: number }
  chunkB: { color: string; size: number; gravity: number }
  /** Shockwave rings: leading edge, body, wake. The wake is dark in both styles
   *  because a bright ring on a bright ring loses its edge. */
  rings: readonly [string, string, string]
  /** Fine sparks — the fast, bright layer that sells the bang. */
  spark: string
  /** The one layer that drifts *against* gravity, so it reads as not-debris. */
  drift: string
  /** What ends up stuck on the camera lens. */
  lens: { colors: readonly string[]; shape: LensShape; drips: boolean }
  /** Full-frame wash on the death frame. */
  wash: string
  /** Radial vignette held while dead. */
  vignette: string
}

export const DEATH_LOOKS: Record<DeathStyle, DeathLook> = {
  // The default. Acid green reads against the pink pig because it is nowhere near
  // pink, and against the green hills because it is nowhere near a natural green —
  // see the palette note, and JOURNAL.md on why pink-on-pink failed.
  slime: {
    chunkA: { color: PALETTE.slime, size: 4, gravity: 1000 },
    chunkB: { color: PALETTE.slimeDark, size: 6, gravity: 1150 },
    rings: [PALETTE.slimeBright, PALETTE.slime, PALETTE.hazard],
    spark: PALETTE.hazardTip,
    drift: PALETTE.cloud,
    lens: {
      colors: [PALETTE.slime, PALETTE.slimeBright, PALETTE.slimeDark],
      shape: 'blob',
      drips: true,
    },
    wash: PALETTE.slimeFilm,
    vignette: PALETTE.vignetteSlime,
  },

  // The pig is a piggy bank, not a body. Same blast, same timings, nothing to
  // object to: coins have the mass, confetti has the colour, and the banknote
  // flecks drift up where the smoke used to, because paper is the thing in the
  // frame that would not fall.
  coins: {
    chunkA: { color: PALETTE.coin, size: 4, gravity: 1000 },
    chunkB: { color: PALETTE.coinDark, size: 5, gravity: 1150 },
    rings: [PALETTE.coinBright, PALETTE.coin, PALETTE.hazard],
    spark: PALETTE.coinBright,
    drift: PALETTE.note,
    lens: {
      colors: [
        PALETTE.coin,
        PALETTE.confettiA,
        PALETTE.confettiB,
        PALETTE.confettiC,
        PALETTE.confettiD,
      ],
      shape: 'chip',
      drips: false,
    },
    wash: PALETTE.goldFilm,
    vignette: PALETTE.vignetteCoins,
  },
}

/**
 * The style this build ships with. Flip to 'coins' for a family-friendly portal.
 * In dev, `?death=coins` overrides it without editing code.
 */
export const DEATH_STYLE: DeathStyle = 'slime'
