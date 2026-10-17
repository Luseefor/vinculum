import { readRecoveryScene } from "./helpers/recoveryScene";
import { expect, test, type Page } from "@playwright/test";
import { expectInputFocused, fillInput } from "./helpers/mathInput";

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
  return ((await readRecoveryScene(page))?.objects ?? []).map(object => {
    if (!("equation" in object)) throw new Error("Expected an equation object in this fixture.");
    return object;
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

for (const width of [390, 1440]) {
  test(`${width}px Add empty expression matches direct entry and Enter focuses the next row`, async ({ page }) => {
    await start(page, width);
    if (width < 720) await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "3D only", exact: true }).click();
    if (width < 720) await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Open object menu" }).click();
    await page.getByRole("button", { name: "Empty expression", exact: true }).click();
    const rowEditor = page.getByRole("complementary", { name: "Scene Navigator" }).locator('[data-auto-equation-input]').filter({ has: page.locator('[aria-label="Equation"]') });
    const equation = rowEditor.first().locator('[aria-label="Equation"]').first();
    await expectInputFocused(equation);
    await fillInput(equation, "x=y^2");
    await expect.poll(() => savedObjects(page)).toMatchObject([{ kind: "implicitCurve", equation: "x=y^2" }]);
    await expect(page.getByRole("button", { name: "2D only", exact: true, includeHidden: true })).toHaveAttribute("aria-pressed", "true");
    await fillInput(equation, "x=y^2+z^2");
    const rowSource = rowEditor.first().locator('input.math-source-input');
    await expect(rowSource).toBeFocused();
    // Initializing the single 3D view can delay the debounced recovery write on software renderers.
    await expect.poll(() => savedObjects(page), { timeout: 15_000 }).toMatchObject([{ kind: "surface", equation: "x=y^2+z^2" }]);
    await expect(page.getByRole("button", { name: "3D only", exact: true, includeHidden: true })).toHaveAttribute("aria-pressed", "true");
    await fillInput(equation, "x=");
    await expect(rowEditor.first().getByRole("status")).toBeVisible();
    expect(await savedObjects(page)).toMatchObject([{ equation: "x=y^2+z^2" }]);
    await fillInput(equation, "x=y^2");
    await rowSource.press("Enter");
    // Unfinished rows belong to the raw session draft, not the validated
    // recovery document. The last healthy recovery remains intact until both
    // definitions are complete.
    await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("vinculum-graph-session")!).state.scene.objects))
      .toMatchObject([{ kind: "implicitCurve", equation: "x=y^2" }, { kind: "implicitCurve", equation: "" }]);
    expect(await savedObjects(page)).toHaveLength(1);
    const next = rowEditor.nth(1);
    await expectInputFocused(next.locator('[aria-label="Equation"]').first());
    await fillInput(next.locator('[aria-label="Equation"]').first(), "y=sin(x)");
    await next.locator('input.math-source-input').press("Tab");
    await expect.poll(() => savedObjects(page)).toMatchObject([{ equation: "x=y^2" }, { equation: "y=sin(x)" }]);
    await page.reload();
    await expect.poll(() => savedObjects(page)).toMatchObject([{ equation: "x=y^2" }, { equation: "y=sin(x)" }]);
  });
}


for (const width of [390, 1440]) {
  test(`${width}px equation entry stays in place through preview and matches Add`, async ({ page }) => {
    await start(page, width);
    const draft = newInput(page);
    await fillInput(draft, "");
    const before = await source(page).boundingBox();
    await source(page).fill("y=x^2");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    const during = await source(page).boundingBox();
    expect(Math.abs(during!.y - before!.y)).toBeLessThan(2);
    expect(Math.abs(during!.x - before!.x)).toBeLessThan(2);
    await expect(source(page)).toBeFocused();
    await source(page).press("Enter");
    const navigator = page.getByRole("complementary", { name: "Scene Navigator" });
    const finalized = navigator.locator('[data-auto-equation-input]').filter({ has: page.locator('[aria-label="Equation"]') });
    const field = finalized.first();
    await expect(field).toBeVisible();
    expect(Math.abs((await field.boundingBox())!.y - before!.y)).toBeLessThan(2);
    await expect(navigator.getByText("Definition", { exact: true })).toHaveCount(0);
    await expect(source(page)).toBeFocused();
    await page.getByRole("button", { name: "Open object menu" }).click();
    await page.getByRole("button", { name: "Empty expression", exact: true }).click();
    await expectInputFocused(finalized.nth(1).locator('[aria-label="Equation"]').first());
    await page.keyboard.press("ArrowDown");
    await expectInputFocused(finalized.nth(1).locator('[aria-label="Equation"]').first());
    const added = await finalized.nth(1).boundingBox();
    expect(Math.abs(added!.x - (await field.boundingBox())!.x)).toBeLessThan(2);
    await expect(navigator.getByText("Definition", { exact: true })).toHaveCount(0);
  });
}
