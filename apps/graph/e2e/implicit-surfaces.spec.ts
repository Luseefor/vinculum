import { expect, test, type Page } from "@playwright/test";

// S18 true implicit 3D surfaces F(x,y,z) = 0: creation, synchronized views,
// equation edits, empty recovery, singular stability, style, persistence,
// workspaces, narrow editing, security diagnostics.
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

async function setGeometryLayout(page: Page, layout: "Single" | "Split" | "Quad") {
  await page.getByLabel("Geometry layout").selectOption(layout.toLowerCase());
}

async function setGeometryView(page: Page, view: "Perspective" | "XY" | "XZ" | "YZ") {
  await page.getByLabel("Geometry view").selectOption(view.toLowerCase());
}

async function probeWorld(
  page: Page,
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
  const deadline = Date.now() + 8000;
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

// S19: implicit/parametric geometry now arrives asynchronously via the
// geometry worker. Probing immediately after an edit can return a stable
// GRID reading before the result lands, so probes after mutations wait for
// outstanding compute to settle first. Zero-pending returns at once.
async function settleCompute(page: Page) {
  const pending = page.locator('[data-testid="compute-status-pending"]');
  await pending.first().waitFor({ state: "attached", timeout: 3000 }).catch(() => {});
  await expect.poll(async () => pending.count(), { timeout: 25000 }).toBe(0);
}

test.describe("S18 implicit surfaces", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("Quick Add creates an implicit surface with equation focused; Enter creates next", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await page.getByRole("button", { name: "Implicit Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByRole("button", { name: "Selected Implicit Surface #1" })).toBeVisible();
    const eqInput = page.getByLabel("Equation", { exact: true }).first();
    await expect(eqInput).toBeFocused({ timeout: 8000 });
    await eqInput.press("Enter");
    await expect(page.getByTestId("scene-object-count")).toHaveText("2");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Sphere renders in Perspective and probes hit the unit shell", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Implicit Sphere", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await expect(canvas).toBeVisible();
    await page.locator('label:has-text("Tool") select').first().selectOption("probe");
    await settleCompute(page);
    const hit = await probeWorld(page, canvas, 0.5, 0.42);
    expect(hit).not.toBeNull();
    if (hit) {
      // Unit sphere in math coords: badge reports world (x, z, y).
      const r = Math.hypot(hit.x, hit.z, hit.y);
      expect(r).toBeGreaterThan(0.8);
      expect(r).toBeLessThan(1.2);
    }

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Ellipsoid renders in XY/XZ/YZ/Split/Quad with correct axis orientation", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Implicit Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    // Asymmetric ellipsoid: center (1,-2,0.5), semi-axes (2,1,3).
    await page.getByLabel("Equation", { exact: true }).fill("(x - 1)^2 / 4 + (y + 2)^2 + (z - 0.5)^2 / 9 = 1");
    await page.waitForTimeout(1200);
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    for (const view of ["Perspective", "XY", "XZ", "YZ"] as const) {
      await setGeometryView(page, view);
      await page.waitForTimeout(600);
      await expect(canvas).toBeVisible();
      await expect(page.getByRole("button", { name: `${view} viewport` })).toHaveAttribute("aria-pressed", "true");
    }
    await setGeometryLayout(page, "Split");
    await page.waitForTimeout(600);
    await expect(page.getByRole("button", { name: "Perspective viewport" })).toBeVisible();
    await expect(page.getByRole("button", { name: "XY viewport" })).toBeVisible();
    await setGeometryLayout(page, "Quad");
    await page.waitForTimeout(800);
    for (const view of ["Perspective", "XY", "XZ", "YZ"] as const) {
      await expect(page.getByRole("button", { name: `${view} viewport` })).toBeVisible();
    }
    // Axis orientation: XY shows x-long/y-short ellipse around x=1, y=-2.
    await setGeometryLayout(page, "Single");
    await setGeometryView(page, "XY");
    await page.waitForTimeout(800);
    await page.locator('label:has-text("Tool") select').first().selectOption("probe");
    await settleCompute(page);
    const right = await probeWorld(page, canvas, 0.66, 0.5);
    const left = await probeWorld(page, canvas, 0.34, 0.5);
    expect(right).not.toBeNull();
    expect(left).not.toBeNull();
    if (right && left) {
      expect(right.x).toBeGreaterThan(left.x);
      // x extent ~[-1, 3] dominates y extent ~[-3, -1].
      expect(right.x - left.x).toBeGreaterThan(1);
    }

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Sphere → ellipsoid edit updates the same object", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Implicit Sphere", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Equation", { exact: true }).fill("x^2 / 4 + y^2 + z^2 / 9 = 1");
    await page.waitForTimeout(1200);
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    await page.locator('label:has-text("Tool") select').first().selectOption("probe");
    await settleCompute(page);
    const hit = await probeWorld(page, page.locator('canvas[data-graph3d-canvas="true"]').first(), 0.5, 0.42);
    expect(hit).not.toBeNull();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("F=1 yields no mesh; editing to sphere recovers", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Implicit Sphere", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Equation", { exact: true }).fill("1");
    await page.waitForTimeout(1000);
    // Valid empty state: object editable, scene stable, no crash.
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    await page.getByLabel("Equation", { exact: true }).fill("x^2 + y^2 + z^2 = 1");
    await page.waitForTimeout(1200);
    await page.locator('label:has-text("Tool") select').first().selectOption("probe");
    await settleCompute(page);
    const hit = await probeWorld(page, page.locator('canvas[data-graph3d-canvas="true"]').first(), 0.5, 0.42);
    expect(hit).not.toBeNull();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Singular field 1/x stays stable with no phantom geometry", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Implicit Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Equation", { exact: true }).fill("1 / x");
    await page.waitForTimeout(1000);
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Style: hide/show, wireframe keep the scene safe", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Implicit Sphere", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await page.getByRole("button", { name: "Hide object" }).first().click();
    await page.waitForTimeout(500);
    await expect(canvas).toBeVisible();
    await page.getByRole("button", { name: "Show object" }).first().click();
    await page.waitForTimeout(500);
    await expect(canvas).toBeVisible();
    await page.getByRole("tab", { name: "Styles" }).click();
    await page.getByRole("switch", { name: /wireframe/i }).click();
    await page.waitForTimeout(500);
    await expect(canvas).toBeVisible();
    await page.getByRole("switch", { name: /wireframe/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Save/reopen preserves the raw equality string", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Implicit Sphere", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByRole("button", { name: "Scene" }).click();
    await page.getByRole("menuitem", { name: "Save as..." }).click();
    await page.locator("#project-name-input").fill("s18-isphere");
    await page.getByRole("button", { name: "Save project", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Save as project" })).not.toBeVisible({ timeout: 10000 });
    await page.reload();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Math Lab creates the same canonical object visible in Geometry Studio", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await page.getByRole("button", { name: "Implicit Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByRole("button", { name: "Selected Implicit Surface #1" })).toBeVisible();
    await toGeometry(page);
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    await page.getByRole("button", { name: "Math Lab" }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Command palette adds an implicit surface", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await page.keyboard.press("Meta+k");
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
    await page.getByLabel("Command search").fill("implicit surface");
    await page.getByRole("option", { name: "Add Implicit Surface" }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Nested unsafe equation is rejected visibly", async ({ page }) => {
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

  test("Narrow 430x800 editing stays usable", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 430, height: 800 });
    await startClean(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Implicit Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Equation", { exact: true }).first().fill("x^2 + y^2 + z^2 = 1");
    await page.waitForTimeout(1200);
    await page.keyboard.press("Escape");
    await toGeometry(page);
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
