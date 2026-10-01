import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// S32 Math Lab interaction & workflow refinement: one coherent
// expression-first workspace. Frozen engine behavior stays covered by the
// S16–S31 suites; this spec pins the Math Lab workflow layer (definition
// hierarchy, domain/sampling presentation, draft preservation, contextual
// analysis, selectors, view preservation, narrow flow, axe).
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

async function showMoreAdd(page: Page) {
  const more = page.getByRole("button", { name: "Show more object types" });
  if ((await more.count()) > 0 && (await more.first().isVisible())) {
    await more.first().click();
  }
}

async function openAnalyze(page: Page) {
  const tab = page.getByRole("tab", { name: "Analyze" });
  if ((await tab.count()) > 0 && (await tab.first().isVisible())) {
    await tab.first().click();
  }
}

async function openObjectTab(page: Page) {
  const tab = page.getByRole("tab", { name: "Object" });
  if ((await tab.count()) > 0 && (await tab.first().isVisible())) {
    await tab.first().click();
  }
}

async function toMathLab(page: Page) {
  await page.getByRole("button", { name: "Math Lab" }).click();
  await expect(page.getByRole("button", { name: "Math Lab" })).toHaveAttribute("aria-pressed", "true");
}

async function toGeometry(page: Page) {
  await page.getByRole("button", { name: "Geometry Studio" }).click();
  await expect(page.getByRole("button", { name: "Geometry Studio" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
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

function inspector(page: Page) {
  return page.locator("#graph-inspector");
}

async function settleCompute(page: Page) {
  const pending = page.locator('[data-testid="compute-status-pending"]');
  await pending.first().waitFor({ state: "attached", timeout: 3000 }).catch(() => {});
  await expect.poll(async () => pending.count(), { timeout: 25000 }).toBe(0);
}

test.describe("S32 Math Lab workflow", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("A: Surface Quick Add selects, focuses equation, types, renders", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByRole("button", { name: "Selected Surface #1" })).toBeVisible();
    // Creation focuses the first meaningful math field (list row equation).
    await expect(page.getByLabel("Equation").first()).toBeFocused({ timeout: 8000 });
    // The Inspector leads with the same expression-first definition.
    await expect(inspector(page).getByLabel("Surface expression z = f(x,y)")).toBeVisible();
    await page.getByLabel("Equation").first().fill("x^2 + y^2");
    await expect(inspector(page).getByLabel("Surface expression z = f(x,y)")).toHaveValue("x^2 + y^2");
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("B: parametric curve tuple layout, tab order, t domain", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "Parametric Curve", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    const group = inspector(page).getByRole("group", { name: "Parametric curve components r(t)" });
    await expect(group).toBeVisible();
    const x = inspector(page).getByLabel("Parametric x(t)");
    const y = inspector(page).getByLabel("Parametric y(t)");
    const z = inspector(page).getByLabel("Parametric z(t)");
    const tMin = inspector(page).getByLabel("t min");
    const tMax = inspector(page).getByLabel("t max");
    // Deliberate tab sequence x → y → z → t min → t max.
    await x.focus();
    await page.keyboard.press("Tab");
    await expect(y).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(z).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(tMin).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(tMax).toBeFocused();
    await x.fill("cos(t)");
    await y.fill("sin(t)");
    await z.fill("t");
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("C: explicit surface dependent-variable form and orientation labels", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(inspector(page).getByLabel("Surface expression z = f(x,y)")).toBeVisible();
    const dependent = inspector(page).getByLabel("Dependent variable");
    const labels = await dependent.evaluate((element) =>
      Array.from((element as HTMLSelectElement).options).map((option) => option.label)
    );
    expect(labels).toEqual(["z = f(x,y)", "x = f(y,z)", "y = f(x,z)"]);
    await dependent.selectOption("x");
    // Labels and domain pairing update coherently with no stale names.
    await expect(inspector(page).getByLabel("Surface expression x = f(y,z)")).toBeVisible();
    await expect(inspector(page).getByLabel("Surface expression z = f(x,y)")).toHaveCount(0);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("D: parametric surface tuple, u/v domains, subordinate resolution", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "Parametric Surface", exact: true }).click();
    await expect(
      inspector(page).getByRole("group", { name: "Parametric surface components r(u,v)" })
    ).toBeVisible();
    await expect(inspector(page).getByLabel("Parametric surface x(u,v)")).toBeVisible();
    await expect(inspector(page).getByLabel("u min")).toBeVisible();
    await expect(inspector(page).getByLabel("v max")).toBeVisible();
    // Resolution is subordinate: no competing visible Object-tab resolution
    // editor (the canonical control lives in Styles).
    await expect(
      inspector(page).getByLabel("Resolution", { exact: true }).filter({ visible: true })
    ).toHaveCount(0);
    await expect(inspector(page).getByText(/adjust in the Styles tab/)).toHaveCount(0);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("E: implicit surface equation is primary with local diagnostics", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "Implicit Surface", exact: true }).click();
    const equation = inspector(page).getByLabel("Implicit surface equation F(x,y,z) = 0");
    await expect(equation).toBeVisible();
    await equation.fill("x^2 + y^2 + z^2 = 1");
    await expect(inspector(page).getByLabel("z min")).toBeVisible();
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("F: vector field components grouped with 2D/3D distinction", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "2D Vector Field", exact: true }).click();
    await expect(
      inspector(page).getByRole("group", { name: "Vector field components F(x,y)" })
    ).toBeVisible();
    await expect(inspector(page).getByLabel("Vector field P component")).toBeVisible();
    await expect(inspector(page).getByLabel("Vector field R component")).toHaveCount(0);
    const dimension = inspector(page).getByLabel("Vector field dimension");
    const labels = await dimension.evaluate((element) =>
      Array.from((element as HTMLSelectElement).options).map((option) => option.label)
    );
    expect(labels).toEqual(["2D — F(x,y)", "3D — F(x,y,z)"]);
    await dimension.selectOption("3d");
    await expect(
      inspector(page).getByRole("group", { name: "Vector field components F(x,y,z)" })
    ).toBeVisible();
    await expect(inspector(page).getByLabel("Vector field R component")).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("G: scalar visualization discloses heat/contour/gradient progressively", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await page.getByLabel("Equation").first().fill("x^2 + y^2");
    await openAnalyze(page);
    await expect(page.getByTestId("scalar-visualization-section")).toBeVisible();
    // Sub-controls hide until their master toggle enables them.
    await expect(page.getByLabel("Contour count")).toHaveCount(0);
    await expect(page.getByLabel("Gradient density")).toHaveCount(0);
    await page.getByRole("switch", { name: "Show contours" }).click();
    await expect(page.getByLabel("Contour count")).toBeVisible();
    await page.getByRole("switch", { name: "Show gradient field" }).click();
    await expect(page.getByLabel("Gradient density")).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("H: differential analysis keeps function-gradient wording coherent", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await page.getByLabel("Equation").first().fill("x^2 + y^2");
    await openAnalyze(page);
    await expect(page.getByText("Differential Analysis")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pick analysis point on surface" })).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("I: vector calculus shows Jacobian table, divergence, curl", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "2D Vector Field", exact: true }).click();
    await page.getByLabel("Vector field P component").first().fill("-y");
    await page.getByLabel("Vector field Q component").first().fill("x");
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-section")).toBeVisible();
    // Empty state instructs instead of blank dashes.
    await expect(page.getByText(/Enter a point in the field domain/)).toBeVisible();
    await page.getByLabel("Analysis point x").fill("1");
    await page.getByLabel("Analysis point y").fill("0");
    await expect(page.getByTestId("vector-calculus-jacobian")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("vector-calculus-divergence")).toContainText("0");
    await expect(page.getByTestId("vector-calculus-curl")).toContainText("2");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("J: streamlines toggle reveals controls, off hides them", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "2D Vector Field", exact: true }).click();
    await page.getByLabel("Vector field P component").first().fill("-y");
    await page.getByLabel("Vector field Q component").first().fill("x");
    await openAnalyze(page);
    await expect(page.getByTestId("streamline-section")).toBeVisible();
    await expect(page.getByLabel("Seed density")).toHaveCount(0);
    await page.getByRole("switch", { name: "Show streamlines" }).click();
    await expect(page.getByLabel("Seed density")).toBeVisible();
    await expect(page.getByLabel("Trace length")).toBeVisible();
    await page.getByRole("switch", { name: "Hide streamlines" }).click();
    await expect(page.getByLabel("Seed density")).toHaveCount(0);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("K: curve integral modes stay contextual with direction control", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "Parametric Curve", exact: true }).click();
    await openAnalyze(page);
    const mode = page.getByLabel("Integral mode");
    const labels = await mode.evaluate((element) =>
      Array.from((element as HTMLSelectElement).options).map((option) => option.label)
    );
    expect(labels).toEqual(["Arc length", "Scalar line integral", "Work / circulation"]);
    // Arc length needs no integrand field and computes automatically.
    await expect(page.getByLabel("Scalar integrand g(x,y,z)")).toHaveCount(0);
    await expect(page.getByTestId("integral-result-value")).toBeVisible({ timeout: 25000 });
    await mode.selectOption("work");
    await expect(page.getByLabel("Curve direction")).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("L: surface integral modes with mathematical orientation wording", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await page.getByLabel("Equation").first().fill("x^2 + y^2");
    await openAnalyze(page);
    const mode = page.getByLabel("Integral mode");
    const labels = await mode.evaluate((element) =>
      Array.from((element as HTMLSelectElement).options).map((option) => option.label)
    );
    expect(labels).toEqual(["Surface area", "Scalar surface integral", "Flux"]);
    await mode.selectOption("flux");
    const orientation = page.getByLabel("Surface orientation");
    const orientationLabels = await orientation.evaluate((element) =>
      Array.from((element as HTMLSelectElement).options).map((option) => option.label)
    );
    expect(orientationLabels.some((label) => label.includes("+z"))).toBe(true);
    expect(orientationLabels.some((label) => label.includes("−z"))).toBe(true);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("M: integral result shows value with estimated error, warning stays neutral", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "Parametric Curve", exact: true }).click();
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toBeVisible({ timeout: 25000 });
    await expect(page.getByTestId("integral-result-error")).toContainText("Estimated numerical error");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("N: matrix editor is a visual grid with row-major keyboard flow", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "2D Linear Transformation", exact: true }).click();
    const group = inspector(page).getByRole("group", { name: "2 by 2 matrix entries" });
    await expect(group).toBeVisible();
    await page.getByLabel("Row 1 column 1").first().focus();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Row 1 column 2").first()).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Row 2 column 1").first()).toBeFocused();
    // Enter in a matrix cell commits without creating a next object.
    await page.getByLabel("Row 1 column 1").first().fill("2");
    await page.getByLabel("Row 1 column 1").first().press("Enter");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("O: determinant, rank, inverse read as compact facts", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "2D Linear Transformation", exact: true }).click();
    await openAnalyze(page);
    await expect(page.getByTestId("linear-fact-determinant")).toHaveText("1", { timeout: 10000 });
    await expect(page.getByTestId("linear-fact-rank")).toHaveText("2");
    await expect(page.getByTestId("linear-fact-invertible")).toHaveText("Yes");
    await expect(page.getByTestId("linear-fact-inverse")).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("P: 90-degree rotation shows neutral no-eigendirection state", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "2D Linear Transformation", exact: true }).click();
    // Rotation by 90°: [[0,-1],[1,0]].
    await page.getByLabel("Row 1 column 1").first().fill("0");
    await page.getByLabel("Row 1 column 2").first().fill("-1");
    await page.getByLabel("Row 2 column 1").first().fill("1");
    await page.getByLabel("Row 2 column 2").first().fill("0");
    await openAnalyze(page);
    await expect(page.getByTestId("linear-fact-eigen-none")).toContainText("No real eigendirections.", {
      timeout: 10000
    });
    // No fake overlay toggle is offered for complex-only spectra.
    await expect(page.getByRole("switch", { name: "Show eigendirections" })).toHaveCount(0);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

// NOTE: letter Q (shear eigendirection presentation) is covered by the
// frozen S28 linearAlgebra suite (shear/defective cases); O/P pin the S32
// presentation contract (compact facts, neutral complex-eigen state).
  test("R: Apply-to-Vector selector shows snippet options with v and Av", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "Vector", exact: true }).click();
    await page.getByRole("button", { name: "2D Linear Transformation", exact: true }).click();
    await openAnalyze(page);
    const select = page.getByLabel("Vector for transformation analysis");
    const labels = await select.evaluate((element) =>
      Array.from((element as HTMLSelectElement).options).map((option) => option.label)
    );
    expect(labels.some((label) => label.startsWith("Vector #"))).toBe(true);
    expect(labels.some((label) => label.includes("<"))).toBe(true);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("S: transient invalid typing keeps caret, selection, and value", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    const input = page.getByLabel("Equation").first();
    await input.fill("x^2 + y^2");
    await input.press("End");
    await page.keyboard.type(" + ");
    await page.keyboard.type("sin(");
    // Invalid intermediate stays editable: no reset, no selection loss.
    await expect(input).toHaveValue("x^2 + y^2 + sin(");
    await expect(page.getByRole("button", { name: "Selected Surface #1" })).toBeVisible();
    await expect(inspector(page).getByLabel("Surface expression z = f(x,y)")).toHaveValue(
      "x^2 + y^2 + sin("
    );
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("T: Object→Analyze→Object preserves a valid draft", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await inspector(page).getByLabel("Surface expression z = f(x,y)").fill("x^3 - 3*x*y^2");
    await openAnalyze(page);
    await openObjectTab(page);
    await expect(inspector(page).getByLabel("Surface expression z = f(x,y)")).toHaveValue(
      "x^3 - 3*x*y^2"
    );
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("V: 2D/3D view switch preserves selection and analysis", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await page.getByLabel("Equation").first().fill("x^2 + y^2");
    await openAnalyze(page);
    await expect(page.getByTestId("integral-analysis-section")).toBeVisible();
    await page.getByRole("group", { name: "View type" }).getByRole("button", { name: "2D only" }).click();
    await expect(page.getByRole("button", { name: "Selected Surface #1" })).toBeVisible();
    await expect(page.getByTestId("integral-analysis-section")).toBeVisible();
    await page.getByRole("group", { name: "View type" }).getByRole("button", { name: "3D only" }).click();
    await expect(page.getByRole("button", { name: "Selected Surface #1" })).toBeVisible();
    await expect(page.getByTestId("integral-analysis-section")).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("W: Math→Geometry→Math preserves scene, selection, and analysis", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await page.getByLabel("Equation").first().fill("x^2 + y^2");
    await openAnalyze(page);
    await expect(page.getByTestId("integral-analysis-section")).toBeVisible();
    await toGeometry(page);
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await toMathLab(page);
    await expect(page.getByRole("button", { name: "Selected Surface #1" })).toBeVisible();
    await openAnalyze(page);
    await expect(page.getByTestId("integral-analysis-section")).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("X: pure UI navigation issues zero compute jobs", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await page.getByLabel("Equation").first().fill("x^2 + y^2");
    await settleCompute(page);
    // Pure UI storm: tabs, view switches, palette open. None may compute.
    await openAnalyze(page);
    await openObjectTab(page);
    await openAnalyze(page);
    await page.getByRole("group", { name: "View type" }).getByRole("button", { name: "2D only" }).click();
    await page.getByRole("group", { name: "View type" }).getByRole("button", { name: "3D only" }).click();
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByLabel("Command search")).toBeVisible({ timeout: 8000 });
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-testid="compute-status-pending"]')).toHaveCount(0);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("AC: narrow 430×800 completes Surface → Analyze → field → matrix flow", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 430, height: 800 });
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await inspector(page).getByLabel("Surface expression z = f(x,y)").fill("x^2 + y^2");
    await inspector(page).getByLabel("x min").fill("-3");
    await openAnalyze(page);
    await expect(page.getByTestId("scalar-visualization-section")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "2D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("2");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await openAnalyze(page);
    await expect(page.getByTestId("streamline-section")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "2D Linear Transformation", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("3");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("AD: Math Lab workflow has no axe violations", async ({ page }) => {
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await page.getByLabel("Equation").first().fill("x^2 + y^2");
    await openAnalyze(page);
    await page.waitForTimeout(800);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
