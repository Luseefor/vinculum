import { expect, test, type Page } from "@playwright/test";
import { addObject } from "./helpers/addObject";

async function startClean(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true }));
  });
  await page.goto("/editor");
  await page.getByRole("button", { name: "2D only", exact: true }).click();
}

for (const kind of ["Curve", "Surface"] as const) {
  test(`2D parametric ${kind} creates in XY and switches dimensions without replacing definitions`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await startClean(page);
    await addObject(page, `2D Parametric ${kind}`);
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.locator('canvas[data-graph2d-canvas="true"]').first()).toBeVisible();
    const dimension = page.getByRole("group", { name: "Parametric dimension", exact: true }).first();
    await expect(dimension.getByRole("button", { name: "2D", exact: true })).toHaveAttribute("aria-pressed", "true");
    const zLabel = kind === "Curve" ? "Parametric z(t) =" : "Parametric z(u,v) =";
    await expect(page.getByLabel(zLabel, { exact: true })).toHaveCount(0);
    await dimension.getByRole("button", { name: "3D", exact: true }).click();
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    await page.getByRole("button", { name: `Edit as text: ${zLabel}`, exact: true }).first().click();
    const z = page.locator("input.math-source-input").and(page.getByLabel(zLabel, { exact: true })).first();
    await z.fill(kind === "Curve" ? "2*t" : "2*u-v");
    await dimension.getByRole("button", { name: "2D", exact: true }).click();
    await expect(page.locator('canvas[data-graph2d-canvas="true"]').first()).toBeVisible();
    await expect(page.getByLabel(zLabel, { exact: true })).toHaveCount(0);
    await dimension.getByRole("button", { name: "3D", exact: true }).click();
    await page.getByRole("button", { name: `Edit as text: ${zLabel}`, exact: true }).first().click();
    await expect(z).toHaveValue(kind === "Curve" ? "2*t" : "2*u-v");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
  });
}

test("planar surface paints a region and survives reload with its dimension", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await startClean(page);
  await addObject(page, "2D Parametric Surface");
  await expect(page.getByTestId("graph2d-spatial-only-note")).toHaveCount(0);
  const canvas = page.locator('canvas[data-graph2d-canvas="true"]').first();
  await expect(canvas).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("parametric-surface-2d.png") });
  const pixel = () => canvas.evaluate(async (node: HTMLCanvasElement) => {
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const viewport = JSON.parse(sessionStorage.getItem("vinculum-graph-session")!).state.ui.viewport2d;
    const rect = node.getBoundingClientRect(), ratio = node.width / rect.width;
    const x = (rect.width / 2 + (.37 - viewport.centerX) * viewport.scale) * ratio;
    const y = (rect.height / 2 - (.37 - viewport.centerY) * viewport.scale) * ratio;
    return [...node.getContext("2d")!.getImageData(Math.floor(x), Math.floor(y), 1, 1).data];
  });
  await page.getByRole("button", { name: "Hide object", exact: true }).first().click();
  const blank = await pixel();
  await page.getByRole("button", { name: "Show object", exact: true }).first().click();
  await expect.poll(pixel).not.toEqual(blank);
  await page.reload();
  await expect(page.getByTestId("scene-object-count")).toHaveText("1");
  await expect(page.getByRole("group", { name: "Parametric dimension" }).first().getByRole("button", { name: "2D", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(canvas).toBeVisible();
});

test("phone creation exposes both planar options and keyboard dimension switching", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 800 });
  await startClean(page);
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  await page.getByRole("button", { name: "Open object menu", exact: true }).click();
  await expect(page.getByRole("button", { name: "2D Parametric Curve", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "2D Parametric Surface", exact: true }).click();
  const dimensions = page.getByRole("group", { name: "Parametric dimension" }).first();
  await dimensions.getByRole("button", { name: "3D", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(dimensions.getByRole("button", { name: "3D", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
