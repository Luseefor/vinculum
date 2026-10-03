import { addObject } from "./helpers/addObject";
import { fillInput, expectInputValue } from "./helpers/mathInput";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

test.setTimeout(60_000);

async function openEditor(page: Page, width: number, height = 844) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(() => {
    localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true }));
    // A desktop width saved before opening the app on a phone must not clip a sheet.
    localStorage.setItem("vinculum-editor-layout", JSON.stringify({ version: 1, state: { rightPanelWidth: 400 } }));
  });
  await page.goto("/editor");
  await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toHaveAttribute("data-render-backend", /webgpu|webgl2/, { timeout: 30000 });
  await page.getByRole("button", { name: "Math Lab", exact: true }).click();
}

async function expectInside(locator: Locator, container: Locator) {
  const outer = await container.boundingBox();
  const bounds = await locator.boundingBox();
  expect(outer).not.toBeNull();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(outer!.x - 1);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(outer!.x + outer!.width + 1);
  expect(bounds!.y).toBeGreaterThanOrEqual(outer!.y - 1);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(outer!.y + outer!.height + 1);
}

test("desktop panels can close and reopen without losing the selected expression", async ({ page }) => {
  await openEditor(page, 1440, 900);
  await page.getByRole("button", { name: "2D only", exact: true }).click();
  await addObject(page, "Surface");
  const inspector = page.getByRole("complementary", { name: "Inspector", exact: true });
  await fillInput(inspector.getByLabel("Surface expression z = f(x,y)"), "x^2 + y^2");
  await page.getByRole("button", { name: "Close inspector", exact: true }).click();
  await expect(inspector).toHaveCount(0);
  await page.getByRole("button", { name: "Inspector", exact: true }).click();
  await expectInputValue(inspector.getByLabel("Surface expression z = f(x,y)"), "x^2 + y^2");
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "Scene Navigator" })).toHaveCount(0);
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  await page.getByRole("button", { name: "Selected Surface #1", exact: true }).click();
  await expectInputValue(page.getByRole("complementary", { name: "Scene Navigator" }).getByLabel("Equation", { exact: true }), "x^2 + y^2");
  await fillInput(page.getByRole("complementary", { name: "Scene Navigator" }).getByLabel("Equation", { exact: true }), "sin(x)");
  await expectInputValue(inspector.getByLabel("Surface expression z = f(x,y)"), "sin(x)");
});

for (const width of [320, 390, 1024]) {
  test(`${width}px controls and resized inspector stay inside their containers`, async ({ page }) => {
    await openEditor(page, width);
    const header = page.locator("header");
    const controls = header.getByRole("button");
    for (let i = 0; i < await controls.count(); i++) await expectInside(controls.nth(i), header);
    const compact = width < 720;
    await page.getByRole("button", { name: "2D and 3D together", exact: true }).click();
    const viewControls = page.locator('[data-view-controls="true"]');
    for (const control of await viewControls.locator("button, select").all()) {
      await expectInside(control, viewControls);
    }
    await page.getByRole("button", { name: "3D only", exact: true }).click();
    // Verify the view controls first, then isolate panel layout from software GPU load.
    await page.getByRole("button", { name: "2D only", exact: true }).click();
    if (compact) await page.getByRole("button", { name: "Objects", exact: true }).click();
    await addObject(page, "Surface");
    if (compact) {
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Inspector", exact: true }).click();
    }
    const inspector = page.getByRole("complementary", { name: "Inspector", exact: true });
    const container = compact ? page.getByRole("dialog", { name: "Inspector", exact: true }) : inspector;
    const tabs = inspector.getByRole("tab");
    for (let i = 0; i < await tabs.count(); i++) await expectInside(tabs.nth(i), container);
    await expectInside(inspector.locator("math-field[aria-label=\"Surface expression z = f(x,y)\"]"), container);
    await expectInside(inspector.getByLabel("y max", { exact: true }), container);
    if (compact) {
      await expectInside(page.getByRole("button", { name: "Close", exact: true }), container);
      const sheet = page.getByRole("dialog", { name: "Inspector", exact: true });
      expect(await sheet.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
    }
    const axe = await new AxeBuilder({ page }).include(".app-shell").analyze();
    expect(axe.violations).toEqual([]);
  });
}

test("compact project menu opens the existing save and open dialogs", async ({ page }) => {
  await openEditor(page, 390);
  const more = page.getByRole("button", { name: "More actions" });
  await more.click();
  await expect(page.getByRole("menuitem", { name: "Save project", exact: true })).toBeVisible();
  await page.getByRole("menuitem", { name: "Save as...", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Save as project" })).toBeVisible();
  await page.keyboard.press("Escape");
  await more.click();
  await page.getByRole("menuitem", { name: "Open project...", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Open project" })).toBeVisible();
});


for (const width of [320, 1440]) {
  test(`${width}px editor removes obsolete panels even when saved open`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true }));
      localStorage.setItem("vinculum-editor-layout", JSON.stringify({ version: 1, state: { bottomPanelCollapsed: false, bottomPanelHeight: 300, bottomPanelTab: "parameters" } }));
    });
    await page.goto("/editor");
    await expect(page.locator("footer, .bottom-dock, .divider-y")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "More panels", exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Parameter r", { exact: true })).toHaveCount(0);
    const main = (await page.getByRole("main").boundingBox())!;
    expect(main.y + main.height).toBeGreaterThanOrEqual(843);
  });
}

test("distance measurements remain available without a bottom panel", async ({ page }) => {
  await openEditor(page, 1440, 900);
  await page.getByRole("button", { name: "2D only", exact: true }).click();
  await page.getByRole("combobox", { name: "Tool", exact: true }).selectOption("measureDistance");
  const bounds = (await page.locator('canvas[data-graph2d-canvas="true"]').first().boundingBox())!;
  await page.mouse.click(bounds.x + bounds.width * .35, bounds.y + bounds.height * .5);
  await page.mouse.click(bounds.x + bounds.width * .65, bounds.y + bounds.height * .5);
  const browser = page.getByRole("complementary", { name: "Scene Navigator" });
  const row = browser.getByRole("button", { name: /^distance\s*[\d.]+ u$/ });
  await expect(row).toBeVisible();
  await row.click();
  await browser.getByRole("button", { name: "Delete measurement distance", exact: true }).click();
  await expect(row).toHaveCount(0);
});

for (const width of [320, 1440]) {
  test(`${width}px Add picker filters, creates, and stays inside the viewport`, async ({ page }) => {
    await openEditor(page, width);
    await page.getByRole("button", { name: "2D only", exact: true }).click();
    if (width < 720) await page.getByRole("button", { name: "Objects", exact: true }).click();
    const trigger = page.getByRole("button", { name: "Open object menu", exact: true });
    await trigger.click();
    const picker = page.getByRole("dialog", { name: "Add to graph", exact: true });
    const bounds = (await picker.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
    const search = picker.getByRole("searchbox", { name: "Search objects" });
    await expect(search).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(picker.getByRole("button", { name: "All", exact: true })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(search).toBeFocused();
    await picker.getByRole("button", { name: "Geometry", exact: true }).click();
    await expect(picker.getByRole("button", { name: "Surface", exact: true })).toHaveCount(0);
    await search.fill("missing object");
    await expect(picker.getByText(/No objects match/)).toBeVisible();
    await picker.getByRole("button", { name: "Clear filters", exact: true }).click();
    await search.fill("Surface");
    await picker.getByRole("button", { name: "Surface", exact: true }).click();
    await expect(picker).toHaveCount(0);
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    await trigger.click();
    await page.keyboard.press("Escape");
    await expect(picker).toHaveCount(0);
    await expect(trigger).toBeFocused();
    if (width < 720) await expect(page.getByRole("dialog", { name: "Objects", exact: true })).toBeVisible();
  });
}

for (const width of [320, 1440]) {
  test(`${width}px object actions omit unrelated conversions and restore focus`, async ({ page }) => {
    await openEditor(page, width);
    if (width < 768) await page.getByRole("button", { name: "Objects", exact: true }).click();
    await addObject(page, "Surface");
    const trigger = page.getByRole("button", { name: "Object actions", exact: true }).first();
    await trigger.click();
    const menu = page.getByRole("menu", { name: "Object actions", exact: true });
    await expect(menu.getByRole("menuitem")).toHaveText(["Remove"]);
    const bounds = await menu.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await menu.getByRole("menuitem", { name: "Remove", exact: true }).click();
    await expect(page.getByRole("button", { name: /^(Select|Selected) Surface #1$/ })).toHaveCount(0);
  });
}
