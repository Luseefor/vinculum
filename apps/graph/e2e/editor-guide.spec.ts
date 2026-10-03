import { expectInputVisible } from "./helpers/mathInput";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function openEditor(page: Page, width: number, height = 844) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(() => localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true })));
  await page.goto("/editor");
  await expect(page.getByRole("button", { name: "Open editor guide" })).toBeVisible();
}

for (const width of [320, 1280]) {
  test(`${width}px empty graph leaves every zoom control clear of the starter card`, async ({ page }) => {
    await openEditor(page, width, 800);
    await page.getByRole("button", { name: width === 320 ? "2D only" : "2D and 3D together", exact: true }).click();
    const card = await page.getByTestId("canvas-empty-state").boundingBox();
    expect(card).not.toBeNull();
    for (const name of ["Zoom in", "Zoom out", "Reset 2D view"]) {
      const control = page.getByRole("button", { name, exact: true });
      await expect(control).toBeVisible();
      const bounds = (await control.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(card!.x + card!.width);
    }
  });
}

for (const width of [320, 390, 1440]) {
  test(`${width}px guide opens real tools and restores focus`, async ({ page }) => {
    await openEditor(page, width, width === 320 ? 568 : 844);
    const help = page.getByRole("button", { name: "Open editor guide" });
    await help.click();
    const guide = page.getByTestId("editor-guide");
    await expect(guide).toBeVisible();
    const bounds = await guide.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await expect(guide.getByRole("link", { name: /Full documentation/ })).toHaveAttribute("href", "/documentations");
    expect((await new AxeBuilder({ page }).include('[data-testid="editor-guide"]').analyze()).violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(help).toBeFocused();
    await help.click();
    await guide.getByRole("button", { name: "Show Objects", exact: true }).click();
    await expect(guide).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open object menu" })).toBeVisible();
    if (width < 720) await page.keyboard.press("Escape");
    await help.click();
    await guide.getByRole("button", { name: "Show Inspector", exact: true }).click();
    await expect(page.getByRole("complementary", { name: "Inspector", exact: true })).toBeVisible();
    if (width < 720) await page.keyboard.press("Escape");
    await help.click();
    await guide.getByRole("button", { name: "Start solving", exact: true }).click();
    await expect(page.getByTestId("field-solver-dialog")).toBeVisible();
    await expect(page.getByTestId("editor-guide")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await help.click();
    await guide.getByRole("button", { name: "Browse examples", exact: true }).click();
    await expect(page.getByRole("dialog", { name: /example/i })).toBeVisible();
  });
}

test("empty graph explains creation and links to help", async ({ page }) => {
  await openEditor(page, 390);
  await page.getByRole("button", { name: "Geometry Studio", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create Surface", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Where are the tools?", exact: true }).click();
  await expect(page.getByTestId("editor-guide")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Create Surface", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create Surface", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Inspector", exact: true }).click();
  await expectInputVisible(page.locator('math-field[aria-label="Surface expression z = f(x,y)"]'));
});


test("short phone first-run tips leave starters reachable", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/editor");
  await page.getByRole("button", { name: "Geometry Studio", exact: true }).click();
  const hint = page.getByTestId("first-run-hint");
  await expect(hint).toBeVisible();
  const starter = page.getByRole("button", { name: "Create Point", exact: true });
  const hintBounds = await hint.boundingBox();
  const starterBounds = await starter.boundingBox();
  expect(hintBounds!.y + hintBounds!.height).toBeLessThanOrEqual(starterBounds!.y);
  await hint.getByRole("button", { name: "Where are the tools?", exact: true }).click();
  await expect(page.getByTestId("editor-guide")).toBeVisible();
  await expect(hint).toHaveCount(0);
  await page.getByRole("button", { name: "Close guide", exact: true }).click();
  await starter.click();
  await expect(starter).toHaveCount(0);
});
