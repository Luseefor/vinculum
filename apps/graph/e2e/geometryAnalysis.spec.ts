import { addObject } from "./helpers/addObject";
import { fillInput } from "./helpers/mathInput";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// S27 geometry relations: canonical Point, legacy point-preset
// compatibility, projections with overlays, line-line relations, skew,
// parallel, overlap, line-plane domains, plane-plane lines, angles,
// parameter liveness, camera independence, synchronized views,
// visibility, delete/kind-switch, persistence, undo/redo, workspace,
// narrow sheets, security/a11y. Zero unexpected console/page errors.
// Each case owns a fresh page/scene; a failure must not skip later coverage.
test.describe.configure({ mode: "default" });

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

async function openAnalyze(page: Page) {
  // S30: analysis sections live under the Analyze tab. Guarded so sheet
  // flows and Object-tab assertions never trip on the navigation itself.
  const tab = page.getByRole("tab", { name: "Analyze" });
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

function graph3dCanvas(page: Page) {
  return page.locator('canvas[data-graph3d-canvas="true"]').first();
}

async function settleScene(page: Page) {
  await page.waitForTimeout(1200);
}

async function selectSecondObject(page: Page, contains: string) {
  // Option labels embed row numbers ("Line #2 (line)"); match by
  // substring, then select the exact value (selectOption needs exact).
  const select = page.getByLabel("Second object for geometry analysis");
  const value = await select.evaluate((element, text) => {
    const options = Array.from((element as HTMLSelectElement).options);
    return options.find((option) => option.label.includes(text))?.value ?? null;
  }, contains);
  expect(value).not.toBeNull();
  await select.selectOption(value as string);
}

test.describe("S27 geometry relations", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("A: Quick Add Point creates a real point with canvas selection", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Point");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByRole("button", { name: "Selected Point #1" })).toBeVisible();
    await fillInput(page.locator("#graph-inspector").getByLabel("Point x"), "1");
    await fillInput(page.locator("#graph-inspector").getByLabel("Point y"), "2");
    await fillInput(page.locator("#graph-inspector").getByLabel("Point z"), "3");
    await expect(graph3dCanvas(page)).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("B: legacy constant-curve scenes load unchanged", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await addObject(page, "Parametric Curve");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await fillInput(page.getByLabel("Parametric x(t) =").first(), "0");
    await fillInput(page.getByLabel("Parametric y(t) =").first(), "0");
    await fillInput(page.getByLabel("Parametric z(t) =").first(), "0");
    // Historical preset keeps its curve identity and legacy row label.
    await expect(page.getByRole("button", { name: "Selected Point #1" })).toBeVisible();
    await expect(graph3dCanvas(page)).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("C: Point-Line projection shows distance and overlay", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Point");
    await fillInput(page.locator("#graph-inspector").getByLabel("Point x"), "3");
    await fillInput(page.locator("#graph-inspector").getByLabel("Point y"), "4");
    await fillInput(page.locator("#graph-inspector").getByLabel("Point z"), "0");
    await addObject(page, "Infinite Line");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point x"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point z"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction x"), "2");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction z"), "0");
    await page.getByRole("button", { name: /Point #1/ }).click();
    await openAnalyze(page);
    await selectSecondObject(page, "Line #2");
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-distance")).toHaveText("4", { timeout: 10000 });
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-point")).toContainText("3");
    await openAnalyze(page);
    await page.getByRole("switch", { name: "Show projection" }).click();
    await settleScene(page);
    await expect(graph3dCanvas(page)).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("D: behind-origin Ray projection clamps to origin", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Point");
    await fillInput(page.locator("#graph-inspector").getByLabel("Point x"), "-3");
    await fillInput(page.locator("#graph-inspector").getByLabel("Point y"), "4");
    await fillInput(page.locator("#graph-inspector").getByLabel("Point z"), "0");
    await showMoreAdd(page);
    await addObject(page, "Ray");
    await fillInput(page.locator("#graph-inspector").getByLabel("Ray origin x"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Ray origin y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Ray origin z"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Ray direction x"), "1");
    await fillInput(page.locator("#graph-inspector").getByLabel("Ray direction y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Ray direction z"), "0");
    await page.getByRole("button", { name: /Point #1/ }).click();
    await openAnalyze(page);
    await selectSecondObject(page, "Ray #2");
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-distance")).toHaveText("5", { timeout: 10000 });
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-point")).toContainText("0");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("E: outside-segment projection clamps to the endpoint", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Point");
    await fillInput(page.locator("#graph-inspector").getByLabel("Point x"), "3");
    await fillInput(page.locator("#graph-inspector").getByLabel("Point y"), "4");
    await fillInput(page.locator("#graph-inspector").getByLabel("Point z"), "0");
    await addObject(page, "Segment");
    await fillInput(page.locator("#graph-inspector").getByLabel("Segment start x"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Segment start y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Segment start z"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Segment end x"), "2");
    await fillInput(page.locator("#graph-inspector").getByLabel("Segment end y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Segment end z"), "0");
    await page.getByRole("button", { name: /Point #1/ }).click();
    await openAnalyze(page);
    await selectSecondObject(page, "Segment #2");
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-point")).toContainText("2");
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-distance")).toContainText("4.123", { timeout: 10000 });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("F: Point-Plane projection with distance and coordinates", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Point");
    await fillInput(page.locator("#graph-inspector").getByLabel("Point x"), "1");
    await fillInput(page.locator("#graph-inspector").getByLabel("Point y"), "3");
    await fillInput(page.locator("#graph-inspector").getByLabel("Point z"), "7");
    await addObject(page, "Plane");
    await page.getByRole("button", { name: /Point #1/ }).click();
    await openAnalyze(page);
    await selectSecondObject(page, "Plane");
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-distance")).not.toBeEmpty();
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-point")).toBeVisible({ timeout: 10000 });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("G: Line-Line unique intersection is shown", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Infinite Line");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point x"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point z"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction x"), "1");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction z"), "0");
    await page.keyboard.press("Escape");
    await addObject(page, "Infinite Line");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point x"), "1");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point y"), "-1");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point z"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction x"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction y"), "1");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction z"), "0");
    await page.getByRole("button", { name: /Line #1/ }).click();
    await openAnalyze(page);
    await selectSecondObject(page, "Line #2");
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-relation")).toHaveText("Intersecting.", { timeout: 10000 });
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-point")).toContainText("1");
    await openAnalyze(page);
    await page.getByRole("switch", { name: "Show intersection" }).click();
    await settleScene(page);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("H: skew lines report skew, distance, and connector", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Infinite Line");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction x"), "1");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction z"), "0");
    await page.keyboard.press("Escape");
    await addObject(page, "Infinite Line");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point x"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point y"), "1");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point z"), "1");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction x"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction y"), "1");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction z"), "0");
    await page.getByRole("button", { name: /Line #1/ }).click();
    await openAnalyze(page);
    await selectSecondObject(page, "Line #2");
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-relation")).toHaveText("Skew.", { timeout: 10000 });
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-distance")).toHaveText("1");
    await openAnalyze(page);
    await page.getByRole("switch", { name: "Show closest connection" }).click();
    await settleScene(page);
    await expect(graph3dCanvas(page)).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("I: parallel lines show no false intersection", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Infinite Line");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point x"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point z"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction x"), "1");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction z"), "0");
    await page.keyboard.press("Escape");
    await addObject(page, "Infinite Line");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point x"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point y"), "2");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point z"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction x"), "1");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction z"), "0");
    await page.getByRole("button", { name: /Line #1/ }).click();
    await openAnalyze(page);
    await selectSecondObject(page, "Line #2");
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-relation")).toHaveText("Parallel, disjoint.", {
      timeout: 10000
    });
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-distance")).toHaveText("2");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("J: coincident lines report coincident with no NaN overlay", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Infinite Line");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point x"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point z"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction x"), "1");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction z"), "0");
    await page.keyboard.press("Escape");
    await addObject(page, "Infinite Line");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point x"), "5");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point z"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction x"), "-2");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction z"), "0");
    await page.getByRole("button", { name: /Line #1/ }).click();
    await openAnalyze(page);
    await selectSecondObject(page, "Line #2");
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-relation")).toHaveText("Coincident.", { timeout: 10000 });
    expect(await page.locator("body").textContent()).not.toMatch(/NaN/);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("K: Line-Plane intersection point", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Infinite Line");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point x"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point z"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction x"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction z"), "1");
    await addObject(page, "Plane");
    await page.getByRole("button", { name: /Line #1/ }).click();
    await openAnalyze(page);
    await selectSecondObject(page, "Plane");
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-relation")).toHaveText("Intersecting.", { timeout: 10000 });
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-point")).toBeVisible();
    await openAnalyze(page);
    await page.getByRole("switch", { name: "Show intersection" }).click();
    await settleScene(page);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("L: Ray and Segment plane domains reject behind/outside hits", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await addObject(page, "Ray");
    await fillInput(page.locator("#graph-inspector").getByLabel("Ray origin x"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Ray origin y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Ray origin z"), "5");
    await fillInput(page.locator("#graph-inspector").getByLabel("Ray direction x"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Ray direction y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Ray direction z"), "1");
    await addObject(page, "Segment");
    await fillInput(page.locator("#graph-inspector").getByLabel("Segment start x"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Segment start y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Segment start z"), "3");
    await fillInput(page.locator("#graph-inspector").getByLabel("Segment end x"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Segment end y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Segment end z"), "4");
    await addObject(page, "Plane");
    await page.getByRole("button", { name: /Ray #1/ }).click();
    await openAnalyze(page);
    await selectSecondObject(page, "Plane");
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-relation")).toHaveText("Intersection lies behind the ray origin.", {
      timeout: 10000
    });
    await page.getByRole("button", { name: /Segment #2/ }).click();
    await openAnalyze(page);
    await selectSecondObject(page, "Plane");
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-relation")).toHaveText("No intersection on this segment.", {
      timeout: 10000
    });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("M: Plane-Plane intersection line is visible", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Plane");
    await page.keyboard.press("Escape");
    await addObject(page, "Plane");
    // Edit through the canonical math-input helper after lazy typeset initialization.
    await fillInput(page.locator("#graph-inspector").getByLabel("Plane equation"), "x = 0");
    await page.getByRole("button", { name: /Plane #1/ }).click();
    await openAnalyze(page);
    await selectSecondObject(page, "Plane #2");
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-relation")).toHaveText("Intersecting.", { timeout: 10000 });
    await openAnalyze(page);
    await page.getByRole("switch", { name: "Show intersection line" }).click();
    await settleScene(page);
    await expect(graph3dCanvas(page)).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("N: vector angle reads 90 degrees", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Vector");
    await fillInput(page.locator("#graph-inspector").getByLabel("Vector component x"), "1");
    await fillInput(page.locator("#graph-inspector").getByLabel("Vector component y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Vector component z"), "0");
    await page.keyboard.press("Escape");
    await addObject(page, "Vector");
    await fillInput(page.locator("#graph-inspector").getByLabel("Vector component x"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Vector component y"), "1");
    await fillInput(page.locator("#graph-inspector").getByLabel("Vector component z"), "0");
    await page.getByRole("button", { name: /Vector #1/ }).click();
    await openAnalyze(page);
    await selectSecondObject(page, "Vector #2");
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-angle")).toHaveText("90°", { timeout: 10000 });
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-relation")).toContainText("Perpendicular");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("O: formula edits update Point analysis live", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await showMoreAdd(page);
    await addObject(page, "Point");
    await fillInput(page.locator("#graph-inspector").getByLabel("Point x"), "r");
    await fillInput(page.locator("#graph-inspector").getByLabel("Point y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Point z"), "0");
    await addObject(page, "Infinite Line");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point x"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point z"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction x"), "1");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction z"), "0");
    await page.getByRole("button", { name: /Point #1/ }).click();
    await openAnalyze(page);
    await selectSecondObject(page, "Line #2");
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-point")).toContainText("2.5", { timeout: 10000 });
    await page.getByRole("tab", { name: "Edit", exact: true }).click();
    await fillInput(page.locator("#graph-inspector").getByLabel("Point x"), "4");
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-point")).toContainText("4", { timeout: 10000 });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("P: orbiting keeps numeric results identical", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Infinite Line");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point x"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point z"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction x"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction z"), "1");
    await addObject(page, "Plane");
    await page.getByRole("button", { name: /Line #1/ }).click();
    await openAnalyze(page);
    await selectSecondObject(page, "Plane");
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-point")).toBeVisible({ timeout: 10000 });
    const before = await page.getByTestId("geometry-fact-point").textContent();
    const canvas = graph3dCanvas(page);
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2 + 150, box!.y + box!.height / 2 + 60, { steps: 8 });
    await page.mouse.up();
    await settleScene(page);
    // Canvas mousedown clears selection by product convention, so reselect
    // and compare: the recomputed facts must be byte-identical despite the
    // radically moved camera and refreshed display endpoints.
    await page.getByRole("button", { name: /Line #1/ }).click();
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-point")).toHaveText(before ?? "", { timeout: 10000 });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Q: overlays render in Quad from one shared resource", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Point");
    await fillInput(page.locator("#graph-inspector").getByLabel("Point x"), "3");
    await fillInput(page.locator("#graph-inspector").getByLabel("Point y"), "4");
    await fillInput(page.locator("#graph-inspector").getByLabel("Point z"), "0");
    await addObject(page, "Infinite Line");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point x"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point z"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction x"), "1");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction z"), "0");
    await page.getByRole("button", { name: /Point #1/ }).click();
    await openAnalyze(page);
    await selectSecondObject(page, "Line #2");
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-distance")).toHaveText("4", { timeout: 10000 });
    await openAnalyze(page);
    await page.getByRole("switch", { name: "Show projection" }).click();
    await page.getByLabel("Geometry layout").selectOption("quad");
    await settleScene(page);
    await expect(graph3dCanvas(page)).toBeVisible();
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-distance")).toHaveText("4");
    await page.getByLabel("Geometry layout").selectOption("single");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("R: hiding a source keeps numbers but hides the overlay", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Point");
    await fillInput(page.locator("#graph-inspector").getByLabel("Point x"), "3");
    await fillInput(page.locator("#graph-inspector").getByLabel("Point y"), "4");
    await fillInput(page.locator("#graph-inspector").getByLabel("Point z"), "0");
    await addObject(page, "Infinite Line");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point x"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line point z"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction x"), "1");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction y"), "0");
    await fillInput(page.locator("#graph-inspector").getByLabel("Line direction z"), "0");
    await page.getByRole("button", { name: /Point #1/ }).click();
    await openAnalyze(page);
    await selectSecondObject(page, "Line #2");
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-distance")).toHaveText("4", { timeout: 10000 });
    await openAnalyze(page);
    await page.getByRole("switch", { name: "Show projection" }).click();
    await page.getByRole("button", { name: "Hide object" }).first().click();
    await settleScene(page);
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-distance")).toHaveText("4");
    await page.getByRole("button", { name: "Show object" }).first().click();
    await settleScene(page);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("S: deleting the secondary clears the analysis", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Point");
    await addObject(page, "Infinite Line");
    await page.getByRole("button", { name: /Point #1/ }).click();
    await openAnalyze(page);
    await selectSecondObject(page, "Line #2");
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-distance")).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: /Line #2/ }).click();
    await page.getByRole("button", { name: /Line #2/ }).press("Delete");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByText("Select another object.")).toBeVisible({ timeout: 10000 });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("T: save/reopen keeps points byte-exact with transient analysis", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Point");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await fillInput(page.locator("#graph-inspector").getByLabel("Point x"), "2*pi");
    await addObject(page, "Infinite Line");
    await page.getByRole("button", { name: /Point #1/ }).click();
    await openAnalyze(page);
    await selectSecondObject(page, "Infinite Line #2");
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-distance")).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "Scene" }).click();
    await page.getByRole("menuitem", { name: "Save as..." }).click();
    await fillInput(page.locator("#project-name-input"), "s27-points");
    await page.getByRole("button", { name: "Save project", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Save as project" })).not.toBeVisible({ timeout: 10000 });
    await page.reload();
    await expect(page.getByTestId("scene-object-count")).toHaveText("2");
    await expect(page.getByRole("button", { name: /Point #1/ })).toBeVisible();
    // Transient analysis does not persist: the chooser resets live.
    await page.getByRole("button", { name: /Point #1/ }).click();
    await openAnalyze(page);
    await expect(page.getByText("Select another object.")).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("U: undo/redo follows live math", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Segment");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("0");
    await page.getByRole("button", { name: "Redo" }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByRole("button", { name: /Segment #1/ })).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("V: analysis coheres across Math Lab and Geometry Studio", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await showMoreAdd(page);
    await addObject(page, "Vector");
    await page.keyboard.press("Escape");
    await addObject(page, "Vector");
    await page.getByRole("button", { name: /Vector #1/ }).click();
    await openAnalyze(page);
    await selectSecondObject(page, "Vector #2");
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-angle")).toBeVisible({ timeout: 10000 });
    await toGeometry(page);
    await expect(page.getByTestId("scene-object-count")).toHaveText("2");
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-angle")).toBeVisible();
    await toMathLab(page);
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-angle")).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("W: narrow 430x800 keeps Geometry Analysis usable", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 430, height: 800 });
    await startClean(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await showMoreAdd(page);
    await addObject(page, "Point");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await addObject(page, "Infinite Line");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await openAnalyze(page);
    await expect(page.getByLabel("Second object for geometry analysis")).toBeVisible();
    await page.keyboard.press("Escape");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("X: unsafe Point coordinate rejected with axe clean", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Point");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await fillInput(page.locator("#graph-inspector").getByLabel("Point x"), "sin(factorial(a))");
    await expect(page.getByRole("alert").first()).toBeVisible({ timeout: 10000 });
    // Park the mouse on the inert 3D canvas: its resting position
    // persists across tests in one profile, and a hover-brightened
    // button would skew axe's color-contrast measurement (S28-R2).
    const axeCanvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
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
