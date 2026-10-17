import { expect, test } from "@playwright/test";
import { createSceneDocument } from "../lib/scene/sceneSchema";
import { createParametricCurve } from "../lib/graph/createParametricCurve";

test("Fit works in 2D and stays available for spatial views", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true }));
  });
  await page.addInitScript(scene => {
    sessionStorage.setItem("vinculum-graph-session", JSON.stringify({ version: 0, state: { scene, ui: { workspace: "math", graphMode: "2d", axis2dPair: "xy" } } }));
  }, createSceneDocument({ objects: [createParametricCurve({ xExpr: "50+10*cos(t)", yExpr: "20+10*sin(t)", zExpr: "0", tMin: 0, tMax: 2*Math.PI })] }));
  await page.goto("/editor");
  await page.getByRole("button", { name: "2D only", exact: true }).click();
  const fit = page.getByRole("button", { name: "Zoom to fit all objects", exact: true });
  await expect(fit).toBeEnabled();
  await fit.click();
  await expect(page.getByTestId("graph2d-fit-status")).toContainText("View fitted.");
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("vinculum-graph-session")!).state.ui.viewport2d.centerX)).toBeCloseTo(50, 1);
  await expect(page.getByRole("button", { name: "Reset 2D view", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Reset 2D view", exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("vinculum-graph-session")!).state.ui.viewport2d.centerX)).toBe(0);
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Fit scene", exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("vinculum-graph-session")!).state.ui.viewport2d.centerX)).toBeCloseTo(50, 1);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "3D only", exact: true }).click();
  await expect(fit).toBeEnabled();
  await page.getByRole("button", { name: "Geometry Studio", exact: true }).click();
  await expect(fit).toBeEnabled();
});

test("2D framing is available from context, palette, and compact menus", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true }));
  });
  await page.goto("/editor");
  await page.getByRole("button", { name: "2D only", exact: true }).click();
  const canvas = page.locator('canvas[data-graph2d-variant="primary"]');
  await canvas.click({ button: "right", position: { x: 90, y: 90 } });
  await expect(page.getByRole("menuitem", { name: "Reset view", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Fit scene", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByRole("textbox", { name: "Command search" }).fill("Fit Scene");
  await expect(page.getByRole("option", { name: "Fit Scene", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 600, height: 850 });
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Fit scene", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Frame selected", exact: true })).toBeVisible();
});

test.describe("touch framing", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("Fit responds to a compact menu tap", async ({ page, browserName }) => {
    test.skip(browserName === "firefox", "Playwright Firefox does not implement touch-screen emulation.");
    await page.addInitScript(scene => {
      localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true }));
      localStorage.setItem("vinculum-editor-layout", JSON.stringify({ version: 1, state: { viewportMode: "2d" } }));
      sessionStorage.setItem("vinculum-graph-session", JSON.stringify({ version: 0, state: { scene, ui: { workspace: "math", graphMode: "2d", axis2dPair: "xy" } } }));
    }, createSceneDocument({ objects: [createParametricCurve({ xExpr: "50+cos(t)" })] }));
    await page.goto("/editor");
    await page.getByRole("button", { name: "More actions", exact: true }).tap();
    await page.getByRole("menuitem", { name: "Fit scene", exact: true }).tap();
    await expect(page.getByTestId("graph2d-fit-status")).toHaveText("View fitted.");
    await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("vinculum-graph-session")!).state.ui.viewport2d.centerX)).toBeCloseTo(50, 1);
  });
});
