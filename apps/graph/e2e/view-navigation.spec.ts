import { expect, test } from "@playwright/test";
import { addObject } from "./helpers/addObject";
import { fillInput } from "./helpers/mathInput";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true }));
  });
  await page.goto("/editor");
});

test("creation and viewport notices provide a working route between dimensions", async ({ page }) => {
  await page.getByRole("button", { name: "2D only", exact: true }).click();
  await addObject(page, "3D Vector Field");
  await expect(page.getByRole("button", { name: "3D only", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "2D only", exact: true }).click();
  await page.getByRole("button", { name: "Show in 3D", exact: true }).click();
  await expect(page.getByRole("button", { name: "3D only", exact: true })).toHaveAttribute("aria-pressed", "true");
  await addObject(page, "2D Vector Field");
  await expect(page.getByRole("button", { name: "2D only", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "3D only", exact: true }).click();
  await page.getByRole("button", { name: "Show in 2D", exact: true }).click();
  await expect(page.getByRole("button", { name: "2D only", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Geometry Studio", exact: true }).click();
  await page.getByRole("button", { name: "Show in 2D", exact: true }).click();
  await expect(page.getByRole("button", { name: "Math Lab", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("scene-object-count")).toHaveText("2");
});

test("automatic equations preserve a combined layout when their dimension changes", async ({ page }) => {
  const input = page.locator('[data-auto-equation-input]').filter({ has: page.locator('[aria-label="New equation"]') }).locator('[aria-label="New equation"]').first();
  for (const equation of ["x=y^2", "x=y^2+z^2", "x=y^2"]) {
    await fillInput(input, equation);
    await expect.poll(() => page.evaluate(() => {
      const saved = sessionStorage.getItem("vinculum-graph-session");
      return saved ? JSON.parse(saved).state.scene.objects[0]?.equation : undefined;
    })).toBe(equation);
    await expect(page.getByRole("button", { name: "2D and 3D together", exact: true })).toHaveAttribute("aria-pressed", "true");
  }
});

test("quad retains its perspective canvas and provides a distinct YZ projection", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await addObject(page, "Point");
  const perspective = page.locator('canvas[data-graph3d-canvas="true"]').first();
  const original = await perspective.elementHandle();
  await page.getByRole("button", { name: "Four-panel layout", exact: true }).click();
  await expect(page.locator('[data-graph3d-projection="yz"] canvas')).toBeVisible();
  await expect(page.getByText(/^3D projection\s*·\s*YZ$/)).toBeVisible();
  expect(await original!.evaluate(canvas => canvas.isConnected)).toBe(true);
  await page.getByRole("button", { name: "Side-by-side layout", exact: true }).click();
  await expect(page.locator('[data-graph3d-projection="yz"]')).not.toBeVisible();
  expect(await original!.evaluate(canvas => canvas.isConnected)).toBe(true);
  await page.getByRole("button", { name: "Four-panel layout", exact: true }).click();
  await expect(page.locator('[data-graph3d-projection="yz"] canvas')).toBeVisible();
  expect(await original!.evaluate(canvas => canvas.isConnected)).toBe(true);
  expect(errors).toEqual([]);
});

test("pin and distance tools work in the second 2D pane using its XZ coordinates", async ({ page }) => {
  await addObject(page, "Point");
  await page.getByRole("button", { name: "Four-panel layout", exact: true }).click();
  const canvas = page.locator('canvas[data-graph2d-variant="quadTop"]');
  await expect(canvas).toBeVisible();
  await page.getByRole("combobox", { name: "Tool", exact: true }).selectOption("addPin");
  await canvas.click({ position: { x: 180, y: 130 } });
  await expect.poll(() => page.evaluate(() => {
    const saved = sessionStorage.getItem("vinculum-graph-session");
    return saved ? JSON.parse(saved).state.scene.measurements.filter((entry: { kind: string }) => entry.kind === "pin") : [];
  })).toMatchObject([{ kind: "pin", point: { y: 0 } }]);
  await page.getByRole("combobox", { name: "Tool", exact: true }).selectOption("measureDistance");
  await canvas.click({ position: { x: 160, y: 130 } });
  await canvas.click({ position: { x: 220, y: 150 } });
  await expect.poll(() => page.evaluate(() => {
    const saved = sessionStorage.getItem("vinculum-graph-session");
    return saved ? JSON.parse(saved).state.scene.measurements.filter((entry: { kind: string }) => entry.kind === "distance") : [];
  })).toMatchObject([{ kind: "distance", points: [{ y: 0 }, { y: 0 }] }]);
});

test("Projection explains its prerequisite and leaves the scene intact", async ({ page }) => {
  await page.getByRole("button", { name: "Open object menu", exact: true }).click();
  await page.getByRole("button", { name: "Analysis", exact: true }).click();
  await expect(page.getByRole("button", { name: "Projection", exact: true })).toBeDisabled();
  await expect(page.getByText("Select a parametric curve first", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open object menu", exact: true })).toBeFocused();
  await expect(page.getByTestId("scene-object-count")).toHaveText("0");
});

test("planar recovery changes the pane that owns the notice and retains Quad", async ({ page }) => {
  await addObject(page, "2D Linear Transformation");
  await page.getByRole("button", { name: "Four-panel layout", exact: true }).click();
  const pane = page.locator('canvas[data-graph2d-variant="quadTop"]').locator("..");
  await expect(pane.getByTestId("graph2d-xy-only-note")).toBeVisible();
  await pane.getByRole("button", { name: "Show on XY" }).focus();
  await page.keyboard.press("Enter");
  await expect(pane.getByTestId("graph2d-xy-only-note")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Four-panel layout", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("scene-object-count")).toHaveText("1");
  await expect.poll(() => page.evaluate(() => {
    const saved = sessionStorage.getItem("vinculum-graph-session");
    const ui = saved ? JSON.parse(saved).state.ui : {};
    return { primary: ui.axis2dPair, secondary: ui.axis2dPairQuadTop };
  })).toEqual({ primary: "xy", secondary: "xy" });
});

test("single-view planar recovery returns from XZ to XY", async ({ page }) => {
  await addObject(page, "2D Linear Transformation");
  await page.getByRole("button", { name: "2D only", exact: true }).click();
  await page.getByRole("button", { name: "View options", exact: true }).click();
  await page.getByRole("combobox", { name: "2D Plane", exact: true }).selectOption("xz");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Show on XY", exact: true }).click();
  await expect(page.getByTestId("graph2d-xy-only-note")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "2D only", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("Escape cancels a 3D sketch even if Sketch is rearmed before pointerup", async ({ page }) => {
  await addObject(page, "Point");
  await page.getByRole("button", { name: "3D only", exact: true }).click();
  const tool = page.getByRole("combobox", { name: "Tool", exact: true });
  await tool.selectOption("draw");
  const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5, { steps: 6 });
  await page.keyboard.press("Escape");
  await tool.selectOption("draw");
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.45, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByTestId("scene-object-count")).toHaveText("1");
});
