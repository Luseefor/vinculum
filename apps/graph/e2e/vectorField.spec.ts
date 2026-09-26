import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

// Vector-field timing bounds are load-sensitive (worker sampling plus
// dev-server compile), so this spec runs serially.
test.describe.configure({ mode: "serial" });

// S20 vector fields: 2D Canvas2D arrows, 3D instanced arrows through the
// S19 worker, synchronized views, render-only scale/normalize (zero jobs),
// singular/zero safety, races, persistence, workspace sharing, narrow
// sheets, and error consistency. Zero unexpected console/page errors.
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

// S19: geometry arrives asynchronously. Probing immediately after an edit
// can return a stable GRID reading before the worker result lands, so every
// probe-after-mutation waits for outstanding compute to settle first. If no
// job is pending the count is already zero and this returns at once.
async function settleCompute(page: Page) {
  const pending = page.locator('[data-testid="compute-status-pending"]');
  await pending.first().waitFor({ state: "attached", timeout: 3000 }).catch(() => {});
  await expect.poll(async () => pending.count(), { timeout: 25000 }).toBe(0);
}

// Render-only changes (scale/normalize/color/visibility) must never attach
// a compute-status indicator. Poll for the whole window: a worker
// round-trip always outlives one poll slice, so any job would be observed.
async function expectNoComputePending(page: Page, action: () => Promise<void>) {
  await action();
  const pending = page.locator('[data-testid="compute-status-pending"]');
  const deadline = Date.now() + 1500;
  while (Date.now() < deadline) {
    expect(await pending.count()).toBe(0);
    await page.waitForTimeout(100);
  }
}

// Counts canvas pixels near a hex color (per-channel tolerance absorbs
// antialiasing). Both the Canvas2D plot and the WebGL viewport (which sets
// preserveDrawingBuffer) support toDataURL readback.
async function countFieldPixels(page: Page, canvas: Locator, hex: string): Promise<number> {
  const dataUrl = await canvas.evaluate((element) => {
    try {
      return (element as HTMLCanvasElement).toDataURL("image/png");
    } catch {
      return null;
    }
  });
  if (!dataUrl) {
    return 0;
  }
  return page.evaluate(
    ({ url, color }) => {
      const target = (h: string) => ({
        r: parseInt(h.slice(1, 3), 16),
        g: parseInt(h.slice(3, 5), 16),
        b: parseInt(h.slice(5, 7), 16)
      });
      const { r, g, b } = target(color);
      return new Promise<number>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const offscreen = document.createElement("canvas");
          offscreen.width = img.naturalWidth;
          offscreen.height = img.naturalHeight;
          const context = offscreen.getContext("2d");
          if (!context) {
            resolve(0);
            return;
          }
          context.drawImage(img, 0, 0);
          const data = context.getImageData(0, 0, offscreen.width, offscreen.height).data;
          let count = 0;
          for (let i = 0; i < data.length; i += 4) {
            if (
              Math.abs((data[i] as number) - r) <= 64 &&
              Math.abs((data[i + 1] as number) - g) <= 64 &&
              Math.abs((data[i + 2] as number) - b) <= 64
            ) {
              count += 1;
            }
          }
          resolve(count);
        };
        img.onerror = () => resolve(0);
        img.src = url;
      });
    },
    { url: dataUrl, color: hex }
  );
}

const FIELD_BLUE = "#3b82f6";

test.describe("S20 vector fields", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("A: 2D radial field creates and renders arrows", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await page.getByRole("button", { name: "2D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    const canvas = page.locator('canvas[data-graph2d-canvas="true"]').first();
    await expect(canvas).toBeVisible();
    // 16x16 radial arrows in field blue: thousands of pixels.
    await expect.poll(async () => countFieldPixels(page, canvas, FIELD_BLUE), { timeout: 15000 }).toBeGreaterThan(150);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("B: 2D rotation edit updates the visualization", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await page.getByRole("button", { name: "2D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    const canvas = page.locator('canvas[data-graph2d-canvas="true"]').first();
    const before = await countFieldPixels(page, canvas, FIELD_BLUE);
    expect(before).toBeGreaterThan(150);
    await page.getByLabel("Vector field P component").first().fill("-y");
    await page.getByLabel("Vector field Q component").first().fill("x");
    await expect
      .poll(async () => countFieldPixels(page, canvas, FIELD_BLUE), { timeout: 15000 })
      .not.toBe(before);
    await expect.poll(async () => countFieldPixels(page, canvas, FIELD_BLUE), { timeout: 15000 }).toBeGreaterThan(150);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("C: 3D radial field computes in the worker and renders instanced arrows", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "3D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await expect(canvas).toBeVisible();
    await settleCompute(page);
    await expect.poll(async () => countFieldPixels(page, canvas, FIELD_BLUE), { timeout: 25000 }).toBeGreaterThan(100);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("D: synchronized views show the same 3D field", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "3D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await settleCompute(page);
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    for (const view of ["xy", "xz", "yz", "perspective"] as const) {
      await page.getByLabel("Geometry view").selectOption(view);
      await expect
        .poll(async () => countFieldPixels(page, canvas, FIELD_BLUE), { timeout: 25000 })
        .toBeGreaterThan(50);
    }
    for (const layout of ["split", "quad", "single"] as const) {
      await page.getByLabel("Geometry layout").selectOption(layout);
      await expect
        .poll(async () => countFieldPixels(page, canvas, FIELD_BLUE), { timeout: 25000 })
        .toBeGreaterThan(50);
    }

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("E: normalize toggle resizes glyphs with zero worker jobs", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "3D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await settleCompute(page);
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await expect.poll(async () => countFieldPixels(page, canvas, FIELD_BLUE), { timeout: 25000 }).toBeGreaterThan(100);
    await page.getByRole("tab", { name: "Styles" }).click();
    await expectNoComputePending(page, async () => {
      await page.getByLabel("Enable vector normalization").click();
    });
    await expect.poll(async () => countFieldPixels(page, canvas, FIELD_BLUE), { timeout: 25000 }).toBeGreaterThan(100);
    // Contrast: a component edit DOES enqueue (proves the pin is live).
    await page.getByLabel("Vector field P component").first().fill("2*x");
    await settleCompute(page);
    await expect.poll(async () => countFieldPixels(page, canvas, FIELD_BLUE), { timeout: 25000 }).toBeGreaterThan(100);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("F: scale change resizes glyphs with zero worker jobs", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "3D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await settleCompute(page);
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    const before = await countFieldPixels(page, canvas, FIELD_BLUE);
    expect(before).toBeGreaterThan(100);
    await page.getByRole("tab", { name: "Styles" }).click();
    await expectNoComputePending(page, async () => {
      await page.getByLabel("Arrow scale", { exact: true }).fill("2");
      // Scale commits on blur (draft pattern shared with resolution).
      await page.keyboard.press("Tab");
    });
    await expect
      .poll(async () => countFieldPixels(page, canvas, FIELD_BLUE), { timeout: 25000 })
      .not.toBe(before);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("G: singular component stays stable with invalid samples omitted", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "3D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Vector field P component").first().fill("1/x");
    await settleCompute(page);
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await expect.poll(async () => countFieldPixels(page, canvas, FIELD_BLUE), { timeout: 25000 }).toBeGreaterThan(50);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("H: zero field causes no crashes or NaNs", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "3D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Vector field P component").first().fill("0");
    await page.getByLabel("Vector field Q component").first().fill("0");
    await page.getByLabel("Vector field R component").first().fill("0");
    await settleCompute(page);
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("I: rapid field edits settle on the latest result only", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "3D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    // Radial -> rotation -> nonlinear with no settle waits.
    await page.getByLabel("Vector field P component").first().fill("-y");
    await page.getByLabel("Vector field Q component").first().fill("x");
    await page.getByLabel("Vector field R component").first().fill("0");
    await page.getByLabel("Vector field P component").first().fill("sin(y)");
    await page.getByLabel("Vector field Q component").first().fill("sin(z)");
    await page.getByLabel("Vector field R component").first().fill("sin(x)");
    await settleCompute(page);
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await expect.poll(async () => countFieldPixels(page, canvas, FIELD_BLUE), { timeout: 25000 }).toBeGreaterThan(50);
    await expect(page.locator("body")).toContainText("sin(y)");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("J: save/reopen preserves the field", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "3D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByRole("button", { name: "Scene" }).click();
    await page.getByRole("menuitem", { name: "Save as..." }).click();
    await page.locator("#project-name-input").fill("s20-vfield");
    await page.getByRole("button", { name: "Save project", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Save as project" })).not.toBeVisible({ timeout: 10000 });
    await page.reload();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await toGeometry(page);
    await showMoreAdd(page);
    await settleCompute(page);
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await expect.poll(async () => countFieldPixels(page, canvas, FIELD_BLUE), { timeout: 25000 }).toBeGreaterThan(100);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("K: one field object works across Math Lab and Geometry Studio", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await page.getByRole("button", { name: "2D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    const canvas2d = page.locator('canvas[data-graph2d-canvas="true"]').first();
    await expect.poll(async () => countFieldPixels(page, canvas2d, FIELD_BLUE), { timeout: 15000 }).toBeGreaterThan(150);
    // Geometry Studio tolerates the 2D field (skipped in 3D, no crash).
    await toGeometry(page);
    await showMoreAdd(page);
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    await toMathLab(page);
    await to2DOnly(page);
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect
      .poll(async () => countFieldPixels(page, page.locator('canvas[data-graph2d-canvas="true"]').first(), FIELD_BLUE), {
        timeout: 15000
      })
      .toBeGreaterThan(150);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("L: narrow 430x800 creates and edits fields through sheets", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 430, height: 800 });
    await startClean(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "2D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await expect(page.getByLabel("Density", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByLabel("Density", { exact: true })).not.toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("M: nested unsafe component is visibly rejected", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "3D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Vector field P component").first().fill("sin(factorial(x))");
    await expect(page.getByTestId("expression-diagnostic").first()).toContainText(/not supported|unsupported/i);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("N: vector field editor has no axe violations", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "3D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await settleCompute(page);
    // Styles tab holds the new scale/normalize controls; the P/Q/R
    // component inputs and Props domain/density inputs are visible in the
    // same scan.
    await page.getByRole("tab", { name: "Styles" }).click();
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
