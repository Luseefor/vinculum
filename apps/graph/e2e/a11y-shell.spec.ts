import { addObject } from "./helpers/addObject";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Workspace shell accessibility regressions (axe + keyboard).
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

async function axeScan(page: Page) {
  // Full WCAG 2A/2AA gate, color-contrast included: S13 resolved the
  // light/dark tertiary and accent-ink token debt at the token level.
  return new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"])
    .analyze();
}

test.describe("Workspace shell accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("empty editor has no axe violations", async ({ page }) => {
    await startClean(page);
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    const results = await axeScan(page);
    expect(results.violations).toEqual([]);
  });

  test("populated editor with open inspector has no axe violations", async ({ page }) => {
    await startClean(page);
    await addObject(page, "Surface");
    // New rows auto-select, which opens the inspector.
    await expect(page.getByRole("button", { name: "Selected Surface #1" })).toBeVisible();
    await page.waitForTimeout(800);
    const results = await axeScan(page);
    expect(results.violations).toEqual([]);
  });

  test("toolbar and object panel are keyboard reachable", async ({ page }) => {
    await startClean(page);
    // Tab from the top: brand/skip area into Scene menu and view controls.
    await page.keyboard.press("Tab");
    let focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.tagName);
    expect(focused).toBeTruthy();
    // Scene menu opens via keyboard.
    await page.getByRole("button", { name: "Scene" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitem", { name: "Save as..." })).toBeVisible();
    await page.keyboard.press("Escape");
    // Object row selection via keyboard (new rows auto-select on creation).
    await addObject(page, "Surface");
    const row = page.getByRole("button", { name: /^(Select|Selected) Surface #1$/ });
    await row.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Selected Surface #1" })).toBeVisible();
  });

  test("narrow drawer has no axe violations and closes with Escape", async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 800 });
    await startClean(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Objects" })).toBeVisible();
    // Let drawer/pressed-state CSS transitions settle before the contrast
    // scan: mid-transition blended colors otherwise read as violations,
    // especially under loaded long sessions (matches the 800ms settle in
    // the populated-inspector test above).
    await page.waitForTimeout(600);
    const results = await axeScan(page);
    expect(results.violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "Objects" })).not.toBeVisible();
  });
});

for (const width of [390, 1440]) {
  test(`${width}px solver modes remain accessible with reduced motion`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await startClean(page);
    await page.getByRole("button", { name: "Math Lab", exact: true }).click();
    const trigger = page.getByRole("button", { name: "Open field solver" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Field solver", exact: true });
    await expect(dialog).toBeVisible();
    for (const mode of ["vector", "scalar", "complex", "conjugate", "curve"]) {
      await dialog.getByLabel("Field problem").selectOption(mode);
      await expect(dialog.getByRole("button", { name: "Add to scene", exact: true })).toBeVisible();
      expect((await axeScan(page)).violations).toEqual([]);
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
}
