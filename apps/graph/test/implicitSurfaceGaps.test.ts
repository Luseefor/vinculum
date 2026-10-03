import { expect, it } from "vitest";
import { computeImplicitSurfaceData } from "@/lib/math/computeImplicitSurfaceData";

it("does not leave interior open edges in a smooth oscillating extrusion", () => {
  const result = computeImplicitSurfaceData({ equation: "cos(x*y+cos(4*y))^2+sin(y)=0.4*x+0.1*y^2", domain: { xMin:-5,xMax:5,yMin:-5,yMax:5,zMin:-5,zMax:5 }, resolution:48, params:{} });
  expect(result.status).toBe("ok");
  if (result.status !== "ok") return;
  const edges = new Map<string, [number, number, number]>();
  for (let i=0;i<result.indices.length;i+=3) for (let k=0;k<3;k++) {
    const a=result.indices[i+k], b=result.indices[i+(k+1)%3];
    const key=`${Math.min(a,b)}:${Math.max(a,b)}`;
    const prev=edges.get(key); edges.set(key,[a,b,(prev?.[2]??0)+1]);
  }
  const gaps=[...edges.values()].filter(([a,b,count])=>count===1 && ![0,1,2].some(axis=>Math.abs(Math.abs(result.positions[a*3+axis])-5)<1e-5 && Math.abs(Math.abs(result.positions[b*3+axis])-5)<1e-5));
  expect(gaps.length).toBe(0);
});
