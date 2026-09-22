import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Workspace shell accessibility regressions (axe + keyboard).
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

async function axeScan(page: Page) {
  // Full WCAG 2A/2AA gate, color-contrast included: S13 resolved the
  // light/dark tertiary and accent-ink token debt at the token level.
  return new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
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
    await page.getByRole("button", { name: "Surface", exact: true }).click();
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
    await page.getByRole("button", { name: "Surface", exact: true }).click();
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
    const results = await axeScan(page);
    expect(results.violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "Objects" })).not.toBeVisible();
  });
});
