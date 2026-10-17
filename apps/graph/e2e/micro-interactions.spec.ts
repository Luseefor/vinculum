import { expect, test, type Page, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { addObject } from "./helpers/addObject";
import { fillInput } from "./helpers/mathInput";

async function openEditor(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
  await page.addInitScript(() => localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true })));
  await page.goto("/editor");
  await page.getByRole("button", { name: "2D only", exact: true }).click();
}

async function pressFeedback(page: Page, control: Locator, reducedMotion: string) {
  const bounds = (await control.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  try {
    await expect.poll(() => control.evaluate(element => getComputedStyle(element).transform))
      .toBe(reducedMotion === "reduce" ? "none" : "matrix(0.98, 0, 0, 0.98, 0, 0)");
  } finally { await page.mouse.up(); }
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`editor controls and invalid fields give feedback with motion ${reducedMotion}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await openEditor(page);
    await pressFeedback(page, page.getByRole("button", { name: "2D only", exact: true }), reducedMotion);
    await addObject(page, "Surface");
    await pressFeedback(page, page.locator("[data-object-row-select]").first(), reducedMotion);
    await pressFeedback(page, page.getByRole("button", { name: "Hide object", exact: true }), reducedMotion);
    await expect(page.getByRole("button", { name: "Show object", exact: true })).toHaveAttribute("aria-pressed", "false");
    await pressFeedback(page, page.getByRole("tab", { name: "Settings", exact: true }), reducedMotion);
    await expect(page.getByRole("tab", { name: "Settings", exact: true })).toHaveAttribute("aria-selected", "true");
    const redo = page.getByRole("button", { name: "Redo", exact: true });
    await expect(redo).toBeDisabled();
    const beforeHover = await redo.evaluate(element => getComputedStyle(element).backgroundColor);
    await redo.hover();
    expect(await redo.evaluate(element => ({ background: getComputedStyle(element).backgroundColor, transform: getComputedStyle(element).transform, duration: getComputedStyle(element).transitionDuration })))
      .toEqual({ background: beforeHover, transform: "none", duration: "0s" });
    await page.getByRole("tab", { name: "Edit", exact: true }).click();
    const expression = page.getByLabel("Surface expression z = f(x,y)").first();
    await fillInput(expression, "sqrt(");
    const invalid = page.locator('#graph-inspector .expression-field .math-input[data-invalid="true"]');
    await expect(invalid).toHaveCount(1);
    await expect(page.getByTestId("math-definition-diagnostic")).toBeVisible();
    await expect.poll(() => invalid.evaluate(element => getComputedStyle(element.closest(".expression-field")!).boxShadow)).toContain("2px");
    if (reducedMotion === "reduce") {
      expect(await invalid.evaluate(element => getComputedStyle(element.closest(".expression-field")!).transitionDuration)).toBe("0s");
    }
    await fillInput(expression, "x+y");
    await expect(invalid).toHaveCount(0);
    await expect(page.getByTestId("math-definition-diagnostic")).toHaveCount(0);
    expect((await new AxeBuilder({ page }).include('#graph-inspector').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
  });

  test(`press and switch feedback remains functional with motion ${reducedMotion}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto("/");
    const button = page.getByRole("button", { name: /Use (light|dark) theme/ });
    const bounds = (await button.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await expect.poll(() => button.evaluate((element) => getComputedStyle(element).transform)).toBe(reducedMotion === "reduce" ? "none" : "matrix(0.98, 0, 0, 0.98, 0, 0)");
    await page.mouse.up();
    await openEditor(page);
    await page.getByRole("button", { name: "Math Lab", exact: true }).click();
    await addObject(page, "Surface");
    await page.getByRole("tab", { name: "Settings", exact: true }).click();
    const toggle = page.getByRole("switch", { name: /wireframe/i });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    if (reducedMotion === "reduce") expect(await toggle.locator(".ui-switch-thumb").evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0s");
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    const theme = page.getByRole("button", { name: "Open theme and accent menu" });
    await theme.click();
    const appearance = page.getByRole("dialog", { name: "Appearance", exact: true });
    await expect(appearance.getByRole("button", { name: "Use light theme" })).toBeFocused();
    await appearance.getByRole("button", { name: "Use dark theme" }).click();
    await expect(appearance.getByRole("button", { name: "Use dark theme" })).toHaveAttribute("aria-pressed", "true");
    await appearance.getByRole("button", { name: "Accent emerald", exact: true }).click();
    await expect(appearance.getByRole("button", { name: "Accent emerald", exact: true })).toHaveAttribute("aria-pressed", "true");
    const popup = (await appearance.boundingBox())!;
    expect(popup.x + popup.width).toBeLessThanOrEqual(1440);
    expect(popup.y + popup.height).toBeLessThanOrEqual(844);
    if (reducedMotion === "reduce") expect(await appearance.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
    expect((await new AxeBuilder({ page }).include('.ui-popover').analyze()).violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(theme).toBeFocused();
  });
}

for (const width of [320, 1440]) {
  test(`${width}px PNG capture exposes real pending, failure, and retry feedback`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openEditor(page, width);
    await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('[data-graph2d-canvas="true"]')!;
      const original = canvas.toBlob.bind(canvas);
      let calls = 0;
      Object.assign(window, { completePngCapture: null, pngCaptureCalls: () => calls });
      canvas.toBlob = (callback, type, quality) => {
        calls++;
        Object.assign(window, { completePngCapture: (fail: boolean) => fail ? callback(null) : original(callback, type, quality) });
      };
    });
    if (width < 1100) {
      await page.getByRole("button", { name: "More actions", exact: true }).click();
      await page.getByRole("menuitem", { name: "Share & export...", exact: true }).click();
    } else await page.getByRole("button", { name: "Share", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Share and export", exact: true });
    const exportPng = dialog.getByRole("button", { name: "2D PNG", exact: true });
    await exportPng.click();
    await expect(exportPng).toHaveAttribute("aria-busy", "true");
    await expect(exportPng).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "JSON", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("status")).toContainText("Preparing 2D PNG");
    const pendingBounds = (await exportPng.boundingBox())!;
    const dialogBounds = (await dialog.boundingBox())!;
    expect(pendingBounds.x + pendingBounds.width).toBeLessThanOrEqual(dialogBounds.x + dialogBounds.width);
    expect(await page.evaluate(() => (window as unknown as { pngCaptureCalls: () => number }).pngCaptureCalls())).toBe(1);
    await page.evaluate(() => (window as unknown as { completePngCapture: (fail: boolean) => void }).completePngCapture(true));
    await expect(exportPng).toBeEnabled();
    await expect(exportPng).toHaveAttribute("aria-busy", "false");
    await expect(dialog.getByRole("status")).toContainText("2D PNG export failed");
    await exportPng.focus();
    await page.keyboard.press("Enter");
    await expect(exportPng).toBeDisabled();
    const download = page.waitForEvent("download");
    await page.evaluate(() => (window as unknown as { completePngCapture: (fail: boolean) => void }).completePngCapture(false));
    expect((await download).suggestedFilename()).toMatch(/-2d\.png$/);
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(".action-toast[role=status]")).toContainText("Export 2D PNG downloaded.");
    expect(await page.evaluate(() => (window as unknown as { pngCaptureCalls: () => number }).pngCaptureCalls())).toBe(2);
  });
}

for (const width of [320, 1440]) {
  test(`${width}px clipboard failure gives a valid manual link and visible export feedback`, async ({ page }) => {
    await openEditor(page, width);
    await page.getByRole("button", { name: "Math Lab", exact: true }).click();
    if (width < 720) await page.getByRole("button", { name: "Objects", exact: true }).click();
    await addObject(page, "Surface");
    if (width < 720) await page.keyboard.press("Escape");
    await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("clipboard denied")) } }));
    const compact = width < 1100;
    await page.getByRole("button", { name: compact ? "More actions" : "Scene", exact: true }).click();
    await page.getByRole("menuitem", { name: "Copy share link", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Share and export", exact: true });
    const input = dialog.getByRole("textbox", { name: "Copy share link manually" });
    await expect(input).toBeFocused();
    const dialogBounds = (await dialog.boundingBox())!;
    expect(dialogBounds.y).toBeGreaterThanOrEqual(0);
    expect(dialogBounds.y + dialogBounds.height).toBeLessThanOrEqual(width === 320 ? 568 : 844);
    const url = await input.inputValue();
    expect(new URL(url).searchParams.get("scene")).toBeTruthy();
    await expect(dialog.getByRole("status")).toContainText("Copy the selected link below");
    await dialog.getByRole("button", { name: "Close", exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Copy share link", exact: true })).toBeFocused();
    const download = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "JSON", exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(/\.json$/);
    const toast = page.locator(".action-toast[role=status]");
    await expect(toast).toContainText("Export JSON downloaded");
    const bounds = (await toast.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: "Dismiss action feedback" }).click();
    await expect(toast).toHaveCount(0);
    // The manually copied payload follows the existing validated import path.
    await page.goto(url);
    await expect(page.getByRole("heading", { name: /shared scene/i })).toBeVisible();
    await page.getByRole("button", { name: "Open shared scene", exact: true }).click();
    if (width < 720) await page.getByRole("button", { name: "Objects", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
  });
}


test("Scene menu navigates by keyboard and hands focus to Save as", async ({ page }) => {
  await openEditor(page);
  const scene = page.getByRole("button", { name: "Scene", exact: true });
  await scene.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: /^New scene/ })).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.getByRole("menuitem", { name: "Share & export...", exact: true })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.getByRole("menuitem", { name: /^New scene/ })).toBeFocused();
  await page.getByRole("menuitem", { name: "Save as...", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Save as project", exact: true });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(scene).toBeFocused();
});

for (const width of [320, 768, 1100, 1440]) {
  test(`${width}px scene actions stay inside a short viewport and export options remain reachable`, async ({ page }) => {
    await openEditor(page, width);
    await page.setViewportSize({ width, height: 568 });
    const compact = width < 1100;
    const trigger = page.getByRole("button", { name: compact ? "More actions" : "Scene", exact: true });
    await trigger.click();
    const menu = page.getByRole("menu");
    const bounds = (await menu.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(568);
    if (!compact) {
      await expect(menu.getByRole("menuitem")).toHaveCount(8);
      // All wide Scene actions are visible without scrolling, including the last.
      const last = (await menu.getByRole("menuitem", { name: "Share & export...", exact: true }).boundingBox())!;
      expect(last.y + last.height).toBeLessThanOrEqual(bounds.y + bounds.height);
    } else {
      await page.keyboard.press("End");
      const theme = menu.getByRole("menuitem", { name: /^Theme:/ });
      await expect(theme).toBeFocused();
      const last = (await theme.boundingBox())!;
      expect(last.y + last.height).toBeLessThanOrEqual(bounds.y + bounds.height);
    }
    await menu.getByRole("menuitem", { name: "Share & export...", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Share and export", exact: true });
    for (const name of ["JSON", "2D PNG", "2D SVG", "3D PNG"]) await expect(dialog.getByRole("button", { name, exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  });
}
