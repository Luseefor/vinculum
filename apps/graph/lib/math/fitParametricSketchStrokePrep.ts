export function resampleStrokeByArcLength(
  points: { horizontal: number; vertical: number }[],
  targetCount: number
) {
  if (points.length < 2) {
    return points;
  }

  const dists: number[] = [0];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const dx = points[i].horizontal - points[i - 1].horizontal;
    const dy = points[i].vertical - points[i - 1].vertical;
    const d = Math.hypot(dx, dy);
    total += d;
    dists.push(total);
  }

  if (total < 1e-12) {
    return [points[0]];
  }

  const out: { horizontal: number; vertical: number }[] = [];
  const count = Math.max(2, Math.min(targetCount, Math.floor(total * 500) + 2));

  for (let k = 0; k < count; k += 1) {
    const s = (k / (count - 1)) * total;
    let j = 0;
    while (j < dists.length - 1 && dists[j + 1] < s) {
      j += 1;
    }
    const s0 = dists[j];
    const s1 = dists[j + 1];
    const u = s1 > s0 ? (s - s0) / (s1 - s0) : 0;
    out.push({
      horizontal: points[j].horizontal + u * (points[j + 1].horizontal - points[j].horizontal),
      vertical: points[j].vertical + u * (points[j + 1].vertical - points[j].vertical)
    });
  }

  return out;
}

export function smoothStrokePoints(points: { horizontal: number; vertical: number }[], passes = 0) {
  if (points.length <= 2 || passes <= 0) {
    return points;
  }
  let current = points;
  for (let pass = 0; pass < passes; pass += 1) {
    const next = current.map((point, index) => {
      if (index === 0 || index === current.length - 1) {
        return point;
      }
      const prev = current[index - 1];
      const curr = current[index];
      const after = current[index + 1];
      return {
        horizontal: prev.horizontal * 0.25 + curr.horizontal * 0.5 + after.horizontal * 0.25,
        vertical: prev.vertical * 0.25 + curr.vertical * 0.5 + after.vertical * 0.25
      };
    });
    current = next;
  }
  return current;
}
