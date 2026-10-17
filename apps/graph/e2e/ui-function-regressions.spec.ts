import { readRecoveryScene } from "./helpers/recoveryScene";
import { expect, test } from "@playwright/test";
import { fillInput, pressInput } from "./helpers/mathInput";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true }));
  });
  await page.goto("/editor");
});

test("the editor remains usable when session storage is blocked", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() { throw new DOMException("Storage is blocked", "SecurityError"); }
    });
  });
  await page.reload();
  await page.getByRole("button", { name: "Edit as text: New equation", exact: true }).waitFor({ state: "visible" });
  await fillInput(page.getByLabel("New equation"), "y=x^2");
  await pressInput(page.getByLabel("New equation"), "Enter");
  await expect(page.getByTestId("scene-object-count")).toHaveText("1");
  expect(errors).toEqual([]);
});

for (const [recipientPath, corruptSession] of [["/editor", false], ["/", false], ["/editor", true]] as const) {
test(`share links restore changed parameter values through ${recipientPath} in a fresh browser context${corruptSession ? " after corrupt session recovery" : ""}`, async ({ page, browser }) => {
  if (corruptSession) {
    await page.addInitScript(() => sessionStorage.setItem("vinculum-graph-session", "{"));
    await page.reload();
  }
  // This workflow starts before any menu interaction has allowed the lazy
  // math editor to load. Await its actual source-mode control before editing.
  await page.getByRole("button", { name: "Edit as text: New equation", exact: true }).waitFor({ state: "visible" });
  await fillInput(page.getByLabel("New equation"), "y=a*x");
  await pressInput(page.getByLabel("New equation"), "Enter");
  await page.getByRole("spinbutton", { name: "a value", exact: true }).fill("3");
  await expect(page.getByRole("slider", { name: "a slider" })).toHaveValue("3");
  if (corruptSession) {
    await expect.poll(async () => (await readRecoveryScene(page))?.parameters?.find(parameter => parameter.id === "a")?.value).toBe(3);
  }
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (url: string) => { (window as typeof window & { copiedScene?: string }).copiedScene = url; } } });
  });
  await page.getByRole("button", { name: "Scene", exact: true }).click();
  await page.getByRole("menuitem", { name: "Copy share link", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { copiedScene?: string }).copiedScene ?? "")).not.toBe("");
  const url = await page.evaluate(() => (window as typeof window & { copiedScene: string }).copiedScene);
  const context = await browser.newContext();
  try {
    await context.addInitScript(() => localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true })));
    const recipient = await context.newPage();
    const recipientUrl = new URL(url);
    recipientUrl.pathname = recipientPath;
    await recipient.goto(recipientUrl.href);
    await expect(recipient).toHaveURL(/\/editor\?scene=/);
    await expect(recipient.getByRole("slider", { name: "a slider" })).toHaveValue("3");
    await expect(recipient.getByRole("spinbutton", { name: "a value" })).toHaveValue("3");
  } finally { await context.close(); }
});

}

test("measurement-only scenes support undo, redo and restart recovery", async ({ page }) => {
  await page.getByRole("button", { name: "2D only", exact: true }).click();
  await page.getByRole("combobox", { name: "Tool", exact: true }).selectOption("addPin");
  await page.locator('canvas[data-graph2d-canvas="true"]').click({ position: { x: 100, y: 100 } });
  const savedMeasurements = () => page.evaluate(() => JSON.parse(sessionStorage.getItem("vinculum-graph-session")!).state.scene.measurements.length);
  await expect.poll(savedMeasurements).toBe(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(savedMeasurements).toBe(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect.poll(savedMeasurements).toBe(1);
  const canvas = page.locator('canvas[data-graph2d-canvas="true"]');
  let count = 1;
  for (const [tool, points] of [["measureDistance", 2], ["measureAngle", 3]] as const) {
    await page.getByRole("combobox", { name: "Tool", exact: true }).selectOption(tool);
    for (let index = 0; index < points; index++) {
      await canvas.click({ position: { x: 160 + index * 50, y: index === 1 ? 200 : 150 } });
    }
    count++;
    await expect.poll(savedMeasurements).toBe(count);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(savedMeasurements).toBe(count - 1);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect.poll(savedMeasurements).toBe(count);
  }
  await page.getByRole("button", { name: "Delete measurement pin", exact: true }).click();
  await expect.poll(savedMeasurements).toBe(2);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(savedMeasurements).toBe(3);
  await expect.poll(async () => (await readRecoveryScene(page))?.measurements.length ?? 0).toBe(3);
  await page.evaluate(() => sessionStorage.removeItem("vinculum-graph-session"));
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Restore unsaved scene?" })).toBeVisible();
  await expect.poll(async () => (await readRecoveryScene(page))?.measurements.length ?? 0).toBe(3);
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect.poll(savedMeasurements).toBe(3);
  await expect(page.getByTestId("scene-object-count")).toHaveText("0");
});

test("2D exports stay enabled in split and quad layouts entered from 3D", async ({ page }) => {
  await page.getByRole("button", { name: "3D only", exact: true }).click();
  await page.getByRole("button", { name: "2D and 3D together", exact: true }).click();
  for (const layout of ["Side-by-side layout", "Four-panel layout"]) {
    await page.getByRole("button", { name: layout, exact: true }).click();
    await page.getByRole("button", { name: "Share", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Share and export" });
    await expect(dialog.getByRole("button", { name: "2D PNG", exact: true })).toBeEnabled();
    await expect(dialog.getByRole("button", { name: "2D SVG", exact: true })).toBeEnabled();
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
  }
});

test("quad plane selector follows the active pane without changing the primary plane", async ({ page }) => {
  await page.getByRole("button", { name: "Four-panel layout", exact: true }).click();
  await page.locator('canvas[data-graph2d-variant="quadTop"]').click({ position: { x: 80, y: 80 } });
  await page.getByRole("button", { name: "View options", exact: true }).click();
  const plane = page.getByRole("combobox", { name: "2D Plane", exact: true });
  await expect(plane).toHaveValue("xz");
  await plane.selectOption("yz");
  await expect(plane).toHaveValue("yz");
  await plane.press("Escape");
  await page.locator('canvas[data-graph2d-variant="primary"]').click({ position: { x: 80, y: 80 } });
  await page.getByRole("button", { name: "View options", exact: true }).click();
  await expect(plane).toHaveValue("xy");
});

test("Escape stops canvas tools but preserves the active tool when closing a dialog or editing", async ({ page }) => {
  const tool = page.getByRole("combobox", { name: "Tool", exact: true });
  await page.getByRole("button", { name: "2D only", exact: true }).click();
  await tool.selectOption("measureDistance");
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(tool).toHaveValue("measureDistance");
  await page.keyboard.press("Escape");
  await expect(tool).toHaveValue("pan");
  await tool.selectOption("draw");
  await fillInput(page.getByLabel("New equation"), "y=x");
  await pressInput(page.getByLabel("New equation"), "Escape");
  await expect(tool).toHaveValue("draw");
});


test("compact menus protect measurement-only scenes and expose visible-view exports", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "2D only", exact: true }).click();
  const tool = page.getByRole("combobox", { name: "Tool", exact: true });
  await tool.selectOption("addPin");
  await page.locator('canvas[data-graph2d-canvas="true"]').click({ position: { x: 20, y: 70 } });
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "New scene", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "New scene", exact: true });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("vinculum-graph-session")!).state.scene.measurements.length)).toBe(1);
  await page.getByRole("button", { name: "3D only", exact: true }).click();
  await page.getByRole("button", { name: "2D and 3D together", exact: true }).click();
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Share & export...", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Share and export", exact: true });
  await expect(dialog.getByRole("button", { name: "2D SVG", exact: true })).toBeEnabled();
  await expect(dialog.getByRole("button", { name: "2D PNG", exact: true })).toBeEnabled();
});
