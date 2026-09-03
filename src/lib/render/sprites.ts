// Pixel sprites as character maps. Chunky on purpose — at 2px per cell an 11x11
// grid lands exactly on the 22x22 player box, so the drawn pig and the thing that
// collides are the same size. Extremities (ear tips, snout) may overhang by a
// pixel or two, which errs FORGIVING: an ear clipping a spike does not kill you.

export const PIXEL = 2

const COLORS: Record<string, string> = {
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
      const color = COLORS[ch]
      if (color) out.push({ dx: x, dy: y, color })
    })
  })
  return out
}

export const PIG_PIXELS: readonly SpritePixel[] = compile(PIG)
export const PIG_W = PIG[0]!.length
export const PIG_H = PIG.length

/**
 * Draws the pig with its feet pointing the way gravity pulls. `squash` compresses
 * along the travel axis; `flipY` is applied around the sprite's own centre so the
 * pig lands on its feet on the ceiling too.
 */
export function drawPig(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  gravitySign: 1 | -1,
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

  ctx.restore()
}
