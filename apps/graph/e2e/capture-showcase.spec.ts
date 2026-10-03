import { test, expect } from "@playwright/test";
import path from "path";

test("Capture real Vinculum product states for promo", async ({ page }) => {
  test.setTimeout(60000);

  // Set 1920x1080 viewport with dark theme preference
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem(
      "vinculum-welcome-onboarding-v1",
      JSON.stringify({
        version: 1,
        dismissed: true,
        updatedAt: new Date().toISOString()
      })
    );
  });

  await page.goto("/editor");
  await page.waitForTimeout(1000);

  // Dismiss any onboarding dialogs
  for (let attempt = 0; attempt < 3; attempt++) {
    const dialogs = page.locator('[role="dialog"]:visible');
    if ((await dialogs.count()) === 0) break;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  }

  // 1. Capture Empty / Initial Editor with 2D+3D split
  const outDir = path.resolve(process.cwd(), "../video/public/product");
  await page.screenshot({ path: path.join(outDir, "editor-initial-split.png") });

  // 2. Open Helix Example (Real Parametric Curve in real engine)
  await page.getByRole("button", { name: "Scene", exact: true }).click();
  await page.getByRole("menuitem", { name: "Open example..." }).click();
  await page.waitForTimeout(400);

  // Find and open Helix Curve
  const helixCard = page.locator("li").filter({ hasText: "Helix Curve" });
  await helixCard.getByRole("button", { name: "Open example" }).click();
  await page.waitForTimeout(1200);

  // Capture full editor with Helix Curve loaded
  await page.screenshot({ path: path.join(outDir, "editor-helix-full.png") });

  // Switch to 3D only mode
  const viewGroup = page.getByRole("group", { name: "View type" });
  await viewGroup.getByRole("button", { name: "3D only" }).click();
  await page.waitForTimeout(800);

  // Capture 3D only Helix
  await page.screenshot({ path: path.join(outDir, "editor-helix-3d-only.png") });

  // Capture isolated 3D canvas of Helix
  const canvas3d = page.locator('canvas[data-graph3d-canvas="true"]').first();
  await canvas3d.screenshot({ path: path.join(outDir, "canvas-helix-pure.png") });

  // 3. Open Saddle Surface Example (Real Surface in real engine)
  await page.getByRole("button", { name: "Scene", exact: true }).click();
  await page.getByRole("menuitem", { name: "Open example..." }).click();
  await page.waitForTimeout(400);

  const saddleCard = page.locator("li").filter({ hasText: "Saddle Surface" });
  await saddleCard.getByRole("button", { name: "Open example" }).click();
  await page.waitForTimeout(1200);

  // Capture full editor with Saddle Surface
  await page.screenshot({ path: path.join(outDir, "editor-saddle-full.png") });

  // Capture 3D canvas of Saddle Surface
  await canvas3d.screenshot({ path: path.join(outDir, "canvas-saddle-pure.png") });

  console.log("Successfully captured real product assets to apps/video/public/product!");
});
