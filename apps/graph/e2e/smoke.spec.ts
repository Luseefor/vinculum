import { expect, test } from "@playwright/test";

test.describe("Graph shell", () => {
  test("loads toolbar and defaults to 3D", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Vinculum" })).toBeVisible();
    await expect(page.getByRole("button", { name: "3D" })).toHaveAttribute("aria-pressed", "true");
  });

  test("switches to 2D mode", async ({ page }) => {
    await page.goto("/");
    const mode2d = page.getByRole("button", { name: "2D", exact: true });
    await mode2d.click();
    await expect(mode2d).toHaveAttribute("aria-pressed", "true");
  });

  test("new scene opens confirmation when more than one object exists", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Add" }).click();
    await page.getByRole("button", { name: "New" }).click();
    await expect(page.getByTestId("new-scene-dialog")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("new-scene-dialog")).not.toBeVisible();
  });
});
