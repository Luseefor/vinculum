import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fillInput } from "./helpers/mathInput";
async function start(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: width === 320 ? 568 : 900 });
  await page.addInitScript(() => localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true })));
  await page.goto("/editor");
  await page.getByRole("button", { name: "2D only", exact: true }).click();
}
for (const width of [320, 1440]) {
  test(`${width}px right-click is compact, stays on-screen, and adds a working equation`, async ({ page }) => {
    await start(page, width);
    const canvas = page.locator('canvas[data-graph2d-canvas="true"]').first();
    await canvas.focus();
    const size = (await canvas.boundingBox())!;
    await canvas.click({ button: "right", position: { x: size.width - 12, y: size.height - 12 } });
    const menu = page.getByRole("menu", { name: "Scene context menu" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem")).toHaveCount(3);
    const bounds = (await menu.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(8);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width - 8);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(width === 320 ? 560 : 892);
    expect(bounds.height).toBeLessThan(200);
    expect((await new AxeBuilder({ page }).include('[aria-label="Scene context menu"]').analyze()).violations).toEqual([]);
    await expect(menu.getByRole("menuitem", { name: "Add equation" })).toBeFocused();
    await page.keyboard.press("End");
    await expect(menu.getByRole("menuitem", { name: "Fit scene" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(canvas).toBeFocused();
    await page.keyboard.press("Shift+F10");
    await menu.getByRole("menuitem", { name: "Add equation" }).click();
    await expect(menu).toHaveCount(0);
    const equation = page.locator('math-field[aria-label="Equation"]').first();
    await expect(equation).toBeVisible();
    await fillInput(equation, "x=y^2");
    await expect(page.locator('[data-auto-equation-input]').filter({ has: page.locator('input[aria-label="Equation"]') }).first().getByRole("status")).toHaveCount(0);
  });
}
test("3D right-click works on the canvas and automatic surfaces retain custom-range choice", async ({ page }) => {
  await start(page);
  const blank = page.locator('[data-auto-equation-input]').filter({ has: page.locator('[aria-label="New equation"]') });
  await fillInput(blank.locator('[aria-label="New equation"]').first(), "x=y^2+z^2");
  await blank.locator('input.math-source-input').press("Enter");
  const follow = page.getByRole("checkbox", { name: "Follow view" });
  await expect(follow).toBeChecked();
  await expect(page.getByLabel("y min", { exact: true })).toHaveCount(0);
  const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
  await expect(canvas).toBeVisible();
  await canvas.click({ button: "right", position: { x: 40, y: 100 } });
  const menu = page.getByRole("menu", { name: "Scene context menu" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Frame selected" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Remove selected" })).toBeVisible();
  await page.keyboard.press("Escape");
  await follow.uncheck();
  await expect(page.getByLabel("y min", { exact: true })).toBeVisible();
  await follow.check();
  await canvas.dispatchEvent("wheel", { deltaY: 600 });
  await expect(follow).toBeChecked();
  await expect(page.getByText("The surface continues as you zoom or pan. Only the visible region is sampled.")).toBeVisible();
});
