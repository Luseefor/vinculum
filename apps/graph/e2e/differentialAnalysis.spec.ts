import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

// Analysis timing bounds are load-sensitive (worker sampling plus
// dev-server compile), so this spec runs serially.
test.describe.configure({ mode: "serial" });

// S21 differential analysis: pick-to-point workflow on explicit and
// implicit surfaces, Inspector gradient/normal/plane values, derived
// overlays in synchronized views, zero-job overlay controls, source-edit
// invalidation, pending-worker protection, singular safety, visibility,
// deletion, workspace coherence, narrow sheets, and error consistency.
// Zero unexpected console/page errors.
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

// Overlay-only changes must never attach a compute-status indicator.
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

// Theme-agnostic overlay signal: counts pixels that changed between two
// canvas captures (the translucent patch + normal arrow always repaint
// hundreds of pixels, whatever the theme or source color).
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

async function openAnalysisSection(page: Page) {
  await expect(page.getByText("Differential Analysis").first()).toBeVisible({ timeout: 10000 });
}

async function pickCenter(page: Page, canvas: Locator) {
  await page.getByRole("button", { name: "Pick analysis point on surface" }).click();
  await canvas.click();
}

async function pickAt(page: Page, canvas: Locator, fx: number, fy: number) {
  await page.getByRole("button", { name: "Pick analysis point on surface" }).click();
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error("canvas has no box");
  }
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}

test.describe("S21 differential analysis", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("A: explicit surface pick shows partials, normal, and overlays", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Equation", { exact: true }).first().fill("z = x^2 + 2*y^2");
    await openAnalysisSection(page);
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    const before = await screenshotPixels(page, canvas);
    // The paraboloid bowl fills the upper viewport; the center pixel is
    // grid. Click upper-middle to land on the surface.
    await pickAt(page, canvas, 0.5, 0.28);
    // Point, gradient/normal, and tangent equation appear.
    await expect(page.getByText(/^P = \(/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Gradient \/ Normal = </)).toBeVisible();
    await expect(page.getByText(/Tangent:/)).toBeVisible();
    // The patch + normal arrow repaint the viewport.
    await expect
      .poll(async () => countChangedPixels(page, canvas, before ?? ""), { timeout: 15000 })
      .toBeGreaterThan(200);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("B: implicit sphere pick yields a finite gradient and tangent", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Implicit Sphere", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await settleCompute(page);
    await openAnalysisSection(page);
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    const before = await screenshotPixels(page, canvas);
    await pickCenter(page, canvas);
    await expect(page.getByText(/^P = \(/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Gradient \/ Normal = </)).toBeVisible();
    await expect
      .poll(async () => countChangedPixels(page, canvas, before ?? ""), { timeout: 15000 })
      .toBeGreaterThan(200);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("C: overlays persist across synchronized views", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Implicit Sphere", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await settleCompute(page);
    await openAnalysisSection(page);
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await pickCenter(page, canvas);
    await expect(page.getByText(/^P = \(/)).toBeVisible({ timeout: 10000 });
    // Record coherence across every synchronized view (same analysis
    // state drives all panes; the scene is shared, never per-pane).
    for (const view of ["xy", "xz", "yz", "perspective"] as const) {
      await page.getByLabel("Geometry view").selectOption(view);
      await expect(page.getByText(/^P = \(/)).toBeVisible();
      await expect(page.getByText(/Gradient \/ Normal = </)).toBeVisible();
    }
    // Overlay presence in perspective (patch faces the camera here)...
    await page.getByLabel("Geometry view").selectOption("perspective");
    const shown = await screenshotPixels(page, canvas);
    await page.getByLabel("Hide tangent plane").click();
    await expect
      .poll(async () => countChangedPixels(page, canvas, shown ?? ""), { timeout: 15000 })
      .toBeGreaterThan(200);
    await page.getByLabel("Show tangent plane").click();
    // ...and in quad (one shared overlayRoot, four panes, zero duplication).
    await page.getByLabel("Geometry layout").selectOption("quad");
    const quadShown = await screenshotPixels(page, canvas);
    await page.getByLabel("Hide tangent plane").click();
    await expect
      .poll(async () => countChangedPixels(page, canvas, quadShown ?? ""), { timeout: 15000 })
      .toBeGreaterThan(200);
    await page.getByLabel("Show tangent plane").click();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("D: overlay toggles change nothing but overlays (zero jobs)", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Implicit Sphere", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await settleCompute(page);
    await openAnalysisSection(page);
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await pickCenter(page, canvas);
    await expect(page.getByText(/^P = \(/)).toBeVisible({ timeout: 10000 });
    const withOverlays = await screenshotPixels(page, canvas);
    await expectNoComputePending(page, async () => {
      await page.getByLabel("Hide tangent plane").click();
    });
    await expect
      .poll(async () => countChangedPixels(page, canvas, withOverlays ?? ""), { timeout: 15000 })
      .toBeGreaterThan(200);
    await expectNoComputePending(page, async () => {
      await page.getByLabel("Show tangent plane").click();
    });
    await expectNoComputePending(page, async () => {
      await page.getByLabel("Hide normal arrow").click();
    });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("E: source edit invalidates analysis with no stale overlay", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Implicit Sphere", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await settleCompute(page);
    await openAnalysisSection(page);
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await pickCenter(page, canvas);
    await expect(page.getByText(/^P = \(/)).toBeVisible({ timeout: 10000 });
    // Structural edit: values vanish, empty pick state returns.
    await page.getByLabel("Equation", { exact: true }).first().fill("x^2 + y^2 + z^2 = 4");
    await expect(page.getByText("Pick a point on the surface.")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/^P = \(/)).not.toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("F: pending worker blocks analysis of the new structure", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Implicit Sphere", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await settleCompute(page);
    await openAnalysisSection(page);
    // Heavy edit at max resolution: the worker stays busy for seconds.
    await page.getByLabel("Equation", { exact: true }).first().fill("sin(x)*cos(y) + sin(y)*cos(z) + sin(z)*cos(x) = 0");
    await page.getByLabel("Resolution", { exact: true }).first().fill("48");
    // While pending, Pick stays disabled with an updating hint.
    await expect(page.getByRole("button", { name: "Pick analysis point on surface" })).toBeDisabled({ timeout: 15000 });
    await settleCompute(page);
    // Settled: picking works again.
    await expect(page.getByRole("button", { name: "Pick analysis point on surface" })).toBeEnabled({ timeout: 15000 });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("G: singular implicit case stays safe with a clear state", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Implicit Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Equation", { exact: true }).first().fill("x^2+y^2-z^2=0");
    await settleCompute(page);
    await openAnalysisSection(page);
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await pickCenter(page, canvas);
    // Either a finite near-apex analysis or the zero-gradient diagnostic:
    // both are safe, NaN-free outcomes (mesh tolerance decides which).
    await expect(
      page.getByText(/^P = \(/).or(page.getByText(/gradient is zero/))
    ).toBeVisible({ timeout: 10000 });
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toMatch(/NaN/);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("H: hiding the source hides overlays and keeps the record", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Implicit Sphere", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await settleCompute(page);
    await openAnalysisSection(page);
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await pickCenter(page, canvas);
    await expect(page.getByText(/^P = \(/)).toBeVisible({ timeout: 10000 });
    const shown = await screenshotPixels(page, canvas);
    // Hide via the row visibility toggle.
    await page.getByRole("button", { name: "Hide object" }).first().click();
    await expect
      .poll(async () => countChangedPixels(page, canvas, shown ?? ""), { timeout: 15000 })
      .toBeGreaterThan(2000);
    // Values stay (record retained); unhide restores without re-pick.
    await expect(page.getByText(/^P = \(/)).toBeVisible();
    await page.getByRole("button", { name: "Show object" }).first().click();
    await expect
      .poll(async () => countChangedPixels(page, canvas, shown ?? ""), { timeout: 15000 })
      .toBeLessThan(200);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("I: deleting the source removes the overlay immediately", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Implicit Sphere", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await settleCompute(page);
    await openAnalysisSection(page);
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await pickCenter(page, canvas);
    await expect(page.getByText(/^P = \(/)).toBeVisible({ timeout: 10000 });
    await page.locator('[aria-label^="Selected "]').first().click();
    await page.keyboard.press("Backspace");
    await expect(page.getByTestId("scene-object-count")).toHaveText("0");
    await expect(page.getByText("Differential Analysis")).not.toBeVisible();
    await expect(page.getByText(/^P = \(/)).not.toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("J: analysis coheres across Math Lab and Geometry Studio", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Implicit Sphere", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await settleCompute(page);
    await openAnalysisSection(page);
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await pickCenter(page, canvas);
    await expect(page.getByText(/^P = \(/)).toBeVisible({ timeout: 10000 });
    await toMathLab(page);
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByText(/^P = \(/)).toBeVisible();
    await toGeometry(page);
    await expect(page.getByText(/^P = \(/)).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("K: narrow 430x800 reaches analysis controls through sheets", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 430, height: 800 });
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Implicit Sphere", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await expect(page.getByText("Differential Analysis")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pick analysis point on surface" })).toBeVisible();
    await page.keyboard.press("Escape");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("L: nested unsafe source stays rejected with analysis inert", async ({ page }) => {    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Implicit Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Equation", { exact: true }).first().fill("sin(factorial(x)) + y + z = 0");
    await expect(page.getByTestId("expression-diagnostic").first()).toContainText(/not supported|unsupported/i);
    await openAnalysisSection(page);
    await expect(page.getByRole("button", { name: "Pick analysis point on surface" })).toBeDisabled();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("M: analysis editor has no axe violations", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Implicit Sphere", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await settleCompute(page);
    await openAnalysisSection(page);
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await pickCenter(page, canvas);
    await expect(page.getByText(/^P = \(/)).toBeVisible({ timeout: 10000 });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
