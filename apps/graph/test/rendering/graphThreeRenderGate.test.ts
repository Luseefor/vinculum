import { expect, it } from "vitest";
import { createGraphThreeRenderGate, createGraphThreeRenderResolution } from "@/lib/graph3d/graphThreeRenderGate";

it("draws the initial scene and leaves an unchanged viewport idle", () => {
  const gate = createGraphThreeRenderGate();
  const scene = {}, ui = {}, results = {};
  expect(gate.shouldRender([scene, ui, results])).toBe(true);
  for (let tick = 0; tick < 120; tick++) expect(gate.shouldRender([scene, ui, results])).toBe(false);
});

it("redraws new scene, UI, and asynchronous worker results", () => {
  const gate = createGraphThreeRenderGate();
  let scene = {}, ui = {}, results = {};
  gate.shouldRender([scene, ui, results]);
  for (const change of [() => { scene = {}; }, () => { ui = {}; }, () => { results = {}; }]) {
    change();
    expect(gate.shouldRender([scene, ui, results])).toBe(true);
    expect(gate.shouldRender([scene, ui, results])).toBe(false);
  }
});

it("coalesces pointer, camera, resize, and view invalidations without losing the next frame", () => {
  const gate = createGraphThreeRenderGate();
  gate.shouldRender([]);
  gate.invalidate(); gate.invalidate(); gate.invalidate();
  expect(gate.shouldRender([])).toBe(true);
  expect(gate.shouldRender([])).toBe(false);
  gate.invalidate();
  expect(gate.shouldRender([])).toBe(true);
});

it("keeps fast navigation and idle delays at full resolution", () => {
  const quality = createGraphThreeRenderResolution();
  expect(quality.pixelRatio(100, 500, true, 3)).toBe(2);
  quality.markInteraction(100);
  for (let now = 116; now < 240; now += 16) expect(quality.pixelRatio(now, 16, true, 2)).toBe(2);
  expect(quality.pixelRatio(240, 1000, false, 2)).toBe(2);
});

it("bounds slow navigation pixel work and restores full resolution after settling", () => {
  const quality = createGraphThreeRenderResolution();
  quality.markInteraction(0);
  expect(quality.pixelRatio(50, 50, true, 1)).toBe(1);
  expect(quality.pixelRatio(100, 50, true, 1)).toBe(0.5);
  expect(quality.pixelRatio(150, 50, true, 1)).toBe(0.5);
  expect(quality.pixelRatio(200, 50, true, 1)).toBe(0.25);
  for (let now = 250; now < 1000; now += 50) {
    quality.markInteraction(now);
    expect(quality.pixelRatio(now, 50, true, 1)).toBeGreaterThanOrEqual(0.25);
  }
  expect(quality.pixelRatio(1251, 300, true, 1)).toBe(0.25);
  expect(quality.pixelRatio(1951, 300, true, 1)).toBe(1);
  expect(quality.pixelRatio(2000, 300, true, 1)).toBe(1);
});

it("captures at full resolution even during reduced-resolution navigation", () => {
  const quality = createGraphThreeRenderResolution();
  quality.markInteraction(0);
  quality.pixelRatio(50, 50, true, 2);
  expect(quality.pixelRatio(100, 50, true, 2)).toBe(1);
  expect(quality.fullResolution(2)).toBe(2);
  expect(quality.pixelRatio(116, 16, true, 2)).toBe(2);
});

it("responds to a stalled navigation frame without waiting for a second stall", () => {
  const quality = createGraphThreeRenderResolution();
  quality.markInteraction(0);
  expect(quality.pixelRatio(150, 150, true, 2)).toBe(1);
  expect(quality.pixelRatio(300, 150, true, 2)).toBe(0.5);
  expect(quality.pixelRatio(400, 100, true, 2)).toBe(0.5);
  expect(quality.pixelRatio(1001, 16, true, 2)).toBe(2);
});
