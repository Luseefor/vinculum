import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// S31 Geometry Studio workflow: create→select→edit→compare→analyze→view.
// Frozen engine behavior is covered by the S16-S29 suites; this spec pins
// the Geometry-first interaction layer (selection parity, definition
// editors, analysis workflow, view preservation, narrow flow, axe).

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

function graph3dCanvas(page: Page) {
  return page.locator('canvas[data-graph3d-canvas="true"]').first();
}

test.describe("S31 Geometry Studio workflow", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("A: Quick Add Point selects it, focuses x, edits live", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByRole("button", { name: "Selected Point #1" })).toBeVisible();
    await expect(page.getByLabel("Point x").first()).toBeFocused({ timeout: 8000 });
    await page.getByLabel("Point x").first().fill("4");
    await expect(graph3dCanvas(page)).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("B: canvas click selects the Point with correct row and Inspector", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    // Put the point at the origin: the default Perspective camera looks at
    // the origin, so it projects to canvas center for a deterministic hit.
    await page.locator("#graph-inspector").getByLabel("Point x").fill("0");
    await page.locator("#graph-inspector").getByLabel("Point y").fill("0");
    await page.locator("#graph-inspector").getByLabel("Point z").fill("0");
    // Move selection elsewhere first via a second object, then click canvas
    // center: only the point marker is pickable there.
    await showMoreAdd(page);
    await page.getByRole("button", { name: "Parametric Curve", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("2");
    await expect(page.getByRole("button", { name: "Selected Parametric Curve #2" })).toBeVisible();
    const canvas = graph3dCanvas(page);
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
      throw new Error("canvas has no box");
    }
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await expect(page.getByRole("button", { name: "Selected Point #1" })).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#graph-inspector").getByLabel("Point x")).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("C: row selection reflects in canvas context and Inspector", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await page.getByRole("button", { name: "Infinite Line", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("2");
    await page.getByRole("button", { name: /^(Select|Selected) Infinite Line #2$/ }).click();
    await expect(page.getByRole("button", { name: "Selected Infinite Line #2" })).toBeVisible();
    await expect(page.locator("#graph-inspector").getByLabel("Line point x")).toBeVisible();
    await expect(graph3dCanvas(page)).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("D: empty clean click deselects, orbit drag does not", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await expect(page.getByRole("button", { name: "Selected Point #1" })).toBeVisible();
    // Orbit-style drag starting on empty canvas preserves selection.
    const canvas = graph3dCanvas(page);
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
      throw new Error("canvas has no box");
    }
    await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.15);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.4, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByRole("button", { name: "Selected Point #1" })).toBeVisible();
    // Genuine clean click on empty space clears selection, keeps the object.
    await page.mouse.click(box.x + box.width * 0.85, box.y + box.height * 0.15);
    await expect(page.getByRole("button", { name: "Selected Point #1" })).not.toBeVisible();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("E: Vector editor separates Origin and Components", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Vector", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByText("Origin", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Components", { exact: true }).first()).toBeVisible();
    await page.getByLabel("Vector component x").first().fill("3");
    await page.getByLabel("Vector component y").first().fill("0");
    await page.getByLabel("Vector component z").first().fill("0");
    await expect(page.getByText("Magnitude 3.").first()).toBeVisible({ timeout: 10000 });
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("F: Line, Ray, and Segment editors show correct tuple structure", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Infinite Line", exact: true }).click();
    await expect(page.locator("#graph-inspector").getByText("Point", { exact: true })).toBeVisible();
    await expect(page.locator("#graph-inspector").getByText("Direction", { exact: true })).toBeVisible();
    await showMoreAdd(page);
    await page.getByRole("button", { name: "Ray", exact: true }).click();
    await expect(page.locator("#graph-inspector").getByText("Origin", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Segment", exact: true }).click();
    await expect(page.locator("#graph-inspector").getByText("Start", { exact: true })).toBeVisible();
    await expect(page.locator("#graph-inspector").getByText("End", { exact: true })).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("G: invalid Line direction recovers without reload", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Infinite Line", exact: true }).click();
    await page.getByLabel("Line direction x").first().fill("0");
    await page.getByLabel("Line direction y").first().fill("0");
    await page.getByLabel("Line direction z").first().fill("0");
    await expect(page.getByText("Line direction must be nonzero.").first()).toBeVisible();
    await page.getByLabel("Line direction x").first().fill("1");
    await expect(page.getByText("Line direction must be nonzero.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Selected Infinite Line #1" })).toBeVisible();
    await expect(graph3dCanvas(page)).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("H: Perspective, XY, XZ, YZ preserve selection", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    for (const view of ["xy", "xz", "yz", "perspective"] as const) {
      await page.getByLabel("Geometry view").selectOption(view);
      await expect(page.getByRole("button", { name: "Selected Point #1" })).toBeVisible();
      await expect(graph3dCanvas(page)).toBeVisible();
    }
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("I: Single, Split, Quad preserve selection and analysis", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await page.getByRole("button", { name: "Infinite Line", exact: true }).click();
    await openAnalyze(page);
    await expect(page.getByLabel("Second object for geometry analysis")).toBeVisible();
    for (const layout of ["split", "quad", "single"] as const) {
      await page.getByLabel("Geometry layout").selectOption(layout);
      await expect(page.getByRole("button", { name: /^(Select|Selected) Infinite Line #2$/ })).toBeVisible();
      await expect(page.getByLabel("Second object for geometry analysis")).toBeVisible();
    }
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("J: Quad pane activation keeps one global selection", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await page.getByLabel("Geometry layout").selectOption("quad");
    await expect(page.getByRole("button", { name: "Selected Point #1" })).toBeVisible();
    // Activating another pane must not fork selection state.
    await page.getByRole("button", { name: "XY viewport" }).click();
    await expect(page.getByRole("button", { name: "Selected Point #1" })).toBeVisible();
    await page.getByRole("button", { name: "Perspective viewport" }).click();
    await expect(page.getByRole("button", { name: "Selected Point #1" })).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("K: Point-Line analysis shows snippet options with correct facts", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await page.locator("#graph-inspector").getByLabel("Point x").fill("0");
    await page.locator("#graph-inspector").getByLabel("Point y").fill("0");
    await page.locator("#graph-inspector").getByLabel("Point z").fill("0");
    await page.getByRole("button", { name: "Infinite Line", exact: true }).click();
    await page.getByRole("button", { name: /Point #1/ }).click();
    await openAnalyze(page);
    // Second-object options carry mathematical snippets, not bare IDs.
    const select = page.getByLabel("Second object for geometry analysis");
    const labels = await select.evaluate((element) =>
      Array.from((element as HTMLSelectElement).options).map((option) => option.label)
    );
    expect(labels.some((label) => label.includes("Infinite Line #2"))).toBe(true);
    expect(labels.some((label) => /Infinite Line #2 — L:/.test(label))).toBe(true);
    const value = await select.evaluate((element, text) => {
      const options = Array.from((element as HTMLSelectElement).options);
      return options.find((option) => option.label.includes(text))?.value ?? null;
    }, "Infinite Line #2");
    expect(value).not.toBeNull();
    await select.selectOption(value as string);
    await expect(page.getByTestId("geometry-fact-distance")).toBeVisible({ timeout: 10000 });
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("L: Point-Plane projection with overlay control", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await page.getByRole("button", { name: "Plane", exact: true }).click();
    await page.getByRole("button", { name: /Point #1/ }).click();
    await openAnalyze(page);
    const select = page.getByLabel("Second object for geometry analysis");
    const value = await select.evaluate((element, text) => {
      const options = Array.from((element as HTMLSelectElement).options);
      return options.find((option) => option.label.includes(text))?.value ?? null;
    }, "Plane #2");
    expect(value).not.toBeNull();
    await select.selectOption(value as string);
    await expect(page.getByTestId("geometry-fact-point")).toBeVisible({ timeout: 10000 });
    await page.getByRole("switch", { name: "Show projection" }).click();
    await expect(graph3dCanvas(page)).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("M: skew lines report relationship, distance, and connector", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Infinite Line", exact: true }).click();
    await page.locator("#graph-inspector").getByLabel("Line point x").fill("0");
    await page.locator("#graph-inspector").getByLabel("Line point y").fill("0");
    await page.locator("#graph-inspector").getByLabel("Line point z").fill("0");
    await page.locator("#graph-inspector").getByLabel("Line direction x").fill("1");
    await page.locator("#graph-inspector").getByLabel("Line direction y").fill("0");
    await page.locator("#graph-inspector").getByLabel("Line direction z").fill("0");
    await page.getByRole("button", { name: "Infinite Line", exact: true }).click();
    await page.locator("#graph-inspector").getByLabel("Line point x").fill("0");
    await page.locator("#graph-inspector").getByLabel("Line point y").fill("1");
    await page.locator("#graph-inspector").getByLabel("Line point z").fill("1");
    await page.locator("#graph-inspector").getByLabel("Line direction x").fill("0");
    await page.locator("#graph-inspector").getByLabel("Line direction y").fill("1");
    await page.locator("#graph-inspector").getByLabel("Line direction z").fill("0");
    await page.getByRole("button", { name: /Line #1/ }).click();
    await openAnalyze(page);
    const select = page.getByLabel("Second object for geometry analysis");
    const value = await select.evaluate((element, text) => {
      const options = Array.from((element as HTMLSelectElement).options);
      return options.find((option) => option.label.includes(text))?.value ?? null;
    }, "Infinite Line #2");
    await select.selectOption(value as string);
    await expect(page.getByTestId("geometry-fact-relation")).toHaveText("Skew.", { timeout: 10000 });
    await expect(page.getByTestId("geometry-fact-distance")).toHaveText("1");
    await page.getByRole("switch", { name: "Show closest connection" }).click();
    await expect(graph3dCanvas(page)).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("N: plane-plane intersection line overlay", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Plane", exact: true }).click();
    await page.getByRole("button", { name: "Plane", exact: true }).click();
    // Default planes are coincident; tilt the second into an intersection.
    await page.getByRole("button", { name: /Plane #2/ }).click();
    await page.getByLabel("Plane equation").fill("x = 0");
    await page.getByRole("button", { name: /Plane #1/ }).click();
    await openAnalyze(page);
    const select = page.getByLabel("Second object for geometry analysis");
    const value = await select.evaluate((element, text) => {
      const options = Array.from((element as HTMLSelectElement).options);
      return options.find((option) => option.label.includes(text))?.value ?? null;
    }, "Plane #2");
    await select.selectOption(value as string);
    await expect(page.getByTestId("geometry-fact-relation")).toHaveText("Intersecting.", { timeout: 10000 });
    await page.getByRole("switch", { name: "Show intersection line" }).click();
    await expect(graph3dCanvas(page)).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("O: deleting the secondary clears the chooser, primary stays", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await page.getByRole("button", { name: "Infinite Line", exact: true }).click();
    await page.getByRole("button", { name: /Point #1/ }).click();
    await openAnalyze(page);
    const select = page.getByLabel("Second object for geometry analysis");
    const value = await select.evaluate((element, text) => {
      const options = Array.from((element as HTMLSelectElement).options);
      return options.find((option) => option.label.includes(text))?.value ?? null;
    }, "Infinite Line #2");
    await select.selectOption(value as string);
    await expect(page.getByTestId("geometry-fact-distance")).toBeVisible({ timeout: 10000 });
    // Delete the secondary Line via its row menu.
    await page.getByRole("button", { name: /^(Select|Selected) Infinite Line #2$/ }).hover();
    await page.getByRole("button", { name: "Object actions" }).nth(1).click();
    await page.getByRole("menuitem", { name: "Remove" }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByRole("button", { name: /^(Select|Selected) Point #1$/ })).toBeVisible();
    await expect(page.getByText("Select another object.")).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("O2: deleting the primary falls back cleanly with analysis reset", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await page.getByRole("button", { name: "Infinite Line", exact: true }).click();
    await page.getByRole("button", { name: /Point #1/ }).click();
    await openAnalyze(page);
    const select = page.getByLabel("Second object for geometry analysis");
    const value = await select.evaluate((element, text) => {
      const options = Array.from((element as HTMLSelectElement).options);
      return options.find((option) => option.label.includes(text))?.value ?? null;
    }, "Infinite Line #2");
    await select.selectOption(value as string);
    await expect(page.getByTestId("geometry-fact-distance")).toBeVisible({ timeout: 10000 });
    // Delete the primary Point: selection falls back to the survivor and
    // the analysis area resets instead of showing stale facts.
    await page.getByRole("button", { name: "Object actions" }).first().click();
    await page.getByRole("menuitem", { name: "Remove" }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByRole("button", { name: /^(Select|Selected) Infinite Line #1$/ })).toBeVisible();
    await expect(page.getByTestId("geometry-fact-distance")).not.toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("O3: converting the secondary to an incompatible kind resets the chooser", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await page.getByRole("button", { name: "Infinite Line", exact: true }).click();
    await page.getByRole("button", { name: /Point #1/ }).click();
    await openAnalyze(page);
    const select = page.getByLabel("Second object for geometry analysis");
    const value = await select.evaluate((element, text) => {
      const options = Array.from((element as HTMLSelectElement).options);
      return options.find((option) => option.label.includes(text))?.value ?? null;
    }, "Infinite Line #2");
    await select.selectOption(value as string);
    await expect(page.getByTestId("geometry-fact-distance")).toBeVisible({ timeout: 10000 });
    // Convert the secondary Line into a Surface (incompatible with Point
    // analysis): no stale facts may survive. Conversion re-selects the
    // converted object by design, so return to the Point first.
    await page.getByRole("button", { name: "Object actions" }).nth(1).click();
    await page.getByRole("menuitem", { name: "Surface", exact: true }).click();
    await expect(page.getByRole("button", { name: /^(Select|Selected) Surface #2$/ })).toBeVisible();
    await page.getByRole("button", { name: /Point #1/ }).click();
    await openAnalyze(page);
    await expect(page.getByTestId("geometry-fact-distance")).not.toBeVisible();
    await expect(page.getByText("Select another object.")).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("P: parameter-driven Point updates analysis live", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await page.locator("#graph-inspector").getByLabel("Point x").fill("r");
    await page.getByRole("button", { name: "Infinite Line", exact: true }).click();
    await page.getByRole("button", { name: /Point #1/ }).click();
    await openAnalyze(page);
    const select = page.getByLabel("Second object for geometry analysis");
    const value = await select.evaluate((element, text) => {
      const options = Array.from((element as HTMLSelectElement).options);
      return options.find((option) => option.label.includes(text))?.value ?? null;
    }, "Infinite Line #2");
    await select.selectOption(value as string);
    await expect(page.getByTestId("geometry-fact-distance")).toBeVisible({ timeout: 10000 });
    const before = await page.getByTestId("geometry-fact-distance").textContent();
    await page.getByRole("button", { name: "PARAMETERS" }).click();
    const slider = page.getByLabel("Parameter r");
    await expect(slider).toBeVisible();
    await slider.evaluate((element, target) => {
      const input = element as HTMLInputElement;
      input.focus();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (setter) {
        setter.call(input, String(target));
      }
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, 6);
    await expect(page.getByTestId("geometry-fact-distance")).not.toHaveText(before ?? "", { timeout: 10000 });
    await expect(page.getByTestId("geometry-fact-distance")).toContainText(/[0-9]/);
    await expect(page.locator("#graph-inspector").getByRole("alert")).toHaveCount(0);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Q: hiding the source keeps facts while overlay follows visibility", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await page.getByRole("button", { name: "Infinite Line", exact: true }).click();
    await page.getByRole("button", { name: /Point #1/ }).click();
    await openAnalyze(page);
    const select = page.getByLabel("Second object for geometry analysis");
    const value = await select.evaluate((element, text) => {
      const options = Array.from((element as HTMLSelectElement).options);
      return options.find((option) => option.label.includes(text))?.value ?? null;
    }, "Infinite Line #2");
    await select.selectOption(value as string);
    await expect(page.getByTestId("geometry-fact-distance")).toBeVisible({ timeout: 10000 });
    await page.getByRole("switch", { name: "Show projection" }).click();
    await page.getByRole("button", { name: "Hide object" }).nth(1).click();
    // Numerics remain valid; no crash, no stale overlay errors.
    await expect(page.getByTestId("geometry-fact-distance")).toBeVisible();
    await expect(page.getByRole("button", { name: "Show object" }).first()).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("R: Geometry to Math and back preserves scene and selection", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await page.getByRole("button", { name: "Plane", exact: true }).click();
    await page.getByRole("button", { name: /Point #1/ }).click();
    await openAnalyze(page);
    const select = page.getByLabel("Second object for geometry analysis");
    const value = await select.evaluate((element, text) => {
      const options = Array.from((element as HTMLSelectElement).options);
      return options.find((option) => option.label.includes(text))?.value ?? null;
    }, "Plane #2");
    await select.selectOption(value as string);
    await expect(page.getByTestId("geometry-fact-distance")).toBeVisible({ timeout: 10000 });
    await page.getByRole("switch", { name: "Show projection" }).click();
    await toMathLab(page);
    await expect(page.getByTestId("scene-object-count")).toHaveText("2");
    await expect(page.getByRole("button", { name: /^(Select|Selected) Point #1$/ })).toBeVisible();
    await toGeometry(page);
    await expect(page.getByRole("button", { name: /^(Select|Selected) Point #1$/ })).toBeVisible();
    await openAnalyze(page);
    // Analysis state (secondary + overlay) survives the roundtrip live.
    await expect(page.getByTestId("geometry-fact-distance")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("switch", { name: "Hide projection" })).toBeVisible();
    await expect(graph3dCanvas(page)).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("S: view, layout, Analyze, and selector navigation issue zero jobs", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await page.getByRole("button", { name: "Infinite Line", exact: true }).click();
    await page.getByRole("button", { name: /Point #1/ }).click();
    await openAnalyze(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await page.getByLabel("Geometry layout").selectOption("split");
    await page.getByLabel("Geometry layout").selectOption("single");
    const select = page.getByLabel("Second object for geometry analysis");
    const value = await select.evaluate((element, text) => {
      const options = Array.from((element as HTMLSelectElement).options);
      return options.find((option) => option.label.includes(text))?.value ?? null;
    }, "Infinite Line #2");
    await select.selectOption(value as string);
    await expect(page.getByTestId("geometry-fact-distance")).toBeVisible({ timeout: 10000 });
    await page.getByRole("switch", { name: "Show projection" }).click();
    await page.getByRole("switch", { name: "Hide projection" }).click();
    await expect(page.getByTestId("geometry-fact-distance")).toBeVisible();
    await expect(page.locator('[data-testid="compute-status-pending"]')).toHaveCount(0);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("T: analysis and view actions add no undo entries", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
    // Pure UI storm without selection changes: tabs, views, analysis
    // secondary, overlay. None of it may push canonical history (row
    // selection pushes by explicit established policy and stays out here).
    // The freshly created Line stays selected throughout the storm.
    await openAnalyze(page);
    const select = page.getByLabel("Second object for geometry analysis");
    await page.getByRole("button", { name: "Infinite Line", exact: true }).click();
    const value = await select.evaluate((element, text) => {
      const options = Array.from((element as HTMLSelectElement).options);
      return options.find((option) => option.label.includes(text))?.value ?? null;
    }, "Point #1");
    await select.selectOption(value as string);
    await page.getByRole("switch", { name: "Show projection" }).click();
    await page.getByLabel("Geometry view").selectOption("xz");
    // One undo must remove the last created object itself.
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("V: mixed primitive scene stays usable", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    const quick = ["Point", "Vector", "Infinite Line", "Segment", "Plane", "Surface"];
    for (const name of quick) {
      await page.getByRole("button", { name, exact: true }).click();
    }
    await showMoreAdd(page);
    for (const name of ["Ray", "Parametric Curve", "Parametric Surface", "Implicit Surface", "3D Vector Field", "2D Vector Field", "3D Linear Transformation", "2D Linear Transformation"]) {
      await page.getByRole("button", { name, exact: true }).click();
    }
    for (const name of ["Sphere", "Cylinder", "Implicit Sphere", "Parametric Sphere", "Parametric Torus", "Implicit Torus", "Sphere Cap", "Cylinder Shell", "Box Plateau", "Slice Plane"]) {
      await addPresetFor(page, name);
    }
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("25");
    await page.getByRole("button", { name: /^(Select|Selected) Point #1$/ }).click();
    await expect(page.locator("#graph-inspector").getByLabel("Point x")).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("W: narrow Geometry create, edit, analyze, and view flow", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 430, height: 800 });
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await page.locator("#graph-inspector").getByLabel("Point x").fill("2");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Infinite Line", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("2");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await openAnalyze(page);
    const select = page.getByLabel("Second object for geometry analysis");
    const value = await select.evaluate((element, text) => {
      const options = Array.from((element as HTMLSelectElement).options);
      return options.find((option) => option.label.includes(text))?.value ?? null;
    }, "Point #1");
    await select.selectOption(value as string);
    await expect(page.getByTestId("geometry-fact-distance")).toBeVisible({ timeout: 10000 });
    await page.getByRole("tab", { name: "Object" }).click();
    await expect(page.locator("#graph-inspector").getByLabel("Line point x")).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("X: Geometry workflow has no axe violations", async ({ page }) => {
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await page.getByRole("button", { name: "Infinite Line", exact: true }).click();
    await page.getByRole("button", { name: /Point #1/ }).click();
    await openAnalyze(page);
    await page.waitForTimeout(800);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

async function addPresetFor(page: Page, name: string) {
  await page.getByRole("button", { name: "Open object menu" }).click();
  await page.getByRole("button", { name, exact: true }).click();
}
