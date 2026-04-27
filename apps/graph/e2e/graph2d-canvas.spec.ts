import { expect, test } from "@playwright/test";

test.describe("2D canvas", () => {
  test("2D mode exposes an accessible primary plot canvas", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "2D", exact: true }).click();

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
    await page.goto("/");
    await page.getByRole("button", { name: "2D", exact: true }).click();

    const canvas2d = page.locator('canvas[data-graph2d-canvas="true"]').first();
    await expect(canvas2d).toBeVisible();
    const box = await canvas2d.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
      return;
    }

    const rangeBadge = page.getByTestId("graph2d-viewport-range-badge").first();
    const before = await rangeBadge.textContent();

    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.wheel(0, -200);
    await expect(rangeBadge).not.toHaveText(before ?? "");
  });
});
