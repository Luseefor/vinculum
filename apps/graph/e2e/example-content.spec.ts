import { expect, test } from "@playwright/test";
import { createSceneDocument } from "../lib/scene/sceneSchema";

for (const [title, mode] of [["Cubic Curve", "2d"], ["Sphere Surface", "3d"]] as const) {
  test(`${title} opens in its intended view after a different axis/layout was saved`, async ({ page }) => {
    await page.addInitScript(scene => {
      localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true }));
      localStorage.setItem("vinculum-editor-layout", JSON.stringify({ version: 1, state: { viewportMode: "quad" } }));
      sessionStorage.setItem("vinculum-graph-session", JSON.stringify({ version: 0, state: { scene, ui: { workspace: "geometry", graphMode: "3d", axis2dPair: "xz", active2dViewport: "quadTop", axis2dPairQuadTop: "yz", viewport2d: { centerX: 100, centerY: -100, scale: 80 } } } }));
    }, createSceneDocument({ objects: [] }));
    await page.goto("/editor?examples=1");
    const gallery = page.getByRole("dialog", { name: "Examples", exact: true });
    await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("vinculum-graph-session")!).state.ui.axis2dPair)).toBe("xz");
    await gallery.getByRole("searchbox").fill(title);
    await gallery.getByRole("button", { name: `Open example: ${title}`, exact: true }).click();
    await expect(gallery).toHaveCount(0);
    await expect(page.getByRole("button", { name: mode === "2d" ? "2D only" : "3D only", exact: true })).toHaveAttribute("aria-pressed", "true");
    const state = await page.evaluate(() => JSON.parse(sessionStorage.getItem("vinculum-graph-session")!).state);
    expect(state.ui.axis2dPair).toBe("xy");
    expect(state.ui.active2dViewport).toBe("primary");
    expect(state.ui.workspace).toBe("math");
    expect(state.ui.viewport2d.centerX).toBe(0);
    expect(state.ui.viewport2d.centerY).toBe(0);
    expect(state.scene.objects[0].kind).toBe(mode === "2d" ? "parametricCurve" : "implicitSurface");
    await expect(page.locator(`canvas[data-graph${mode}-canvas="true"]:visible`).first()).toBeVisible();
  });
}

test("replacing an example asks clearly, lets you cancel, and opens the selected content", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true })));
  await page.goto("/editor?examples=1");
  let gallery = page.getByRole("dialog", { name: "Examples", exact: true });
  await gallery.getByRole("searchbox").fill("Helix Curve");
  await gallery.getByRole("button", { name: "Open example: Helix Curve" }).click();
  await expect(gallery).toHaveCount(0);
  const before = await page.evaluate(() => JSON.parse(sessionStorage.getItem("vinculum-graph-session")!).state.scene.objects[0].id);
  await page.getByRole("button", { name: "Scene", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Open example/ }).click();
  gallery = page.getByRole("dialog", { name: "Examples", exact: true });
  await gallery.getByRole("searchbox").fill("Saddle Surface");
  await gallery.getByRole("button", { name: "Open example: Saddle Surface" }).click();
  const confirm = page.getByRole("dialog", { name: "Open example", exact: true });
  await expect(confirm).toBeVisible();
  await expect(gallery).toHaveCount(0);
  await expect(confirm).toContainText("Saddle Surface");
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(gallery).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("vinculum-graph-session")!).state.scene.objects[0].id)).toBe(before);
  await gallery.getByRole("searchbox").fill("Saddle Surface");
  await gallery.getByRole("button", { name: "Open example: Saddle Surface" }).click();
  await confirm.getByRole("button", { name: "Open example", exact: true }).click();
  await expect(confirm).toHaveCount(0);
  await expect(gallery).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("vinculum-graph-session")!).state.scene.objects[0].equation)).toBe("z = (x^2 - y^2)/2");
});
