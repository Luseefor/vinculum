import { interpolateImplicitEdge } from "./implicitEquationParse";

export type ImplicitContourSample = (u: number, v: number) => number | null;

export function marchImplicitContourSquares(
  uMin: number,
  uMax: number,
  vMin: number,
  vMax: number,
  resolution: number,
  stepU: number,
  stepV: number,
  sample: ImplicitContourSample
): Array<{ u1: number; v1: number; u2: number; v2: number }> {
  const contourSegments: Array<{ u1: number; v1: number; u2: number; v2: number }> = [];
  const emitSegment = (
    ua: number,
    va: number,
    fa: number,
    ub: number,
    vb: number,
    fb: number,
    uc: number,
    vc: number,
    fc: number,
    ud: number,
    vd: number,
    fd: number
  ) => {
    const p1 = interpolateImplicitEdge(ua, va, fa, ub, vb, fb);
    const p2 = interpolateImplicitEdge(uc, vc, fc, ud, vd, fd);
    if (!p1 || !p2) {
      return;
    }
    contourSegments.push({ u1: p1.u, v1: p1.v, u2: p2.u, v2: p2.v });
  };

  for (let iy = 0; iy < resolution; iy += 1) {
    for (let ix = 0; ix < resolution; ix += 1) {
      const u0 = uMin + ix * stepU;
      const u1 = u0 + stepU;
      const v0 = vMin + iy * stepV;
      const v1 = v0 + stepV;

      const a = sample(u0, v0);
      const b = sample(u1, v0);
      const c = sample(u1, v1);
      const d = sample(u0, v1);
      if (a === null || b === null || c === null || d === null) {
        continue;
      }

      const mask = (a > 0 ? 8 : 0) | (b > 0 ? 4 : 0) | (c > 0 ? 2 : 0) | (d > 0 ? 1 : 0);
      if (mask === 0 || mask === 15) {
        continue;
      }

      switch (mask) {
        case 1:
        case 14:
          emitSegment(u0, v1, d, u0, v0, a, u0, v1, d, u1, v1, c);
          break;
        case 2:
        case 13:
          emitSegment(u1, v1, c, u1, v0, b, u0, v1, d, u1, v1, c);
          break;
        case 3:
        case 12:
          emitSegment(u0, v0, a, u1, v0, b, u0, v1, d, u1, v1, c);
          break;
        case 4:
        case 11:
          emitSegment(u0, v0, a, u1, v0, b, u1, v0, b, u1, v1, c);
          break;
        case 5:
          emitSegment(u0, v0, a, u1, v0, b, u0, v0, a, u0, v1, d);
          emitSegment(u1, v0, b, u1, v1, c, u0, v1, d, u1, v1, c);
          break;
        case 6:
        case 9:
          emitSegment(u0, v0, a, u0, v1, d, u1, v0, b, u1, v1, c);
          break;
        case 7:
        case 8:
          emitSegment(u0, v0, a, u0, v1, d, u0, v0, a, u1, v0, b);
          break;
        case 10:
          emitSegment(u0, v0, a, u1, v0, b, u1, v0, b, u1, v1, c);
          emitSegment(u0, v0, a, u0, v1, d, u0, v1, d, u1, v1, c);
          break;
      }
    }
  }

  return contourSegments;
}
