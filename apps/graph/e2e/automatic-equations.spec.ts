import { expect, test, type Page } from "@playwright/test";
import { fillInput } from "./helpers/mathInput";

async function start(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: 844 });
  await page.addInitScript(() => localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true })));
  await page.goto("/editor");
  if (width < 720) await page.getByRole("button", { name: "Objects", exact: true }).click();
  await expect(page.locator('[data-auto-equation-input]').last()).toBeVisible();
}
const blank = (page: Page) => page.locator('[data-auto-equation-input]').filter({ has: page.locator('[aria-label="New equation"]') });
const newInput = (page: Page) => blank(page).locator('[aria-label="New equation"]').first();
const source = (page: Page) => blank(page).locator('input.math-source-input');
async function savedObjects(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem("vinculum-unnamed-scene-recovery-v1");
    return raw ? JSON.parse(JSON.parse(raw).sceneJson).objects as { id: string; kind: string; equation: string; autoExpression?: boolean }[] : [];
  });
}

for (const width of [390, 1440]) {
  test(`${width}px plots a blank equation without a type picker and preserves typing through 3D changes`, async ({ page }) => {
    await start(page, width);
    await fillInput(newInput(page), "x=y^2");
    await expect.poll(() => savedObjects(page)).toMatchObject([{ kind: "implicitCurve", equation: "x=y^2", autoExpression: true }]);
    await expect(source(page)).toBeFocused();
    const id = (await savedObjects(page))[0].id;
    await fillInput(newInput(page), "x=y^2+z^2");
    await expect.poll(() => savedObjects(page)).toMatchObject([{ id, kind: "surface", equation: "x=y^2+z^2", autoExpression: true }]);
    await expect(source(page)).toBeFocused();
    await fillInput(newInput(page), "x=y^2");
    await expect.poll(() => savedObjects(page)).toMatchObject([{ id, kind: "implicitCurve", equation: "x=y^2" }]);
    await source(page).press("Enter");
    await expect(source(page)).toHaveValue("");
    if (width < 720) await page.keyboard.press("Escape");
    const canvas = page.locator('canvas[data-graph2d-canvas="true"]').first();
    await expect(canvas).toBeVisible();
    // A genuine line has colored pixels on both branches, with no shaded
    // rectangular surface domain. Canvas2D pixels are independent of GPU.
    const ink = await canvas.evaluate((node: HTMLCanvasElement) => {
      const { data } = node.getContext("2d")!.getImageData(0, 0, node.width, node.height);
      let colored = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i+2] > data[i] + 40 && data[i+2] > data[i+1] + 20) colored++;
      return colored;
    });
    expect(ink).toBeGreaterThan(100);
    expect(ink).toBeLessThan(20000);
  });
}

test("invalid drafts keep the last valid graph, and multiple equations save and reopen", async ({ page }) => {
  await start(page);
  await fillInput(newInput(page), "x^2+y^2=4");
  await expect.poll(() => savedObjects(page)).toMatchObject([{ kind: "implicitCurve" }]);
  await fillInput(newInput(page), "x=");
  await expect(blank(page).getByRole("status")).toBeVisible();
  expect(await savedObjects(page)).toMatchObject([{ equation: "x^2+y^2=4" }]);
  await fillInput(newInput(page), "x^2+y^2=4");
  await source(page).press("Enter");
  await fillInput(newInput(page), "6*cos(x^2)^2");
  await source(page).press("Enter");
  await expect.poll(async () => (await savedObjects(page)).length).toBe(2);
  await page.reload();
  await expect.poll(() => savedObjects(page)).toMatchObject([{ kind: "implicitCurve", equation: "x^2+y^2=4" }, { kind: "implicitCurve", equation: "6*cos(x^2)^2" }]);
});

test("a finalized equation edits in Inspector without losing focus or its plot-range controls", async ({ page }) => {
  await start(page);
  await fillInput(newInput(page), "x=y^2");
  await source(page).press("Enter");
  await expect.poll(() => savedObjects(page)).toMatchObject([{ kind: "implicitCurve" }]);
  const inspector = page.getByRole("complementary", { name: "Inspector", exact: true });
  const editor = inspector.locator('[data-auto-equation-input]');
  await fillInput(editor.locator('[aria-label="Equation"]').first(), "x=y^2+z^2");
  await expect.poll(() => savedObjects(page)).toMatchObject([{ kind: "surface" }]);
  await expect(editor.locator('input.math-source-input')).toBeFocused();
  await expect(inspector.getByRole("checkbox", { name: "Follow view" })).toBeChecked();
  await inspector.getByRole("checkbox", { name: "Follow view" }).uncheck();
  await expect(inspector.getByLabel("y min", { exact: true })).toBeVisible();
  await fillInput(editor.locator('[aria-label="Equation"]').first(), "x=y^2");
  await expect.poll(() => savedObjects(page)).toMatchObject([{ kind: "implicitCurve" }]);
  await expect(editor.locator('input.math-source-input')).toBeFocused();
});

test("types a relation directly in the typeset math editor", async ({ page }) => {
  await start(page);
  const math = blank(page).locator('math-field[aria-label="New equation"]');
  await expect(math).toBeVisible();
  await math.click();
  await expect.poll(() => math.evaluate(field => document.activeElement === field)).toBe(true);
  await page.keyboard.type("x=y^2", { delay: 40 });
  await expect.poll(() => savedObjects(page)).toMatchObject([{ kind: "implicitCurve", autoExpression: true }]);
  await page.keyboard.press("Enter");
  await expect(blank(page).locator('math-field')).toBeVisible();
  expect((await savedObjects(page))[0].equation).toMatch(/^x\s*=.*y/);
});
