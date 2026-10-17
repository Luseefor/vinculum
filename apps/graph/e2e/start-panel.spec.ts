import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function openFresh(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto("/editor");
  await expect(page.getByTestId("canvas-empty-state")).toBeVisible();
}

async function settled(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => undefined)));
  });
}

for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1280, 800], [1440, 900], [844, 390]]) {
  test(`${width}x${height} start panel stays contained, scrolls, and hands off to examples`, async ({ page }) => {
    await openFresh(page, width, height);
    const panel = page.getByTestId("canvas-empty-state");
    await expect(panel).toHaveCount(1);
    await expect(panel.getByTestId("first-run-hint")).toHaveCount(1);
    const bounds = (await panel.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    if (height <= 568) {
      for (const name of ["Create Surface", "Create Parametric Curve", "Create 2D Vector Field"]) {
        const starter = panel.getByRole("button", { name, exact: true });
        expect(await starter.evaluate(button => {
          const box = button.getBoundingClientRect();
          return button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
        }), `${name} is visible before scrolling`).toBe(true);
      }
    }
    const tips = panel.locator("summary");
    await tips.click();
    await expect(panel.getByText("Use Solve for field problems; Inspector → Analyze for a selected object.")).toBeVisible();
    await panel.getByRole("button", { name: "Got it", exact: true }).click();
    await expect(panel.getByTestId("first-run-hint")).toHaveCount(0);
    const examples = panel.getByRole("button", { name: "Open example", exact: true });
    await expect(examples).toBeFocused();
    await examples.click();
    const gallery = page.getByRole("dialog", { name: /example/i });
    await expect(gallery).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(examples).toBeFocused();
    await panel.getByRole("button", { name: "Where are the tools?", exact: true }).click();
    await expect(page.getByTestId("editor-guide")).toBeVisible();
  });
}

test("keyboard dismissal and reopening preserve the empty scene", async ({ page }) => {
  await openFresh(page, 1280, 800);
  const close = page.getByRole("button", { name: "Hide start panel" });
  await close.focus();
  await page.keyboard.press("Escape");
  const reopen = page.getByRole("button", { name: "Show start panel" });
  await expect(reopen).toBeFocused();
  await expect(page.getByTestId("canvas-empty-state")).toHaveCount(0);
  await expect(page.getByTestId("scene-object-count")).toHaveText("0");
  await page.keyboard.press("Enter");
  await expect(close).toBeFocused();
  await expect(page.getByTestId("first-run-hint")).toHaveCount(0);
  await page.getByRole("button", { name: "Create 2D Vector Field" }).click();
  await expect(page.getByTestId("canvas-empty-state")).toHaveCount(0);
  await expect(page.getByTestId("scene-object-count")).toHaveText("1");
});

test("split and quad layouts share one start panel across their panes", async ({ page }) => {
  await openFresh(page, 1440, 900);
  await page.getByRole("button", { name: "2D and 3D together", exact: true }).click();
  await page.getByRole("button", { name: "Four-panel layout", exact: true }).click();
  await expect(page.getByTestId("canvas-empty-state")).toHaveCount(0);
  const zooms = page.getByRole("button", { name: "Zoom in", exact: true });
  await expect(zooms).toHaveCount(2);
  for (const zoom of await zooms.all()) {
    expect(await zoom.evaluate(button => {
      const box = button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    })).toBe(true);
  }
  await page.getByRole("button", { name: "Show start panel" }).click();
  await expect(page.getByTestId("canvas-empty-state")).toHaveCount(1);
  await expect(page.getByTestId("first-run-hint")).toHaveCount(1);
  await page.getByRole("button", { name: "Side-by-side layout", exact: true }).click();
  await expect(page.getByTestId("canvas-empty-state")).toHaveCount(1);
});

for (const theme of ["light", "dark"] as const) {
  test(`${theme} start panel is accessible with reduced motion and expanded tips`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openFresh(page, 390, 844);
    await page.evaluate(theme => document.documentElement.setAttribute("data-theme", theme), theme);
    const panel = page.getByTestId("canvas-empty-state");
    await panel.locator("summary").click();
    await settled(page);
    const movingOrHidden = await panel.evaluate(el => [...el.querySelectorAll("[style]")]
      .filter(child => getComputedStyle(child).transform !== "none" || Number(getComputedStyle(child).opacity) < 1)
      .map(child => ({ html: child.outerHTML.slice(0, 200), transform: getComputedStyle(child).transform, opacity: getComputedStyle(child).opacity })));
    expect(movingOrHidden).toEqual([]);
    const results = await new AxeBuilder({ page }).include('[data-testid="canvas-empty-state"]').analyze();
    expect(results.violations).toEqual([]);
    await page.getByRole("button", { name: "Create Surface", exact: true }).click();
    await expect(panel).toHaveCount(0);
    const objects = page.getByRole("button", { name: "Objects", exact: true });
    await expect(objects).toContainText("1");
    if (!await page.getByTestId("scene-object-count").isVisible()) await objects.click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
  });
}

test("changing the motion preference keeps the focused action usable", async ({ page }) => {
  await openFresh(page, 1280, 800);
  const examples = page.getByRole("button", { name: "Open example", exact: true });
  await examples.focus();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(examples).toBeFocused();
  await expect.poll(() => page.getByTestId("canvas-empty-state").evaluate(el => [...el.querySelectorAll("[style]")].every(child => getComputedStyle(child).transform === "none" && getComputedStyle(child).opacity === "1"))).toBe(true);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(examples).toBeFocused();
  await examples.click();
  await expect(page.getByRole("dialog", { name: /example/i })).toBeVisible();
});
