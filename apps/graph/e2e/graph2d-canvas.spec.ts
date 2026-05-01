import { expect, test } from "@playwright/test";

async function dismissBlockingDialogs(page: import("@playwright/test").Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const visibleDialogs = page.locator('[role="dialog"]:visible');
    if ((await visibleDialogs.count()) === 0) {
      break;
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(120);
  }
}

test.describe("2D canvas", () => {
  test.beforeEach(async ({ page }) => {
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
  });

  test("2D mode exposes an accessible primary plot canvas", async ({ page }) => {
    await page.goto("/editor");
    await dismissBlockingDialogs(page);
    await page.getByRole("group", { name: "View type" }).getByRole("button", { name: "2D only" }).click();

    const primaryCanvas = page.locator('canvas[data-graph2d-canvas="true"]').first();
    await expect(primaryCanvas).toBeVisible();
    await expect(primaryCanvas).toHaveAttribute("role", "img");
    await expect(primaryCanvas).toHaveAttribute("aria-label", /2D graph/i);

    const box = await primaryCanvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(32);
    expect(box!.height).toBeGreaterThan(32);
  });

  test("wheel over primary 2D canvas changes viewport (range badge)", async ({ page }) => {
    await page.goto("/editor");
    await dismissBlockingDialogs(page);
    await page.getByRole("group", { name: "View type" }).getByRole("button", { name: "2D only" }).click();

    const canvas2d = page.locator('canvas[data-graph2d-canvas="true"]').first();
    await expect(canvas2d).toBeVisible();
    const box = await canvas2d.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
      return;
    }

    const rangeBadge = page.getByTestId("graph2d-viewport-range-badge").first();
    const before = await rangeBadge.textContent();

    await canvas2d.dispatchEvent("wheel", { deltaY: -500 });
    await canvas2d.dispatchEvent("wheel", { deltaY: -500 });
    await expect(rangeBadge).not.toHaveText(before ?? "");
  });
});
