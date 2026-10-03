import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [320, 1440]) {
  test(`${width}px examples gallery supports search, topics, keyboard opening, and both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 900 });
    await page.addInitScript(() => localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true })));
    await page.goto("/editor?examples=1");
    const dialog = page.getByRole("dialog", { name: "Examples", exact: true });
    await expect(dialog).toBeVisible();
    const search = dialog.getByRole("searchbox", { name: "Search examples" });
    await expect(search).toBeFocused();
    const bounds = (await dialog.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(width === 320 ? 568 : 900);
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    for (const theme of ["light", "dark"]) {
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      expect((await new AxeBuilder({ page }).include('[data-testid="examples-gallery"]').analyze()).violations).toEqual([]);
    }
    await search.fill("helix");
    await expect(dialog.getByRole("button", { name: /^Open example:/ })).toHaveCount(1);
    await dialog.getByRole("combobox", { name: "Example topic" }).selectOption("Planes");
    await expect(dialog.getByRole("status")).toHaveText("No examples match your search.");
    await dialog.getByRole("button", { name: "Clear filters" }).click();
    await expect(search).toHaveValue("");
    await search.fill("helix");
    const open = dialog.getByRole("button", { name: "Open example: Helix Curve" });
    await open.focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    if (width === 320) await page.getByRole("button", { name: "Objects", exact: true }).click();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
  });
}
