import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// S35 final product polish: non-blocking onboarding, theme/status UX,
// selection semantics, reduced motion, responsive coherence. Engine
// behavior remains covered by S16–S34.

async function dismissStartupChrome(page: Page) {
  for (let i = 0; i < 5; i++) {
    if ((await page.locator('[role="dialog"]:visible').count()) === 0) break;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  }
}

async function startFresh(page: Page) {
  await page.goto("/editor");
  await page.evaluate(() => {
    window.localStorage.removeItem("vinculum-welcome-onboarding-v1");
  });
  await page.reload();
  await dismissStartupChrome(page);
}

async function startDismissed(page: Page) {
  await page.goto("/editor");
  await page.evaluate(() => {
    window.localStorage.setItem(
      "vinculum-welcome-onboarding-v1",
      JSON.stringify({ version: 1, dismissed: true, updatedAt: new Date().toISOString() })
    );
  });
  await page.reload();
  await dismissStartupChrome(page);
}

async function toGeometry(page: Page) {
  await page.getByRole("button", { name: "Geometry Studio" }).click();
  await expect(page.getByRole("button", { name: "Geometry Studio" })).toHaveAttribute("aria-pressed", "true");
}

async function toMathLab(page: Page) {
  await page.getByRole("button", { name: "Math Lab" }).click();
  await expect(page.getByRole("button", { name: "Math Lab" })).toHaveAttribute("aria-pressed", "true");
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

async function axeScan(page: Page) {
  return new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
}

test.describe("S35 final product polish", () => {
  test("A: fresh first-run Geometry shows non-blocking tips", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await startFresh(page);
    await toGeometry(page);
    const hint = page.getByTestId("first-run-hint");
    await expect(hint).toBeVisible();
    await expect(hint).toContainText("Geometry Studio");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Create Point" }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("B: dismiss onboarding persists across reload", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await startFresh(page);
    await toGeometry(page);
    await expect(page.getByTestId("first-run-hint")).toBeVisible();
    await page.getByRole("button", { name: "Got it" }).click();
    await expect(page.getByTestId("first-run-hint")).toHaveCount(0);
    await page.reload();
    await dismissStartupChrome(page);
    await toGeometry(page);
    await expect(page.getByTestId("first-run-hint")).toHaveCount(0);
  });

  test("C: first Math visit uses Math Lab copy", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await startFresh(page);
    await toMathLab(page);
    await expect(page.getByTestId("first-run-hint")).toContainText("Math Lab");
  });

  test("D: onboarding dismiss does not mutate the scene", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await startFresh(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Create Point" }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByRole("button", { name: "Got it" }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
  });

  test("E: light Geometry shell remains axe clean with selection", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await startDismissed(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Create Point" }).click();
    const results = await axeScan(page);
    expect(results.violations).toEqual([]);
  });

  test("F: dark Geometry shell remains axe clean", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await startDismissed(page);
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
    });
    await toGeometry(page);
    await page.getByRole("button", { name: "Create Point" }).click();
    const results = await axeScan(page);
    expect(results.violations).toEqual([]);
  });

  test("I: compact first-run does not cover the whole canvas", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startFresh(page);
    await toGeometry(page);
    const hint = page.getByTestId("first-run-hint");
    await expect(hint).toBeVisible();
    const box = await hint.boundingBox();
    expect(box).toBeTruthy();
    expect((box?.height ?? 0) / 844).toBeLessThan(0.45);
    await expect(page.getByRole("button", { name: "Dismiss getting started tips" })).toBeVisible();
  });

  test("J: tablet composition keeps polished shell", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 768, height: 1024 });
    await startDismissed(page);
    await toGeometry(page);
    await expect(page.getByRole("button", { name: "Geometry Studio" })).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("K: selected object row exposes pressed state beyond color", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await startDismissed(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Create Point" }).click();
    await expect(page.locator('[data-object-row-select][aria-pressed="true"]').first()).toBeVisible();
  });

  test("Q/R: empty Geometry and Math states are intentional", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await startDismissed(page);
    await toGeometry(page);
    await expect(page.getByText("Add a point, line, or surface to begin.").first()).toBeVisible();
    await toMathLab(page);
    await expect(page.getByText("Add an expression or field to begin.").first()).toBeVisible();
  });

  test("X: reduced motion keeps tips usable", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await startFresh(page);
    await toGeometry(page);
    await expect(page.getByTestId("first-run-hint")).toBeVisible();
    await page.getByRole("button", { name: "Got it" }).click();
    await expect(page.getByTestId("first-run-hint")).toHaveCount(0);
  });

  test("AH: compact accessibility axe clean", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startDismissed(page);
    await toGeometry(page);
    const results = await axeScan(page);
    expect(results.violations).toEqual([]);
  });
});
