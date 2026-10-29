/** Circle swept along one fixed tick, with no sampling gaps or extra RNG. */
export function sweptCircle(
  shot: { x: number; y: number; vx: number; vy: number; radius: number },
  target: { x: number; y: number; radius: number },
): boolean {
  const x = shot.x - shot.vx;
  const y = shot.y - shot.vy;
  const length2 = shot.vx ** 2 + shot.vy ** 2;
  const t = length2 === 0 ? 0 : Math.max(
    0,
    Math.min(
      1,
      ((target.x - x) * shot.vx + (target.y - y) * shot.vy) / length2,
    ),
  );
  return (x + t * shot.vx - target.x) ** 2 +
      (y + t * shot.vy - target.y) ** 2 <
    (shot.radius + target.radius) ** 2;
}
