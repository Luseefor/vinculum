import { addObject } from "./helpers/addObject";
import { fillInput, expectInputValue, expectInputFocused } from "./helpers/mathInput";
import { expect, test, type Page } from "@playwright/test";

// S14 object workflow matrix: fast creation, keyboard navigation, invalid
// correction, delete/undo, palette + context menu commands, narrow sheet.
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

function collectErrors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  return { consoleErrors, pageErrors };
}

test.describe("S14 object workflow matrix", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("Workflow A/C/D/G: fast create, invalid-correct, delete-undo, regressions", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await page.getByRole("group", { name: "View type" }).getByRole("button", { name: "3D only" }).click();
    const canvas3d = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await expect(canvas3d).toBeVisible();

    // A: add -> equation focused automatically -> type -> renders.
    await addObject(page, "Surface");
    const eqInput = page.locator(SURFACE_INPUT).first();
    await expectInputFocused(eqInput, { timeout: 8000 });
    await fillInput(eqInput, "z = x^2 + y^2");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(canvas3d).toBeVisible();

    // C: invalid -> error -> correct -> clears, focus never lost.
    await fillInput(eqInput, "sin(");
    await expect(page.getByTestId("expression-diagnostic").first()).toBeVisible();
    await expectInputFocused(eqInput);
    await fillInput(eqInput, "z = sin(x)");
    await expect(page.getByTestId("expression-diagnostic")).toHaveCount(0);

    // G: S9/S10/S11 through the editor. Scoped to the definition
    // diagnostic (S30): Integral Analysis may report domain non-finiteness
    // contextually once its worker result arrives.
    await fillInput(eqInput, "1/(x^2+y^2)");
    await expect(page.getByTestId("expression-diagnostic")).toHaveCount(0);
    await fillInput(eqInput, "sin(factorial(x))");
    await expect(page.getByTestId("expression-diagnostic").first()).toContainText(/not supported|unsupported/i);
    await fillInput(eqInput, "z = x^2 + y^2");

    // D: Backspace on body deletes selected; toolbar Undo restores.
    await page.locator('[aria-label^="Selected "]').first().focus();
    await page.keyboard.press("Backspace");
    await expect(page.getByTestId("scene-object-count")).toHaveText("0");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");

    // Backspace inside input edits text, never deletes the object.
    // (Undo remounts the row collapsed, so expand first — as a user would.)
    await page.getByRole("button", { name: "Expand definition" }).first().click();
    const restored = page.locator(SURFACE_INPUT).first();
    await fillInput(restored, "z = x");
    await expect(restored).toBeVisible();
    await restored.press("Backspace");
    await expectInputValue(restored, "z = ");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Workflow B/E: keyboard navigation and search filter", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    for (let i = 0; i < 3; i++) {
      await addObject(page, "Surface");
    }
    await expect(page.getByTestId("scene-object-count")).toHaveText("3");

    // ArrowDown moves selection through rows.
    const first = page.getByRole("button", { name: "Select Surface #1" });
    await first.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("button", { name: "Selected Surface #2" })).toBeVisible();
    await page.keyboard.press("End");
    await expect(page.getByRole("button", { name: "Selected Surface #3" })).toBeVisible();
    await page.keyboard.press("Home");
    await expect(page.getByRole("button", { name: "Selected Surface #1" })).toBeVisible();

    // "/" focuses search; filtering narrows rows without losing selection.
    await page.keyboard.press("/");
    await expect(page.locator("#object-search-input")).toBeFocused();
    await fillInput(page.locator("#object-search-input"), "surface #2");
    await expect(page.getByRole("button", { name: /^(Select|Selected) Surface #2$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Select|Selected) Surface #1$/ })).toHaveCount(0);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Palette and context menu commands execute", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await page.getByRole("group", { name: "View type" }).getByRole("button", { name: "3D only" }).click();
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();

    // Command palette adds a plane with focus in its equation.
    await page.keyboard.press("Meta+k");
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
    await fillInput(page.getByLabel("Command search"), "plane");
    await page.getByRole("option", { name: "Add Plane" }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");

    // The scene context menu is owned by the graph canvas.
    await page.locator('canvas[data-graph3d-canvas="true"]:visible').first().click({ button: "right", position: { x: 40, y: 100 } });
    await expect(page.getByRole("menuitem", { name: "Remove selected" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Remove selected" }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("0");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Workflow F: narrow sheet create/edit/select/close/canvas", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 430, height: 800 });
    await startClean(page);
    await page.getByRole("group", { name: "View type" }).getByRole("button", { name: "3D only" }).click();
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await expect(canvas).toBeVisible();

    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Objects" })).toBeVisible();
    await addObject(page, "Surface");
    const eqInput = page.locator(SURFACE_INPUT).first();
    await expectInputFocused(eqInput, { timeout: 8000 });
    await fillInput(eqInput, "z = x^2 + y^2");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    // Hide/show from the sheet.
    await page.getByRole("button", { name: "Hide object" }).first().click({ force: true });
    await page.getByRole("button", { name: "Show object" }).first().click({ force: true });
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
