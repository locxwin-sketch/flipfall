// Pixel sprites as character maps. Chunky on purpose — at 2px per cell an 11x11
// grid lands exactly on the 22x22 player box, so the drawn pig and the thing that
// collides are the same size. Extremities (ear tips, snout) may overhang by a
// pixel or two, which errs FORGIVING: an ear clipping a spike does not kill you.

export const PIXEL = 2

/** Gold showing through the pig's belly. Matches the coin palette deliberately. */
const PIG_FILL = '#ffd23f'
const PIG_FILL_BRIGHT = '#fff3a0'

/**
 * The pig's whole palette. Exported because `death.test.ts` guards new death styles
 * against picking debris that matches the pig — debris has to contrast with the
 * thing it came out of, or it stops reading as debris. Importing it here means that
 * guard tracks the sprite automatically if the pig is ever recoloured.
 */
export const PIG_COLORS: Record<string, string> = {
  k: '#7a2f4a', // outline
  p: '#ff9ec4', // body
  d: '#e87ba6', // body shadow
  s: '#ffc9dd', // snout
  n: '#a83e68', // nostril
  e: '#2a1520', // eye
  w: '#ffffff', // eye glint
  l: '#c85f8a', // trotter
}

/**
 * Pig, front-facing, 11 wide x 11 tall. Read it as art, not code — the shape is
 * the spec.
 *
 * Front-facing beats side-on at this size. The first attempt was a side view with
 * tall ears and a deep notch between them, and at 22px it read as a bat. Two ears,
 * two eyes and a big central snout is the silhouette people already recognise.
 */
const PIG = [
  '..kk...kk..',
  '.kppk.kppk.',
  'kkppkkkppkk',
  'kpppppppppk',
  'kpepppppepk',
  'kpppppppppk',
  'kpssssssspk',
  'kpsnsssnspk',
  'kpssssssspk',
  '.kdpppppdk.',
  '..lll.lll..',
]

export interface SpritePixel {
  dx: number
  dy: number
  color: string
}

function compile(rows: readonly string[]): SpritePixel[] {
  const out: SpritePixel[] = []
  rows.forEach((row, y) => {
    ;[...row].forEach((ch, x) => {
      const color = PIG_COLORS[ch]
      if (color) out.push({ dx: x, dy: y, color })
    })
  })
  return out
}

export const PIG_PIXELS: readonly SpritePixel[] = compile(PIG)
export const PIG_W = PIG[0]!.length
export const PIG_H = PIG.length

/**
 * How many coins fill the pig completely. Past this the belly is simply full — the
 * counter keeps climbing but the sprite stops changing, because an 11x11 grid runs
 * out of belly long before a good run runs out of coins.
 */
export const PIG_FULL_COINS = 12

/** Belly cells, bottom row first — the pig fills from the bottom, like a jar. */
const BELLY: ReadonlyArray<readonly [number, number]> = [
  [3, 8], [4, 8], [5, 8], [6, 8], [7, 8],
  [3, 7], [4, 7], [6, 7], [7, 7],
  [3, 6], [4, 6], [5, 6], [6, 6], [7, 6],
]

/**
 * Draws the pig with its feet pointing the way gravity pulls. `squash` compresses
 * along the travel axis; `flipY` is applied around the sprite's own centre so the
 * pig lands on its feet on the ceiling too.
 *
 * `coins` fills the snout area with gold from the bottom up. The pig is a piggy
 * bank, and this is the only place that fact is visible while alive — without it,
 * collecting is a number in the corner and the death spill comes out of nowhere.
 */
export function drawPig(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  gravitySign: 1 | -1,
  coins = 0,
): void {
  const sx = w / (PIG_W * PIXEL)
  const sy = h / (PIG_H * PIXEL)

  ctx.save()
  ctx.translate(Math.round(x + w / 2), Math.round(y + h / 2))
  ctx.scale(sx, sy * gravitySign)
  ctx.translate((-PIG_W * PIXEL) / 2, (-PIG_H * PIXEL) / 2)

  for (const px of PIG_PIXELS) {
    ctx.fillStyle = px.color
    ctx.fillRect(px.dx * PIXEL, px.dy * PIXEL, PIXEL, PIXEL)
  }

  if (coins > 0) {
    // Drawn AFTER the body, over the snout cells, so it reads as gold showing
    // through rather than as a recoloured pig.
    const n = Math.min(BELLY.length, Math.round((coins / PIG_FULL_COINS) * BELLY.length))
    for (let i = 0; i < n; i++) {
      const cell = BELLY[i]!
      ctx.fillStyle = i === n - 1 ? PIG_FILL_BRIGHT : PIG_FILL
      ctx.fillRect(cell[0] * PIXEL, cell[1] * PIXEL, PIXEL, PIXEL)
    }
  }

  ctx.restore()
}
