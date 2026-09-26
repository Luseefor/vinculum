import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// S30 product navigation: workspaces, creation surfaces, Inspector
// Object/Analyze, view controls, focus, drafts, narrow flows, axe.
// Mathematical behavior is covered by the S16-S29 suites; this spec pins
// the information architecture around the frozen engine.

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

async function showMoreAdd(page: Page) {
  const more = page.getByRole("button", { name: "Show more object types" });
  if ((await more.count()) > 0 && (await more.first().isVisible())) {
    await more.first().click();
  }
}

async function addPreset(page: Page, name: string) {
  await page.getByRole("button", { name: "Open object menu" }).click();
  await page.getByRole("button", { name, exact: true }).click();
}

async function openAnalyze(page: Page) {
  const tab = page.getByRole("tab", { name: "Analyze" });
  if ((await tab.count()) > 0 && (await tab.first().isVisible())) {
    await tab.first().click();
  }
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

test.describe("S30 product information architecture", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("A: Geometry empty state invites creation with usable Quick Add", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await expect(page.getByText("Add a point, line, surface…")).toBeVisible();
    for (const name of ["Create Point", "Create Vector", "Create Infinite Line"]) {
      await expect(page.getByRole("button", { name })).toBeVisible();
    }
    await page.getByRole("button", { name: "Create Point" }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByText("Add a point, line, surface…")).not.toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("B: Math empty state invites expression entry with usable Quick Add", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await expect(page.getByText("Add an expression or mathematical object")).toBeVisible();
    for (const name of ["Create Surface", "Create Parametric Curve", "Create Implicit Surface"]) {
      await expect(page.getByRole("button", { name })).toBeVisible();
    }
    await page.getByRole("button", { name: "Create Surface" }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("C: Add Object catalog lists every canonical type in categories", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await page.getByRole("button", { name: "Open object menu" }).click();
    await expect(page.getByText("Graphs")).toBeVisible();
    await expect(page.getByText("Primitives")).toBeVisible();
    await expect(page.getByText("Analysis")).toBeVisible();
    for (const name of [
      "Parametric Curve",
      "Surface",
      "Parametric Surface",
      "Implicit Surface",
      "Plane",
      "Point",
      "Vector",
      "Infinite Line",
      "Segment",
      "Ray",
      "2D Vector Field",
      "3D Vector Field",
      "2D Linear Transformation",
      "3D Linear Transformation"
    ]) {
      await expect(page.getByRole("button", { name, exact: true }).first()).toBeVisible();
    }
    // A More-behind kind creates through the catalog.
    await page.getByRole("button", { name: "Parametric Surface", exact: true }).first().click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("D: Quick Add, Add Object, and palette create equivalent objects", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await addPreset(page, "Implicit Sphere");
    await page.keyboard.press("Meta+k");
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
    await page.getByLabel("Command search").fill("Add Ray");
    await page.getByRole("option", { name: "Add Ray" }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("3");
    // Equivalence, not just count: each surface created its canonical kind.
    await expect(page.getByRole("button", { name: /^(Select|Selected) Surface #1$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Select|Selected) Ray #3$/ })).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("E: workspace switch preserves scene and selection", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(page.getByRole("button", { name: "Selected Surface #1" })).toBeVisible();
    await toGeometry(page);
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByRole("button", { name: "Selected Surface #1" })).toBeVisible();
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    await toMathLab(page);
    await expect(page.getByRole("button", { name: "Selected Surface #1" })).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("F: Inspector Object shows definition without analysis sections", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Object" })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#domain-x-range-min")).toBeVisible();
    await expect(page.getByTestId("integral-analysis-section")).not.toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("G: Inspector Analyze discovers Surface capabilities", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await openAnalyze(page);
    await expect(page.getByText("Differential Analysis")).toBeVisible();
    await expect(page.getByTestId("scalar-visualization-section")).toBeVisible();
    await expect(page.getByTestId("integral-analysis-section")).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("H: Vector Field Analyze discovers calculus plus streamlines", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await page.getByRole("button", { name: "3D Vector Field", exact: true }).click();
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-section")).toBeVisible();
    await expect(page.getByTestId("streamline-section")).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("I: Geometry Analyze discovers relations for primitives", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-analysis-section")).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("J: Linear Transform Analyze discovers det, rank, eigen, and apply", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "2D Linear Transformation", exact: true }).click();
    await openAnalyze(page);
    await expect(page.getByTestId("linear-fact-determinant")).toBeVisible();
    await expect(page.getByTestId("linear-fact-rank")).toBeVisible();
    await expect(page.getByLabel("Vector for transformation analysis")).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("K: Point Analyze hides vector calculus and integrals", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-analysis-section")).toBeVisible();
    await expect(page.getByTestId("vector-calculus-section")).not.toBeVisible();
    await expect(page.getByTestId("integral-analysis-section")).not.toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("L: tab, menu, and palette navigation dispatch zero compute jobs", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByRole("tab", { name: "Analyze" }).click();
    await page.getByRole("tab", { name: "Object" }).click();
    await page.getByRole("button", { name: "Open object menu" }).click();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Meta+k");
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-testid="compute-status-pending"]')).toHaveCount(0);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("M: Geometry view and layout controls switch without stale canvas", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    await page.getByLabel("Geometry layout").selectOption("quad");
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    await page.getByLabel("Geometry layout").selectOption("single");
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("N: palette categories and mathematical aliases", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await page.keyboard.press("Meta+k");
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
    for (const category of ["Create", "View", "Workspace", "Object", "Scene"]) {
      await expect(page.getByText(category, { exact: true }).first()).toBeVisible();
    }
    await page.getByLabel("Command search").fill("matrix");
    await expect(page.getByRole("option", { name: "Add 2D Linear Transformation" })).toBeVisible();
    await page.getByLabel("Command search").fill("curl");
    await expect(page.getByText("No matching commands.")).toBeVisible();
    await page.keyboard.press("Escape");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("O: creation focuses the definition field; Escape closes palette", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(page.locator('input[placeholder="x + y = 1, z = x^2 + y^2, or x^2 + y^2 = 1"]').first()).toBeFocused({
      timeout: 8000
    });
    await page.keyboard.press("Meta+k");
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Command palette" })).not.toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("P: expression draft survives Inspector tab switches", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    const input = page.locator('input[placeholder="x + y = 1, z = x^2 + y^2, or x^2 + y^2 = 1"]').first();
    await expect(input).toBeFocused({ timeout: 8000 });
    await input.fill("z = x^2 - y^2");
    await page.getByRole("tab", { name: "Analyze" }).click();
    await page.getByRole("tab", { name: "Object" }).click();
    await expect(page.locator('input[placeholder="x + y = 1, z = x^2 + y^2, or x^2 + y^2 = 1"]').first()).toHaveValue(
      "z = x^2 - y^2"
    );
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Q: object list stays usable with a mixed scene", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    for (const name of ["Point", "Vector", "Infinite Line", "Segment", "Plane", "Surface"]) {
      await page.getByRole("button", { name, exact: true }).click();
    }
    await expect(page.getByTestId("scene-object-count")).toHaveText("6");
    await expect(page.getByRole("button", { name: /^(Select|Selected) Point #1$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Select|Selected) Surface #6$/ })).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("R: narrow Geometry reaches switch, catalog, list, and Object tab", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 430, height: 800 });
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Objects" })).toBeVisible();
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    // Behind-Quick kinds stay reachable in the narrow sheet via More.
    await showMoreAdd(page);
    await page.getByRole("button", { name: "Ray", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("2");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Object" })).toBeVisible();
    await page.keyboard.press("Escape");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("S: narrow Math reaches Analyze through sheets", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 430, height: 800 });
    await startClean(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await openAnalyze(page);
    await expect(page.getByTestId("integral-analysis-section")).toBeVisible();
    await page.keyboard.press("Escape");
    // Palette creation works at narrow width too.
    await page.keyboard.press("Meta+k");
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
    await page.getByLabel("Command search").fill("Add Ray");
    await page.getByRole("option", { name: "Add Ray" }).click();
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("2");
    await page.keyboard.press("Escape");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("T: product IA has no axe violations", async ({ page }) => {
    await startClean(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await openAnalyze(page);
    await page.waitForTimeout(800);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("U: palette creates through the renamed Parametric Curve label", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await page.keyboard.press("Meta+k");
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
    await page.getByLabel("Command search").fill("parametric curve");
    await page.getByRole("option", { name: "Add Parametric Curve" }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByRole("button", { name: /^(Select|Selected) Parametric Curve #1$/ })).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("V: scene context menu offers all 14 creation entries", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await page.locator("header").first().click({ button: "right" });
    await expect(page.getByRole("menuitem", { name: "Add Parametric Curve" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Add 3D Linear Transformation" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Add Ray" }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("W: More reveals behind-Quick entries per workspace and collapses", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await expect(page.getByRole("button", { name: "Ray", exact: true })).not.toBeVisible();
    await showMoreAdd(page);
    await expect(page.getByRole("button", { name: "Ray", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Show fewer object types" })).toBeVisible();
    await page.getByRole("button", { name: "Show fewer object types" }).click();
    await expect(page.getByRole("button", { name: "Ray", exact: true })).not.toBeVisible();
    await toMathLab(page);
    await showMoreAdd(page);
    await expect(page.getByRole("button", { name: "Point", exact: true })).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("X: More-behind creation focuses its definition field", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "Ray", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    // The new row's first coordinate input receives focus.
    await expect(page.getByLabel("Ray origin x").first()).toBeFocused({ timeout: 8000 });
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
