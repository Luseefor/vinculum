import { addObject } from "./helpers/addObject";
import { fillInput, expectInputValue, expectInputFocused } from "./helpers/mathInput";
import { expect, test, type Page } from "@playwright/test";

// S15 workspace workflows: shared scene continuity, cross-workspace edit,
// creation focus, views, save/reload, regressions, narrow behavior.
const SURFACE_INPUT = 'input[placeholder="x + y = 1, z = x^2 + y^2, or x^2 + y^2 = 1"]';

async function startClean(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "vinculum-welcome-onboarding-v1",
      JSON.stringify({ version: 1, dismissed: true, updatedAt: new Date().toISOString() })
    );
  });
  await page.goto("/editor");
  for (let i = 0; i < 5; i++) {
    if ((await page.locator('[role="dialog"]:visible').count()) === 0) break;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }
}

async function showMoreAdd(page: Page) {
  // S30: Quick Add shows six actions per workspace; the rest sit behind More.
  const more = page.getByRole("button", { name: "Open object menu" });
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

async function setEquation(page: Page, index: number, equation: string) {
  // Creation-focus expansion settles asynchronously across commits; wait for
  // the expected row input instead of racing it (S33-R1: pre-existing focus
  // timing race, exposed under dev-server load — same delay on base).
  await expect
    .poll(async () => page.locator(SURFACE_INPUT).count(), { timeout: 10000 })
    .toBeGreaterThanOrEqual(index + 1);
  const input = page.locator(SURFACE_INPUT).nth(index);
  if (!(await input.locator("..").isVisible())) {
    await page.getByRole("button", { name: "Expand definition" }).first().click();
  }
  await fillInput(input, equation);
  await expect(input).toBeVisible();
  await input.blur();
  await page.waitForTimeout(500);
  await expectInputValue(input, equation);
}

test.describe("S15 workspace workflows", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("Workflow 1+2+4: shared scene, cross-workspace edit, selection retained", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await page.getByRole("group", { name: "View type" }).getByRole("button", { name: "3D only" }).click();
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();

    // Create one of each kind in Math Lab (default).
    await expect(page.getByRole("button", { name: "Math Lab" })).toHaveAttribute("aria-pressed", "true");
    await addObject(page, "Surface");
    await setEquation(page, 0, "z = x^2 + y^2");
    await showMoreAdd(page);
    await addObject(page, "Plane");
    await addObject(page, "Parametric Curve");
    await addObject(page, "Surface");
    await setEquation(page, 1, "z = sin(x) + cos(y)");
    await expect(page.getByTestId("scene-object-count")).toHaveText("4");
    const idsBefore = await page.evaluate(() => {
      const items = [...document.querySelectorAll("[data-object-row-select]")];
      return items.map((el) => el.getAttribute("data-object-row-select"));
    });

    // Switch to Geometry and back: IDs, equations, visibility stable.
    await page.getByRole("button", { name: "Geometry Studio" }).click();
    await expect(page.getByRole("button", { name: "Geometry Studio" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("scene-object-count")).toHaveText("4");
    // Workflow 2: edit the same surface in Geometry.
    await setEquation(page, 0, "z = x^2 - y^2");
    await page.getByRole("button", { name: "Math Lab" }).click();
    await expectInputValue(page.locator(SURFACE_INPUT).first(), "z = x^2 - y^2");
    const idsAfter = await page.evaluate(() => {
      const items = [...document.querySelectorAll("[data-object-row-select]")];
      return items.map((el) => el.getAttribute("data-object-row-select"));
    });
    expect(idsAfter).toEqual(idsBefore);

    // Workflow 4: selection retained across switch with usable inspector.
    await page.getByRole("button", { name: /^(Select|Selected) Surface #1$/ }).click();
    await page.getByRole("button", { name: "Geometry Studio" }).click();
    await expect(page.getByRole("button", { name: "Selected Surface #1" })).toBeVisible();
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Workflow 3+5+6+8: creation focus, views, save, regressions per workspace", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    // Workflow 3: creation focus in Geometry workspace.
    await page.getByRole("button", { name: "Geometry Studio" }).click();
    await addObject(page, "Plane");
    await expectInputFocused(page.locator('input[placeholder="ax + by + cz + d = 0"]').first(), { timeout: 8000 });

    // Workflow 5: view/layout switching inside Geometry Studio, no stale
    // canvas. S30: the 2D/3D "View type" group is Math-Lab-only by design
    // (Geometry is the spatial 3D lens); Geometry switches Perspective/XY
    // via its View select and Single/Split via its Layout select.
    await page.getByRole("combobox", { name: "Geometry view" }).selectOption("xy");
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    await page.getByRole("combobox", { name: "Geometry view" }).selectOption("perspective");
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    await page.getByRole("combobox", { name: "Geometry layout" }).selectOption("split");
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    await page.getByRole("combobox", { name: "Geometry layout" }).selectOption("single");
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();

    // Workflow 6: save/reload keeps scene; workspace preference coherent.
    await page.getByRole("button", { name: "Scene" }).click();
    await page.getByRole("menuitem", { name: "Save as..." }).click();
    await fillInput(page.locator("#project-name-input"), "s15-ws");
    await page.getByRole("button", { name: "Save project", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Save as project" })).not.toBeVisible({ timeout: 10000 });
    await page.reload();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");

    // Workflow 8: S9/S10/S11 through the editor.
    await page.getByRole("button", { name: "Math Lab" }).click();
    await addObject(page, "Surface");
    await setEquation(page, 0, "1/(x^2+y^2)");
    // S30: scoped to the definition diagnostic (see workspace-shell.spec.ts);
    // Integral Analysis may report domain non-finiteness contextually.
    await expect(page.getByTestId("expression-diagnostic")).toHaveCount(0);
    await setEquation(page, 0, "sin(factorial(x))");
    await expect(page.getByTestId("expression-diagnostic").first()).toContainText(/not supported|unsupported/i);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Workflow 7: narrow workspace switching and sheet workflow", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 430, height: 800 });
    await startClean(page);
    await page.getByRole("group", { name: "View type" }).getByRole("button", { name: "3D only" }).click();
    // Switcher reachable at narrow width (compact bar), canvas unobstructed.
    await page.getByRole("button", { name: "Geometry Studio" }).click();
    await expect(page.getByRole("button", { name: "Geometry Studio" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Objects" })).toBeVisible();
    await addObject(page, "Plane");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "Objects" })).not.toBeVisible();
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
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
