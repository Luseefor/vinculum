import { expect, test } from "@playwright/test";
import { createSceneDocument } from "../lib/scene/sceneSchema";
import { createParametricSurfaceGraph } from "../lib/graph/createParametricSurfaceGraph";

test("a spatial parametric patch draws its actual XY intersection and exports it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const object = createParametricSurfaceGraph({ xExpr: "u", yExpr: "v", zExpr: "u-2", color: "#3b82f6", resolution: 32, domain: { uMin: -3, uMax: 3, vMin: -3, vMax: 3 } });
  await page.addInitScript(scene => {
    localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true }));
    localStorage.setItem("vinculum-editor-layout", JSON.stringify({ version: 1, state: { viewportMode: "2d" } }));
    sessionStorage.setItem("vinculum-graph-session", JSON.stringify({ version: 0, state: { scene, ui: { workspace: "math", graphMode: "2d", axis2dPair: "xy" } } }));
  }, createSceneDocument({ objects: [object] }));
  await page.goto("/editor");
  await expect(page.getByTestId("implicit-slice-label")).toContainText("z = 0");
  const canvas = page.locator('canvas[data-graph2d-variant="primary"]');
  await expect.poll(() => canvas.evaluate((node: HTMLCanvasElement) => {
    const viewport = JSON.parse(sessionStorage.getItem("vinculum-graph-session")!).state.ui.viewport2d;
    const rect = node.getBoundingClientRect(), ratio = node.width / rect.width;
    const pixels = node.getContext("2d")!.getImageData(0, 0, node.width, node.height).data;
    let count = 0, worst = 0;
    for (let y = 0; y < node.height; y++) for (let x = 0; x < node.width; x++) {
      const i = (y*node.width+x)*4;
      if (pixels[i+2] > 180 && pixels[i+1] > 80 && pixels[i] < 130 && pixels[i+2] > pixels[i+1]+40) {
        count++; worst = Math.max(worst, Math.abs((x/ratio-rect.width/2)/viewport.scale+viewport.centerX-2));
      }
    }
    return count > 100 && worst < .1;
  })).toBe(true);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("dialog", { name: "Share and export" }).getByRole("button", { name: "2D SVG", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/-2d\.svg$/);
});
