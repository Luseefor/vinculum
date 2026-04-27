import { expect, test } from "@playwright/test";

test.describe("Graph shell", () => {
  test("loads toolbar and defaults to 3D", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header").getByText("Vinculum")).toBeVisible();
    await expect(page.getByRole("button", { name: "3D", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    await expect(page.getByRole("button", { name: "pan", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "probe", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sketch", exact: true })).toBeVisible();
  });

  test("switches to 2D mode", async ({ page }) => {
    await page.goto("/");
    const mode2d = page.getByRole("button", { name: "2D", exact: true });
    await mode2d.click();
    await expect(mode2d).toHaveAttribute("aria-pressed", "true");
  });

  test("new scene opens confirmation when the scene has objects", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Add Object/i }).click();
    await page.getByRole("button", { name: /Add Object/i }).click();

    await page.getByRole("button", { name: "Scene" }).click();
    await page.getByRole("button", { name: "New Scene" }).click();
    await expect(page.getByTestId("new-scene-dialog")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("new-scene-dialog")).not.toBeVisible();
  });

  test("3D canvas remains stable during orbit", async ({ page }) => {
    await page.goto("/");
    const canvas3d = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await expect(canvas3d).toBeVisible();

    const box = await canvas3d.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
      return;
    }

    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.55);
    await page.mouse.up();

    await expect(canvas3d).toBeVisible();
    await expect(page.getByRole("button", { name: "3D", exact: true })).toHaveAttribute("aria-pressed", "true");
  });

  test("3D probe shows hover coordinate box", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "probe", exact: true }).click();

    const canvas3d = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await expect(canvas3d).toBeVisible();
    const box = await canvas3d.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
      return;
    }

    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await expect(page.locator('[data-graph3d-probe-hover="true"]').first()).toBeVisible();
  });

  test("theme menu can set light then dark resolved theme", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open theme and accent menu" }).click();
    await page.getByRole("button", { name: "Use light theme" }).click();
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.dataset.theme))
      .toBe("light");

    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Open theme and accent menu" }).click();
    await page.getByRole("button", { name: "Use dark theme" }).click();
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.dataset.theme))
      .toBe("dark");
  });

  test("sketch in 2D adds parametric object visible in 3D", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "2D", exact: true }).click();
    await page.getByRole("button", { name: "Sketch", exact: true }).click();

    const canvas2d = page.locator('canvas[data-graph2d-canvas="true"]').first();
    await expect(canvas2d).toBeVisible();
    const box = await canvas2d.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
      return;
    }

    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.65);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.55);
    await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.5);
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.4);
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.35);
    await page.mouse.up();

    await expect(page.getByTestId("scene-object-count")).toHaveText("1");

    await page.getByRole("button", { name: "3D", exact: true }).click();
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
  });
});
