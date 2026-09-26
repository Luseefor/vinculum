import { expect, test, type Page } from "@playwright/test";

// Workspace shell regressions: object lifecycle, live equation
// diagnostics, view modes, project save, and narrow drawer behavior.
const SURFACE_INPUT = 'input[placeholder="x + y = 1, z = x^2 + y^2, or x^2 + y^2 = 1"]';

async function dismissBlockingDialogs(page: Page) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if ((await page.locator('[role="dialog"]:visible').count()) === 0) break;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }
}

async function startClean(page: Page) {
  await page.goto("/editor");
  await page.evaluate(() => {
    window.localStorage.setItem(
      "vinculum-welcome-onboarding-v1",
      JSON.stringify({ version: 1, dismissed: true, updatedAt: new Date().toISOString() })
    );
  });
  await page.reload();
  await dismissBlockingDialogs(page);
}

async function setEquation(page: Page, index: number, equation: string) {
  const input = page.locator(SURFACE_INPUT).nth(index);
  if ((await input.count()) === 0 || !(await input.isVisible())) {
    await page.getByRole("button", { name: "Expand definition" }).first().click();
  }
  await expect(input).toBeVisible();
  await input.fill(equation);
  await input.blur();
  await page.waitForTimeout(500);
  await expect(input).toHaveValue(equation);
}

async function showMoreAdd(page: Page) {
  // S30: Quick Add shows six actions per workspace; the rest sit behind More.
  const more = page.getByRole("button", { name: "Show more object types" });
  if ((await more.count()) > 0 && (await more.first().isVisible())) {
    await more.first().click();
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

test.describe("Workspace shell", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("object lifecycle + multi-object + S9/S10/S11 + modes + save", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await page.getByRole("group", { name: "View type" }).getByRole("button", { name: "3D only" }).click();
    const canvas3d = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await expect(canvas3d).toBeVisible();

    // Add surface via Quick Add, edit equation.
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await setEquation(page, 0, "z = x^2 + y^2");
    await expect(canvas3d).toBeVisible();

    // Hide / show.
    await page.getByRole("button", { name: "Hide object" }).first().click({ force: true });
    await expect(page.getByRole("button", { name: "Show object" }).first()).toBeVisible();
    await page.getByRole("button", { name: "Show object" }).first().click({ force: true });
    await expect(canvas3d).toBeVisible();

    // S9 + S10 + S11 semantics through the real editor.
    // S30: scope to the definition diagnostic. A singular-but-valid equation
    // must not produce an equation-level diagnostic (S9 sampling-domain
    // rule); the Integral Analysis section may still report domain
    // non-finiteness contextually once it auto-computes.
    await setEquation(page, 0, "1/(x^2+y^2)");
    await expect(page.getByTestId("expression-diagnostic")).toHaveCount(0);
    await setEquation(page, 0, "sin(factorial(x))");
    await expect(page.getByTestId("expression-diagnostic").first()).toContainText(/not supported|unsupported/i);
    await setEquation(page, 0, "z = x^2 + y^2");

    // Plane + parametric companions, selection follows clicks.
    await showMoreAdd(page);
    await page.getByRole("button", { name: "Plane", exact: true }).click();
    await page.getByRole("button", { name: "Parametric Curve", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("3");
    await page.getByRole("button", { name: "Select Surface #1" }).click();
    await expect(page.getByRole("button", { name: "Selected Surface #1" })).toBeVisible();

    // S10 plane equation persists through validation-backed save path.
    await page.getByRole("button", { name: "Scene" }).click();
    await page.getByRole("menuitem", { name: "Save as..." }).click();
    await page.locator("#project-name-input").fill("s12-matrix");
    await page.getByRole("button", { name: "Save project", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Save as project" })).not.toBeVisible({ timeout: 10000 });

    // Delete via object actions menu.
    await page.getByRole("button", { name: "Object actions" }).first().click();
    await page.getByRole("menuitem", { name: "Remove" }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("2");

    // Modes 3D -> 2D -> 3D.
    await page.getByRole("group", { name: "View type" }).getByRole("button", { name: "2D only" }).click();
    await expect(page.locator('canvas[data-graph2d-canvas="true"]').first()).toBeVisible();
    await page.getByRole("group", { name: "View type" }).getByRole("button", { name: "3D only" }).click();
    await expect(canvas3d).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("narrow drawer workflow does not block canvas", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 430, height: 800 });
    await startClean(page);
    // Compact narrow bar restores view switching below lg.
    await page.getByRole("group", { name: "View type" }).getByRole("button", { name: "3D only" }).click();
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await expect(canvas).toBeVisible();
    // Open objects drawer, add + edit, close via Escape, interact with canvas.
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Objects" })).toBeVisible();
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "Objects" })).not.toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.up();
    }
    await expect(canvas).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
