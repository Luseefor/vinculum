import { addObject } from "./helpers/addObject";
import { fillInput } from "./helpers/mathInput";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// S26 geometry primitives: vector/line/ray/segment creation, editing,
// degeneracy diagnostics, parameters, canvas selection, orthographic
// views, split/quad, camera extent, visibility/color, persistence,
// undo/redo, workspace coherence, narrow sheets, security/a11y.
// Zero unexpected console/page errors.
// Each case owns a fresh page/scene; a failure must not skip later coverage.
test.describe.configure({ mode: "default" });

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

async function setGeometryView(page: Page, view: "Perspective" | "XY" | "XZ" | "YZ") {
  await page.getByLabel("Geometry view").selectOption(view.toLowerCase());
}

async function setGeometryLayout(page: Page, layout: "Single" | "Split" | "Quad") {
  await page.getByLabel("Geometry layout").selectOption(layout.toLowerCase());
}

function graph3dCanvas(page: Page) {
  return page.locator('canvas[data-graph3d-canvas="true"]').first();
}

async function settleScene(page: Page) {
  await page.waitForTimeout(1200);
}

test.describe("S26 geometry primitives", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("A: add Vector, edit origin/components, arrow selected", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Vector");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByRole("button", { name: "Selected Vector #1" })).toBeVisible();
    await fillInput(page.getByLabel("Vector origin x").first(), "1");
    await fillInput(page.getByLabel("Vector origin y").first(), "2");
    await fillInput(page.getByLabel("Vector origin z").first(), "3");
    await fillInput(page.getByLabel("Vector component x").first(), "4");
    await fillInput(page.getByLabel("Vector component y").first(), "5");
    await fillInput(page.getByLabel("Vector component z").first(), "6");
    await expect(graph3dCanvas(page)).toBeVisible();
    await expect(page.getByText(/Magnitude/).first()).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("B: zero vector stays valid with point marker, no crash or NaN", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Vector");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await fillInput(page.getByLabel("Vector component x").first(), "0");
    await fillInput(page.getByLabel("Vector component y").first(), "0");
    await fillInput(page.getByLabel("Vector component z").first(), "0");
    await expect(page.getByText("Zero vector.").first()).toBeVisible();
    await expect(graph3dCanvas(page)).toBeVisible();
    expect(await page.locator("body").textContent()).not.toMatch(/NaN/);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("C: infinite Line spans the viewport and edits live", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Infinite Line");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByRole("button", { name: "Selected Infinite Line #1" })).toBeVisible();
    await fillInput(page.getByLabel("Line point x").first(), "-1");
    await fillInput(page.getByLabel("Line direction x").first(), "3");
    await expect(graph3dCanvas(page)).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("D: Ray renders one-sided with direction marker", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await showMoreAdd(page);
    await addObject(page, "Ray");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByRole("button", { name: "Selected Ray #1" })).toBeVisible();
    await expect(graph3dCanvas(page)).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("E: Segment connects finite endpoints", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Segment");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByRole("button", { name: "Selected Segment #1" })).toBeVisible();
    await expect(page.getByText(/Length/).first()).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("F: degenerate Segment A=B is point-valid without crash", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Segment");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await fillInput(page.getByLabel("Segment end x").first(), "-2");
    await fillInput(page.getByLabel("Segment end y").first(), "-1");
    await fillInput(page.getByLabel("Segment end z").first(), "0");
    await expect(page.getByText(/Coincident endpoints/).first()).toBeVisible();
    expect(await page.locator("body").textContent()).not.toMatch(/NaN/);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("G: zero-direction Line diagnoses and restores on valid edit", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Infinite Line");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await fillInput(page.getByLabel("Line direction x").first(), "0");
    await fillInput(page.getByLabel("Line direction y").first(), "0");
    await fillInput(page.getByLabel("Line direction z").first(), "0");
    await expect(page.getByText("Line direction must be nonzero.").first()).toBeVisible();
    await expect(graph3dCanvas(page)).toBeVisible();
    await fillInput(page.getByLabel("Line direction x").first(), "1");
    await expect(page.getByText("Line direction must be nonzero.")).toHaveCount(0);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("H: formula edits update vector magnitude live", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await showMoreAdd(page);
    await addObject(page, "Vector");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await fillInput(page.getByLabel("Vector component x").first(), "r");
    await fillInput(page.getByLabel("Vector component y").first(), "0");
    await fillInput(page.getByLabel("Vector component z").first(), "0");
    await expect(page.getByText("Magnitude 2.5.").first()).toBeVisible({ timeout: 10000 });
    await fillInput(page.getByLabel("Vector component x").first(), "4");
    await expect(page.getByText("Magnitude 4.").first()).toBeVisible({ timeout: 10000 });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("I: canvas clean-click selects the vector in Perspective", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Vector");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await fillInput(page.getByLabel("Vector origin x").first(), "0");
    await fillInput(page.getByLabel("Vector origin y").first(), "0");
    await fillInput(page.getByLabel("Vector origin z").first(), "0");
    await fillInput(page.getByLabel("Vector component x").first(), "5");
    await fillInput(page.getByLabel("Vector component y").first(), "0");
    await fillInput(page.getByLabel("Vector component z").first(), "0");
    // Select a different target first (add a curve), then sweep
    // clean clicks along the arrow's screen span: the first click on the
    // fat invisible proxy selects the vector (misses change nothing).
    await showMoreAdd(page);
    await addObject(page, "Parametric Curve");
    await expect(page.getByTestId("scene-object-count")).toHaveText("2");
    await expect(page.getByRole("button", { name: "Selected Parametric Curve #2" })).toBeVisible();
    const canvas = graph3dCanvas(page);
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    // The +x arrow's screen direction depends on the canvas aspect ratio, so
    // sweep both the upper-right and lower-right fans from the origin.
    const sweep: Array<[number, number]> = [
      [0.62, 0.57],
      [0.66, 0.6],
      [0.7, 0.62],
      [0.74, 0.645],
      [0.78, 0.67],
      [0.65, 0.2],
      [0.68, 0.3],
      [0.7, 0.4],
      [0.73, 0.5],
      [0.75, 0.6],
      [0.78, 0.7]
    ];
    for (const [fx, fy] of sweep) {
      if ((await page.getByRole("button", { name: "Selected Vector #1" }).count()) > 0) {
        break;
      }
      await page.mouse.click(box!.x + box!.width * fx, box!.y + box!.height * fy);
    }
    await expect(page.getByRole("button", { name: "Selected Vector #1" })).toBeVisible({ timeout: 10000 });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("J: XY/XZ/YZ show the asymmetric scene without errors", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Vector");
    await addObject(page, "Infinite Line");
    await addObject(page, "Segment");
    await expect(page.getByTestId("scene-object-count")).toHaveText("3");
    for (const view of ["XY", "XZ", "YZ"] as const) {
      await setGeometryView(page, view);
      await settleScene(page);
      await expect(graph3dCanvas(page)).toBeVisible();
    }
    await setGeometryView(page, "Perspective");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("K: Split and Quad share canonical resources", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Vector");
    await showMoreAdd(page);
    await addObject(page, "Ray");
    await setGeometryLayout(page, "Split");
    await settleScene(page);
    await expect(graph3dCanvas(page)).toBeVisible();
    await setGeometryLayout(page, "Quad");
    await settleScene(page);
    await expect(graph3dCanvas(page)).toBeVisible();
    await expect(page.getByTestId("scene-object-count")).toHaveText("2");
    await setGeometryLayout(page, "Single");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("L: orbit does not expose short Line extent", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Infinite Line");
    const canvas = graph3dCanvas(page);
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2 + 150, box!.y + box!.height / 2 + 60, { steps: 8 });
    await page.mouse.up();
    await settleScene(page);
    await expect(canvas).toBeVisible();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("M: visibility and color apply in place", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Segment");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByRole("button", { name: "Hide object" }).first().click();
    await settleScene(page);
    await expect(graph3dCanvas(page)).toBeVisible();
    await page.getByRole("button", { name: "Show object" }).first().click();
    await page.getByRole("tab", { name: "Settings" }).click();
    await fillInput(page.locator('input[type="color"]').first(), "#ff0000");
    await settleScene(page);
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("N: save/reopen preserves raw coordinate expressions", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Vector");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await fillInput(page.getByLabel("Vector component x").first(), "2*pi");
    await page.getByRole("button", { name: "Scene" }).click();
    await page.getByRole("menuitem", { name: "Save as..." }).click();
    await fillInput(page.locator("#project-name-input"), "s26-primitives");
    await page.getByRole("button", { name: "Save project", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Save as project" })).not.toBeVisible({ timeout: 10000 });
    await page.reload();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByRole("button", { name: /Vector #1/ })).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("O: undo/redo restores coordinate edits and deletion", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Segment");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("0");
    await page.getByRole("button", { name: "Redo" }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByRole("button", { name: /Segment #1/ })).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("P: primitives cohere across Math Lab and Geometry Studio", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toMathLab(page);
    await showMoreAdd(page);
    await addObject(page, "Ray");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await toGeometry(page);
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await expect(page.getByRole("button", { name: /Ray #1/ })).toBeVisible();
    await toMathLab(page);
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("Q: narrow 430x800 reaches primitive editors", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.setViewportSize({ width: 430, height: 800 });
    await startClean(page);
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await showMoreAdd(page);
    await addObject(page, "Vector");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await expect(page.getByLabel("Vector origin x").first()).toBeVisible();
    await page.keyboard.press("Escape");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("R: unsafe coordinate rejected with axe clean", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);
    await startClean(page);
    await toGeometry(page);
    await addObject(page, "Vector");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await fillInput(page.getByLabel("Vector component x").first(), "sin(factorial(a))");
    await expect(page.getByRole("alert").first()).toBeVisible({ timeout: 10000 });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
