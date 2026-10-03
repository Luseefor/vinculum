import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { addObject } from "./helpers/addObject";

async function openEditor(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
  await page.addInitScript(() => localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true })));
  await page.goto("/editor");
  await page.getByRole("button", { name: "2D only", exact: true }).click();
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
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
