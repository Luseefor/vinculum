import { expect, test, type Locator, type Page } from "@playwright/test";
import { addObject } from "./helpers/addObject";
import { fillInput } from "./helpers/mathInput";
import { screenshotPixels } from "./helpers/canvasPixels";

async function frame(canvas: Locator) {
  return Number(await canvas.getAttribute("data-render-frame"));
}

async function pixels(page: Page, canvas: Locator) {
  const result = await screenshotPixels(page, canvas);
  expect(result).not.toBeNull();
  return result;
}

test("3D stops idle GPU draws and redraws camera, worker results, visibility and orthographic zoom", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true })));
  await page.goto("/editor");
  await page.getByRole("button", { name: "Geometry Studio", exact: true }).click();
  await addObject(page, "3D Vector Field");
  const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
  await expect.poll(() => frame(canvas)).toBeGreaterThan(0);
  await page.mouse.move(0, 0);
  // Allow camera damping and the initial worker result to finish, then demand
  // three stable observations before measuring the idle interval.
  let last = -1, stable = 0;
  await expect.poll(async () => {
    const current = await frame(canvas);
    stable = current === last ? stable + 1 : 0;
    last = current;
    return stable;
  }, { intervals: [250], timeout: 15000 }).toBeGreaterThanOrEqual(3);
  const idle = await frame(canvas);
  const fullPixelRatio = await page.evaluate(() => Math.min(devicePixelRatio, 2));
  await expect(canvas).toHaveAttribute("data-render-pixel-ratio", String(fullPixelRatio));
  await page.waitForTimeout(600);
  expect(await frame(canvas)).toBe(idle);
  const beforeOrbit = await pixels(page, canvas);
  expect(beforeOrbit).not.toBeNull();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 35, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => frame(canvas)).toBeGreaterThan(idle);
  await expect.poll(() => pixels(page, canvas)).not.toBe(beforeOrbit);
  const beforeEdit = await pixels(page, canvas);
  await fillInput(page.getByLabel("Vector field P component").first(), "-y");
  await fillInput(page.getByLabel("Vector field Q component").first(), "x");
  await fillInput(page.getByLabel("Vector field R component").first(), "0");
  // Actual output pixels must reflect asynchronously recomputed geometry.
  await expect.poll(() => pixels(page, canvas), { timeout: 15000 }).not.toBe(beforeEdit);
  const shown = await pixels(page, canvas);
  await page.getByRole("button", { name: "Hide object", exact: true }).first().click();
  await expect.poll(() => pixels(page, canvas)).not.toBe(shown);
  await page.getByRole("button", { name: "Show object", exact: true }).first().click();
  await page.getByLabel("Geometry layout", { exact: true }).selectOption("single");
  await page.getByLabel("Geometry view", { exact: true }).selectOption("xy");
  const beforeZoom = await pixels(page, canvas);
  const orthoBox = (await canvas.boundingBox())!;
  await page.mouse.move(orthoBox.x + orthoBox.width / 2, orthoBox.y + orthoBox.height / 2);
  await page.mouse.wheel(0, -240);
  await expect.poll(() => pixels(page, canvas)).not.toBe(beforeZoom);
  await expect(canvas).toHaveAttribute("data-render-pixel-ratio", String(fullPixelRatio));
  expect(errors).toEqual([]);
});
