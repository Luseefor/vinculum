import { expect, test } from "@playwright/test";
import { createSceneDocument } from "../lib/scene/sceneSchema";
import type { GraphObject } from "@vinculum/scene/types";
import { writeFileSync } from "node:fs";

test.skip(({ browserName }) => browserName !== "chromium", "Chrome stress uses CDP heap measurements.");

type Probe = { frames:number[]; tasks:number[]; last:number; active:boolean };
const colors = ["#3b82f6", "#e11d48", "#059669", "#d97706"];
for (const mode of ["2d", "3d"] as const) {
  test(`stress ${mode}: dense scene, repeated zoom, layout changes, and recovery`, async ({ page }, testInfo) => {
    test.setTimeout(90000);
    const errors:string[]=[];
    page.on("pageerror", error=>errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("crash", ()=>errors.push("Chrome page crashed"));
    const objects:GraphObject[] = mode === "2d"
      ? Array.from({length:24},(_,i)=>({id:`stress-${i}`,kind:"implicitCurve",equation:i<8?`cos(x*y+cos(4*y))^2+sin(y)=0.4*x+0.1*y^2+${i/10}`:`y=sin(${i+1}*x)+${i/5}`,color:colors[i%4],visible:true,autoExpression:true}))
      : Array.from({length:8},(_,i)=>({id:`stress-${i}`,kind:"implicitSurface",equation:i%2?`sin(x)*cos(y)+sin(y)*cos(z)+sin(z)*cos(x)=${i/10}`:`x^2+y^2+z^2=${2+i}`,color:colors[i%4],visible:true,domain:{xMin:-4,xMax:4,yMin:-4,yMax:4,zMin:-4,zMax:4},resolution:48,appearance:{wireframe:false}}));
    await page.addInitScript(({scene,mode})=>{
      localStorage.setItem("vinculum-welcome-onboarding-v1",JSON.stringify({version:1,dismissed:true}));
      localStorage.setItem("vinculum-editor-layout",JSON.stringify({version:1,state:{viewportMode:mode}}));
      sessionStorage.setItem("vinculum-graph-session",JSON.stringify({version:0,state:{scene,ui:{workspace:"math",graphMode:mode,axis2dPair:"xy"}}}));
    }, {scene:createSceneDocument({objects}),mode});
    await page.goto("/editor");
    await expect(page.getByTestId("scene-object-count")).toHaveText(String(objects.length));
    const canvas=page.locator(`canvas[data-graph${mode}-canvas="true"]:visible`).first();
    await expect(canvas).toBeVisible();
    if(mode==="3d") await expect(canvas).toHaveAttribute("data-render-backend",/webgpu|webgl2/);
    await page.waitForTimeout(2000); // shader/worker warm-up is recorded separately from steady-state interaction
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("HeapProfiler.collectGarbage");
    const before = await cdp.send("Runtime.getHeapUsage");
    if (process.env.VINCULUM_STRESS_PROFILE) {
      await cdp.send("Profiler.enable");
      await cdp.send("Profiler.start");
    }
    await page.evaluate(()=>{
      const probe:Probe={frames:[],tasks:[],last:performance.now(),active:true};
      (window as unknown as {graphStress:Probe}).graphStress=probe;
      const tick=(now:number)=>{if(!probe.active)return;probe.frames.push(now-probe.last);probe.last=now;requestAnimationFrame(tick);};
      requestAnimationFrame(tick);
      new PerformanceObserver(list=>{if(probe.active)probe.tasks.push(...list.getEntries().map(entry=>entry.duration));}).observe({type:"longtask",buffered:false});
    });
    const box=(await canvas.boundingBox())!;
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    for(let i=0;i<12;i++) {await page.mouse.wheel(0,i%2?120:-120);await page.waitForTimeout(75);}
    for(let i=0;i<3;i++) {
      await page.getByRole("button",{name:mode==="2d"?"3D only":"2D only",exact:true}).click();
      await page.getByRole("button",{name:mode==="2d"?"2D only":"3D only",exact:true}).click();
    }
    await page.waitForTimeout(2000);
    const probe=await page.evaluate(mode=>{const p=(window as unknown as {graphStress:Probe}).graphStress;p.active=false;return {frames:p.frames,tasks:p.tasks,backend:mode === "2d" ? "canvas2d" : document.querySelector('canvas[data-graph3d-canvas="true"]')?.getAttribute("data-render-backend")};}, mode);
    await cdp.send("HeapProfiler.collectGarbage");
    const after=await cdp.send("Runtime.getHeapUsage");
    if (process.env.VINCULUM_STRESS_PROFILE) {
      const { profile } = await cdp.send("Profiler.stop");
      writeFileSync(`${process.env.VINCULUM_STRESS_PROFILE}-${mode}.json`, JSON.stringify(profile));
    }
    const frames=probe.frames.slice(1).sort((a,b)=>a-b);
    const report={mode,objects:objects.length,backend:probe.backend,frames:frames.length,p95FrameMs:frames[Math.floor(frames.length*.95)]??0,maxFrameMs:Math.max(0,...frames),maxLongTaskMs:Math.max(0,...probe.tasks),longTasks:probe.tasks.length,heapGrowthBytes:after.usedSize-before.usedSize,backingStorageGrowthBytes:after.backingStorageSize-before.backingStorageSize,errors};
    expect(report.maxFrameMs).toBeLessThan(2500);
    console.info("BROWSER_GRAPH_STRESS",JSON.stringify(report));
    await testInfo.attach(`graph-stress-${mode}.json`,{body:JSON.stringify(report,null,2),contentType:"application/json"});
    expect(errors).toEqual([]);
    expect(report.frames).toBeGreaterThan(5);
    expect(report.maxLongTaskMs).toBeLessThan(2500);
    expect(report.heapGrowthBytes).toBeLessThan(64*1024*1024);
    expect(report.backingStorageGrowthBytes).toBeLessThan(64*1024*1024);
    // Recover after load: hiding the scene must leave the editor usable.
    for(let i=0;i<objects.length;i++) await page.getByRole("button",{name:"Hide object",exact:true}).first().click();
    await expect(page.getByRole("button",{name:"Hide object",exact:true})).toHaveCount(0);
    await expect(page.getByRole("button",{name:"Show object",exact:true})).toHaveCount(objects.length);
  });
}

test("ordinary 2D editing stays responsive under 4x CPU slowdown and repeated navigation", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("crash", () => errors.push("Chrome page crashed"));
  const objects: GraphObject[] = Array.from({ length: 4 }, (_, i) => ({
    id: `normal-${i}`, kind: "implicitCurve", equation: `y=sin(${i + 1}*x)+${i}`,
    color: colors[i], visible: true, autoExpression: true
  }));
  await page.addInitScript(scene => {
    localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true }));
    localStorage.setItem("vinculum-editor-layout", JSON.stringify({ version: 1, state: { viewportMode: "2d" } }));
    if (!sessionStorage.getItem("vinculum-graph-session")) sessionStorage.setItem("vinculum-graph-session", JSON.stringify({ version: 0, state: { scene, ui: { workspace: "math", graphMode: "2d", axis2dPair: "xy" } } }));
  }, createSceneDocument({ objects }));
  await page.goto("/editor");
  const canvas = page.locator('canvas[data-graph2d-canvas="true"]:visible').first();
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(2000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("HeapProfiler.collectGarbage");
  const before = await cdp.send("Runtime.getHeapUsage");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.evaluate(() => {
    const probe: Probe = { frames: [], tasks: [], last: performance.now(), active: true };
    (window as unknown as { graphStress: Probe }).graphStress = probe;
    const tick = (now: number) => { if (!probe.active) return; probe.frames.push(now - probe.last); probe.last = now; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    new PerformanceObserver(list => { if (probe.active) probe.tasks.push(...list.getEntries().map(entry => entry.duration)); }).observe({ type: "longtask", buffered: false });
  });
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const started = Date.now();
  for (let i = 0; i < 120; i++) {
    await page.mouse.wheel(0, i % 2 ? 40 : -40);
    await page.waitForTimeout(1000);
    if (i % 30 === 0) {
      await page.getByRole("button", { name: "Hide object", exact: true }).first().click();
      await page.getByRole("button", { name: "Show object", exact: true }).first().click();
    }
  }
  await page.waitForTimeout(500);
  const probe = await page.evaluate(() => { const p = (window as unknown as { graphStress: Probe }).graphStress; p.active = false; return { frames: p.frames, tasks: p.tasks }; });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await cdp.send("HeapProfiler.collectGarbage");
  const after = await cdp.send("Runtime.getHeapUsage");
  const frames = probe.frames.slice(1).sort((a, b) => a - b);
  const report = { workload: "ordinary-2d", cpuSlowdown: 4, interactions: 120, durationMs: Date.now() - started, p95FrameMs: frames[Math.floor(frames.length * .95)], maxLongTaskMs: Math.max(0, ...probe.tasks), heapGrowthBytes: after.usedSize - before.usedSize, backingStorageGrowthBytes: after.backingStorageSize - before.backingStorageSize, errors };
  console.info("BROWSER_GRAPH_STRESS", JSON.stringify(report));
  await testInfo.attach("graph-stress-ordinary-2d.json", { body: JSON.stringify(report, null, 2), contentType: "application/json" });
  expect(report.p95FrameMs).toBeLessThan(200);
  expect(report.maxLongTaskMs).toBeLessThan(500);
  expect(report.heapGrowthBytes).toBeLessThan(16 * 1024 * 1024);
  expect(report.backingStorageGrowthBytes).toBeLessThan(16 * 1024 * 1024);
  expect(errors).toEqual([]);
  const rangeBeforeReload = await page.getByTestId("graph2d-viewport-range-badge").first().textContent();
  await page.reload();
  await expect(canvas).toBeVisible();
  await expect(page.getByTestId("scene-object-count")).toHaveText("4");
  await expect(page.getByTestId("graph2d-viewport-range-badge").first()).toHaveText(rangeBeforeReload!);
});
