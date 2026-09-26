import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// S28 linear algebra: 2D identity/scale/reflection/shear/rotation/
// singular/zero, 3D diagonal/reflection, row-column-world mapping,
// parameter liveness, vector application + delete lifecycle, eigen
// overlay, synchronized views, camera independence, persistence,
// undo/redo, workspace coherence, narrow sheets, security/a11y.
// Zero unexpected console/page errors.
test.describe.configure({ mode: "serial" });

async function startClean(page: Page) {
  await page.goto("/editor");
  await page.evaluate(() => {
    window.localStorage.setItem(
      "vinculum-welcome-onboarding-v1",
      JSON.stringify({ version: 1, dismissed: true, updatedAt: new Date().toISOString() })
    );
  });
  await page.reload();
  for (let i = 0; i < 5; i++) {
    if ((await page.locator('[role="dialog"]:visible').count()) === 0) break;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }
}

function collectErrors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  return { consoleErrors, pageErrors };
}

async function toGeometry(page: Page) {
  await page.getByRole("button", { name: "Geometry Studio" }).click();
  await expect(page.getByRole("button", { name: "Geometry Studio" })).toHaveAttribute("aria-pressed", "true");
}

async function toMathLab(page: Page) {
  await page.getByRole("button", { name: "Math Lab" }).click();
  await expect(page.getByRole("button", { name: "Math Lab" })).toHaveAttribute("aria-pressed", "true");
}

function graph3dCanvas(page: Page) {
  return page.locator('canvas[data-graph3d-canvas="true"]').first();
}

function inspector(page: Page) {
  return page.locator("#graph-inspector");
}

async function setCell(page: Page, row: number, col: number, value: string) {
  await inspector(page).getByLabel(`Row ${row} column ${col}`).fill(value);
}

async function settleScene(page: Page) {
  await page.waitForTimeout(1200);
}

test.describe("S28 linear algebra", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("A: 2D identity keeps the unit square with det=1 rank=2", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "2D Linear Transformation", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByTestId("linear-fact-determinant")).toHaveText("1", { timeout: 10000 });
    await expect(page.getByTestId("linear-fact-rank")).toHaveText("2");
    await expect(page.getByTestId("linear-fact-invertible")).toHaveText("Yes");
    await expect(page.getByTestId("linear-fact-scale")).toHaveText("1");
    await expect(page.getByTestId("linear-fact-orientation")).toHaveText("Preserved");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("B: diag(2,3) scales basis with det=6 area=6", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "2D Linear Transformation", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await setCell(page, 1, 1, "2");
    await setCell(page, 2, 2, "3");
    await expect(page.getByTestId("linear-fact-determinant")).toHaveText("6", { timeout: 10000 });
    await expect(page.getByTestId("linear-fact-scale")).toHaveText("6");
    await expect(page.getByTestId("linear-fact-rank")).toHaveText("2");
    await expect(page.getByTestId("linear-fact-inverse")).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("C: reflection diag(-1,1) reverses orientation", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "2D Linear Transformation", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await setCell(page, 1, 1, "-1");
    await expect(page.getByTestId("linear-fact-determinant")).toHaveText("-1", { timeout: 10000 });
    await expect(page.getByTestId("linear-fact-orientation")).toHaveText("Reversed");
    await expect(page.getByTestId("linear-fact-scale")).toHaveText("1");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("D: shear has det=1 with a single eigendirection", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "2D Linear Transformation", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await setCell(page, 1, 2, "1");
    await expect(page.getByTestId("linear-fact-determinant")).toHaveText("1", { timeout: 10000 });
    await expect(page.getByTestId("linear-fact-orientation")).toHaveText("Preserved");
    await expect(page.getByTestId("linear-fact-eigen")).toBeVisible({ timeout: 10000 });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("E: 90-degree rotation preserves orientation with no real eigendirections", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "2D Linear Transformation", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await setCell(page, 1, 1, "0");
    await setCell(page, 1, 2, "-1");
    await setCell(page, 2, 1, "1");
    await setCell(page, 2, 2, "0");
    await expect(page.getByTestId("linear-fact-determinant")).toHaveText("1", { timeout: 10000 });
    await expect(page.getByTestId("linear-fact-orientation")).toHaveText("Preserved");
    await expect(page.getByTestId("linear-fact-eigen-none")).toContainText("No real eigendirections.");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("F: singular [[1,2],[2,4]] has rank 1 with no inverse", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "2D Linear Transformation", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await setCell(page, 1, 2, "2");
    await setCell(page, 2, 1, "2");
    await setCell(page, 2, 2, "4");
    await expect(page.getByTestId("linear-fact-determinant")).toHaveText("0", { timeout: 10000 });
    await expect(page.getByTestId("linear-fact-rank")).toHaveText("1");
    await expect(page.getByTestId("linear-fact-invertible")).toHaveText("No");
    await expect(page.getByTestId("linear-fact-orientation")).toHaveText("Collapsed / singular");
    expect(await page.locator("body").textContent()).not.toMatch(/NaN/);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("G: zero matrix collapses with rank 0 and no NaNs", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "2D Linear Transformation", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await setCell(page, 1, 1, "0");
    await setCell(page, 2, 2, "0");
    await expect(page.getByTestId("linear-fact-rank")).toHaveText("0", { timeout: 10000 });
    await expect(page.getByTestId("linear-fact-invertible")).toHaveText("No");
    expect(await page.locator("body").textContent()).not.toMatch(/NaN/);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("H: 3D diag(2,3,4) has det=24 rank=3 volume=24", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "3D Linear Transformation", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await setCell(page, 1, 1, "2");
    await setCell(page, 2, 2, "3");
    await setCell(page, 3, 3, "4");
    await expect(page.getByTestId("linear-fact-determinant")).toHaveText("24", { timeout: 10000 });
    await expect(page.getByTestId("linear-fact-rank")).toHaveText("3");
    await expect(page.getByTestId("linear-fact-scale")).toHaveText("24");
    await expect(page.getByTestId("linear-fact-orientation")).toHaveText("Preserved");
    await expect(graph3dCanvas(page)).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("I: 3D diag(1,1,-1) reverses orientation", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "3D Linear Transformation", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await setCell(page, 3, 3, "-1");
    await expect(page.getByTestId("linear-fact-determinant")).toHaveText("-1", { timeout: 10000 });
    await expect(page.getByTestId("linear-fact-orientation")).toHaveText("Reversed");
    await expect(page.getByTestId("linear-fact-scale")).toHaveText("1");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("J: asymmetric matrix maps basis columns (Ae1=<1,4,7>)", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "3D Linear Transformation", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByRole("button", { name: "Vector", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("2");
    // e1 as a canonical vector: Ae1 must read back the first column.
    await inspector(page).getByLabel("Vector component x").fill("1");
    await inspector(page).getByLabel("Vector component y").fill("0");
    await inspector(page).getByLabel("Vector component z").fill("0");
    await page.getByRole("button", { name: /Linear Transformation #1/ }).click();
    await setCell(page, 1, 2, "2");
    await setCell(page, 1, 3, "3");
    await setCell(page, 2, 1, "4");
    await setCell(page, 2, 3, "6");
    await setCell(page, 3, 1, "7");
    await setCell(page, 3, 2, "8");
    await setCell(page, 3, 3, "9");
    await page.getByLabel("Vector for transformation analysis").selectOption({ index: 1 });
    await expect(page.getByTestId("linear-fact-av")).toContainText("1", { timeout: 10000 });
    await expect(page.getByTestId("linear-fact-av")).toContainText("4");
    await expect(page.getByTestId("linear-fact-av")).toContainText("7");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("K: entry parameter `r` updates det live via slider", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "2D Linear Transformation", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await setCell(page, 1, 1, "r");
    // Default r=2.5: det reads 2.5; driving the slider to 4 updates live.
    await expect(page.getByTestId("linear-fact-determinant")).toHaveText("2.5", { timeout: 10000 });
    await page.getByRole("button", { name: "PARAMETERS" }).click();
    const slider = page.getByLabel("Parameter r");
    await expect(slider).toBeVisible();
    await slider.evaluate((element, value) => {
      const input = element as HTMLInputElement;
      input.focus();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (setter) {
        setter.call(input, String(value));
      } else {
        input.value = String(value);
      }
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, "4");
    await expect(page.getByTestId("linear-fact-determinant")).toHaveText("4", { timeout: 10000 });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("L: vector application excludes origin with overlay", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "3D Linear Transformation", exact: true }).click();
    await setCell(page, 1, 1, "2");
    await setCell(page, 2, 2, "3");
    await setCell(page, 3, 3, "4");
    await page.getByRole("button", { name: "Vector", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("2");
    await inspector(page).getByLabel("Vector origin x").fill("10");
    await inspector(page).getByLabel("Vector origin y").fill("20");
    await inspector(page).getByLabel("Vector origin z").fill("30");
    await inspector(page).getByLabel("Vector component x").fill("1");
    await inspector(page).getByLabel("Vector component y").fill("2");
    await inspector(page).getByLabel("Vector component z").fill("3");
    await page.getByRole("button", { name: /Linear Transformation #1/ }).click();
    await page.getByLabel("Vector for transformation analysis").selectOption({ index: 1 });
    // diag(2,3,4)·<1,2,3> = <2,6,12>; origin (10,20,30) excluded.
    await expect(page.getByTestId("linear-fact-av")).toContainText("2", { timeout: 10000 });
    await expect(page.getByTestId("linear-fact-av")).toContainText("6");
    await expect(page.getByTestId("linear-fact-av")).toContainText("12");
    await page.getByRole("switch", { name: "Show transformed vector" }).click();
    await settleScene(page);
    await expect(graph3dCanvas(page)).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("M: deleting the vector clears the analysis selection", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "3D Linear Transformation", exact: true }).click();
    await page.getByRole("button", { name: "Vector", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("2");
    await page.getByRole("button", { name: /Linear Transformation #1/ }).click();
    await page.getByLabel("Vector for transformation analysis").selectOption({ index: 1 });
    await expect(page.getByTestId("linear-fact-av")).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: /Vector #2/ }).click();
    await page.keyboard.press("Delete");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByRole("button", { name: /Linear Transformation #1/ }).click();
    await expect(page.getByLabel("Vector for transformation analysis")).toHaveValue("");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("N: eigendirection overlay toggles without blocking picks", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "2D Linear Transformation", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await setCell(page, 1, 1, "2");
    await setCell(page, 2, 2, "3");
    await expect(page.getByTestId("linear-fact-eigen")).toBeVisible({ timeout: 10000 });
    await page.getByRole("switch", { name: "Show eigendirections" }).click();
    await settleScene(page);
    await expect(graph3dCanvas(page)).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("O: synchronized views share one transform resource", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "3D Linear Transformation", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await setCell(page, 1, 1, "2");
    await expect(page.getByTestId("linear-fact-determinant")).toHaveText("2", { timeout: 10000 });
    await page.getByLabel("Geometry layout").selectOption("quad");
    await settleScene(page);
    await expect(graph3dCanvas(page)).toBeVisible();
    await expect(page.getByTestId("linear-fact-determinant")).toHaveText("2");
    await page.getByLabel("Geometry layout").selectOption("single");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("P: orbiting leaves det/rank/eigen/Av unchanged", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "3D Linear Transformation", exact: true }).click();
    await setCell(page, 1, 1, "2");
    await setCell(page, 2, 2, "3");
    await setCell(page, 3, 3, "4");
    await expect(page.getByTestId("linear-fact-determinant")).toHaveText("24", { timeout: 10000 });
    const canvas = graph3dCanvas(page);
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2 + 150, box!.y + box!.height / 2 + 60, { steps: 8 });
    await page.mouse.up();
    await settleScene(page);
    // Canvas mousedown clears selection by product convention; reselect.
    await page.getByRole("button", { name: /Linear Transformation #1/ }).click();
    await expect(page.getByTestId("linear-fact-determinant")).toHaveText("24", { timeout: 10000 });
    await expect(page.getByTestId("linear-fact-rank")).toHaveText("3");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Q: save/reopen preserves matrix expressions byte-exact", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "2D Linear Transformation", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await setCell(page, 1, 1, "2*pi");
    await page.getByRole("button", { name: "Scene" }).click();
    await page.getByRole("menuitem", { name: "Save as..." }).click();
    await page.locator("#project-name-input").fill("s28-transform");
    await page.getByRole("button", { name: "Save project", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Save as project" })).not.toBeVisible({ timeout: 10000 });
    await page.reload();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByRole("button", { name: /Linear Transformation #1/ })).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("R: undo/redo restores matrix edits", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "2D Linear Transformation", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await setCell(page, 1, 1, "5");
    await expect(page.getByTestId("linear-fact-determinant")).toHaveText("5", { timeout: 10000 });
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByTestId("linear-fact-determinant")).toHaveText("1", { timeout: 10000 });
    await page.getByRole("button", { name: "Redo" }).click();
    await expect(page.getByTestId("linear-fact-determinant")).toHaveText("5", { timeout: 10000 });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("S: analysis coheres across Math Lab and Geometry Studio", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "2D Linear Transformation", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByTestId("linear-fact-determinant")).toBeVisible({ timeout: 10000 });
    await toGeometry(page);
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByTestId("linear-fact-determinant")).toBeVisible();
    await toMathLab(page);
    await expect(page.getByTestId("linear-fact-determinant")).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("T: narrow 430x800 keeps matrix editor and analysis usable", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 430, height: 800 });
    await startClean(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "2D Linear Transformation", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await expect(page.getByLabel("Row 1 column 1")).toBeVisible();
    await expect(page.getByTestId("linear-fact-determinant")).toBeVisible();
    await page.keyboard.press("Escape");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("U: unsafe matrix expression rejected with axe clean", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "2D Linear Transformation", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await setCell(page, 1, 1, "sin(factorial(a))");
    await expect(page.getByRole("alert").first()).toBeVisible({ timeout: 10000 });
    // Park the mouse on the inert 2D canvas: its resting position
    // persists across tests in one profile, and a hover-brightened
    // button would skew axe's color-contrast measurement.
    const axeCanvas = page.locator('canvas[data-graph2d-canvas="true"]').first();
    const axeBox = await axeCanvas.boundingBox();
    if (axeBox) {
      await page.mouse.move(axeBox.x + axeBox.width / 2, axeBox.y + axeBox.height / 2);
    }
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
