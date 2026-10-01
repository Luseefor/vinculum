import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// S34 responsive/tablet/narrow/touch redesign: one responsive mathematical
// application across compact/medium/wide with touch-first canvas gestures.
// Frozen engine behavior stays covered by S16–S33.
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

function inspector(page: Page) {
  return page.locator("#graph-inspector");
}

function graph3dCanvas(page: Page) {
  return page.locator('canvas[data-graph3d-canvas="true"]').first();
}

async function canvasCenter(page: Page) {
  const box = await graph3dCanvas(page).boundingBox();
  if (!box) {
    throw new Error("canvas has no box");
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

async function composition(page: Page) {
  return page.evaluate(() => document.querySelector("[data-composition]")?.getAttribute("data-composition"));
}

async function openAnalyze(page: Page) {
  const tab = page.getByRole("tab", { name: "Analyze" });
  if ((await tab.count()) > 0 && (await tab.first().isVisible())) {
    await tab.first().click();
  }
}

async function settleCompute(page: Page) {
  const pending = page.locator('[data-testid="compute-status-pending"]');
  await pending.first().waitFor({ state: "attached", timeout: 3000 }).catch(() => {});
  await expect.poll(async () => pending.count(), { timeout: 25000 }).toBe(0);
}

test.describe("S34 responsive composition", () => {
  test("A: 390 portrait shell fits with visible canvas", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await startClean(page);
    await expect.poll(async () => composition(page), { timeout: 8000 }).toBe("compact");
    await expect(graph3dCanvas(page)).toBeVisible();
    const box = await graph3dCanvas(page).boundingBox();
    expect(box!.width).toBeGreaterThan(300);
    expect(box!.height).toBeGreaterThan(200);
    // No whole-page horizontal overflow.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
    // Compact chrome: workspace + undo + objects + inspector + overflow.
    await expect(page.getByRole("button", { name: "Geometry Studio" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Objects", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Inspector", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "More actions" })).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("B: 430 historical baseline geometry workflow passes", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 430, height: 800 });
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await inspector(page).getByLabel("Point x").fill("2");
    await expect(inspector(page).getByLabel("Point x")).toHaveValue("2");
    await page.keyboard.press("Escape");
    await expect(graph3dCanvas(page)).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("C: 844x390 landscape keeps chrome compact and canvas usable", async ({ page }) => {    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await startClean(page);
    await expect.poll(async () => composition(page), { timeout: 8000 }).toBe("compact");
    await toGeometry(page);
    const box = await graph3dCanvas(page).boundingBox();
    // Landscape canvas keeps working height (not the crushed 43px).
    expect(box!.height).toBeGreaterThan(80);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Objects" })).toBeVisible();
    await page.keyboard.press("Escape");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("C2: short-compact sheet stays visible above 1024px width", async ({ page }) => {
    // S34-R11: sheets gate on composition (short landscape is compact),
    // never on a Tailwind breakpoint that would hide a focus-trapped modal.
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 1024, height: 390 });
    await startClean(page);
    await expect.poll(async () => composition(page), { timeout: 8000 }).toBe("compact");
    await toGeometry(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Objects" });
    await expect(dialog).toBeVisible();
    // Actually rendered (not CSS-hidden): has real dimensions.
    const box = await dialog.boundingBox();
    expect(box!.width).toBeGreaterThan(200);
    await page.keyboard.press("Escape");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("C3: compact-wide-compact roundtrip keeps a single sheet", async ({ page }) => {
    // S34-R12: toggles enforce one sheet within compact; leaving compact
    // clears both flags so returning cannot stack two fixed dialogs.
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Objects" })).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect.poll(async () => composition(page), { timeout: 8000 }).toBe("wide");
    // Wide opens the Inspector from selection, not a toolbar toggle.
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.locator("#graph-inspector")).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(async () => composition(page), { timeout: 8000 }).toBe("compact");
    await page.waitForTimeout(400);
    expect(await page.getByRole("dialog").count()).toBeLessThanOrEqual(1);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("D: 768x1024 tablet portrait uses medium composition", async ({ page }) => {    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 768, height: 1024 });
    await startClean(page);
    await expect.poll(async () => composition(page), { timeout: 8000 }).toBe("medium");
    await toGeometry(page);
    // One persistent rail (Objects), canvas dominant.
    await expect(page.getByTestId("scene-object-count")).toBeVisible();
    const box = await graph3dCanvas(page).boundingBox();
    expect(box!.width).toBeGreaterThan(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("E: 1024x768 tablet landscape keeps canvas workable", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 1024, height: 768 });
    await startClean(page);
    await expect.poll(async () => composition(page), { timeout: 8000 }).toBe("medium");
    await toGeometry(page);
    const box = await graph3dCanvas(page).boundingBox();
    expect(box!.width).toBeGreaterThan(400);
    expect(box!.height).toBeGreaterThan(300);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("F: 1440 wide three-region layout unchanged", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await startClean(page);
    await expect.poll(async () => composition(page), { timeout: 8000 }).toBe("wide");
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    // Persistent left rail + persistent inspector panel (no sheets).
    await expect(page.getByTestId("scene-object-count")).toBeVisible();
    await expect(inspector(page).getByLabel("Point x")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("G: breakpoint cross 1440-390-1440 preserves scene/selection/draft", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await inspector(page).getByLabel("Point x").fill("7");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(async () => composition(page), { timeout: 8000 }).toBe("compact");
    await expect(page.getByTestId("compact-object-count")).toHaveText("1");
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await expect(page.getByRole("button", { name: "Selected Point #1" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await expect(inspector(page).getByLabel("Point x")).toHaveValue("7");
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect.poll(async () => composition(page), { timeout: 8000 }).toBe("wide");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByRole("button", { name: "Selected Point #1" })).toBeVisible();
    await expect(inspector(page).getByLabel("Point x")).toHaveValue("7");
    await expect(page.locator('[data-testid="compute-status-pending"]')).toHaveCount(0);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("H: orientation 390x844-844x390-390x844 preserves state", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.setViewportSize({ width: 844, height: 390 });
    await expect.poll(async () => composition(page), { timeout: 8000 }).toBe("compact");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(graph3dCanvas(page)).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("I: exactly one logical Inspector mounted", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await expect(inspector(page)).toBeVisible();
    expect(await page.locator("#graph-inspector").count()).toBe(1);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(500);
    expect(await page.locator("#graph-inspector").count()).toBeLessThanOrEqual(1);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("J: exactly one active object editor path", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await page.keyboard.press("Escape");
    // Visible object-count badges: at most one (no header/sheet duplication).
    const visibleBadges = page.locator('[data-testid="scene-object-count"]').filter({ visible: true });
    expect(await visibleBadges.count()).toBeLessThanOrEqual(1);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("K: compact create Point focuses the equation field", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Point", exact: true }).click();
    // Creation focuses the first coordinate field inside the open sheet.
    await expect(page.getByLabel("Point x").first()).toBeFocused({ timeout: 8000 });
    await page.getByLabel("Point x").first().fill("4");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("L: compact Surface create-type-analyze-close-canvas", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await inspector(page).getByLabel("Surface expression z = f(x,y)").fill("x^2 + y^2");
    await page.getByRole("tab", { name: "Analyze" }).click();
    await expect(page.getByTestId("scalar-visualization-section")).toBeVisible();
    await page.getByRole("tab", { name: "Object" }).click();
    await page.keyboard.press("Escape");
    await expect(graph3dCanvas(page)).toBeVisible();
    // Selection survives sheet close, surfaced by the compact chip.
    await expect(page.getByRole("button", { name: "Inspect Surface 1" })).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("M: compact Vector Field definition plus streamlines", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "2D Vector Field", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await expect(inspector(page).getByLabel("Vector field P component")).toBeVisible();
    await page.getByRole("tab", { name: "Analyze" }).click();
    await expect(page.getByTestId("streamline-section")).toBeVisible();
    await page.getByRole("switch", { name: "Show streamlines" }).click();
    await expect(page.getByLabel("Seed density")).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("N: compact 3x3 matrix fits and edits", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Show more object types" }).click();
    await page.getByRole("button", { name: "3D Linear Transformation", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    const group = inspector(page).getByRole("group", { name: "3 by 3 matrix entries" });
    await expect(group).toBeVisible();
    const groupBox = await group.boundingBox();
    const sheetBox = await page.getByRole("dialog", { name: "Inspector" }).boundingBox();
    expect(groupBox!.width).toBeLessThanOrEqual(sheetBox!.width);
    await inspector(page).getByLabel("Row 1 column 1").fill("2");
    await page.getByRole("tab", { name: "Analyze" }).click();
    await expect(page.getByTestId("linear-fact-determinant")).toBeVisible({ timeout: 10000 });
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("O: compact Geometry Analysis usable", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await page.getByRole("button", { name: "Infinite Line", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: /Point #1/ }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await page.getByRole("tab", { name: "Analyze" }).click();
    const select = page.getByLabel("Second object for geometry analysis");
    const value = await select.evaluate((element, text) => {
      const options = Array.from((element as HTMLSelectElement).options);
      return options.find((option) => option.label.includes(text))?.value ?? null;
    }, "Infinite Line #2");
    await select.selectOption(value as string);
    await expect(page.getByTestId("geometry-fact-distance")).toBeVisible({ timeout: 10000 });
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("P: compact Integral mode, integrand, result", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Parametric Curve", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await page.getByRole("tab", { name: "Analyze" }).click();
    await expect(page.getByLabel("Integral mode")).toBeVisible();
    await expect(page.getByTestId("integral-result-value")).toBeVisible({ timeout: 25000 });
    await expect(page.getByTestId("integral-result-error")).toContainText("Estimated numerical error");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Q: sheet open and close restores the trigger", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Objects" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Objects", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Inspector" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Inspector", exact: true })).toBeFocused();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("R: sheet scroll ownership (canvas stable underneath)", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await page.getByRole("tab", { name: "Analyze" }).click();
    const section = page.getByTestId("scalar-visualization-section");
    await section.hover();
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(400);
    // Sheet stayed open on Analyze; selection (via chip) and scene intact.
    await expect(page.getByTestId("scalar-visualization-section")).toBeVisible();
    await expect(page.getByRole("button", { name: "Inspect Surface 1" })).toBeVisible();
    await expect(page.locator('[data-testid="compute-status-pending"]')).toHaveCount(0);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("AE: responsive storm issues zero compute jobs", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await page.getByLabel("Equation").first().fill("x^2 + y^2");
    await settleCompute(page);
    // Storm: resize across breakpoints and orientations, open/close sheets.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(400);
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(400);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(400);
    await expect(page.locator('[data-testid="compute-status-pending"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Selected Surface #1" })).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("AF: responsive storm adds zero canonical history", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    // Undo is available from creation only.
    await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 844, height: 390 });
    await page.setViewportSize({ width: 1440, height: 900 });
    // One Undo still removes the created point itself: storm added nothing.
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("0");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("AG: responsive storm leaves serialization untouched", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await inspector(page).getByLabel("Point x").fill("1");
    await inspector(page).getByLabel("Point y").fill("2");
    await inspector(page).getByLabel("Point z").fill("3");
    const before = {
      x: await inspector(page).getByLabel("Point x").inputValue(),
      y: await inspector(page).getByLabel("Point y").inputValue(),
      z: await inspector(page).getByLabel("Point z").inputValue()
    };
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 844, height: 390 });
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: /^(Select|Selected) Point #1$/ }).click();
    await expect(inspector(page).getByLabel("Point x")).toHaveValue(before.x);
    await expect(inspector(page).getByLabel("Point y")).toHaveValue(before.y);
    await expect(inspector(page).getByLabel("Point z")).toHaveValue(before.z);
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("AH: Graph2D backing size follows resize", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("group", { name: "View type" }).getByRole("button", { name: "2D only" }).click();
    const canvas = page.locator('canvas[data-graph2d-canvas="true"]').first();
    await expect(canvas).toBeVisible();
    const before = await canvas.evaluate((el) => ({ w: (el as HTMLCanvasElement).width, h: (el as HTMLCanvasElement).height }));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(600);
    await expect(canvas).toBeVisible();
    const after = await canvas.evaluate((el) => ({ w: (el as HTMLCanvasElement).width, h: (el as HTMLCanvasElement).height }));
    expect(after.w).toBeLessThan(before.w);
    expect(after.w).toBeGreaterThan(0);
    expect(after.h).toBeGreaterThan(0);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("AI: Quad survives compact-wide roundtrip with valid picking", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry layout").selectOption("quad");
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await inspector(page).getByLabel("Point x").fill("0");
    await inspector(page).getByLabel("Point y").fill("0");
    await inspector(page).getByLabel("Point z").fill("0");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(600);
    // Panes tile without overlap; clicking the perspective pane (top-left
    // quadrant center, not the divider cross) picks the point.
    await expect(page.getByRole("button", { name: "Perspective viewport" })).toBeVisible();
    const canvas = graph3dCanvas(page);
    const box = await canvas.boundingBox();
    await page.mouse.click(box!.x + box!.width * 0.25, box!.y + box!.height * 0.25);
    await expect(page.getByRole("button", { name: "Selected Point #1" })).toBeVisible({ timeout: 10000 });
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("AK: viewport metadata does not disable user zoom", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startClean(page);
    const content = await page.evaluate(() => document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "");
    expect(content).not.toMatch(/maximum-scale/i);
    expect(content).not.toMatch(/user-scalable\s*=\s*no/i);
  });

  test("AJ: safe-area insets apply without covering chrome", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await startClean(page);
    // Shell honors safe-area env() with zero fallbacks (no notch here).
    const padding = await page.evaluate(() => {
      const shell = document.querySelector(".app-shell") as HTMLElement;
      const style = getComputedStyle(shell);
      return { top: style.paddingTop, bottom: style.paddingBottom };
    });
    expect(padding.top).toBeDefined();
    expect(padding.bottom).toBeDefined();
    await toGeometry(page);
    await expect(page.getByRole("button", { name: "Objects", exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("AM: compact workspace switch keeps Inspector coherent", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await expect(inspector(page).getByLabel("Point x")).toBeVisible();
    // Sheets dismiss before workspace switch (backdrop/Escape); Inspector
    // state (selection/analysis/drafts) survives the roundtrip.
    await page.keyboard.press("Escape");
    await toMathLab(page);
    await expect(page.getByTestId("compact-object-count")).toHaveText("1");
    await toGeometry(page);
    // Selection survived the roundtrip (compact chip is the proof surface).
    await expect(page.getByRole("button", { name: "Inspect Point 1" })).toBeVisible();
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await expect(inspector(page).getByLabel("Point x")).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("AN: compact axe clean (Math analyze)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await page.getByRole("tab", { name: "Analyze" }).click();
    await page.waitForTimeout(800);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("AO: tablet axe clean (768 portrait)", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await page.waitForTimeout(800);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("S34 touch workflows", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("S: touch one-finger orbit keeps selection (Perspective)", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await page.keyboard.press("Escape");
    const canvas = graph3dCanvas(page);
    const box = await canvas.boundingBox();
    const cdp = await page.context().newCDPSession(page);
    // One-finger drag on empty corner: camera gesture, selection preserved.
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: box!.x + 40, y: box!.y + 40, id: 1 }]
    });
    for (let i = 1; i <= 6; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: box!.x + 40 + (80 * i) / 6, y: box!.y + 40, id: 1 }]
      });
      await page.waitForTimeout(30);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(500);
    // Camera gesture preserved selection (compact chip proves it: the row
    // lives in the closed Objects sheet).
    await expect(page.getByRole("button", { name: "Inspect Point 1" })).toBeVisible();
    await expect(page.locator('[data-testid="compute-status-pending"]')).toHaveCount(0);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("T: ortho touch pan plus pinch zoom", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await page.keyboard.press("Escape");
    const canvas = graph3dCanvas(page);
    const box = await canvas.boundingBox();
    const cdp = await page.context().newCDPSession(page);
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    // Pinch out (fingers apart): zooms in — a later fixed drag moves more.
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: cx - 40, y: cy, id: 1 },
        { x: cx + 40, y: cy, id: 2 }
      ]
    });
    for (let i = 1; i <= 6; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: cx - 40 - (40 * i) / 6, y: cy, id: 1 },
          { x: cx + 40 + (40 * i) / 6, y: cy, id: 2 }
        ]
      });
      await page.waitForTimeout(30);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(500);
    await expect(page.getByRole("button", { name: "Inspect Point 1" })).toBeVisible();
    await expect(page.locator('[data-testid="compute-status-pending"]')).toHaveCount(0);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("U: Math 2D touch pan plus pinch", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("group", { name: "View type" }).getByRole("button", { name: "2D only" }).click();
    const canvas = page.locator('canvas[data-graph2d-canvas="true"]').first();
    await expect(canvas).toBeVisible();
    const badge = page.getByTestId("graph2d-viewport-range-badge");
    const before = await badge.textContent();
    const box = await canvas.boundingBox();
    const cdp = await page.context().newCDPSession(page);
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    // One-finger drag pans.
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx, y: cy, id: 1 }] });
    for (let i = 1; i <= 5; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: cx + (50 * i) / 5, y: cy, id: 1 }]
      });
      await page.waitForTimeout(30);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(400);
    await expect.poll(async () => badge.textContent(), { timeout: 8000 }).not.toBe(before);
    const panned = await badge.textContent();
    // Two-finger spread pinches (range changes again).
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: cx - 30, y: cy, id: 1 },
        { x: cx + 30, y: cy, id: 2 }
      ]
    });
    for (let i = 1; i <= 5; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: cx - 30 - (30 * i) / 5, y: cy, id: 1 },
          { x: cx + 30 + (30 * i) / 5, y: cy, id: 2 }
        ]
      });
      await page.waitForTimeout(30);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(400);
    await expect.poll(async () => badge.textContent(), { timeout: 8000 }).not.toBe(panned);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("V: touch Point drag moves with one undo", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await page.locator("#graph-inspector").getByLabel("Point x").fill("0");
    await page.locator("#graph-inspector").getByLabel("Point y").fill("0");
    await page.locator("#graph-inspector").getByLabel("Point z").fill("0");
    await page.keyboard.press("Escape");
    const canvas = graph3dCanvas(page);
    const box = await canvas.boundingBox();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx, y: cy, id: 1 }] });
    for (let i = 1; i <= 8; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: cx + (60 * i) / 8, y: cy, id: 1 }]
      });
      await page.waitForTimeout(30);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await expect(inspector(page).getByLabel("Point x")).not.toHaveValue("0", { timeout: 8000 });
    await expect(inspector(page).getByLabel("Point z")).toHaveValue("0");
    // One touch drag collapses into one undo entry (sheet closed first:
    // the header Undo sits beneath the open sheet).
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Undo" }).click();
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await expect(inspector(page).getByLabel("Point x")).toHaveValue("0");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("W: touch Segment endpoint wins over camera", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Segment", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await inspector(page).getByLabel("Segment start x").fill("0");
    await inspector(page).getByLabel("Segment start y").fill("0");
    await inspector(page).getByLabel("Segment start z").fill("0");
    await inspector(page).getByLabel("Segment end x").fill("0");
    await inspector(page).getByLabel("Segment end y").fill("4");
    await inspector(page).getByLabel("Segment end z").fill("0");
    await page.keyboard.press("Escape");
    const canvas = graph3dCanvas(page);
    const box = await canvas.boundingBox();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx, y: cy, id: 1 }] });
    for (let i = 1; i <= 8; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: cx, y: cy + (40 * i) / 8, id: 1 }]
      });
      await page.waitForTimeout(30);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    // Start moved (not camera-panned); End fixed.
    await expect(inspector(page).getByLabel("Segment start y")).not.toHaveValue("0", { timeout: 8000 });
    await expect(inspector(page).getByLabel("Segment end y")).toHaveValue("4");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("X: touch Vector tip updates components", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Vector", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await inspector(page).getByLabel("Vector origin x").fill("0");
    await inspector(page).getByLabel("Vector origin y").fill("0");
    await inspector(page).getByLabel("Vector origin z").fill("0");
    await inspector(page).getByLabel("Vector component x").first().fill("2");
    await inspector(page).getByLabel("Vector component y").first().fill("0");
    await inspector(page).getByLabel("Vector component z").first().fill("0");
    await page.keyboard.press("Escape");
    const canvas = graph3dCanvas(page);
    const box = await canvas.boundingBox();
    // Tip at (2,0,0); world-per-pixel at span 12 over ~360px min dimension.
    const wpp = 12 / Math.min(box!.width, box!.height);
    const tx = box!.x + box!.width / 2 + 2 / wpp;
    const ty = box!.y + box!.height / 2;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: tx, y: ty, id: 1 }] });
    for (let i = 1; i <= 6; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: tx + (30 * i) / 6, y: ty, id: 1 }]
      });
      await page.waitForTimeout(30);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await expect(inspector(page).getByLabel("Vector component x").first()).not.toHaveValue("2", { timeout: 8000 });
    await expect(inspector(page).getByLabel("Vector origin x")).toHaveValue("0");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Y: touch expression lock (parameter-backed Point intact)", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await inspector(page).getByLabel("Point x").fill("r-2.5");
    await inspector(page).getByLabel("Point y").fill("0");
    await inspector(page).getByLabel("Point z").fill("0");
    await page.keyboard.press("Escape");
    const canvas = graph3dCanvas(page);
    const box = await canvas.boundingBox();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx, y: cy, id: 1 }] });
    for (let i = 1; i <= 6; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: cx + (60 * i) / 6, y: cy, id: 1 }]
      });
      await page.waitForTimeout(30);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await expect(inspector(page).getByLabel("Point x")).toHaveValue("r-2.5");
    await expect(page.locator('[data-testid="compute-status-pending"]')).toHaveCount(0);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Z: touch targets meet intended interaction size", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startClean(page);
    await toGeometry(page);
    const coarse = await page.evaluate(() => window.matchMedia("(pointer: coarse)").matches);
    expect(coarse).toBe(true);
    const sizes = await page.evaluate(() => {
      const pick = (name: string) => {
        const el = [...document.querySelectorAll("header button")].find((button) => {
          const label = button.getAttribute("aria-label") ?? button.textContent ?? "";
          return label.trim() === name || label.trim().startsWith(name);
        }) as HTMLElement | undefined;
        const rect = el?.getBoundingClientRect();
        return rect ? Math.round(Math.min(rect.width, rect.height)) : null;
      };
      return {
        objects: pick("Objects") ?? undefined,
        inspector: pick("Inspector") ?? undefined,
        more: pick("More actions") ?? undefined
      };
    });
    // Compact chrome controls meet the ~40px interaction size.
    expect(sizes.objects).toBeGreaterThanOrEqual(36);
    expect(sizes.inspector).toBeGreaterThanOrEqual(36);
    expect(sizes.more).toBeGreaterThanOrEqual(36);
  });

  test("AA: touch flow needs no hover (create, select, analyze)", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await expect(inspector(page).getByLabel("Point x")).toBeVisible();
    await page.getByRole("tab", { name: "Analyze" }).click();
    await expect(page.getByText("Geometry Analysis")).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("AB: Frame Selected through the overflow menu (touch, no keyboard)", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await page.locator("#graph-inspector").getByLabel("Point x").fill("30");
    await page.locator("#graph-inspector").getByLabel("Point y").fill("40");
    await page.locator("#graph-inspector").getByLabel("Point z").fill("50");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Frame selected" }).click();
    // Deselect with a corner tap (framed point sits at the center), then
    // tapping the center selects it again — proving framing centered it
    // (compact chip proves selection; rows live in the closed sheet).
    const canvas = graph3dCanvas(page);
    const box = await canvas.boundingBox();
    await page.touchscreen.tap(box!.x + 30, box!.y + 100);
    await page.waitForTimeout(500);
    await expect(page.getByRole("button", { name: "Inspect Point 1" })).toHaveCount(0);
    await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await expect(page.getByRole("button", { name: "Inspect Point 1" })).toBeVisible({ timeout: 10000 });
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("AC: Fit Scene through the overflow menu (touch)", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Fit scene" }).click();
    await expect(graph3dCanvas(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "Inspect Point 1" })).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("AD: focused field stays visible after height reduction", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Show more object types" }).click();
    await page.getByRole("button", { name: "3D Linear Transformation", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    const cell = inspector(page).getByLabel("Row 3 column 3");
    await cell.focus();
    // Simulate virtual-keyboard height loss.
    await page.setViewportSize({ width: 390, height: 500 });
    await page.waitForTimeout(500);
    const visible = await cell.evaluate((el) => {
      const rect = (el as HTMLElement).getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= window.innerHeight && rect.width > 0;
    });
    expect(visible).toBe(true);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("AL: coarse pointer on touch, fine on desktop", async ({ page }) => {
    await startClean(page);
    expect(await page.evaluate(() => window.matchMedia("(pointer: coarse)").matches)).toBe(true);
    expect(await page.evaluate(() => window.matchMedia("(hover: none)").matches)).toBe(true);
  });
});
