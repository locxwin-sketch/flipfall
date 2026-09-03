// Expanding rings. Render-only, like everything under fx/.
//
// A ring is what makes an explosion read as force rather than as confetti: the
// particles say "pieces", the ring says "pressure".

const MAX = 6

interface Ring {
  x: number
  y: number
  life: number
  maxLife: number
  radius: number
  width: number
  color: string
}

const pool: Ring[] = Array.from({ length: MAX }, () => ({
  x: 0,
  y: 0,
  life: 0,
  maxLife: 1,
  radius: 0,
  width: 0,
  color: '#fff',
}))
let cursor = 0

export function ring(
  x: number,
  y: number,
  radius: number,
  lifeMs: number,
  color: string,
  width = 4,
): void {
  const r = pool[cursor]!
  cursor = (cursor + 1) % MAX
  r.x = x
  r.y = y
  r.life = lifeMs / 1000
  r.maxLife = r.life
  r.radius = radius
  r.width = width
  r.color = color
}

export function clearRings(): void {
  for (const r of pool) r.life = 0
}

export function updateRings(dt: number): void {
  for (const r of pool) {
    if (r.life > 0) r.life = Math.max(0, r.life - dt)
  }
}

/** World coordinates — call inside the camera transform. */
export function drawRings(ctx: CanvasRenderingContext2D): void {
  for (const r of pool) {
    if (r.life <= 0) continue
    const t = 1 - r.life / r.maxLife // 0 -> 1 as it expands
    // Ease-out: fast punch outward, then it hangs and fades.
    const eased = 1 - (1 - t) * (1 - t)
    ctx.globalAlpha = (1 - t) * 0.85
    ctx.strokeStyle = r.color
    ctx.lineWidth = Math.max(1, r.width * (1 - t))
    ctx.beginPath()
    ctx.arc(r.x, r.y, Math.max(1, r.radius * eased), 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}
