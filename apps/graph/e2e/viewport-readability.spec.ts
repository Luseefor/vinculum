import { expect, test, type Page } from "@playwright/test";
import { addObject } from "./helpers/addObject";
import { screenshotPixels } from "./helpers/canvasPixels";
import { fillInput } from "./helpers/mathInput";

test.setTimeout(90_000);

async function start(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(() => localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true })));
  await page.goto("/editor");
  await page.getByRole("button", { name: "Math Lab", exact: true }).click();
}

async function addTestSurface(page: Page, expression: string) {
  await page.getByRole("button", { name: "2D only", exact: true }).click();
  await addObject(page, "Surface");
  await fillInput(page.getByLabel("Surface expression z = f(x,y)", { exact: true }), expression);
  // The tests exercise GPU overlays and picking, rather than mesh complexity.
  await page.getByRole("tab", { name: "Settings", exact: true }).click();
  await page.getByLabel("Resolution", { exact: true }).fill("16");
  await page.getByRole("tab", { name: "Analyze", exact: true }).click();
  await page.getByRole("button", { name: "3D only", exact: true }).click();
}

async function coloredPixels(page: Page, color: "orange" | "blue") {
  const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
  const png = await screenshotPixels(page, canvas);
  return page.evaluate(async ({ png, color }) => {
    if (!png) return 0;
    const image = new Image();
    image.src = png;
    await image.decode();
    const scratch = document.createElement("canvas");
    scratch.width = image.width;
    scratch.height = image.height;
    const context = scratch.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i]!, g = pixels[i + 1]!, b = pixels[i + 2]!;
      if (color === "orange" ? r > g * 1.4 && r > b * 1.7 && r > 40 : b > r + 30 && g > r + 8) count++;
    }
    return count;
  }, { png, color });
}

test("3D gradient arrows draw, respond to controls and disappear when disabled", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await start(page);
  await addTestSurface(page, "x^2+y^2");
  const before = await coloredPixels(page, "orange");
  await page.getByLabel("Show gradient field", { exact: true }).click();
  await expect(page.getByText(/Visible in 2D and 3D/)).toBeVisible();
  await page.getByLabel("Gradient density", { exact: true }).fill("6");
  await expect.poll(() => coloredPixels(page, "orange"), { timeout: 30_000 }).toBeGreaterThan(before + 100);
  await page.getByLabel("Show normalize gradient", { exact: true }).click();
  await expect.poll(() => coloredPixels(page, "orange"), { timeout: 30_000 }).toBeGreaterThan(before + 100);
  await page.getByLabel("Hide gradient field", { exact: true }).click();
  await expect.poll(() => coloredPixels(page, "orange"), { timeout: 30_000 }).toBeLessThan(before + 30);
  expect(errors).toEqual([]);
});

test("differentiation previews surface coordinates before committing and clears on cancel", async ({ page }) => {
  await start(page);
  await addTestSurface(page, "x+y");
  await page.getByRole("button", { name: "Pick analysis point on surface", exact: true }).click();
  const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
  const bounds = (await canvas.boundingBox())!;
  const hover = page.locator('[data-graph3d-probe-hover="true"]');
  await page.mouse.move(bounds.x + bounds.width * .5, bounds.y + bounds.height * .5);
  await expect(hover).toContainText(/Pick X -?\d+\.\d+ · Y -?\d+\.\d+ · Z -?\d+\.\d+/);
  await expect(page.getByRole("button", { name: "Cancel picking analysis point" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(hover).toBeHidden();
  await page.getByRole("button", { name: "Pick analysis point on surface", exact: true }).click();
  await page.mouse.move(bounds.x + bounds.width * .5 + 2, bounds.y + bounds.height * .5);
  await expect(hover).toContainText("Pick X");
  await page.mouse.click(bounds.x + bounds.width * .5 + 2, bounds.y + bounds.height * .5);
  await expect(page.getByRole("button", { name: "Cancel picking analysis point" })).toHaveCount(0);
  await expect(page.getByRole("math", { name: /^P =/ })).toBeVisible();
  await expect(hover).toBeHidden();
});

test("Add catalog replaces rail chips and wide strokes render on the GPU backend", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await start(page);
  await expect(page.getByText("Quick add", { exact: true })).toHaveCount(0);
  const add = page.getByRole("button", { name: "Open object menu", exact: true });
  await add.click();
  await page.keyboard.press("Escape");
  await expect(add).toBeFocused();
  for (const name of ["Infinite Line", "Ray", "Segment", "Parametric Curve"]) await addObject(page, name);
  await expect(page.getByTestId("scene-object-count")).toHaveText("4");
  await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toHaveAttribute("data-render-backend", /webgpu|webgl2/);
  await expect.poll(() => coloredPixels(page, "blue"), { timeout: 30_000 }).toBeGreaterThan(300);
  expect(errors).toEqual([]);
});
