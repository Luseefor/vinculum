import { readRecoveryScene } from "./helpers/recoveryScene";
import { expect, test, type Page } from "@playwright/test";
import { addObject } from "./helpers/addObject";
import { fillInput } from "./helpers/mathInput";

async function scene(page: Page) {
  const saved = await readRecoveryScene(page);
  if (!saved) return null;
  return { ...saved, objects: saved.objects.map(object => {
    if (!("equation" in object)) throw new Error("Expected an equation object in this fixture.");
    return object;
  }) };

}
async function showInspector(page: Page) {
  const button = page.getByRole("button", { name: "Inspector", exact: true });
  if (await button.getAttribute("aria-pressed") !== "true") await button.click();
}
async function addEquation(page: Page, equation: string) {
  const row = page.locator("[data-auto-equation-input]").filter({ has: page.locator('[aria-label="New equation"]') });
  await fillInput(row.locator('[aria-label="New equation"]').first(), equation);
  await row.locator("input.math-source-input").press("Enter");
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true })));
  await page.goto("/editor");
  await expect(page.locator('canvas[data-graph2d-canvas="true"]').first()).toBeVisible();
});

for (const operation of ["Union", "Intersection", "Subtract"]) {
  test(`${operation} creates a live source-linked region and survives undo and reload`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await addObject(page, "Implicit Surface");
    await addObject(page, "Implicit Surface");
    await showInspector(page);
    await page.getByRole("tab", { name: "Settings", exact: true }).click();
    await page.getByText("Object operations", { exact: true }).click();
    await page.getByRole("button", { name: operation, exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("3");
    await page.getByRole("tab", { name: "Edit", exact: true }).click();
    const summary = page.getByTestId("object-combination-summary");
    await expect(summary).toBeVisible();
    await expect(summary.getByRole("button", { name: "Select source 1" })).toBeEnabled();
    await expect.poll(async () => (await scene(page))?.objects.at(-1)?.combination?.operation).toBe(operation === "Subtract" ? "subtract" : operation.toLowerCase());
    const original = await scene(page);
    if (!original) throw new Error("Expected the operation to be saved.");
    expect(original.objects.slice(0, 2).every((object: { visible: boolean }) => !object.visible)).toBe(true);
    await summary.getByRole("button", { name: "Select source 1" }).click();
    await fillInput(page.locator("#graph-inspector").getByLabel("Implicit surface equation F(x,y,z) = 0", { exact: true }).first(), "(x-2)^2+y^2+z^2=1");
    await page.getByRole("tab", { name: "Settings", exact: true }).click();
    await expect.poll(async () => (await scene(page))?.objects.at(-1)?.equation).toContain("x-2");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(async () => (await scene(page))?.objects.at(-1)?.equation).toBe(original.objects.at(-1)!.equation);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect.poll(async () => (await scene(page))?.objects.at(-1)?.equation).toContain("x-2");
    await page.reload();
    await expect(page.getByTestId("scene-object-count")).toHaveText("3");
    await expect.poll(async () => (await scene(page))?.objects.at(-1)?.combination).toEqual(original.objects.at(-1)!.combination);
    expect(errors).toEqual([]);
  });
}

test("planar intersections mark crossings and curve extrusion keeps edited Z bounds", async ({ page }) => {
  await addEquation(page, "x^2+y^2=4");
  await addEquation(page, "y=x");
  await expect(page.getByRole("group", { name: "Selected 2D Curve #2", exact: true })).toBeVisible();
  await showInspector(page);
  await page.getByRole("tab", { name: "Analyze", exact: true }).click();
  const select = page.getByLabel("Second object for geometry analysis");
  await select.selectOption({ index: 1 });
  await expect(page.getByTestId("surface-intersection-result")).toHaveText("Intersection points found.");
  await page.getByRole("switch", { name: "Show intersection points", exact: true }).click();
  const canvas = page.locator('canvas[data-graph2d-canvas="true"]').first();
  await expect.poll(() => canvas.evaluate((node: HTMLCanvasElement) => {
    const data = node.getContext("2d")!.getImageData(0, 0, node.width, node.height).data;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] > 220 && data[i + 1] > 120 && data[i + 1] < 190 && data[i + 2] < 60) count++;
    return count;
  })).toBeGreaterThan(20);
  const markerY = () => canvas.evaluate((node: HTMLCanvasElement) => {
    const data = node.getContext("2d")!.getImageData(0, 0, node.width, node.height).data;
    let count = 0, sum = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] > 220 && data[i + 1] > 120 && data[i + 1] < 190 && data[i + 2] < 60) { count++; sum += Math.floor(i / 4 / node.width); }
    return count ? sum / count : Infinity;
  });
  const previousMarkerY = await markerY();
  await page.getByRole("tab", { name: "Edit", exact: true }).click();
  await fillInput(page.locator("#graph-inspector").getByLabel("Equation", { exact: true }).first(), "y=1");
  await page.getByRole("tab", { name: "Analyze", exact: true }).click();
  await expect(page.getByTestId("surface-intersection-result")).toHaveText("Intersection points found.");
  await expect(page.getByRole("switch", { name: "Hide intersection points", exact: true })).toHaveAttribute("aria-checked", "true");
  await expect.poll(markerY).toBeLessThan(previousMarkerY - 10);
  await page.getByRole("tab", { name: "Edit", exact: true }).click();
  await page.getByRole("checkbox", { name: "Extend to 3D", exact: true }).check();
  await page.getByLabel("z min", { exact: true }).fill("2");
  await page.getByLabel("z min", { exact: true }).press("Tab");
  await page.getByLabel("z max", { exact: true }).fill("8");
  await page.getByLabel("z max", { exact: true }).press("Tab");
  await expect.poll(async () => { const object = (await scene(page))?.objects[1]; return object?.kind === "implicitCurve" ? object.extensionRange : undefined; }).toEqual({ zMin: 2, zMax: 8 });
  await page.getByRole("group", { name: "View type" }).getByRole("button", { name: "3D only", exact: true }).click();
  await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
  await expect(page.getByTestId("compute-status-pending")).toHaveCount(0);
  await page.reload();
  await expect.poll(async () => { const object = (await scene(page))?.objects[1]; return object?.kind === "implicitCurve" ? object.extensionRange : undefined; }).toEqual({ zMin: 2, zMax: 8 });
});
