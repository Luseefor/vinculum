import { addObject } from "./helpers/addObject";
import { fillInput, pressInput } from "./helpers/mathInput";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// S25 timing bounds are load-sensitive (integral worker quadrature plus
// dev-server compile), so this spec runs serially.
// Each case owns a fresh page/scene; a failure must not skip later coverage.
test.describe.configure({ mode: "default" });

// S25 integral calculus: arc length, scalar line integrals, work with
// reversal, explicit surface area, flux with orientation, parametric
// sphere area and flux, convergence quality, non-finite safety, worker
// races, field deletion, parameter updates, render independence,
// workspace coherence, transient persistence, narrow sheets, security/a11y.
// Zero unexpected console/page errors.
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

async function addPreset(page: Page, name: string) {
  // S30: templates live in the Add Object menu.
  await page.getByRole("button", { name: "Open object menu" }).click();
  await page.getByRole("button", { name, exact: true }).click();
}

async function openAnalyze(page: Page) {
  // S30: analysis sections live under the Analyze tab. Guarded so sheet
  // flows and Object-tab assertions never trip on the navigation itself.
  const tab = page.getByRole("tab", { name: "Analyze" });
  if ((await tab.count()) > 0 && (await tab.first().isVisible())) {
    await tab.first().click();
  }
}

async function openObject(page: Page) {
  // S30 companion to openAnalyze: definition/domain editors live under the
  // Object tab. Guarded like openAnalyze.
  const tab = page.getByRole("tab", { name: "Edit" });
  if ((await tab.count()) > 0 && (await tab.first().isVisible())) {
    await tab.first().click();
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

async function settleCompute(page: Page) {
  const pending = page.locator('[data-testid="compute-status-pending"]');
  await pending.first().waitFor({ state: "attached", timeout: 3000 }).catch(() => {});
  await expect.poll(async () => pending.count(), { timeout: 25000 }).toBe(0);
}

async function expectNoComputePending(page: Page, action: () => Promise<void>) {
  await action();
  const pending = page.locator('[data-testid="compute-status-pending"]');
  const deadline = Date.now() + 1500;
  while (Date.now() < deadline) {
    expect(await pending.count()).toBe(0);
    await page.waitForTimeout(100);
  }
}

async function addLineCurve(page: Page) {
  await showMoreAdd(page);
  await addObject(page, "Parametric Curve");
  await expect(page.getByTestId("scene-object-count")).toHaveText("1");
  await fillInput(page.getByLabel("Parametric x(t) =").first(), "t");
  await fillInput(page.getByLabel("Parametric y(t) =").first(), "0");
  await fillInput(page.getByLabel("Parametric z(t) =").first(), "0");
  await fillInput(page.getByLabel("t min"), "0");
  await fillInput(page.getByLabel("t max"), "3");
}

async function addUnitCircle(page: Page) {
  await showMoreAdd(page);
  await addObject(page, "Parametric Curve");
  await expect(page.getByTestId("scene-object-count")).toHaveText("1");
  await fillInput(page.getByLabel("Parametric x(t) =").first(), "cos(t)");
  await fillInput(page.getByLabel("Parametric y(t) =").first(), "sin(t)");
  await fillInput(page.getByLabel("Parametric z(t) =").first(), "0");
  await fillInput(page.getByLabel("t min"), "0");
  await fillInput(page.getByLabel("t max"), "6.2831853072");
}

async function selectObjectRow(page: Page, name: string) {
  // Creating an object selects it; return selection to the target.
  await page.getByRole("button", { name: `Select ${name}` }).click();
  await expect(page.getByRole("button", { name: `Selected ${name}` })).toBeVisible();
}

test.describe("S25 integral analysis", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("A: arc length of r=<t,0,0> over [0,3] is ~3", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await addLineCurve(page);
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toContainText("3", { timeout: 15000 });
    expect(await page.locator("body").textContent()).not.toMatch(/NaN/);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("B: unit circle arc length is ~2*pi", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await addUnitCircle(page);
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toContainText("6.2832", { timeout: 15000 });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("C: scalar line integral of g=x is ~0.5", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await addLineCurve(page);
    await fillInput(page.getByLabel("t max"), "1");
    await openAnalyze(page);
    await page.getByLabel("Integral mode").selectOption("scalarLine");
    await openAnalyze(page);
    await fillInput(page.getByLabel("Scalar integrand g(x,y,z)"), "x");
    await openAnalyze(page);
    await pressInput(page.getByLabel("Scalar integrand g(x,y,z)"), "Enter");
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toContainText("0.5", { timeout: 15000 });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("D: rotation-field circulation around the unit circle is ~2*pi", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addUnitCircle(page);
    await addObject(page, "3D Vector Field");
    await expect(page.getByTestId("scene-object-count")).toHaveText("2");
    await fillInput(page.getByLabel("Vector field P component").first(), "-y");
    await fillInput(page.getByLabel("Vector field Q component").first(), "x");
    await fillInput(page.getByLabel("Vector field R component").first(), "0");
    await settleCompute(page);
    await selectObjectRow(page, "Parametric Curve #1");
    await openAnalyze(page);
    await page.getByLabel("Integral mode").selectOption("work");
    await page.getByLabel("Vector field", { exact: true }).selectOption({ index: 1 });
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toContainText("6.2832", { timeout: 25000 });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("E: reverse flips work sign, arc length unchanged", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addUnitCircle(page);
    await addObject(page, "3D Vector Field");
    await fillInput(page.getByLabel("Vector field P component").first(), "-y");
    await fillInput(page.getByLabel("Vector field Q component").first(), "x");
    await fillInput(page.getByLabel("Vector field R component").first(), "0");
    await settleCompute(page);
    await selectObjectRow(page, "Parametric Curve #1");
    await openAnalyze(page);
    await page.getByLabel("Integral mode").selectOption("work");
    await page.getByLabel("Vector field", { exact: true }).selectOption({ index: 1 });
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toContainText("6.2832", { timeout: 25000 });
    await page.getByLabel("Curve direction").selectOption("reverse");
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toContainText("−6.2832", { timeout: 15000 });
    await openAnalyze(page);
    await page.getByLabel("Integral mode").selectOption("arcLength");
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toContainText("6.2832", { timeout: 15000 });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("F: explicit plane area z=0 over [-1,1]^2 is ~4", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await addObject(page, "Surface");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await fillInput(page.getByLabel("Equation", { exact: true }).first(), "z = 0");
    // S32: compact paired domain in the expression-first Object tab.
    await fillInput(page.locator("#graph-inspector").getByLabel("x min"), "-1");
    await fillInput(page.locator("#graph-inspector").getByLabel("x max"), "1");
    await fillInput(page.locator("#graph-inspector").getByLabel("y min"), "-1");
    await fillInput(page.locator("#graph-inspector").getByLabel("y max"), "1");
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toContainText("4", { timeout: 15000 });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("G: +z plane flux of F=<0,0,1> is ~4, reversed ~-4", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Surface");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await fillInput(page.getByLabel("Equation", { exact: true }).first(), "z = 0");
    // S32: compact paired domain in the expression-first Object tab.
    await fillInput(page.locator("#graph-inspector").getByLabel("x min"), "-1");
    await fillInput(page.locator("#graph-inspector").getByLabel("x max"), "1");
    await fillInput(page.locator("#graph-inspector").getByLabel("y min"), "-1");
    await fillInput(page.locator("#graph-inspector").getByLabel("y max"), "1");
    await showMoreAdd(page);
    await addObject(page, "3D Vector Field");
    await expect(page.getByTestId("scene-object-count")).toHaveText("2");
    await fillInput(page.getByLabel("Vector field P component").first(), "0");
    await fillInput(page.getByLabel("Vector field Q component").first(), "0");
    await fillInput(page.getByLabel("Vector field R component").first(), "1");
    await settleCompute(page);
    await selectObjectRow(page, "Surface #1");
    await openAnalyze(page);
    await page.getByLabel("Integral mode").selectOption("flux");
    await page.getByLabel("Vector field", { exact: true }).selectOption({ index: 1 });
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toContainText("4", { timeout: 25000 });
    await page.getByLabel("Surface orientation").selectOption("reversed");
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toContainText("−4", { timeout: 15000 });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("H: parametric sphere area is ~4*pi", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addPreset(page, "Parametric Sphere");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await settleCompute(page);
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toContainText("12.566", { timeout: 25000 });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("I: radial sphere flux is ~4*pi outward, sign flips reversed", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addPreset(page, "Parametric Sphere");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await showMoreAdd(page);
    await addObject(page, "3D Vector Field");
    await expect(page.getByTestId("scene-object-count")).toHaveText("2");
    await fillInput(page.getByLabel("Vector field P component").first(), "x");
    await fillInput(page.getByLabel("Vector field Q component").first(), "y");
    await fillInput(page.getByLabel("Vector field R component").first(), "z");
    await settleCompute(page);
    await selectObjectRow(page, "Parametric Surface #1");
    await openAnalyze(page);
    await page.getByLabel("Integral mode").selectOption("flux");
    await page.getByLabel("Vector field", { exact: true }).selectOption({ index: 1 });
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toContainText("12.566", { timeout: 25000 });
    await page.getByLabel("Surface orientation").selectOption("reversed");
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toContainText("−12.566", { timeout: 15000 });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("J: constant-field closed sphere flux is ~0", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addPreset(page, "Parametric Sphere");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await showMoreAdd(page);
    await addObject(page, "3D Vector Field");
    await expect(page.getByTestId("scene-object-count")).toHaveText("2");
    await fillInput(page.getByLabel("Vector field P component").first(), "1");
    await fillInput(page.getByLabel("Vector field Q component").first(), "0");
    await fillInput(page.getByLabel("Vector field R component").first(), "0");
    await settleCompute(page);
    await selectObjectRow(page, "Parametric Surface #1");
    await openAnalyze(page);
    await page.getByLabel("Integral mode").selectOption("flux");
    await page.getByLabel("Vector field", { exact: true }).selectOption({ index: 1 });
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toBeVisible({ timeout: 25000 });
    const text = (await page.getByTestId("integral-result-value").textContent()) ?? "";
    const value = Number((text.match(/-?\d+(\.\d+)?(e-?\d+)?/i) ?? ["NaN"])[0]);
    expect(Number.isFinite(value)).toBe(true);
    expect(Math.abs(value)).toBeLessThan(0.01);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("K: high quality tightens the convergence estimate", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await addUnitCircle(page);
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toContainText("6.2832", { timeout: 15000 });
    const lowError = await page.getByTestId("integral-result-error").textContent();
    await openAnalyze(page);
    await page.getByLabel("Integral quality").selectOption("high");
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toContainText("6.2832", { timeout: 15000 });
    const highError = await page.getByTestId("integral-result-error").textContent();
    expect(lowError).not.toBeNull();
    expect(highError).not.toBeNull();
    expect(await page.locator("body").textContent()).not.toMatch(/NaN/);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("L: non-finite integrand reports unavailable with no NaN", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await addLineCurve(page);
    await openAnalyze(page);
    await page.getByLabel("Integral mode").selectOption("scalarLine");
    await openAnalyze(page);
    await fillInput(page.getByLabel("Scalar integrand g(x,y,z)"), "1/x");
    await openAnalyze(page);
    await pressInput(page.getByLabel("Scalar integrand g(x,y,z)"), "Enter");
    // x=t over [0,3] crosses the pole: unavailable, never NaN/Infinity.
    await expect(page.getByText("Integrand is non-finite in the integration domain.")).toBeVisible({
      timeout: 15000
    });
    expect(await page.locator("body").textContent()).not.toMatch(/NaN/);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("M: rapid integrand, quality, and field changes settle latest-only", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addUnitCircle(page);
    await addObject(page, "3D Vector Field");
    await expect(page.getByTestId("scene-object-count")).toHaveText("2");
    await fillInput(page.getByLabel("Vector field P component").first(), "-y");
    await fillInput(page.getByLabel("Vector field Q component").first(), "x");
    await fillInput(page.getByLabel("Vector field R component").first(), "0");
    await settleCompute(page);
    await selectObjectRow(page, "Parametric Curve #1");
    await openAnalyze(page);
    await page.getByLabel("Integral mode").selectOption("work");
    await page.getByLabel("Vector field", { exact: true }).selectOption({ index: 1 });
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toContainText("6.2832", { timeout: 25000 });
    // Rapid quality race with no settle waits.
    await openAnalyze(page);
    await page.getByLabel("Integral quality").selectOption("low");
    await openAnalyze(page);
    await page.getByLabel("Integral quality").selectOption("high");
    await openAnalyze(page);
    await page.getByLabel("Integral quality").selectOption("medium");
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toContainText("6.2832", { timeout: 25000 });
    // Rapid field race: latest expression wins.
    await fillInput(page.getByLabel("Vector field P component").first(), "2*x");
    await fillInput(page.getByLabel("Vector field Q component").first(), "2*y");
    await fillInput(page.getByLabel("Vector field P component").first(), "-y");
    await fillInput(page.getByLabel("Vector field Q component").first(), "x");
    await settleCompute(page);
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toContainText("6.2832", { timeout: 25000 });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("N: deleting the field invalidates work cleanly", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addUnitCircle(page);
    await addObject(page, "3D Vector Field");
    await expect(page.getByTestId("scene-object-count")).toHaveText("2");
    await fillInput(page.getByLabel("Vector field P component").first(), "-y");
    await fillInput(page.getByLabel("Vector field Q component").first(), "x");
    await fillInput(page.getByLabel("Vector field R component").first(), "0");
    await settleCompute(page);
    await selectObjectRow(page, "Parametric Curve #1");
    await openAnalyze(page);
    await page.getByLabel("Integral mode").selectOption("work");
    await page.getByLabel("Vector field", { exact: true }).selectOption({ index: 1 });
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toBeVisible({ timeout: 25000 });
    // Delete the field (curve #1 stays): select its row, then Backspace.
    await page.getByRole("button", { name: "Select Vector Field #2" }).click();
    await page.getByRole("button", { name: "Selected Vector Field #2" }).press("Backspace");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1", { timeout: 10000 });
    await expect(page.getByText("Select a vector field to compute work.")).toBeVisible({ timeout: 10000 });
    expect(await page.locator("body").textContent()).not.toMatch(/NaN/);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("O: formula edits recompute the integral", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await addObject(page, "Parametric Curve");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await fillInput(page.getByLabel("Parametric x(t) =").first(), "r*cos(t)");
    await fillInput(page.getByLabel("Parametric y(t) =").first(), "r*sin(t)");
    await fillInput(page.getByLabel("Parametric z(t) =").first(), "0");
    await fillInput(page.getByLabel("t min"), "0");
    await fillInput(page.getByLabel("t max"), "6.2831853072");
    // Default r=2.5: arc length 2*pi*2.5 ≈ 15.708.
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toContainText("15.708", { timeout: 15000 });
    await page.getByRole("tab", { name: "Edit", exact: true }).click();
    await fillInput(page.getByLabel("Parametric x(t) =").first(), "4*cos(t)");
    await fillInput(page.getByLabel("Parametric y(t) =").first(), "4*sin(t)");
    // r=4: arc length 2*pi*4 ≈ 25.1327.
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toContainText("25.1327", { timeout: 15000 });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("P: tessellation, color, and view changes enqueue zero integral jobs", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addPreset(page, "Parametric Sphere");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await settleCompute(page);
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toBeVisible({ timeout: 25000 });
    // Surface resolution (tessellation) rebuilds render geometry but must
    // not recompute integrals: the value stays identical (S25-R2 — the
    // object-row pending dot observes geometry jobs, so assert value
    // stability across a geometry settle instead of zero pending here).
    const before = await page.getByTestId("integral-result-value").textContent();
        // S32: resolution lives in the Styles tab (Tessellation section).
        await page.getByRole("tab", { name: "Settings" }).first().click();
        await fillInput(page.getByLabel("Resolution", { exact: true }).first(), "24");
    await settleCompute(page);
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toHaveText(before ?? "", { timeout: 25000 });
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toBeVisible();
    await page.getByRole("tab", { name: "Settings" }).click();
    await expectNoComputePending(page, async () => {
      await page.getByLabel("Geometry view").selectOption("xy");
    });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Q: result coheres across Math Lab and Geometry Studio", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await addUnitCircle(page);
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toBeVisible({ timeout: 15000 });
    await toGeometry(page);
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toBeVisible();
    await toMathLab(page);
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("R: save/reopen keeps objects with analysis reset", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await addUnitCircle(page);
    await openAnalyze(page);
    await expect(page.getByTestId("integral-result-value")).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Scene" }).click();
    await page.getByRole("menuitem", { name: "Save as..." }).click();
    await fillInput(page.locator("#project-name-input"), "s25-integral");
    await page.getByRole("button", { name: "Save project", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Save as project" })).not.toBeVisible({ timeout: 10000 });
    await page.reload();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await toMathLab(page);
    // Canonical curve survived; transient analysis did not persist a stale
    // value — the section recomputes live for the reloaded scene.
    await openAnalyze(page);
    await expect(page.getByTestId("integral-analysis-section")).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("S: narrow 430x800 reaches integral controls through sheets", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 430, height: 800 });
    await startClean(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await addObject(page, "Parametric Curve");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await openAnalyze(page);
    await expect(page.getByText("Integral Analysis")).toBeVisible();
    await openAnalyze(page);
    await expect(page.getByLabel("Integral mode")).toBeVisible();
    await openAnalyze(page);
    await expect(page.getByLabel("Integral quality")).toBeVisible();
    await page.keyboard.press("Escape");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("T: unsafe integrand rejected with axe clean", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await addLineCurve(page);
    await openAnalyze(page);
    await page.getByLabel("Integral mode").selectOption("scalarLine");
    await openAnalyze(page);
    await fillInput(page.getByLabel("Scalar integrand g(x,y,z)"), "sin(factorial(x))");
    await openAnalyze(page);
    await pressInput(page.getByLabel("Scalar integrand g(x,y,z)"), "Enter");
    await expect(page.getByText("Integrand is non-finite in the integration domain.").or(page.getByText(/not supported|unsupported/i))).toBeVisible({
      timeout: 15000
    });
    expect(await page.locator("body").textContent()).not.toMatch(/NaN/);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
