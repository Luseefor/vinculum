import { expect, test } from "@playwright/test";
import { fillInput, expectInputValue } from "./helpers/mathInput";
import { addObject } from "./helpers/addObject";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true }));
  });
  await page.goto("/editor");
});

for (const [equation, shape] of [["z=x^2+y^2-4", "circle"], ["x=y^2+z^2", "sideways"]] as const) {
  test(`${equation} shows the actual 3D surface cross-section in the 2D canvas`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const row = page.locator('[data-auto-equation-input]').last();
    await fillInput(row.locator('[aria-label="New equation"]').first(), equation);
    await row.locator("input.math-source-input").press("Enter");
    await page.getByRole("button", { name: "2D and 3D together", exact: true }).click();
    await expect(page.getByTestId("implicit-slice-label").first()).toContainText("z = 0");
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    const canvas = page.locator('canvas[data-graph2d-canvas="true"]').first();
    await expect.poll(() => canvas.evaluate((node: HTMLCanvasElement, kind) => {
      const ui = JSON.parse(sessionStorage.getItem("vinculum-graph-session")!).state.ui;
      const viewport = ui.viewport2d;
      const rect = node.getBoundingClientRect();
      const ratio = node.width / rect.width;
      const { data } = node.getContext("2d")!.getImageData(0, 0, node.width, node.height);
      let count = 0, worst = 0;
      for (let py = 0; py < node.height; py += 2) for (let px = 0; px < node.width; px += 2) {
        const i = (py * node.width + px) * 4;
        if (!(data[i + 2] > 180 && data[i + 1] > 80 && data[i] < 130 && data[i + 2] > data[i + 1] + 40)) continue;
        const x = (px / ratio - rect.width / 2) / viewport.scale + viewport.centerX;
        const y = -(py / ratio - rect.height / 2) / viewport.scale + viewport.centerY;
        worst = Math.max(worst, Math.abs(kind === "circle" ? x * x + y * y - 4 : x - y * y));
        count++;
      }
      return count > 80 && worst < .5;
    }, shape)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("axis changes identify slices rather than relabeling the surface", async ({ page }) => {
  await addObject(page, "Surface");
  await page.getByRole("button", { name: "2D and 3D together", exact: true }).click();
  await page.getByRole("button", { name: "View options", exact: true }).click();
  await page.getByRole("combobox", { name: "2D Plane", exact: true }).selectOption("xz");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("implicit-slice-label").first()).toContainText("y = 0");
  await page.getByRole("button", { name: "View options", exact: true }).click();
  await page.getByRole("combobox", { name: "2D Plane", exact: true }).selectOption("yz");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("implicit-slice-label").first()).toContainText("x = 0");
});

test("the dependent-variable control changes the surface equation and its 2D slice", async ({ page }) => {
  await addObject(page, "Surface");
  await fillInput(page.getByLabel("Surface expression z = f(x,y)").first(), "z = 3");
  const dependent = page.getByRole("combobox", { name: "Dependent variable", exact: true });
  // selectOption changes the DOM value without moving focus; users leave
  // the expression editor before operating this control.
  await dependent.focus();
  await dependent.selectOption("x");
  await expectInputValue(page.getByLabel("Surface expression x = f(y,z)").first(), "3");
  await expect.poll(() => page.evaluate(() => {
    const recovery = JSON.parse(sessionStorage.getItem("vinculum-graph-session")!);
    return recovery.state.scene.objects.find((o: { kind: string }) => o.kind === "surface");
  })).toMatchObject({ orientation: "x", equation: "x = 3" });
  await page.getByRole("button", { name: "2D and 3D together", exact: true }).click();
  const canvas = page.locator('canvas[data-graph2d-canvas="true"]').first();
  await expect.poll(() => canvas.evaluate((node: HTMLCanvasElement) => {
    const { viewport2d: viewport } = JSON.parse(sessionStorage.getItem("vinculum-graph-session")!).state.ui;
    const rect = node.getBoundingClientRect(), ratio = node.width / rect.width;
    const pixels = node.getContext("2d")!.getImageData(0, 0, node.width, node.height).data;
    let count = 0, worst = 0;
    for (let py = 0; py < node.height; py += 2) for (let px = 0; px < node.width; px += 2) {
      const i = (py * node.width + px) * 4;
      if (!(pixels[i + 2] > 180 && pixels[i + 1] > 80 && pixels[i] < 130 && pixels[i + 2] > pixels[i + 1] + 40)) continue;
      worst = Math.max(worst, Math.abs((px / ratio - rect.width / 2) / viewport.scale + viewport.centerX - 3));
      count++;
    }
    return count > 80 && worst < .1;
  })).toBe(true);
});

test("objects restricted to one dimension have an honest viewport note", async ({ page }) => {
  await addObject(page, "3D Vector Field");
  await page.getByRole("button", { name: "2D and 3D together", exact: true }).click();
  await expect(page.getByTestId("graph2d-spatial-only-note").first()).toHaveText("1 object is shown in 3D only");
  await addObject(page, "2D Vector Field");
  await expect(page.getByTestId("graph3d-planar-only-note").first()).toHaveText("1 vector field is shown in 2D only");
});
