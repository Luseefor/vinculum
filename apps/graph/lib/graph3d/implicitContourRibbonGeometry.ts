import { mapMathToWorldFromAxes } from "./implicitEquationParse";

export function buildRibbonBuffersFromContourSegments(
  contourSegments: Array<{ u1: number; v1: number; u2: number; v2: number }>,
  uAxis: "x" | "y" | "z",
  vAxis: "x" | "y" | "z",
  missingAxis: "x" | "y" | "z",
  wMin: number,
  wMax: number
): { edgePositions: number[]; fillPositions: number[]; fillIndices: number[] } {
  const edgePositions: number[] = [];
  const fillPositions: number[] = [];
  const fillIndices: number[] = [];

  const pushEdge = (p1: { x: number; y: number; z: number }, p2: { x: number; y: number; z: number }) => {
    edgePositions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
  };

  for (const seg of contourSegments) {
    const a0 = mapMathToWorldFromAxes(uAxis, vAxis, missingAxis, seg.u1, seg.v1, wMin);
    const a1 = mapMathToWorldFromAxes(uAxis, vAxis, missingAxis, seg.u1, seg.v1, wMax);
    const b0 = mapMathToWorldFromAxes(uAxis, vAxis, missingAxis, seg.u2, seg.v2, wMin);
    const b1 = mapMathToWorldFromAxes(uAxis, vAxis, missingAxis, seg.u2, seg.v2, wMax);

    pushEdge(a0, b0);
    pushEdge(a1, b1);
    pushEdge(a0, a1);
    pushEdge(b0, b1);

    const baseIndex = fillPositions.length / 3;
    fillPositions.push(
      a0.x, a0.y, a0.z,
      a1.x, a1.y, a1.z,
      b1.x, b1.y, b1.z,
      b0.x, b0.y, b0.z
    );
    fillIndices.push(
      baseIndex, baseIndex + 1, baseIndex + 2,
      baseIndex, baseIndex + 2, baseIndex + 3
    );
  }

  return { edgePositions, fillPositions, fillIndices };
}
