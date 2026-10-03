import { writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { computeImplicitSurfaceData } from "@/lib/math/computeImplicitSurfaceData";
import { sampleImplicitScalarField } from "@/lib/math/sampleImplicitField";
import { compileImplicitSurfaceExpression } from "@/lib/math/compileImplicitSurface";

it("profiles bounded numerical stress cases without returning unsafe buffers", () => {
  const domain = {xMin:-5,xMax:5,yMin:-5,yMax:5,zMin:-5,zMax:5};
  const cases = ["x^2+y^2+z^2=9", "sin(x)*cos(y)+sin(y)*cos(z)+sin(z)*cos(x)=0", "cos(x*y+cos(4*y))^2+sin(y)=0.4*x+0.1*y^2", "1/(x-0.17)=0", "sin(40*x)*sin(40*y)*sin(40*z)=0.1"];
  const report = [];
  for (const equation of cases) {
    const start = performance.now();
    const result = computeImplicitSurfaceData({equation,domain,resolution:48,params:{}});
    expect(result.status).not.toBe("error");
    if (result.status === "ok") {
      expect(result.triangleCount).toBeLessThanOrEqual(750000);
      expect(result.positions.every(Number.isFinite)).toBe(true);
      expect(result.indices.every(index => index < result.vertexCount)).toBe(true);
    }
    report.push({equation,ms:Math.round(performance.now()-start),status:result.status,...(result.status === "ok" ? {triangles:result.triangleCount,bytes:result.positions.byteLength+result.indices.byteLength}: {})});
  }
  const compiled = compileImplicitSurfaceExpression(cases[2], {});
  const batchMs:number[] = [], scalarMs:number[] = [];
  for (let pass=0;pass<4;pass++) {
    const startA=performance.now(); const a=sampleImplicitScalarField(compiled.evaluator,{domain,resolution:48});
    const endA=performance.now(); const b=sampleImplicitScalarField((x,y,z)=>compiled.evaluator(x,y,z),{domain,resolution:48});
    const endB=performance.now();
    expect(a.values).toEqual(b.values); expect(a.valid).toEqual(b.valid);
    if(pass) {batchMs.push(endA-startA);scalarMs.push(endB-endA);}
  }
  report.push({equation:"3D grid sampling median: Rust batches",ms:Math.round(batchMs.sort((a,b)=>a-b)[1]),status:"ok"});
  report.push({equation:"3D grid sampling median: scalar fallback",ms:Math.round(scalarMs.sort((a,b)=>a-b)[1]),status:"ok"});
  const start = performance.now();
  expect(compiled.sampleXYGrid!(-20,20,769,-12,12,769).length).toBe(769**2);
  report.push({equation:"large 2D contour: 591361 samples",ms:Math.round(performance.now()-start),status:"ok"});
  if (process.env.VINCULUM_STRESS_REPORT) writeFileSync(process.env.VINCULUM_STRESS_REPORT, JSON.stringify(report,null,2));
}, 30000);
