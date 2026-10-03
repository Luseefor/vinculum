import { expect, test } from "@playwright/test";
import { fillInput } from "./helpers/mathInput";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true })));
  await page.goto("/editor");
});

test("named variables create accessible sliders that update and survive reload", async ({ page }) => {
  await fillInput(page.getByLabel("New equation"), "y=a*x+b");
  await page.getByRole("textbox", { name: "New equation", exact: true }).press("Enter");
  await expect(page.getByRole("slider", { name: "a slider" })).toHaveValue("1");
  await expect(page.getByRole("slider", { name: "b slider" })).toHaveValue("1");
  await page.getByRole("slider", { name: "a slider" }).press("End");
  await expect(page.getByRole("spinbutton", { name: "a value" })).toHaveValue("10");
  await page.reload();
  await expect(page.getByRole("slider", { name: "a slider" })).toHaveValue("10");
  await fillInput(page.getByLabel("New equation"), "b=20");
  await page.getByRole("textbox", { name: "New equation", exact: true }).press("Enter");
  await expect(page.getByRole("slider", { name: "b slider" })).toHaveValue("20");
  await expect(page.getByTestId("scene-object-count")).toHaveText("1");
});

test("the reported oscillating relation is a 2D curve and never a 3D surface", async ({ page }) => {
  await fillInput(page.getByLabel("New equation"), "cos(xy+cos(4y))^2+sin(y)=0.4x+0.1y^2");
  await page.getByRole("textbox", { name: "New equation", exact: true }).press("Enter");
  await expect(page.getByRole("button", { name: "2D only", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("vinculum-graph-session")!).state.scene.objects[0].kind)).toBe("implicitCurve");
  await expect(page.locator('canvas[data-graph2d-canvas="true"]:visible')).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Invalid expression syntax" })).toHaveCount(0);
});


test("2D curves offer an explicit reversible extension in the 3D view", async ({ page }) => {
  await fillInput(page.getByLabel("New equation"), "x=y^2");
  await page.getByRole("textbox", { name: "New equation", exact: true }).press("Enter");
  await expect(page.getByRole("button", { name: "Extend to 3D", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "3D only", exact: true }).click();
  await expect(page.getByRole("button", { name: "Extend to 3D", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Object actions", exact: true }).click();
  const extension = page.getByRole("menuitemcheckbox", { name: "Extend to 3D", exact: true });
  await expect(extension).toHaveAttribute("aria-checked", "false");
  await extension.click();
  await expect(page.getByRole("menu", { name: "Object actions" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Object actions", exact: true })).toBeFocused();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("vinculum-graph-session")!).state.scene.objects[0])).toMatchObject({ kind: "implicitCurve", extendTo3D: true });
  await page.reload();
  await page.getByRole("button", { name: "Object actions", exact: true }).click();
  const remove = page.getByRole("menuitemcheckbox", { name: "Remove 3D extension", exact: true });
  await expect(remove).toHaveAttribute("aria-checked", "true");
  await remove.click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Object actions", exact: true }).click();
  await expect(remove).toHaveAttribute("aria-checked", "true");
  await remove.press("Escape");
  await expect(page.getByRole("menu", { name: "Object actions" })).toHaveCount(0);
});
