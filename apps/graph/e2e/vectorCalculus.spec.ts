import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

// S22 timing bounds are load-sensitive (worker sampling plus dev-server
// compile), so this spec runs serially.
test.describe.configure({ mode: "serial" });

// S22 vector calculus: pointwise Jacobian/divergence/curl for 2D+3D
// fields, parameterized live recompute, render-only independence, source
// invalidation, unsupported isolation, directional derivatives, curl
// overlays in synchronized views, lifecycle clearing, narrow sheets, and
// security. Zero unexpected console/page errors.
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

async function openAnalyze(page: Page) {
  // S30: analysis sections live under the Analyze tab. Guarded so sheet
  // flows and Object-tab assertions never trip on the navigation itself.
  const tab = page.getByRole("tab", { name: "Analyze" });
  if ((await tab.count()) > 0 && (await tab.first().isVisible())) {
    await tab.first().click();
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

async function setAnalysisPoint(page: Page, point: { x: number; y?: number; z?: number }) {
  await openAnalyze(page);
  await page.getByLabel("Analysis point x").fill(String(point.x));
  if (point.y !== undefined) {
    await page.getByLabel("Analysis point y").fill(String(point.y));
  }
  if (point.z !== undefined) {
    const zInput = page.getByLabel("Analysis point z");
    if ((await zInput.count()) > 0) {
      await zInput.fill(String(point.z));
    }
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

test.describe("S22 vector calculus", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("A: 2D radial field reports J=I, div=2, scalar curl=0", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await page.getByRole("button", { name: "2D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-section")).toBeVisible();
    await expectNoComputePending(page, async () => {
      await setAnalysisPoint(page, { x: 1, y: 2 });
    });
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-divergence")).toContainText("2", { timeout: 10000 });
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-curl")).toContainText("0");
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-jacobian")).toContainText("1");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("B: 2D rotation reports div=0, scalar curl=2", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await page.getByRole("button", { name: "2D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Vector field P component").first().fill("-y");
    await page.getByLabel("Vector field Q component").first().fill("x");
    await setAnalysisPoint(page, { x: 1, y: 2 });
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-divergence")).toContainText("0", { timeout: 10000 });
    // Scalar curl = Qx - Py = 1 - (-1) = 2.
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-curl")).toContainText("2");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("C: 3D radial field reports J=I, div=3, curl=0", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "3D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await settleCompute(page);
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-section")).toBeVisible();
    await expectNoComputePending(page, async () => {
      await setAnalysisPoint(page, { x: 1, y: 2, z: 1 });
    });
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-divergence")).toContainText("3", { timeout: 10000 });
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-curl")).toContainText("0");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("D: 3D rotation reports curl=<0,0,2> with optional overlay", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "3D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Vector field P component").first().fill("-y");
    await page.getByLabel("Vector field Q component").first().fill("x");
    await page.getByLabel("Vector field R component").first().fill("0");
    await settleCompute(page);
    await setAnalysisPoint(page, { x: 1, y: 1, z: 1 });
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-divergence")).toContainText("0", { timeout: 10000 });
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-curl")).toContainText("2");
    // Curl overlay defaults off; enabling repaints but enqueues no jobs.
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    const before = await screenshotPixels(page, canvas);
    await expectNoComputePending(page, async () => {
      await openAnalyze(page);
      await page.getByLabel("Show curl vector").click();
    });
    await expect
      .poll(async () => countChangedPixels(page, canvas, before ?? ""), { timeout: 15000 })
      .toBeGreaterThan(100);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("E: parameterized field updates live with zero point re-pick", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "3D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    // Default params include r=2.5: F=<r*x,y,z> has div=r+2=4.5.
    await page.getByLabel("Vector field P component").first().fill("r*x");
    await settleCompute(page);
    await setAnalysisPoint(page, { x: 0, y: 0, z: 0 });
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-divergence")).toContainText("4.5", { timeout: 10000 });
    // Parameter value change recomputes at the same point (no repick):
    // drive the real PARAMETERS slider (bottom panel), zero worker jobs.
    await page.getByRole("button", { name: "PARAMETERS" }).click();
    const slider = page.getByLabel("Parameter r");
    await expect(slider).toBeVisible();
    await slider.evaluate((element, value) => {
      const input = element as HTMLInputElement;
      input.focus();
      // React listens for the native value setter: assigning .value
      // directly bypasses it, so invoke the prototype setter instead.
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (setter) {
        setter.call(input, String(value));
      } else {
        input.value = String(value);
      }
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, "4");
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-divergence")).toContainText("6", { timeout: 10000 });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("F: render-only changes keep calculus correct with zero jobs", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "3D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await settleCompute(page);
    await setAnalysisPoint(page, { x: 1, y: 1, z: 1 });
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-divergence")).toContainText("3", { timeout: 10000 });
    await page.getByRole("tab", { name: "Styles" }).click();
    await expectNoComputePending(page, async () => {
      await page.getByLabel("Enable vector normalization").click();
    });
    await expectNoComputePending(page, async () => {
      await page.getByLabel("Arrow scale", { exact: true }).fill("2");
      await page.keyboard.press("Tab");
    });
    // S30: Vector Calculus lives in the Analyze tab: return there to
    // verify the render-only edits left the mathematics untouched.
    await page.getByRole("tab", { name: "Analyze" }).click();
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-divergence")).toContainText("3");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("G: source edit radial→rotational changes analysis immediately", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await page.getByRole("button", { name: "2D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await setAnalysisPoint(page, { x: 1, y: 1 });
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-divergence")).toContainText("2", { timeout: 10000 });
    await page.getByLabel("Vector field P component").first().fill("-y");
    await page.getByLabel("Vector field Q component").first().fill("x");
    // Math edit invalidates the record: the stale radial values vanish
    // immediately (no stale display), then re-setting the same point shows
    // the rotational analysis (div 0, curl 2).
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-divergence")).not.toBeVisible({ timeout: 10000 });
    await setAnalysisPoint(page, { x: 1, y: 1 });
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-divergence")).toContainText("0", { timeout: 10000 });
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-curl")).toContainText("2");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("H: unsupported derivative stays unavailable while the field renders", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await page.getByRole("button", { name: "2D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Vector field P component").first().fill("tan(x)");
    await setAnalysisPoint(page, { x: 0.5, y: 1 });
    await expect(page.getByText("unavailable").first()).toBeVisible({ timeout: 10000 });
    const canvas = page.locator('canvas[data-graph2d-canvas="true"]').first();
    await expect(canvas).toBeVisible();
    expect(await page.locator("body").textContent()).not.toMatch(/NaN/);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("I: directional derivative follows D_u f at the picked point", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Equation", { exact: true }).first().fill("z = x^2 + 2*y^2");
    await openAnalyze(page);
    await expect(page.getByText("Differential Analysis")).toBeVisible();
    // Pick-to-point workflow (same as S21): the paraboloid bowl fills the
    // upper viewport, so upper-middle lands on the surface.
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await openAnalyze(page);
    await page.getByRole("button", { name: "Pick analysis point on surface" }).click();
    const box = await canvas.boundingBox();
    if (!box) {
      throw new Error("canvas has no box");
    }
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.28);
    await expect(page.getByText(/^P = \(/)).toBeVisible({ timeout: 10000 });
    // Read the picked point, then verify D along <3,4> matches
    // ∇f·û = (2x*0.6 + 4y*0.8) for f=x^2+2y^2 (unit-test pins 7.6 at (1,2)).
    const pointText = await page.getByText(/^P = \(/).textContent();
    const numbers = (pointText ?? "").match(/-?\d+(\.\d+)?(e-?\d+)?/gi)?.map(Number) ?? [];
    expect(numbers.length).toBeGreaterThanOrEqual(2);
    const [px, py] = numbers as [number, number];
    const expected = 2 * px * 0.6 + 4 * py * 0.8;
    await page.getByLabel("Direction x").fill("3");
    await page.getByLabel("Direction y").fill("4");
    const valueText = await page.getByTestId("directional-derivative-value").textContent();
    const actual = Number((valueText ?? "").match(/-?\d+(\.\d+)?(e-?\d+)?/i)?.[0]);
    expect(Number.isFinite(actual)).toBe(true);
    expect(Math.abs(actual - expected)).toBeLessThan(0.05);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("J: zero direction is a compact diagnostic with no NaN", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Equation", { exact: true }).first().fill("z = x^2 + 2*y^2");
    await openAnalyze(page);
    await expect(page.getByText("Differential Analysis")).toBeVisible();
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await openAnalyze(page);
    await page.getByRole("button", { name: "Pick analysis point on surface" }).click();
    const box = await canvas.boundingBox();
    if (!box) {
      throw new Error("canvas has no box");
    }
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.28);
    await expect(page.getByText(/^P = \(/)).toBeVisible({ timeout: 10000 });
    await page.getByLabel("Direction x").fill("0");
    await page.getByLabel("Direction y").fill("0");
    await expect(page.getByText("Direction must be nonzero.")).toBeVisible({ timeout: 10000 });
    expect(await page.locator("body").textContent()).not.toMatch(/NaN/);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("K: curl overlay appears in perspective and quad from one shared root", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "3D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Vector field P component").first().fill("-y");
    await page.getByLabel("Vector field Q component").first().fill("x");
    await page.getByLabel("Vector field R component").first().fill("0");
    await settleCompute(page);
    await setAnalysisPoint(page, { x: 1, y: 1, z: 1 });
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-curl")).toContainText("2", { timeout: 10000 });
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await page.getByLabel("Geometry view").selectOption("perspective");
    const before = await screenshotPixels(page, canvas);
    await openAnalyze(page);
    await page.getByLabel("Show curl vector").click();
    await expect
      .poll(async () => countChangedPixels(page, canvas, before ?? ""), { timeout: 15000 })
      .toBeGreaterThan(100);
    await page.getByLabel("Geometry layout").selectOption("quad");
    const quadShown = await screenshotPixels(page, canvas);
    await page.getByLabel("Hide curl vector").click();
    await expect
      .poll(async () => countChangedPixels(page, canvas, quadShown ?? ""), { timeout: 15000 })
      .toBeGreaterThan(100);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("L: delete clears vector analysis (kind switch pinned by unit tests)", async ({ page }) => {
    // Kind/dimension-switch clearing is pinned by vectorAnalysisState unit
    // tests (store transitions); this test covers the user-facing delete
    // path end to end.
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "3D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await settleCompute(page);
    await setAnalysisPoint(page, { x: 1, y: 1, z: 1 });
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-jacobian")).toBeVisible({ timeout: 10000 });
    await page.locator('[aria-label^="Selected "]').first().click();
    await page.keyboard.press("Backspace");
    await expect(page.getByTestId("scene-object-count")).toHaveText("0");
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-section")).not.toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("M: narrow 430x800 reaches calculus controls through sheets", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 430, height: 800 });
    await startClean(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "2D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-section")).toBeVisible();
    await expect(page.getByLabel("Analysis point x")).toBeVisible();
    await page.keyboard.press("Escape");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("N: nested unsafe component is visibly rejected with calculus inert", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "3D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Vector field P component").first().fill("sin(factorial(x))");
    await expect(page.getByTestId("expression-diagnostic").first()).toContainText(/not supported|unsupported/i);
    await openAnalyze(page);
    await expect(page.getByText("Field has errors")).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("P: 2D analysis survives the running 3D tick (S22-R1)", async ({ page }) => {
    // The curl overlay sync sees every record but must never clear 2D
    // ones: a 2D field analyzed in Math Lab keeps its Inspector values
    // after switching to Geometry Studio (3D engine ticking, 2D field
    // skipped in 3D with no crash — S20 test K tolerance).
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await page.getByRole("button", { name: "2D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await setAnalysisPoint(page, { x: 1, y: 2 });
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-divergence")).toContainText("2", { timeout: 10000 });
    await toGeometry(page);
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    await page.waitForTimeout(2000);
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-divergence")).toContainText("2", { timeout: 10000 });
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-curl")).toContainText("0");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("O: vector calculus editor has no axe violations", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "3D Vector Field", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await settleCompute(page);
    await setAnalysisPoint(page, { x: 1, y: 1, z: 1 });
    await openAnalyze(page);
    await expect(page.getByTestId("vector-calculus-jacobian")).toBeVisible({ timeout: 10000 });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
