import { test } from "@playwright/test";
import path from "path";

test("Record interactive Vinculum editor session", async ({ browser }) => {
  test.setTimeout(90000);

  const outDir = path.resolve(process.cwd(), "../video/public/recorded");

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: outDir,
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();

  // Suppress onboarding dialogs
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

  // 1. Enter editor
  await page.goto("/editor");
  await page.waitForTimeout(600);

  for (let attempt = 0; attempt < 3; attempt++) {
    const dialogs = page.locator('[role="dialog"]:visible');
    if ((await dialogs.count()) === 0) break;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
  }

  // Settle on clean editor with 2D+3D view (approx 1s)
  await page.waitForTimeout(1200);

  // 2. Open Scene -> Examples -> Helix Curve
  await page.getByRole("button", { name: "Scene", exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole("menuitem", { name: "Open example..." }).click();
  await page.waitForTimeout(600);

  const helixCard = page.locator("li").filter({ hasText: "Helix Curve" });
  await helixCard.getByRole("button", { name: "Open example" }).click();
  await page.waitForTimeout(1500);

  // 3. Switch to 3D only to focus on the mathematical object
  const viewGroup = page.getByRole("group", { name: "View type" });
  await viewGroup.getByRole("button", { name: "3D only" }).click();
  await page.waitForTimeout(1200);

  // 4. Orbit camera around the real 3D Helix
  const canvas3d = page.locator('canvas[data-graph3d-canvas="true"]').first();
  const box = await canvas3d.boundingBox();
  if (box) {
    const startX = box.x + box.width * 0.55;
    const startY = box.y + box.height * 0.5;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // Smooth orbit gesture
    for (let i = 0; i <= 30; i++) {
      await page.mouse.move(startX + i * 8, startY - i * 2);
      await page.waitForTimeout(20);
    }
    await page.mouse.up();
    await page.waitForTimeout(1000);
  }

  // 5. Open Saddle Surface example to transition to real surface
  await page.getByRole("button", { name: "Scene", exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole("menuitem", { name: "Open example..." }).click();
  await page.waitForTimeout(600);

  const saddleCard = page.locator("li").filter({ hasText: "Saddle Surface" });
  await saddleCard.getByRole("button", { name: "Open example" }).click();
  await page.waitForTimeout(2000);

  // Orbit camera around real Saddle surface
  if (box) {
    const startX = box.x + box.width * 0.5;
    const startY = box.y + box.height * 0.5;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let i = 0; i <= 25; i++) {
      await page.mouse.move(startX - i * 6, startY + i * 3);
      await page.waitForTimeout(25);
    }
    await page.mouse.up();
    await page.waitForTimeout(1200);
  }

  await page.close();
  await context.close();
  console.log("Interactive session recorded successfully!");
});
