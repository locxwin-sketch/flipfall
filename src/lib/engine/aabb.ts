export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Touching edges do NOT count as overlap — a pixel-perfect graze is a survival. */
export function overlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/** Bounding box of a box's motion across one tick, for swept collision. */
export function sweep(from: Box, dx: number, dy: number): Box {
  return {
    x: Math.min(from.x, from.x + dx),
    y: Math.min(from.y, from.y + dy),
    w: from.w + Math.abs(dx),
    h: from.h + Math.abs(dy),
  }
}
