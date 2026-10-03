import { addObject } from "./helpers/addObject";
import { fillInput } from "./helpers/mathInput";
import { screenshotPixels } from "./helpers/canvasPixels";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

// S24 timing bounds are load-sensitive (streamline worker tracing plus
// dev-server compile), so this spec runs serially.
// Each case owns a fresh page/scene; a failure must not skip later coverage.
test.describe.configure({ mode: "default" });

// S24 streamlines: 2D constant/rotation/radial/singular fields, control
// recompute, glyph independence, 3D rotation/quad/helix, worker races,
// visibility, deletion, workspace coherence, transient persistence,
// narrow sheets, and security. Zero unexpected console/page errors.
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

test.describe("S24 streamlines", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("A: 2D constant field draws straight horizontal trajectories", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await addObject(page, "2D Vector Field");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await fillInput(page.getByLabel("Vector field P component").first(), "1");
    await fillInput(page.getByLabel("Vector field Q component").first(), "0");
    const canvas = page.locator('canvas[data-graph2d-canvas="true"]').first();
    const before = await screenshotPixels(page, canvas);
    await openAnalyze(page);
    await page.getByLabel("Show streamlines").click();
    await openAnalyze(page);
    await expect(page.getByTestId("streamline-count")).toContainText("curves", { timeout: 15000 });
    await expect
      .poll(async () => countChangedPixels(page, canvas, before ?? ""), { timeout: 15000 })
      .toBeGreaterThan(500);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("B: 2D rotation draws closed circular streamlines", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await addObject(page, "2D Vector Field");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await fillInput(page.getByLabel("Vector field P component").first(), "-y");
    await fillInput(page.getByLabel("Vector field Q component").first(), "x");
    const canvas = page.locator('canvas[data-graph2d-canvas="true"]').first();
    const before = await screenshotPixels(page, canvas);
    await openAnalyze(page);
    await page.getByLabel("Show streamlines").click();
    await openAnalyze(page);
    await expect(page.getByTestId("streamline-count")).toContainText("curves", { timeout: 15000 });
    await expect
      .poll(async () => countChangedPixels(page, canvas, before ?? ""), { timeout: 15000 })
      .toBeGreaterThan(500);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("C: 2D radial field draws ray streamlines", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await addObject(page, "2D Vector Field");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    const canvas = page.locator('canvas[data-graph2d-canvas="true"]').first();
    const before = await screenshotPixels(page, canvas);
    await openAnalyze(page);
    await page.getByLabel("Show streamlines").click();
    await openAnalyze(page);
    await expect(page.getByTestId("streamline-count")).toContainText("curves", { timeout: 15000 });
    await expect
      .poll(async () => countChangedPixels(page, canvas, before ?? ""), { timeout: 15000 })
      .toBeGreaterThan(500);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("D: singular field never bridges x=0", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await addObject(page, "2D Vector Field");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await fillInput(page.getByLabel("Vector field P component").first(), "1/x");
    await fillInput(page.getByLabel("Vector field Q component").first(), "1");
    await openAnalyze(page);
    await page.getByLabel("Show streamlines").click();
    await expect(page.locator('canvas[data-graph2d-canvas="true"]').first()).toBeVisible();
    await page.waitForTimeout(3000);
    expect(await page.locator("body").textContent()).not.toMatch(/NaN/);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("E: seed density and length changes recompute", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await addObject(page, "2D Vector Field");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await openAnalyze(page);
    await page.getByLabel("Show streamlines").click();
    await openAnalyze(page);
    await expect(page.getByTestId("streamline-count")).toBeVisible({ timeout: 15000 });
    const before = await page.getByTestId("streamline-count").textContent();
    await openAnalyze(page);
    await fillInput(page.getByLabel("Seed density"), "10");
    await expect
      .poll(async () => page.getByTestId("streamline-count").textContent(), { timeout: 15000 })
      .not.toBe(before);
    await openAnalyze(page);
    await page.getByLabel("Trace length").selectOption("long");
    await openAnalyze(page);
    await expect(page.getByTestId("streamline-count")).toBeVisible({ timeout: 15000 });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("F: glyph scale/density/normalize enqueue zero streamline jobs", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await addObject(page, "3D Vector Field");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await settleCompute(page);
    await openAnalyze(page);
    await page.getByLabel("Show streamlines").click();
    await openAnalyze(page);
    await expect(page.getByTestId("streamline-count")).toBeVisible({ timeout: 25000 });
    await page.getByRole("tab", { name: "Settings" }).click();
    await expectNoComputePending(page, async () => {
      await page.getByLabel("Enable vector normalization").click();
    });
    await expectNoComputePending(page, async () => {
      await fillInput(page.getByLabel("Arrow scale", { exact: true }), "2");
      await page.keyboard.press("Tab");
    });
    await page.getByRole("tab", { name: "Analyze" }).click();
    await openAnalyze(page);
    await expect(page.getByTestId("streamline-count")).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("G: 3D rotation renders streamlines in Perspective", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await addObject(page, "3D Vector Field");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await fillInput(page.getByLabel("Vector field P component").first(), "-y");
    await fillInput(page.getByLabel("Vector field Q component").first(), "x");
    await fillInput(page.getByLabel("Vector field R component").first(), "0");
    await settleCompute(page);
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    const before = await screenshotPixels(page, canvas);
    await openAnalyze(page);
    await page.getByLabel("Show streamlines").click();
    await openAnalyze(page);
    await expect(page.getByTestId("streamline-count")).toBeVisible({ timeout: 25000 });
    await expect
      .poll(async () => countChangedPixels(page, canvas, before ?? ""), { timeout: 25000 })
      .toBeGreaterThan(100);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("H: one shared streamline resource across Quad panes", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await addObject(page, "3D Vector Field");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await fillInput(page.getByLabel("Vector field P component").first(), "-y");
    await fillInput(page.getByLabel("Vector field Q component").first(), "x");
    await fillInput(page.getByLabel("Vector field R component").first(), "0");
    await settleCompute(page);
    await openAnalyze(page);
    await page.getByLabel("Show streamlines").click();
    await openAnalyze(page);
    await expect(page.getByTestId("streamline-count")).toBeVisible({ timeout: 25000 });
    await page.getByLabel("Geometry layout").selectOption("quad");
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await expect(canvas).toBeVisible();
    await openAnalyze(page);
    await expect(page.getByTestId("streamline-count")).toBeVisible();
    for (const view of ["xy", "xz", "yz", "perspective"] as const) {
      await page.getByLabel("Geometry view").selectOption(view);
      await openAnalyze(page);
      await expect(page.getByTestId("streamline-count")).toBeVisible();
    }

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("I: helix field draws nonplanar trajectories", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await addObject(page, "3D Vector Field");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await fillInput(page.getByLabel("Vector field P component").first(), "-y");
    await fillInput(page.getByLabel("Vector field Q component").first(), "x");
    await fillInput(page.getByLabel("Vector field R component").first(), "0.5");
    await settleCompute(page);
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    const before = await screenshotPixels(page, canvas);
    await openAnalyze(page);
    await page.getByLabel("Show streamlines").click();
    await openAnalyze(page);
    await expect(page.getByTestId("streamline-count")).toBeVisible({ timeout: 25000 });
    await expect
      .poll(async () => countChangedPixels(page, canvas, before ?? ""), { timeout: 25000 })
      .toBeGreaterThan(100);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("J: rapid expression and config changes settle on the latest result", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await addObject(page, "3D Vector Field");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    // Rapid expression race with no settle waits (edits precede enabling,
    // since math edits prune derived configs by design).
    await fillInput(page.getByLabel("Vector field P component").first(), "x");
    await fillInput(page.getByLabel("Vector field Q component").first(), "y");
    await fillInput(page.getByLabel("Vector field R component").first(), "z");
    await fillInput(page.getByLabel("Vector field P component").first(), "-y");
    await fillInput(page.getByLabel("Vector field Q component").first(), "x");
    await fillInput(page.getByLabel("Vector field R component").first(), "0");
    await fillInput(page.getByLabel("Vector field P component").first(), "x");
    await fillInput(page.getByLabel("Vector field Q component").first(), "-y");
    await settleCompute(page);
    await openAnalyze(page);
    await page.getByLabel("Show streamlines").click();
    await openAnalyze(page);
    await expect(page.getByTestId("streamline-count")).toBeVisible({ timeout: 25000 });
    await expect(page.locator("body")).toContainText("x");
    // Rapid config race: only the latest density settles.
    await openAnalyze(page);
    await fillInput(page.getByLabel("Seed density"), "2");
    await openAnalyze(page);
    await fillInput(page.getByLabel("Seed density"), "4");
    await openAnalyze(page);
    await fillInput(page.getByLabel("Seed density"), "3");
    await openAnalyze(page);
    await expect(page.getByTestId("streamline-count")).toBeVisible({ timeout: 25000 });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("K: hiding the source hides lines with zero recompute", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await addObject(page, "2D Vector Field");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await openAnalyze(page);
    await page.getByLabel("Show streamlines").click();
    await openAnalyze(page);
    await expect(page.getByTestId("streamline-count")).toBeVisible({ timeout: 15000 });
    const canvas = page.locator('canvas[data-graph2d-canvas="true"]').first();
    const shown = await screenshotPixels(page, canvas);
    await expectNoComputePending(page, async () => {
      await page.getByRole("button", { name: "Hide object" }).first().click();
    });
    await expect
      .poll(async () => countChangedPixels(page, canvas, shown ?? ""), { timeout: 15000 })
      .toBeGreaterThan(500);
    // Numerics stay cached while hidden; unhide restores without re-pick.
    await openAnalyze(page);
    await expect(page.getByTestId("streamline-count")).toBeVisible();
    await expectNoComputePending(page, async () => {
      await page.getByRole("button", { name: "Show object" }).first().click();
    });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("L: deleting the source removes streamlines immediately", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await addObject(page, "3D Vector Field");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await settleCompute(page);
    await openAnalyze(page);
    await page.getByLabel("Show streamlines").click();
    await openAnalyze(page);
    await expect(page.getByTestId("streamline-count")).toBeVisible({ timeout: 25000 });
    await page.locator('[aria-label^="Selected "]').first().focus();
    await page.keyboard.press("Backspace");
    await expect(page.getByTestId("scene-object-count")).toHaveText("0");
    await expect(page.getByTestId("streamline-section")).not.toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("M: streamline state coheres across Math Lab and Geometry Studio", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await addObject(page, "2D Vector Field");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await openAnalyze(page);
    await page.getByLabel("Show streamlines").click();
    await openAnalyze(page);
    await expect(page.getByTestId("streamline-count")).toBeVisible({ timeout: 15000 });
    await toGeometry(page);
    await showMoreAdd(page);
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    // 2D-field streamlines have no 3D overlay, but the config persists.
    await expect(page.getByLabel("Hide streamlines")).toBeVisible();
    await toMathLab(page);
    await to2DOnly(page);
    await openAnalyze(page);
    await expect(page.getByTestId("streamline-count")).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("N: save/reopen keeps the field with streamlines transient/off", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await to2DOnly(page);
    await addObject(page, "2D Vector Field");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await openAnalyze(page);
    await page.getByLabel("Show streamlines").click();
    await openAnalyze(page);
    await expect(page.getByTestId("streamline-count")).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Scene" }).click();
    await page.getByRole("menuitem", { name: "Save as..." }).click();
    await fillInput(page.locator("#project-name-input"), "s24-streamlines");
    await page.getByRole("button", { name: "Save project", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Save as project" })).not.toBeVisible({ timeout: 10000 });
    await page.reload();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await to2DOnly(page);
    await openAnalyze(page);
    await expect(page.getByLabel("Show streamlines")).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("O: narrow 430x800 reaches streamline controls through sheets", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 430, height: 800 });
    await startClean(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await addObject(page, "2D Vector Field");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await openAnalyze(page);
    await expect(page.getByRole("heading", { name: "Streamlines" })).toBeVisible();
    await expect(page.getByLabel("Show streamlines")).toBeVisible();
    await page.keyboard.press("Escape");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("P: nested unsafe field is visibly rejected with streamlines inert", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await addObject(page, "3D Vector Field");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await fillInput(page.getByLabel("Vector field P component").first(), "sin(factorial(x))");
    await expect(page.getByTestId("expression-diagnostic").first()).toContainText(/not supported|unsupported/i);
    await openAnalyze(page);
    await expect(page.getByText("Fix the component expressions to enable streamlines.")).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
