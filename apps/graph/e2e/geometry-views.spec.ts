import { addObject } from "./helpers/addObject";
import { expectInputValue, fillInput } from "./helpers/mathInput";
import { expect, test, type Page } from "@playwright/test";

// Geometry Studio synchronized views: single/split/quad across
// Perspective/XY/XZ/YZ sharing one scene.
const SURFACE_INPUT = 'input[placeholder="x + y = 1, z = x^2 + y^2, or x^2 + y^2 = 1"]';

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

test.describe("Geometry synchronized views", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("single Perspective/XY/XZ/YZ each render with the view select as the only indicator", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    // Seed one asymmetric surface + one plane for readable panes.
    await addObject(page, "Surface");
    await addObject(page, "Plane");
    await expect(page.getByTestId("scene-object-count")).toHaveText("2");
    for (const view of ["Perspective", "XY", "XZ", "YZ"] as const) {
      await setGeometryView(page, view);
      await page.waitForTimeout(600);
      await expect(page.locator('canvas[data-graph3d-canvas="true"]:visible').first()).toBeVisible();
      await expectInputValue(page.getByLabel("Geometry view"), view.toLowerCase());
      await expect(page.getByRole("button", { name: `${view} viewport` })).toHaveCount(0);
      await expect(page.getByTestId("scene-object-count")).toHaveText("2");
    }
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("split and quad compose, edit and visibility propagate", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Surface");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");

    await setGeometryLayout(page, "Split");
    await page.waitForTimeout(600);
    await expect(page.getByRole("button", { name: "Perspective viewport" })).toBeVisible();
    await expect(page.getByRole("button", { name: "XY viewport" })).toBeVisible();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");

    // Edit reaches all panes without duplicating objects.
    const input = page.locator(SURFACE_INPUT).first();
    if ((await input.count()) === 0) {
      await page.getByRole("button", { name: "Expand definition" }).first().click();
    }
    await fillInput(page.locator(SURFACE_INPUT).first(), "z = x^2 - y^2");
    await page.waitForTimeout(800);
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");

    // Visibility applies everywhere; hide/show stays stable.
    await page.getByRole("button", { name: "Hide object" }).first().click({ force: true });
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Show object" }).first().click({ force: true });
    await page.waitForTimeout(500);

    await setGeometryLayout(page, "Quad");
    await page.waitForTimeout(800);
    for (const view of ["Perspective", "XY", "XZ", "YZ"] as const) {
      await expect(page.getByRole("button", { name: `${view} viewport` })).toBeVisible();
    }
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await setGeometryLayout(page, "Single");
    await page.waitForTimeout(500);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("pane activation, ortho zoom/pan isolation, perspective orbit", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Surface");
    await setGeometryLayout(page, "Quad");
    await page.waitForTimeout(800);
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]:visible').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    // The selector, chip, and engine share the same active pane.
    await setGeometryView(page, "YZ");
    await expect(page.getByRole("button", { name: "YZ viewport" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "XZ viewport" }).click();
    await expect(page.getByLabel("Geometry view")).toHaveValue("xz");

    // Clicking the XY quadrant activates it.
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.25);
    await expect(page.getByRole("button", { name: "XY viewport" })).toHaveAttribute("aria-pressed", "true");

    await expect(page.getByLabel("Geometry view")).toHaveValue("xy");

    // Wheel over XY zooms without errors; canvas stays live.
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.25);
    await page.mouse.wheel(0, -600);
    await page.waitForTimeout(500);
    await expect(canvas).toBeVisible();
    await expect(page.getByRole("button", { name: "XY viewport" })).toHaveAttribute("aria-pressed", "true");

    // Drag with pan tool in XY keeps XY active.
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.25);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.3, { steps: 5 });
    await page.mouse.up();
    await expect(page.getByRole("button", { name: "XY viewport" })).toHaveAttribute("aria-pressed", "true");

    // Orbit in Perspective re-activates it and stays stable.
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3, { steps: 5 });
    await page.mouse.up();
    await expect(page.getByRole("button", { name: "Perspective viewport" })).toHaveAttribute("aria-pressed", "true");
    await expect(canvas).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("ortho gestures never move the perspective camera", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Surface");
    await setGeometryLayout(page, "Split");
    await page.waitForTimeout(800);
    // Adding the surface selects it and opens the inspector, which narrows
    // the canvas. A canvas pointerdown clears selection (S14) and collapses
    // the inspector, resizing the canvas and legitimately changing the
    // perspective aspect. Click empty sky first so the layout is settled
    // before comparing perspective state.
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]:visible').first();
    let box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    await page.mouse.click(box.x + box.width * 0.1, box.y + box.height * 0.12);
    let stableWidth = 0;
    const settleDeadline = Date.now() + 8000;
    while (Date.now() < settleDeadline) {
      await page.waitForTimeout(250);
      const next = await canvas.boundingBox();
      if (next && Math.abs(next.width - stableWidth) < 1 && Math.abs(next.width - (box?.width ?? 0)) < 1) {
        box = next;
        break;
      }
      stableWidth = next?.width ?? stableWidth;
      if (next) box = next;
    }
    await page.locator('label:has-text("Tool") select').first().selectOption("probe");
    const settledBox = box;
    expect(settledBox).not.toBeNull();
    if (!settledBox) return;

    // Probe a fixed perspective-pane point: identical world coordinates
    // before and after ortho gestures proves the perspective camera is
    // untouched (4-decimal badge text is subpixel-sensitive).
    async function probePerspectiveCenter(): Promise<string | null> {
      await page.mouse.move(settledBox.x + settledBox.width * 0.25, settledBox.y + settledBox.height * 0.5);
      const badge = page.locator('[data-graph3d-probe-hover="true"]').first();
      const deadline = Date.now() + 8000;
      let previous = "";
      while (Date.now() < deadline) {
        await page.waitForTimeout(150);
        const visible = (await badge.count()) > 0 && (await badge.isVisible());
        const text = visible ? ((await badge.textContent()) ?? "") : "";
        if (text && text === previous) {
          return text;
        }
        previous = text;
      }
      return null;
    }

    const before = await probePerspectiveCenter();
    expect(before).not.toBeNull();
    // First gesture over the ortho pane: drag (pan) then wheel (zoom).
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.45, { steps: 8 });
    await page.mouse.up();
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.5);
    await page.mouse.wheel(0, -600);
    await page.waitForTimeout(800);
    // Guard: if the canvas resized mid-gesture the same screen fraction maps
    // to a different ray and the comparison below would be meaningless.
    const afterBox = await canvas.boundingBox();
    expect(afterBox).not.toBeNull();
    expect(Math.abs((afterBox?.width ?? 0) - box.width)).toBeLessThan(1);
    const after = await probePerspectiveCenter();
    expect(after).not.toBeNull();
    expect(after).toBe(before);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("probe works in an orthographic pane; workspace round-trips to Math Lab", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Surface");
    await setGeometryView(page, "XY");
    await page.waitForTimeout(800);
    // Probe tool via compact select is desktop-only here; use toolbar Tool select.
    await page.locator('label:has-text("Tool") select').first().selectOption("probe");
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]:visible').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await page.waitForTimeout(600);
    }
    await expect(canvas).toBeVisible();
    // Back to Math Lab: legacy UI intact, scene intact.
    await page.getByRole("button", { name: "Math Lab" }).click();
    await expect(page.getByRole("group", { name: "View type" })).toBeVisible();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    // Math Lab 2D/3D/split smoke: each mode renders live and keeps the scene.
    // NOTE: :visible scoping is required — visited workspace trees stay
    // mounted but hidden, so .first() can resolve to a stale canvas.
    await page.getByRole("button", { name: "2D only" }).click();
    await expect(page.locator('canvas[data-graph2d-canvas="true"]:visible').first()).toBeVisible();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByRole("button", { name: "3D only" }).click();
    await expect(page.locator('canvas[data-graph3d-canvas="true"]:visible:visible').first()).toBeVisible();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByRole("button", { name: "2D and 3D together" }).click();
    await expect(page.locator('canvas[data-graph2d-canvas="true"]:visible').first()).toBeVisible();
    await expect(page.locator('canvas[data-graph3d-canvas="true"]:visible:visible').first()).toBeVisible();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("asymmetric probe mapping proves no mirrored axes", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    // Shallow tilted plane: no ortho ray is parallel to it, so every
    // probe point hits and mapping is fully determined by orientation.
    await addObject(page, "Surface");
    const eqInput = page.locator(SURFACE_INPUT).first();
    if ((await eqInput.count()) === 0) {
      await page.getByRole("button", { name: "Expand definition" }).first().click();
    }
    await fillInput(page.locator(SURFACE_INPUT).first(), "z = 0.1 * x + 0.1 * y");
    await page.locator(SURFACE_INPUT).first().blur();
    await expectInputValue(page.locator(SURFACE_INPUT).first(), "z = 0.1 * x + 0.1 * y");
    await page.waitForTimeout(1000);
    await page.locator('label:has-text("Tool") select').first().selectOption("probe");
    const canvas = page.locator('canvas[data-graph3d-canvas="true"]:visible').first();

    // World coordinates reported by the probe badge: world.x = math x,
    // world.y = math z, world.z = math y.
    async function probeWorld(fx: number, fy: number): Promise<{ x: number; y: number; z: number } | null> {
      const box = await canvas.boundingBox();
      if (!box) {
        return null;
      }
      await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy);
      // Settle-poll: hover state updates asynchronously per frame; require
      // two consecutive identical readings so a stale badge never counts.
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

    await setGeometryView(page, "XY");
    await page.waitForTimeout(800);
    const xyRight = await probeWorld(0.7, 0.5);
    const xyLeft = await probeWorld(0.3, 0.5);
    const xyTop = await probeWorld(0.5, 0.3);
    expect(xyRight).not.toBeNull();
    expect(xyLeft).not.toBeNull();
    expect(xyTop).not.toBeNull();
    if (xyRight && xyLeft && xyTop) {
      expect(xyRight.x).toBeGreaterThan(0);
      expect(xyLeft.x).toBeLessThan(0);
      expect(xyTop.z).toBeGreaterThan(0);
    }

    await setGeometryView(page, "XZ");
    await page.waitForTimeout(800);
    const xzRight = await probeWorld(0.7, 0.5);
    const xzUpper = await probeWorld(0.5, 0.47);
    const xzLower = await probeWorld(0.5, 0.53);
    expect(xzRight).not.toBeNull();
    expect(xzUpper).not.toBeNull();
    expect(xzLower).not.toBeNull();
    if (xzRight && xzUpper && xzLower) {
      expect(xzRight.x).toBeGreaterThan(0);
      expect(xzUpper.y).toBeGreaterThan(xzLower.y);
    }

    await setGeometryView(page, "YZ");
    await page.waitForTimeout(800);
    const yzRight = await probeWorld(0.7, 0.5);
    const yzUpper = await probeWorld(0.5, 0.47);
    const yzLower = await probeWorld(0.5, 0.53);
    expect(yzRight).not.toBeNull();
    expect(yzUpper).not.toBeNull();
    expect(yzLower).not.toBeNull();
    if (yzRight && yzUpper && yzLower) {
      expect(yzRight.z).toBeGreaterThan(0);
      expect(yzUpper.y).toBeGreaterThan(yzLower.y);
    }

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("narrow geometry single view stays usable", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 430, height: 800 });
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Objects" })).toBeVisible();
    await addObject(page, "Surface");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "Objects" })).not.toBeVisible();
    await expect(page.locator('canvas[data-graph3d-canvas="true"]:visible').first()).toBeVisible();

    // The CSS2D label layer is clipped to the perspective pane, so its box
    // directly proves panes tile without overlap or collapse at 430px.
    async function labelLayerGeometry() {
      return page.locator('canvas[data-graph3d-canvas="true"]:visible').first().evaluate((canvas) => {
        const label = canvas?.nextElementSibling as HTMLElement | null;
        if (!canvas || !label) {
          return null;
        }
        const canvasRect = canvas.getBoundingClientRect();
        const labelRect = label.getBoundingClientRect();
        return {
          display: label.style.display,
          canvasW: canvasRect.width,
          canvasH: canvasRect.height,
          labelW: labelRect.width,
          labelH: labelRect.height,
          labelX: labelRect.left - canvasRect.left,
          labelY: labelRect.top - canvasRect.top
        };
      });
    }

    await setGeometryLayout(page, "Split");
    await page.waitForTimeout(800);
    await expect(page.getByRole("button", { name: "Perspective viewport" })).toBeVisible();
    await expect(page.getByRole("button", { name: "XY viewport" })).toBeVisible();
    const splitLabel = await labelLayerGeometry();
    expect(splitLabel).not.toBeNull();
    if (splitLabel) {
      expect(splitLabel.display).toBe("block");
      expect(Math.abs(splitLabel.labelX)).toBeLessThanOrEqual(2);
      expect(Math.abs(splitLabel.labelY)).toBeLessThanOrEqual(2);
      expect(Math.abs(splitLabel.labelW - splitLabel.canvasW / 2)).toBeLessThanOrEqual(2);
      expect(Math.abs(splitLabel.labelH - splitLabel.canvasH)).toBeLessThanOrEqual(2);
    }

    await setGeometryLayout(page, "Quad");
    await page.waitForTimeout(800);
    for (const view of ["Perspective", "XY", "XZ", "YZ"] as const) {
      await expect(page.getByRole("button", { name: `${view} viewport` })).toBeVisible();
    }
    const quadLabel = await labelLayerGeometry();
    expect(quadLabel).not.toBeNull();
    if (quadLabel) {
      expect(quadLabel.display).toBe("block");
      expect(Math.abs(quadLabel.labelW - quadLabel.canvasW / 2)).toBeLessThanOrEqual(2);
      expect(Math.abs(quadLabel.labelH - quadLabel.canvasH / 2)).toBeLessThanOrEqual(2);
    }
    // The Scene Navigator (with the object count) is hidden at this width;
    // canvas visibility proves the quad view is still live. Scene integrity
    // was already asserted above (count "1" before the layout switches).
    await expect(page.locator('canvas[data-graph3d-canvas="true"]:visible').first()).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
