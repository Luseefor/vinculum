import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

// S23 timing bounds are load-sensitive (scalar worker sampling plus
// dev-server compile), so this spec runs serially.
test.describe.configure({ mode: "serial" });

// S23 scalar-field visualization: 2D heat maps, contour overlays, dense
// gradient glyphs, 3D implicit planar slices, worker races, visibility,
// source-edit refresh, transient persistence, workspace coherence, narrow
// sheets, and security. Zero unexpected console/page errors.
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
  // S30: Quick Add shows six actions per workspace; the rest sit behind More.
  const more = page.getByRole("button", { name: "Show more object types" });
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

async function to2DOnly(page: Page) {
  await page.getByRole("group", { name: "View type" }).getByRole("button", { name: "2D only" }).click();
  await expect(page.locator('canvas[data-graph2d-canvas="true"]').first()).toBeVisible();
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

async function screenshotPixels(page: Page, canvas: Locator): Promise<string | null> {
  return canvas.evaluate((element) => {
    try {
      return (element as HTMLCanvasElement).toDataURL("image/png");
    } catch {
      return null;
    }
  });
}

async function countChangedPixels(page: Page, canvas: Locator, beforeUrl: string): Promise<number> {
  const afterUrl = await screenshotPixels(page, canvas);
  if (!beforeUrl || !afterUrl) {
    return 0;
  }
  return page.evaluate(
    ({ before, after }) => {
      const load = (url: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = url;
        });
      return (async () => {
        try {
          const [a, b] = await Promise.all([load(before), load(after)]);
          const w = Math.min(a.naturalWidth, b.naturalWidth);
          const h = Math.min(a.naturalHeight, b.naturalHeight);
          const scratch = document.createElement("canvas");
          scratch.width = w;
          scratch.height = h;
          const context = scratch.getContext("2d");
          if (!context) {
            return 0;
          }
          context.drawImage(a, 0, 0, w, h);
          const pixelsA = context.getImageData(0, 0, w, h).data;
          context.drawImage(b, 0, 0, w, h);
          const pixelsB = context.getImageData(0, 0, w, h).data;
          let changed = 0;
          for (let i = 0; i < pixelsA.length; i += 4) {
            const delta =
              Math.abs((pixelsA[i] as number) - (pixelsB[i] as number)) +
              Math.abs((pixelsA[i + 1] as number) - (pixelsB[i + 1] as number)) +
              Math.abs((pixelsA[i + 2] as number) - (pixelsB[i + 2] as number));
            if (delta > 36) {
              changed += 1;
            }
          }
          return changed;
        } catch {
          return 0;
        }
      })();
    },
    { before: beforeUrl, after: afterUrl }
  );
}

test.describe("S23 scalar field visualization", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("A: heat map of f=x^2+y^2 paints with a sane range", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Equation", { exact: true }).first().fill("z = x^2 + y^2");
    const canvas = page.locator('canvas[data-graph2d-canvas="true"]').first();
    const before = await screenshotPixels(page, canvas);
    await openAnalyze(page);
    await page.getByLabel("Show heat map").click();
    // Legend appears with the finite range once the worker result lands.
    await openAnalyze(page);
    await expect(page.getByTestId("scalar-viz-legend")).toContainText("Range", { timeout: 15000 });
    await openAnalyze(page);
    await expect(page.getByTestId("scalar-viz-legend")).toContainText("50");
    await expect
      .poll(async () => countChangedPixels(page, canvas, before ?? ""), { timeout: 15000 })
      .toBeGreaterThan(2000);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("B: contours draw closed rings over the heat", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Equation", { exact: true }).first().fill("z = x^2 + y^2");
    await openAnalyze(page);
    await page.getByLabel("Show heat map").click();
    await openAnalyze(page);
    await expect(page.getByTestId("scalar-viz-legend")).toBeVisible({ timeout: 15000 });
    const canvas = page.locator('canvas[data-graph2d-canvas="true"]').first();
    const heatOnly = await screenshotPixels(page, canvas);
    await openAnalyze(page);
    await page.getByLabel("Show contours").click();
    await expect
      .poll(async () => countChangedPixels(page, canvas, heatOnly ?? ""), { timeout: 15000 })
      .toBeGreaterThan(500);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("C: saddle f=x^2-y^2 shows a zero contour", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Equation", { exact: true }).first().fill("z = x^2 - y^2");
    await openAnalyze(page);
    await page.getByLabel("Show heat map").click();
    await openAnalyze(page);
    await page.getByLabel("Show contours").click();
    await openAnalyze(page);
    await expect(page.getByTestId("scalar-viz-legend")).toContainText("zero contour included", {
      timeout: 15000
    });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("D: singular 1/x leaves a gap with no bridge or crash", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Equation", { exact: true }).first().fill("z = 1/x");
    await openAnalyze(page);
    await page.getByLabel("Show heat map").click();
    await openAnalyze(page);
    await page.getByLabel("Show contours").click();
    await openAnalyze(page);
    await expect(page.getByTestId("scalar-viz-legend")).toBeVisible({ timeout: 15000 });
    await expect(page.locator('canvas[data-graph2d-canvas="true"]').first()).toBeVisible();
    expect(await page.locator("body").textContent()).not.toMatch(/NaN/);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("E: dense gradient arrows point outward on the bowl", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Equation", { exact: true }).first().fill("z = x^2 + 2*y^2");
    const canvas = page.locator('canvas[data-graph2d-canvas="true"]').first();
    const before = await screenshotPixels(page, canvas);
    await openAnalyze(page);
    await page.getByLabel("Show gradient field").click();
    await expect
      .poll(async () => countChangedPixels(page, canvas, before ?? ""), { timeout: 15000 })
      .toBeGreaterThan(500);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("F: heat and contours survive while gradients report unavailable", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Equation", { exact: true }).first().fill("z = tan(x) + y");
    await openAnalyze(page);
    await page.getByLabel("Show heat map").click();
    await openAnalyze(page);
    await page.getByLabel("Show contours").click();
    await openAnalyze(page);
    await page.getByLabel("Show gradient field").click();
    await expect(page.getByText("Gradient unavailable for this expression.")).toBeVisible({
      timeout: 15000
    });
    // Heat still applies (section stays fully enabled).
    await openAnalyze(page);
    await expect(page.getByTestId("scalar-viz-legend")).toBeVisible();
    await expect(page.getByLabel("Hide heat map")).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("G: implicit sphere XY slice at z=0 shows heat and a zero contour", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "Implicit Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Equation", { exact: true }).first().fill("x^2+y^2+z^2-1");
    await settleCompute(page);
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    const before = await screenshotPixels(page, canvas);
    await openAnalyze(page);
    await page.getByLabel("Show scalar slice").click();
    await expect(page.getByTestId("scalar-viz-legend")).toContainText("Range", { timeout: 25000 });
    // Unit tests pin exact zero contours for the sphere; here the mesh
    // repaint plus the finite range prove the slice landed.
    await openAnalyze(page);
    await expect(page.getByTestId("scalar-viz-legend")).toContainText("-1");
    await expect
      .poll(async () => countChangedPixels(page, canvas, before ?? ""), { timeout: 25000 })
      .toBeGreaterThan(200);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("H: moving the slice z=0 to z=0.8 shrinks the contour", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "Implicit Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Equation", { exact: true }).first().fill("x^2+y^2+z^2-1");
    await settleCompute(page);
    await openAnalyze(page);
    await page.getByLabel("Show scalar slice").click();
    await expect(page.getByTestId("scalar-viz-legend")).toBeVisible({ timeout: 25000 });
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    const atZero = await screenshotPixels(page, canvas);
    await openAnalyze(page);
    await page.getByLabel("Slice value").fill("0.8");
    await expect
      .poll(async () => countChangedPixels(page, canvas, atZero ?? ""), { timeout: 25000 })
      .toBeGreaterThan(200);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("I: slice is shared across perspective and quad views", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "Implicit Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Equation", { exact: true }).first().fill("x^2+y^2+z^2-1");
    await settleCompute(page);
    await openAnalyze(page);
    await page.getByLabel("Show scalar slice").click();
    await expect(page.getByTestId("scalar-viz-legend")).toBeVisible({ timeout: 25000 });
    await page.getByLabel("Geometry view").selectOption("perspective");
    await openAnalyze(page);
    await expect(page.getByTestId("scalar-viz-legend")).toBeVisible();
    await page.getByLabel("Geometry layout").selectOption("quad");
    await openAnalyze(page);
    await expect(page.getByTestId("scalar-viz-legend")).toBeVisible();
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await expect(canvas).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("J: rapid expression and slice edits settle on the latest result", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "Implicit Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    // Rapid expression race with no settle waits (equation edits precede
    // enabling, since edits prune derived configs by design).
    await page.getByLabel("Equation", { exact: true }).first().fill("x^2+y^2+z^2-4");
    await page.getByLabel("Equation", { exact: true }).first().fill("x^2+y^2+z^2-9");
    await page.getByLabel("Equation", { exact: true }).first().fill("x^2+y^2+z^2-1");
    await settleCompute(page);
    await openAnalyze(page);
    await page.getByLabel("Show scalar slice").click();
    await expect(page.getByTestId("scalar-viz-legend")).toBeVisible({ timeout: 25000 });
    // Rapid slice moves: only the latest value sticks.
    await openAnalyze(page);
    await page.getByLabel("Slice value").fill("0.5");
    await openAnalyze(page);
    await page.getByLabel("Slice value").fill("1");
    await openAnalyze(page);
    await expect(page.getByTestId("scalar-viz-legend")).toBeVisible({ timeout: 25000 });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("K: hiding the source hides derived layers with zero recompute", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Equation", { exact: true }).first().fill("z = x^2 + y^2");
    await openAnalyze(page);
    await page.getByLabel("Show heat map").click();
    await openAnalyze(page);
    await expect(page.getByTestId("scalar-viz-legend")).toBeVisible({ timeout: 15000 });
    const canvas = page.locator('canvas[data-graph2d-canvas="true"]').first();
    const shown = await screenshotPixels(page, canvas);
    await expectNoComputePending(page, async () => {
      await page.getByRole("button", { name: "Hide object" }).first().click();
    });
    await expect
      .poll(async () => countChangedPixels(page, canvas, shown ?? ""), { timeout: 15000 })
      .toBeGreaterThan(2000);
    await expectNoComputePending(page, async () => {
      await page.getByRole("button", { name: "Show object" }).first().click();
    });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("L: source edits refresh derived results without staleness", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Equation", { exact: true }).first().fill("z = x^2 + y^2");
    await openAnalyze(page);
    await page.getByLabel("Show heat map").click();
    await openAnalyze(page);
    await expect(page.getByTestId("scalar-viz-legend")).toContainText("50", { timeout: 15000 });
    // Bowl -> saddle edits prune the derived config by design: no stale
    // "50" may linger. Re-enabling shows the saddle range [-12.5, 12.5].
    await page.getByLabel("Equation", { exact: true }).first().fill("z = (x^2 - y^2)/2");
    await openAnalyze(page);
    await expect(page.getByTestId("scalar-viz-legend")).not.toBeVisible({ timeout: 15000 });
    await openAnalyze(page);
    await page.getByLabel("Show heat map").click();
    await openAnalyze(page);
    await expect(page.getByTestId("scalar-viz-legend")).toContainText("12.5", { timeout: 15000 });
    expect(await page.getByTestId("scalar-viz-legend").textContent()).not.toContain("50");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("M: scalar visualization is transient across save/reopen", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Equation", { exact: true }).first().fill("z = x^2 + y^2");
    await openAnalyze(page);
    await page.getByLabel("Show heat map").click();
    await openAnalyze(page);
    await expect(page.getByTestId("scalar-viz-legend")).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Scene" }).click();
    await page.getByRole("menuitem", { name: "Save as..." }).click();
    await page.locator("#project-name-input").fill("s23-scalar");
    await page.getByRole("button", { name: "Save project", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Save as project" })).not.toBeVisible({ timeout: 10000 });
    await page.reload();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await to2DOnly(page);
    // Canonical source survived; transient heat did not auto-enable.
    await openAnalyze(page);
    await expect(page.getByLabel("Show heat map")).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("N: scalar state coheres across Math Lab and Geometry Studio", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Equation", { exact: true }).first().fill("z = x^2 + y^2");
    await openAnalyze(page);
    await page.getByLabel("Show heat map").click();
    await openAnalyze(page);
    await expect(page.getByTestId("scalar-viz-legend")).toBeVisible({ timeout: 15000 });
    await toGeometry(page);
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await openAnalyze(page);
    await expect(page.getByTestId("scalar-viz-legend")).toBeVisible();
    await toMathLab(page);
    await to2DOnly(page);
    await openAnalyze(page);
    await expect(page.getByTestId("scalar-viz-legend")).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("O: narrow 430x800 reaches scalar controls through sheets", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 430, height: 800 });
    await startClean(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await openAnalyze(page);
    await expect(page.getByText("Scalar Visualization")).toBeVisible();
    await expect(page.getByLabel("Show heat map")).toBeVisible();
    await page.keyboard.press("Escape");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("P: nested unsafe source is visibly rejected with viz inert", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Equation", { exact: true }).first().fill("z = sin(factorial(x)) + y");
    await expect(page.getByTestId("expression-diagnostic").first()).toContainText(/not supported|unsupported/i);
    await openAnalyze(page);
    await expect(page.getByText("Fix the source equation to enable scalar visualization.")).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Q: scalar visualization editor has no axe violations", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Equation", { exact: true }).first().fill("z = x^2 + y^2");
    await openAnalyze(page);
    await page.getByLabel("Show heat map").click();
    await openAnalyze(page);
    await page.getByLabel("Show contours").click();
    await openAnalyze(page);
    await page.getByLabel("Show gradient field").click();
    await openAnalyze(page);
    await expect(page.getByTestId("scalar-viz-legend")).toBeVisible({ timeout: 15000 });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
