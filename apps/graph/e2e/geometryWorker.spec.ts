import { expect, test, type Page } from "@playwright/test";

// Heavy worker-compute timing bounds are load-sensitive (res-48 gyroids
// across workers plus dev-server compile), so this spec runs serially.
test.describe.configure({ mode: "serial" });

// S19 workerized heavy geometry: implicit sphere through the worker,
// rapid-edit races, interaction during heavy compute, deletion race,
// view/layout stability, parametric worker parity, persistence, narrow
// sheet, and error consistency. Zero unexpected console/page errors.
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

async function addPreset(page: Page, name: string) {
  // S30: templates live in the Add Object menu.
  await page.getByRole("button", { name: "Open object menu" }).click();
  await page.getByRole("button", { name, exact: true }).click();
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

async function probeWorld(  page: Page,
  canvas: ReturnType<Page["locator"]>,
  fx: number,
  fy: number
): Promise<{ x: number; y: number; z: number } | null> {
  const box = await canvas.boundingBox();
  if (!box) {
    return null;
  }
  await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy);
  const badge = page.locator('[data-graph3d-probe-hover="true"]').first();
  let previous: string | null = null;
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(150);
    const visible = (await badge.count()) > 0 && (await badge.isVisible());
    const text = visible ? ((await badge.textContent()) ?? "") : "";
    if (text && text === previous) {
      const match = /X\s+(-?[\d.]+)\s*·\s*Y\s+(-?[\d.]+)\s*·\s*Z\s+(-?[\d.]+)/.exec(text);
      if (match) {
        return { x: Number(match[1]), y: Number(match[2]), z: Number(match[3]) };
      }
      return null;
    }
    previous = text;
  }
  return null;
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

test.describe("S19 workerized geometry", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("A: implicit sphere computes in the worker and renders", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addPreset(page, "Implicit Sphere");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await expect(canvas).toBeVisible();
    await page.locator('label:has-text("Tool") select').first().selectOption("probe");
    await settleCompute(page);
    const hit = await probeWorld(page, canvas, 0.5, 0.42);
    expect(hit).not.toBeNull();
    if (hit) {
      const r = Math.hypot(hit.x, hit.z, hit.y);
      expect(r).toBeGreaterThan(0.8);
      expect(r).toBeLessThan(1.2);
    }

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("B: rapid sphere→F=1→sphere race settles on a rendered sphere", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addPreset(page, "Implicit Sphere");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    const eqInput = page.getByLabel("Equation", { exact: true }).first();
    // Three rapid edits with no settle waits: a stale empty must never win.
    await eqInput.fill("sin(x)*cos(y) + sin(y)*cos(z) + sin(z)*cos(x) = 0");
    await eqInput.fill("1");
    await eqInput.fill("x^2 + y^2 + z^2 = 1");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await page.locator('label:has-text("Tool") select').first().selectOption("probe");
    await settleCompute(page);
    const hit = await probeWorld(page, canvas, 0.5, 0.42);
    expect(hit).not.toBeNull();
    if (hit) {
      const r = Math.hypot(hit.x, hit.z, hit.y);
      expect(r).toBeGreaterThan(0.8);
      expect(r).toBeLessThan(1.2);
    }

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("C: toolbar, search, and pane switch stay prompt during res-48 gyroid compute", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "Implicit Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    const eqInput = page.getByLabel("Equation", { exact: true }).first();
    await eqInput.fill("sin(x)*cos(y) + sin(y)*cos(z) + sin(z)*cos(x) = 0");
    // S32: resolution lives in the Styles tab (Tessellation section).
    await page.getByRole("tab", { name: "Styles" }).first().click();
    await page.getByLabel("Resolution", { exact: true }).first().fill("48");
    // Heavy compute is now in flight. Every interaction below must complete
    // promptly (generous bound distinguishes responsive from multi-second
    // main-thread block, without millisecond fragility).
    const started = Date.now();
    await page.getByRole("button", { name: "Scene" }).click();
    await expect(page.getByRole("menuitem", { name: "Save as..." })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByLabel("Geometry layout").selectOption("quad");
    await expect(page.getByRole("button", { name: "Perspective viewport" })).toBeVisible();
    await page.getByLabel("Geometry layout").selectOption("single");
    const elapsed = Date.now() - started;
    expect(elapsed).toBeLessThan(8000);
    // And the heavy result still lands correctly afterwards.
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await page.locator('label:has-text("Tool") select').first().selectOption("probe");
    await settleCompute(page);
    const hit = await probeWorld(page, canvas, 0.5, 0.5);
    expect(hit).not.toBeNull();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("D: deleting an object mid-compute resurrects no mesh", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "Implicit Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    // Slow compute so the delete below lands while the job is in flight.
    const eqInput = page.getByLabel("Equation", { exact: true }).first();
    await eqInput.fill("sin(x)*cos(y) + sin(y)*cos(z) + sin(z)*cos(x) = 0");
    // S32: resolution lives in the Styles tab (Tessellation section).
    await page.getByRole("tab", { name: "Styles" }).first().click();
    await page.getByLabel("Resolution", { exact: true }).first().fill("48");
    await page.locator('[aria-label^="Selected "]').first().click();
    await page.keyboard.press("Backspace");
    await expect(page.getByTestId("scene-object-count")).toHaveText("0");
    // Settle well past any worker round-trip, then confirm nothing returned.
    await page.waitForTimeout(4000);
    await expect(page.getByTestId("scene-object-count")).toHaveText("0");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("E: view/layout switches during compute keep the app stable", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "Implicit Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Equation", { exact: true }).first().fill("x^2 + y^2 + z^2 = 1");
    await page.getByLabel("Geometry view").selectOption("xy");
    await page.getByLabel("Geometry layout").selectOption("quad");
    await page.getByLabel("Geometry view").selectOption("perspective");
    await page.getByLabel("Geometry layout").selectOption("single");
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await expect(canvas).toBeVisible();
    await page.locator('label:has-text("Tool") select').first().selectOption("probe");
    await settleCompute(page);
    const hit = await probeWorld(page, canvas, 0.5, 0.42);
    expect(hit).not.toBeNull();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("F: parametric sphere renders identically through the worker", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addPreset(page, "Parametric Sphere");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await expect(canvas).toBeVisible();
    await page.locator('label:has-text("Tool") select').first().selectOption("probe");
    await settleCompute(page);
    const hit = await probeWorld(page, canvas, 0.5, 0.42);
    expect(hit).not.toBeNull();
    if (hit) {
      const r = Math.hypot(hit.x, hit.z, hit.y);
      expect(r).toBeGreaterThan(0.8);
      expect(r).toBeLessThan(1.2);
    }

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("G: save/reopen with a worker-built mesh is unaffected", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addPreset(page, "Implicit Sphere");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByRole("button", { name: "Scene" }).click();
    await page.getByRole("menuitem", { name: "Save as..." }).click();
    await page.locator("#project-name-input").fill("s19-isphere");
    await page.getByRole("button", { name: "Save project", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Save as project" })).not.toBeVisible({ timeout: 10000 });
    await page.reload();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("H: narrow 430x800 heavy compute does not freeze Sheet controls", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 430, height: 800 });
    await startClean(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Implicit Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Equation", { exact: true }).first().fill("sin(x)*cos(y) + sin(y)*cos(z) + sin(z)*cos(x) = 0");
    // The Objects drawer is already open as an overlay sheet at this width;
    // close it first, then exercise open/close while compute is in flight.
    await page.keyboard.press("Escape");
    const started = Date.now();
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Objects" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "Objects" })).not.toBeVisible();
    expect(Date.now() - started).toBeLessThan(8000);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("I: unsafe expression is rejected consistently (no worker involvement)", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await page.getByRole("button", { name: "Implicit Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    const eqInput = page.getByLabel("Equation", { exact: true }).first();
    await eqInput.fill("sin(factorial(x)) + y + z = 0");
    await expect(page.getByTestId("expression-diagnostic").first()).toContainText(/not supported|unsupported/i);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
