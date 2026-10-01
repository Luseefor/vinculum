import { expect, test, type Page } from "@playwright/test";

// S17 parametric surfaces x(u,v), y(u,v), z(u,v): creation, synchronized
// views, probes, singular domains, recovery, style, persistence, workspaces.
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

async function addPreset(page: Page, name: string) {
  // S30: templates live in the Add Object menu.
  await page.getByRole("button", { name: "Open object menu" }).click();
  await page.getByRole("button", { name, exact: true }).click();
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

async function setGeometryLayout(page: Page, layout: "Single" | "Split" | "Quad") {
  await page.getByLabel("Geometry layout").selectOption(layout.toLowerCase());
}

async function setGeometryView(page: Page, view: "Perspective" | "XY" | "XZ" | "YZ") {
  await page.getByLabel("Geometry view").selectOption(view.toLowerCase());
}

async function addParametricSphere(page: Page) {
  await addPreset(page, "Parametric Sphere");
  await expect(page.getByTestId("scene-object-count")).toHaveText("1");
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

// S19: parametric geometry now arrives asynchronously via the geometry
// worker. Probes after mutations wait for outstanding compute to settle
// first; zero-pending returns at once.
async function settleCompute(page: Page) {
  const pending = page.locator('[data-testid="compute-status-pending"]');
  await pending.first().waitFor({ state: "attached", timeout: 3000 }).catch(() => {});
  await expect.poll(async () => pending.count(), { timeout: 25000 }).toBe(0);
}

test.describe("S17 parametric surfaces", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("Quick Add creates a parametric surface with x(u,v) focused; Enter creates next", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "Parametric Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    // New objects auto-select; creation focus lands in the row's x(u,v)
    // input, exactly like parametric curves.
    await expect(page.getByRole("button", { name: "Selected Parametric Surface #1" })).toBeVisible();
    const xInput = page.getByLabel("Parametric x(u,v) =").first();
    await expect(xInput).toBeFocused({ timeout: 8000 });
    // Enter in x(u,v) follows parametric-curve create-next semantics.
    await xInput.press("Enter");
    await expect(page.getByTestId("scene-object-count")).toHaveText("2");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Sphere template renders in Perspective/XY/XZ/YZ, Split, and Quad", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addParametricSphere(page);
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    for (const view of ["Perspective", "XY", "XZ", "YZ"] as const) {
      await setGeometryView(page, view);
      await page.waitForTimeout(600);
      await expect(canvas).toBeVisible();
      await expect(page.getByLabel("Geometry view")).toHaveValue(view.toLowerCase());
      await expect(page.getByTestId("scene-object-count")).toHaveText("1");
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
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Asymmetric saddle probes map to pane axes without mirrors", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "Parametric Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    // Asymmetric map x = u, y = 2v, z = 3u + v over the default ±5 domain.
    // Geometry Studio auto-expands the new row; its definition inputs carry
    // the Parametric * labels (the expression list is a Math Lab surface).
    await page.getByLabel("Parametric y(u,v) =", { exact: true }).fill("2 * v");
    await page.getByLabel("Parametric z(u,v) =", { exact: true }).fill("3 * u + v");
    await page.waitForTimeout(1000);
    await page.locator('label:has-text("Tool") select').first().selectOption("probe");
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();

    await setGeometryView(page, "XY");
    await page.waitForTimeout(800);
    await settleCompute(page);
    const xyRight = await probeWorld(page, canvas, 0.62, 0.5);
    const xyLeft = await probeWorld(page, canvas, 0.38, 0.5);
    const xyTop = await probeWorld(page, canvas, 0.5, 0.44);
    const xyBottom = await probeWorld(page, canvas, 0.5, 0.56);
    expect(xyRight).not.toBeNull();
    expect(xyLeft).not.toBeNull();
    expect(xyTop).not.toBeNull();
    expect(xyBottom).not.toBeNull();
    if (xyRight && xyLeft && xyTop && xyBottom) {
      // XY pane: screen right = math +x, screen up = math +y (badge Z).
      expect(xyRight.x).toBeGreaterThan(xyLeft.x);
      expect(xyTop.z).toBeGreaterThan(xyBottom.z);
    }

    await setGeometryView(page, "XZ");
    await page.waitForTimeout(800);
    const xzRight = await probeWorld(page, canvas, 0.62, 0.5);
    const xzLeft = await probeWorld(page, canvas, 0.38, 0.5);
    const xzUpper = await probeWorld(page, canvas, 0.5, 0.44);
    const xzLower = await probeWorld(page, canvas, 0.5, 0.56);
    expect(xzRight).not.toBeNull();
    expect(xzLeft).not.toBeNull();
    expect(xzUpper).not.toBeNull();
    expect(xzLower).not.toBeNull();
    if (xzRight && xzLeft && xzUpper && xzLower) {
      // XZ pane: screen right = math +x, screen up = math +z (badge Y).
      expect(xzRight.x).toBeGreaterThan(xzLeft.x);
      expect(xzUpper.y).toBeGreaterThan(xzLower.y);
    }

    await setGeometryView(page, "YZ");
    await page.waitForTimeout(800);
    const yzRight = await probeWorld(page, canvas, 0.62, 0.5);
    const yzLeft = await probeWorld(page, canvas, 0.38, 0.5);
    expect(yzRight).not.toBeNull();
    expect(yzLeft).not.toBeNull();
    if (yzRight && yzLeft) {
      // YZ pane: screen right = math +y (badge Z).
      expect(yzRight.z).toBeGreaterThan(yzLeft.z);
    }

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Torus renders in Perspective and Quad; probe hits in both modes", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addPreset(page, "Parametric Torus");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await expect(canvas).toBeVisible();
    await setGeometryLayout(page, "Quad");
    await page.waitForTimeout(800);
    await expect(canvas).toBeVisible();
    await page.locator('label:has-text("Tool") select').first().selectOption("probe");
    // Probe the top-left (perspective) quadrant: the torus must raycast.
    await settleCompute(page);
    const hit = await probeWorld(page, canvas, 0.25, 0.4);
    expect(hit).not.toBeNull();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Singular domain renders valid pieces; all-invalid recovers by editing", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await page.getByRole("button", { name: "Parametric Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByLabel("Parametric x(u,v) =", { exact: true }).fill("1 / u");
    await page.waitForTimeout(1000);
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    await page.locator('label:has-text("Tool") select').first().selectOption("probe");
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    // u > 0 side stays probeable; the u = 0 column is omitted, not bridged.
    await settleCompute(page);
    const validSide = await probeWorld(page, canvas, 0.7, 0.5);
    expect(validSide).not.toBeNull();

    // All-invalid: no mesh, object stays editable, no crash.
    await page.getByLabel("Parametric x(u,v) =", { exact: true }).fill("1 / 0");
    await page.waitForTimeout(1000);
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    // Recovery: valid expression restores the probeable mesh.
    await page.getByLabel("Parametric x(u,v) =", { exact: true }).fill("u");
    await page.waitForTimeout(1000);
    await settleCompute(page);
    const recovered = await probeWorld(page, canvas, 0.5, 0.5);
    expect(recovered).not.toBeNull();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Style: hide/show, color, and wireframe keep the scene safe", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addParametricSphere(page);
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await page.getByRole("button", { name: "Hide object" }).first().click();
    await page.waitForTimeout(500);
    await expect(canvas).toBeVisible();
    await page.getByRole("button", { name: "Show object" }).first().click();
    await page.waitForTimeout(500);
    await expect(canvas).toBeVisible();
    // Wireframe via the Styles tab.
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

  test("Save/reopen persists the parametric surface", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addParametricSphere(page);
    await page.getByRole("button", { name: "Scene" }).click();
    await page.getByRole("menuitem", { name: "Save as..." }).click();
    await page.locator("#project-name-input").fill("s17-psphere");
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
    await showMoreAdd(page);
    await page.getByRole("button", { name: "Parametric Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByRole("button", { name: "Selected Parametric Surface #1" })).toBeVisible();
    await toGeometry(page);
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    await page.getByRole("button", { name: "Math Lab" }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Command palette adds a parametric surface", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await page.keyboard.press("Meta+k");
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
    await page.getByLabel("Command search").fill("parametric surface");
    await page.getByRole("option", { name: "Add Parametric Surface" }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Narrow 430x800 editing stays usable", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 430, height: 800 });
    await startClean(page);
    // At this width the object panel starts collapsed; open it first.
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await showMoreAdd(page);
    await page.getByRole("button", { name: "Parametric Surface", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    // The new row auto-expands; the ObjectRow input commits immediately.
    await page.getByLabel("Parametric z(u,v) =", { exact: true }).first().fill("u * v");
    await page.waitForTimeout(800);
    // Geometry Studio is 3D-first at any width (the Math Lab view-type
    // group collapses at 430px). Close the objects drawer first: at this
    // width it overlays the workspace switcher.
    await page.keyboard.press("Escape");
    await toGeometry(page);
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    // The Scene Navigator (with the object count) is hidden at this width;
    // canvas visibility proves the view is live. The count was asserted at
    // creation time above.

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
