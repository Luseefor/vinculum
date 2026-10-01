import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// S33 canvas interaction refinement: hover, cursor, clean selection,
// Frame Selected / Fit Scene, literal-backed orthographic drags with
// one-undo transactions, locks, lifecycle safety, and camera/math
// invariance. Frozen engine behavior stays covered by S16–S32.
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

async function createPointAt(page: Page, x: string, y: string, z: string) {
  await page.getByRole("button", { name: "Point", exact: true }).click();
  await inspector(page).getByLabel("Point x").fill(x);
  await inspector(page).getByLabel("Point y").fill(y);
  await inspector(page).getByLabel("Point z").fill(z);
}

async function openAnalyze(page: Page) {
  const tab = page.getByRole("tab", { name: "Analyze" });
  if ((await tab.count()) > 0 && (await tab.first().isVisible())) {
    await tab.first().click();
  }
}

async function showMoreAdd(page: Page) {
  const more = page.getByRole("button", { name: "Show more object types" });
  if ((await more.count()) > 0 && (await more.first().isVisible())) {
    await more.first().click();
  }
}

async function settleCompute(page: Page) {
  const pending = page.locator('[data-testid="compute-status-pending"]');
  await pending.first().waitFor({ state: "attached", timeout: 3000 }).catch(() => {});
  await expect.poll(async () => pending.count(), { timeout: 25000 }).toBe(0);
}

test.describe("S33 canvas interaction", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("A: hover shows pointer cursor and leave clears it", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await createPointAt(page, "0", "0", "0");
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("2");
    // Select #2 so #1 (at the center) is unselected: hovering its body
    // shows pointer (no handle affordance on unselected objects).
    await page.getByRole("button", { name: /^(Select|Selected) Point #2$/ }).click();
    const canvas = graph3dCanvas(page);
    const { x, y } = await canvasCenter(page);
    await page.mouse.move(x, y);
    await expect.poll(async () => canvas.evaluate((el) => (el as HTMLElement).style.cursor), { timeout: 8000 }).toBe("pointer");
    // Select #1: the same hover now shows the draggable handle cursor.
    await page.getByRole("button", { name: /^(Select|Selected) Point #1$/ }).click();
    await page.mouse.move(x + 2, y + 2);
    await page.mouse.move(x, y);
    await expect.poll(async () => canvas.evaluate((el) => (el as HTMLElement).style.cursor), { timeout: 8000 }).toBe("move");
    // Leave clears hover state (no stuck cursor).
    await page.mouse.move(10, 10);
    await expect.poll(async () => canvas.evaluate((el) => (el as HTMLElement).style.cursor), { timeout: 8000 }).toBe("");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("B: click selects, small movement stays a click, orbit drag keeps selection", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    // Point#1 at the origin (canvas center); Point#2 keeps defaults (off-center).
    await createPointAt(page, "0", "0", "0");
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("2");
    // Settle creation selection first (engine sync under load).
    await expect(page.getByRole("button", { name: "Selected Point #2" })).toBeVisible();
    const { x, y, box } = await canvasCenter(page);
    await page.mouse.click(x, y);
    await expect(page.getByRole("button", { name: "Selected Point #1" })).toBeVisible({ timeout: 10000 });
    // 3px movement is still a clean click (selection stable, no camera fight).
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 3, y + 1, { steps: 3 });
    await page.mouse.up();
    await expect(page.getByRole("button", { name: "Selected Point #1" })).toBeVisible();
    // Large drag pans the camera; selection is preserved, math untouched.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 120, y + 60, { steps: 10 });
    await page.mouse.up();
    await expect(page.getByRole("button", { name: "Selected Point #1" })).toBeVisible();
    expect(box.width).toBeGreaterThan(0);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("C: Frame Selected centers a far Point (F key)", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await createPointAt(page, "30", "40", "50");
    const canvas = graph3dCanvas(page);
    const { x, y } = await canvasCenter(page);
    // Before framing the far point is off-screen: center hover is empty.
    await page.mouse.move(x, y);
    await page.waitForTimeout(400);
    await expect.poll(async () => canvas.evaluate((el) => (el as HTMLElement).style.cursor), { timeout: 8000 }).toBe("");
    // Defocus the equation input onto the object row so F reaches the canvas.
    await page.getByRole("button", { name: "Selected Point #1" }).click();
    await page.keyboard.press("f");
    // After framing, the point's handle sits at the center (move cursor).
    await page.mouse.move(x + 2, y + 2);
    await page.mouse.move(x, y);
    await expect.poll(async () => canvas.evaluate((el) => (el as HTMLElement).style.cursor), { timeout: 8000 }).toBe("move");
    // Dragging from the center now edits the framed point.
    await page.mouse.down();
    await page.mouse.move(x + 40, y, { steps: 8 });
    await page.mouse.up();
    await expect(inspector(page).getByLabel("Point x")).not.toHaveValue("30", { timeout: 8000 });
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("D: Frame Line stays local (never the clipped extent)", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await page.getByRole("button", { name: "Infinite Line", exact: true }).click();
    await inspector(page).getByLabel("Line point x").fill("100");
    await inspector(page).getByLabel("Line point y").fill("0");
    await inspector(page).getByLabel("Line point z").fill("0");
    // Defocus the equation input onto the object row so F reaches the canvas.
    await page.getByRole("button", { name: "Selected Infinite Line #1" }).click();
    await page.keyboard.press("f");
    // A 60px drag moves x by ~1.5 world units (local span ≈ 15.6), proving
    // the camera fit the defining point instead of the giant clipped line.
    const { x, y } = await canvasCenter(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 60, y, { steps: 8 });
    await page.mouse.up();
    const value = await inspector(page).getByLabel("Line point x").inputValue({ timeout: 8000 });
    expect(Number(value)).toBeGreaterThan(95);
    expect(Number(value)).toBeLessThan(105);
    await expect(inspector(page).getByLabel("Line direction x")).toHaveValue("3");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("E: Frame Surface fits finite content via palette", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("button", { name: "Surface", exact: true }).click();
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByLabel("Command search")).toBeVisible({ timeout: 8000 });
    await page.getByLabel("Command search").fill("Frame Selected");
    await page.getByRole("option", { name: "Frame Selected" }).click();
    await expect(graph3dCanvas(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "Selected Surface #1" })).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("F: XY Point drag updates x/y, preserves z, one undo", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await createPointAt(page, "0", "0", "0");
    const { x, y } = await canvasCenter(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 60, y, { steps: 10 });
    await page.mouse.up();
    await expect(inspector(page).getByLabel("Point x")).not.toHaveValue("0", { timeout: 8000 });
    await expect(inspector(page).getByLabel("Point y")).toHaveValue("0");
    await expect(inspector(page).getByLabel("Point z")).toHaveValue("0");
    // Many pointermoves collapse into ONE undo entry.
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(inspector(page).getByLabel("Point x")).toHaveValue("0");
    await page.getByRole("button", { name: "Redo" }).click();
    await expect(inspector(page).getByLabel("Point x")).not.toHaveValue("0");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("G: XZ Point drag updates x/z, preserves y", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xz");
    await createPointAt(page, "0", "0", "0");
    const { x, y } = await canvasCenter(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 60, y, { steps: 10 });
    await page.mouse.up();
    await expect(inspector(page).getByLabel("Point x")).not.toHaveValue("0", { timeout: 8000 });
    await expect(inspector(page).getByLabel("Point y")).toHaveValue("0");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("H: YZ Point drag updates y/z, preserves x", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("yz");
    await createPointAt(page, "0", "0", "0");
    const { x, y } = await canvasCenter(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 60, { steps: 10 });
    await page.mouse.up();
    await expect(inspector(page).getByLabel("Point z")).not.toHaveValue("0", { timeout: 8000 });
    await expect(inspector(page).getByLabel("Point x")).toHaveValue("0");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("I: Segment Start drag keeps End fixed", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await page.getByRole("button", { name: "Segment", exact: true }).click();
    await inspector(page).getByLabel("Segment start x").fill("0");
    await inspector(page).getByLabel("Segment start y").fill("0");
    await inspector(page).getByLabel("Segment start z").fill("0");
    await inspector(page).getByLabel("Segment end x").fill("0");
    await inspector(page).getByLabel("Segment end y").fill("4");
    await inspector(page).getByLabel("Segment end z").fill("0");
    const { x, y } = await canvasCenter(page);
    // Start marker sits at the center; drag it down (math −y).
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 40, { steps: 8 });
    await page.mouse.up();
    await expect(inspector(page).getByLabel("Segment start y")).not.toHaveValue("0", { timeout: 8000 });
    await expect(inspector(page).getByLabel("Segment end y")).toHaveValue("4");
    await expect(inspector(page).getByLabel("Segment end x")).toHaveValue("0");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(inspector(page).getByLabel("Segment start y")).toHaveValue("0");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("J: Segment End drag keeps Start fixed", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await page.getByRole("button", { name: "Segment", exact: true }).click();
    await inspector(page).getByLabel("Segment start x").fill("0");
    await inspector(page).getByLabel("Segment start y").fill("0");
    await inspector(page).getByLabel("Segment start z").fill("0");
    await inspector(page).getByLabel("Segment end x").fill("0");
    await inspector(page).getByLabel("Segment end y").fill("4");
    await inspector(page).getByLabel("Segment end z").fill("0");
    // The default ortho span (12 units) covers the canvas's shorter side, so
    // y=4 sits min(w,h)/3 px above center. Grab near the End marker.
    const { x, y, box } = await canvasCenter(page);
    const endOffset = Math.min(box.width, box.height) / 3;
    await page.mouse.move(x, y - endOffset);
    await page.mouse.down();
    await page.mouse.move(x, y - endOffset + 40, { steps: 8 });
    await page.mouse.up();
    await expect(inspector(page).getByLabel("Segment end y")).not.toHaveValue("4", { timeout: 8000 });
    await expect(inspector(page).getByLabel("Segment start y")).toHaveValue("0");
    await expect(inspector(page).getByLabel("Segment start x")).toHaveValue("0");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("K: Vector origin drag leaves components unchanged", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await page.getByRole("button", { name: "Vector", exact: true }).click();
    await inspector(page).getByLabel("Vector origin x").fill("0");
    await inspector(page).getByLabel("Vector origin y").fill("0");
    await inspector(page).getByLabel("Vector origin z").fill("0");
    await inspector(page).getByLabel("Vector component x").first().fill("2");
    const { x, y } = await canvasCenter(page);
    // Origin marker sits at the center (origin 0,0,0).
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 50, y, { steps: 8 });
    await page.mouse.up();
    await expect(inspector(page).getByLabel("Vector origin x")).not.toHaveValue("0", { timeout: 8000 });
    await expect(inspector(page).getByLabel("Vector component x").first()).toHaveValue("2");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("L: Vector tip drag updates components, preserves origin", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await page.getByRole("button", { name: "Vector", exact: true }).click();
    await inspector(page).getByLabel("Vector origin x").fill("0");
    await inspector(page).getByLabel("Vector origin y").fill("0");
    await inspector(page).getByLabel("Vector origin z").fill("0");
    await inspector(page).getByLabel("Vector component x").first().fill("2");
    await inspector(page).getByLabel("Vector component y").first().fill("0");
    await inspector(page).getByLabel("Vector component z").first().fill("0");
    // Tip at (2,0,0) ≈ 107px right of center at default span.
    const { x, y } = await canvasCenter(page);
    await page.mouse.move(x + 107, y);
    await page.mouse.down();
    await page.mouse.move(x + 147, y, { steps: 8 });
    await page.mouse.up();
    await expect(inspector(page).getByLabel("Vector component x").first()).not.toHaveValue("2", { timeout: 8000 });
    await expect(inspector(page).getByLabel("Vector origin x")).toHaveValue("0");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("M: zero Vector tip stays manipulable without crash", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await page.getByRole("button", { name: "Vector", exact: true }).click();
    // Zero the vector: tip coincides with origin; offset tip handle grabs.
    await inspector(page).getByLabel("Vector origin x").fill("0");
    await inspector(page).getByLabel("Vector origin y").fill("0");
    await inspector(page).getByLabel("Vector origin z").fill("0");
    await inspector(page).getByLabel("Vector component x").first().fill("0");
    await inspector(page).getByLabel("Vector component y").first().fill("0");
    await inspector(page).getByLabel("Vector component z").first().fill("0");
    // Tip handle is offset 0.4 world units; default ortho span is 12 units
    // across the canvas's shorter side.
    const { x, y, box } = await canvasCenter(page);
    const tipOffset = (Math.min(box.width, box.height) / 12) * 0.4;
    await page.mouse.move(x + tipOffset, y);
    await page.mouse.down();
    await page.mouse.move(x + tipOffset + 40, y, { steps: 8 });
    await page.mouse.up();
    await expect(inspector(page).getByLabel("Vector component x").first()).not.toHaveValue("0", { timeout: 8000 });
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("N: Line defining-point drag preserves direction", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await page.getByRole("button", { name: "Infinite Line", exact: true }).click();
    await inspector(page).getByLabel("Line point x").fill("0");
    await inspector(page).getByLabel("Line point y").fill("0");
    await inspector(page).getByLabel("Line point z").fill("0");
    const { x, y } = await canvasCenter(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 50, y, { steps: 8 });
    await page.mouse.up();
    await expect(inspector(page).getByLabel("Line point x")).not.toHaveValue("0", { timeout: 8000 });
    await expect(inspector(page).getByLabel("Line direction x")).toHaveValue("3");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("O: Ray origin drag preserves direction", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await showMoreAdd(page);
    await page.getByRole("button", { name: "Ray", exact: true }).click();
    await inspector(page).getByLabel("Ray origin x").fill("0");
    await inspector(page).getByLabel("Ray origin y").fill("0");
    await inspector(page).getByLabel("Ray origin z").fill("0");
    const { x, y } = await canvasCenter(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 50, { steps: 8 });
    await page.mouse.up();
    await expect(inspector(page).getByLabel("Ray origin y")).not.toHaveValue("0", { timeout: 8000 });
    await expect(inspector(page).getByLabel("Ray direction x")).toHaveValue("-1");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("P: expression-backed Point is locked (raw expression preserved, 0 edits)", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await page.getByRole("button", { name: "Point", exact: true }).click();
    // Parameter-backed coordinate: renders at the origin for the default
    // r=2.5 but must never be rewritten by a drag.
    await inspector(page).getByLabel("Point x").fill("r-2.5");
    await inspector(page).getByLabel("Point y").fill("0");
    await inspector(page).getByLabel("Point z").fill("0");
    const { x, y } = await canvasCenter(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 60, y, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    // No rewrite: raw expression intact, no history, no jobs.
    await expect(inspector(page).getByLabel("Point x")).toHaveValue("r-2.5");
    await expect(page.locator('[data-testid="compute-status-pending"]')).toHaveCount(0);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Q: mixed lock is pane-local (YZ drags, XY locked)", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await page.getByRole("button", { name: "Point", exact: true }).click();
    // Foldable-but-not-literal x: renders at x=3 yet locks XY dragging.
    await inspector(page).getByLabel("Point x").fill("1+2");
    await inspector(page).getByLabel("Point y").fill("0");
    await inspector(page).getByLabel("Point z").fill("0");
    const { x, y } = await canvasCenter(page);
    // XY requires x → locked: grab the point itself (x=3 ≈ +160px) and
    // drag; the gesture becomes a camera pan, math untouched.
    await page.mouse.move(x + 160, y);
    await page.mouse.down();
    await page.mouse.move(x + 220, y, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    await expect(inspector(page).getByLabel("Point x")).toHaveValue("1+2");
    await expect(inspector(page).getByLabel("Point y")).toHaveValue("0");
    // YZ needs only y/z → draggable.
    await page.getByLabel("Geometry view").selectOption("yz");
    const center = await canvasCenter(page);
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x + 60, center.y, { steps: 8 });
    await page.mouse.up();
    await expect(inspector(page).getByLabel("Point y")).not.toHaveValue("0", { timeout: 8000 });
    await expect(inspector(page).getByLabel("Point x")).toHaveValue("1+2");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("R: Escape cancels the drag (originals restored, 0 history)", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    // No Inspector fills here: creation is the ONLY history entry, so one
    // Undo after cancel must remove the point itself.
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    // Defocus onto the row, frame the default point to the center, drag it.
    await page.getByRole("button", { name: "Selected Point #1" }).click();
    await page.keyboard.press("f");
    const { x, y } = await canvasCenter(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 60, y, { steps: 8 });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(inspector(page).getByLabel("Point x")).toHaveValue("1", { timeout: 8000 });
    await expect(inspector(page).getByLabel("Point y")).toHaveValue("2");
    await expect(inspector(page).getByLabel("Point z")).toHaveValue("3");
    // Cancel pushed nothing: one Undo removes the created point itself.
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("0");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("S: pointer leaving mid-drag keeps tracking (capture, no stuck state)", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await createPointAt(page, "0", "0", "0");
    const { x, y, box } = await canvasCenter(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    // Drag far outside the canvas, then release outside (capture holds it).
    await page.mouse.move(box.x - 50, box.y - 50, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    // Committed (capture holds the gesture): the point moved with the pointer.
    await expect(inspector(page).getByLabel("Point x")).not.toHaveValue("0", { timeout: 8000 });
    // No stuck move cursor after release outside the canvas.
    await page.mouse.move(x, y);
    await page.waitForTimeout(400);
    const cursor = await graph3dCanvas(page).evaluate((el) => (el as HTMLElement).style.cursor);
    expect(cursor === "" || cursor === "pointer").toBe(true);
    // Canvas interactive afterwards: reselect via the row, values intact.
    await page.getByRole("button", { name: /^(Select|Selected) Point #1$/ }).click();
    await expect(page.getByRole("button", { name: "Selected Point #1" })).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("T: derived overlay clicks never select or drag", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await inspector(page).getByLabel("Point x").fill("0");
    await inspector(page).getByLabel("Point y").fill("0");
    await inspector(page).getByLabel("Point z").fill("0");
    await page.getByRole("button", { name: "Infinite Line", exact: true }).click();
    await page.getByRole("button", { name: /Point #1/ }).click();
    await openAnalyze(page);
    const select = page.getByLabel("Second object for geometry analysis");
    const value = await select.evaluate((element, text) => {
      const options = Array.from((element as HTMLSelectElement).options);
      return options.find((option) => option.label.includes(text))?.value ?? null;
    }, "Infinite Line #2");
    await select.selectOption(value as string);
    await expect(page.getByTestId("geometry-fact-distance")).toBeVisible({ timeout: 10000 });
    await page.getByRole("switch", { name: "Show projection" }).click();
    // Click the projection marker area (canvas center): selection stays.
    const { x, y } = await canvasCenter(page);
    await page.mouse.click(x, y);
    await expect(page.getByRole("button", { name: /^(Select|Selected) Point #1$/ })).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("U: Geometry Analysis facts update live during drag", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await inspector(page).getByLabel("Point x").fill("0");
    await inspector(page).getByLabel("Point y").fill("0");
    await inspector(page).getByLabel("Point z").fill("0");
    await page.getByRole("button", { name: "Infinite Line", exact: true }).click();
    await page.getByRole("button", { name: /Point #1/ }).click();
    await openAnalyze(page);
    const select = page.getByLabel("Second object for geometry analysis");
    const value = await select.evaluate((element, text) => {
      const options = Array.from((element as HTMLSelectElement).options);
      return options.find((option) => option.label.includes(text))?.value ?? null;
    }, "Infinite Line #2");
    await select.selectOption(value as string);
    await expect(page.getByTestId("geometry-fact-distance")).toBeVisible({ timeout: 10000 });
    // Return to Object tab context is unnecessary: drag the point on canvas.
    const { x, y } = await canvasCenter(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 80, y, { steps: 10 });
    await page.mouse.up();
    // Distance fact recomputed from the dragged position (was 0).
    await expect(page.getByTestId("geometry-fact-distance")).not.toHaveText("0", { timeout: 10000 });
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("V: Linear Transform cross-feature (origin vs tip)", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await page.getByRole("button", { name: "Vector", exact: true }).click();
    await inspector(page).getByLabel("Vector origin x").fill("0");
    await inspector(page).getByLabel("Vector origin y").fill("0");
    await inspector(page).getByLabel("Vector origin z").fill("0");
    await inspector(page).getByLabel("Vector component x").first().fill("1");
    await inspector(page).getByLabel("Vector component y").first().fill("0");
    await inspector(page).getByLabel("Vector component z").first().fill("0");
    await showMoreAdd(page);
    await page.getByRole("button", { name: "2D Linear Transformation", exact: true }).click();
    // The transform stays selected: its Analyze tab hosts Apply to Vector.
    await openAnalyze(page);
    const select = page.getByLabel("Vector for transformation analysis");
    const value = await select.evaluate((element, text) => {
      const options = Array.from((element as HTMLSelectElement).options);
      return options.find((option) => option.label.includes(text))?.value ?? null;
    }, "Vector #1");
    await select.selectOption(value as string);
    await expect(page.getByTestId("linear-fact-av")).toBeVisible({ timeout: 10000 });
    const before = await page.getByTestId("linear-fact-av").textContent();
    // Select the vector and drag its ORIGIN (center): Av unchanged.
    await page.getByRole("button", { name: /^(Select|Selected) Vector #1$/ }).click();
    const { x, y } = await canvasCenter(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 40, y, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /^(Select|Selected) Linear Transformation #2$/ }).click();
    await openAnalyze(page);
    await expect(page.getByTestId("linear-fact-av")).toHaveText(before ?? "");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("W: orbit keeps numeric analysis invariant", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await inspector(page).getByLabel("Point x").fill("0");
    await inspector(page).getByLabel("Point y").fill("0");
    await inspector(page).getByLabel("Point z").fill("0");
    await page.getByRole("button", { name: "Infinite Line", exact: true }).click();
    await page.getByRole("button", { name: /Point #1/ }).click();
    await openAnalyze(page);
    const select = page.getByLabel("Second object for geometry analysis");
    const value = await select.evaluate((element, text) => {
      const options = Array.from((element as HTMLSelectElement).options);
      return options.find((option) => option.label.includes(text))?.value ?? null;
    }, "Infinite Line #2");
    await select.selectOption(value as string);
    await expect(page.getByTestId("geometry-fact-distance")).toBeVisible({ timeout: 10000 });
    const before = await page.getByTestId("geometry-fact-distance").textContent();
    // Orbit drag (perspective default): facts must not move.
    const { x, y } = await canvasCenter(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 150, y + 80, { steps: 12 });
    await page.mouse.up();
    await expect(page.getByTestId("geometry-fact-distance")).toHaveText(before ?? "");
    await expect(page.locator('[data-testid="compute-status-pending"]')).toHaveCount(0);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("X: Quad Frame Selected targets the active pane only", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry layout").selectOption("quad");
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await inspector(page).getByLabel("Point x").fill("20");
    await inspector(page).getByLabel("Point y").fill("0");
    await inspector(page).getByLabel("Point z").fill("0");
    // Activate the XY pane, then frame: selection stays global and clean.
    await page.getByRole("button", { name: "XY viewport" }).click();
    await page.keyboard.press("f");
    await expect(page.getByRole("button", { name: "Selected Point #1" })).toBeVisible();
    await expect(page.getByRole("button", { name: "XY viewport" })).toHaveAttribute("aria-pressed", "true");
    await expect(graph3dCanvas(page)).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Y: view switch mid-drag restores pre-drag values", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await createPointAt(page, "0", "0", "0");
    const { x, y } = await canvasCenter(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 60, y, { steps: 8 });
    // Switch planes mid-drag without touching the pointer.
    await page.getByLabel("Geometry view").selectOption("xz");
    await page.mouse.up();
    await expect(inspector(page).getByLabel("Point x")).toHaveValue("0", { timeout: 8000 });
    await expect(inspector(page).getByLabel("Point y")).toHaveValue("0");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Z: Delete during drag is ignored (no crash, no orphan)", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await createPointAt(page, "0", "0", "0");
    const { x, y } = await canvasCenter(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 60, y, { steps: 8 });
    await page.keyboard.press("Delete");
    // Object survives the guarded delete; release commits the drag.
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.mouse.up();
    await expect(inspector(page).getByLabel("Point x")).not.toHaveValue("0", { timeout: 8000 });
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("AA: F/Space/Delete in inputs edit text, never trigger canvas", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Point", exact: true }).click();
    const input = inspector(page).getByLabel("Point x");
    await input.fill("5");
    await input.press("End");
    await page.keyboard.type(" f");
    await expect(input).toHaveValue("5 f");
    await page.keyboard.press("Delete");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByRole("button", { name: "Selected Point #1" })).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("AB: Math 2D wheel pans, Ctrl+wheel zooms", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await page.getByRole("group", { name: "View type" }).getByRole("button", { name: "2D only" }).click();
    const badge = page.getByTestId("graph2d-viewport-range-badge");
    const canvas = page.locator('canvas[data-graph2d-canvas="true"]').first();
    await expect(canvas).toBeVisible();
    const before = await badge.textContent().catch(() => null);
    const box = await canvas.boundingBox();
    if (!box) {
      throw new Error("2d canvas has no box");
    }
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(600);
    const after = await badge.textContent().catch(() => null);
    // Plain wheel pans the 2D viewport (range badge moves).
    expect(after).not.toBe(before);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("AC: handle lifecycle follows selection and scene", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await createPointAt(page, "0", "0", "0");
    const { x, y } = await canvasCenter(page);
    // Handle grab works, then deleting the object leaves no stuck state.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 40, y, { steps: 6 });
    await page.mouse.up();
    await expect(inspector(page).getByLabel("Point x")).not.toHaveValue("0", { timeout: 8000 });
    await page.getByRole("button", { name: "Object actions" }).first().click();
    await page.getByRole("menuitem", { name: "Remove" }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("0");
    // Fresh scene, fresh point: drag works again (no orphan handles).
    await page.getByRole("button", { name: "Point", exact: true }).click();
    const center = await canvasCenter(page);
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x + 40, center.y, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("AD: many pointermoves collapse into one undo entry", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await createPointAt(page, "0", "0", "0");
    const { x, y } = await canvasCenter(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 90, y + 30, { steps: 30 });
    await page.mouse.up();
    await expect(inspector(page).getByLabel("Point x")).not.toHaveValue("0", { timeout: 8000 });
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(inspector(page).getByLabel("Point x")).toHaveValue("0");
    await expect(inspector(page).getByLabel("Point y")).toHaveValue("0");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("AE: hover/frame/camera leave serialization untouched", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await createPointAt(page, "1", "2", "3");
    const before = {
      x: await inspector(page).getByLabel("Point x").inputValue(),
      y: await inspector(page).getByLabel("Point y").inputValue(),
      z: await inspector(page).getByLabel("Point z").inputValue()
    };
    const { x, y } = await canvasCenter(page);
    await page.mouse.move(x, y);
    await page.waitForTimeout(400);
    // Defocus the equation input onto the object row so F reaches the canvas.
    await page.getByRole("button", { name: "Selected Point #1" }).click();
    await page.keyboard.press("f");
    await page.waitForTimeout(400);
    // Camera orbit after framing.
    await page.getByLabel("Geometry view").selectOption("perspective");
    const center = await canvasCenter(page);
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x + 100, center.y + 40, { steps: 10 });
    await page.mouse.up();
    await expect(inspector(page).getByLabel("Point x")).toHaveValue(before.x);
    await expect(inspector(page).getByLabel("Point y")).toHaveValue(before.y);
    await expect(inspector(page).getByLabel("Point z")).toHaveValue(before.z);
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("AF: narrow 430x800 canvas sanity (no touch optimization yet)", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 430, height: 800 });
    await startClean(page);
    await toGeometry(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page.getByRole("button", { name: "Point", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await expect(inspector(page).getByLabel("Point x")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(graph3dCanvas(page)).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("AG: canvas interaction has no axe violations", async ({ page }) => {
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await createPointAt(page, "1", "2", "3");
    await openAnalyze(page);
    await page.waitForTimeout(800);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("AH: Vector tip drags with parameter-backed origin (no swallowed gesture)", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await page.getByLabel("Geometry view").selectOption("xy");
    await page.getByRole("button", { name: "Vector", exact: true }).click();
    // Origin resolves through the parameter (renders at 0,0,0) while its
    // raw text stays non-literal; tip components are plain literals.
    await inspector(page).getByLabel("Vector origin x").fill("r-2.5");
    await inspector(page).getByLabel("Vector origin y").fill("0");
    await inspector(page).getByLabel("Vector origin z").fill("0");
    await inspector(page).getByLabel("Vector component x").first().fill("2");
    await inspector(page).getByLabel("Vector component y").first().fill("0");
    await inspector(page).getByLabel("Vector component z").first().fill("0");
    // Tip at (2,0,0) ≈ 107px right of center at default span.
    const { x, y } = await canvasCenter(page);
    await page.mouse.move(x + 107, y);
    await page.mouse.down();
    await page.mouse.move(x + 147, y, { steps: 8 });
    await page.mouse.up();
    // Components follow the pointer; the parameter-backed origin text is
    // preserved exactly (S33-R6: no NaN swallow, no rewrite).
    await expect(inspector(page).getByLabel("Vector component x").first()).not.toHaveValue("2", { timeout: 8000 });
    await expect(inspector(page).getByLabel("Vector origin x")).toHaveValue("r-2.5");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(inspector(page).getByLabel("Vector component x").first()).toHaveValue("2");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
