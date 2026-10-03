import { fillInput } from "./helpers/mathInput";
import { expect, test, type Page } from "@playwright/test";

async function openSolver(page: Page) {
  await page.goto("/editor");
  await page.evaluate(() => localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true, updatedAt: new Date().toISOString() })));
  await page.reload();
  for (let i = 0; i < 5 && await page.getByRole("dialog").count(); i++) await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Math Lab", exact: true }).click();
  await page.getByRole("button", { name: "Open field solver" }).click();
}

test("curl requires only a vector and the solution overlay explains the answer", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openSolver(page);
  const solver = page.getByTestId("field-solver-dialog");
  await expect(solver.getByTestId("symbolic-curl").getByRole("math", { name: "<0, 0, 2>", exact: true })).toBeVisible();
  await expect(solver.getByLabel("Analysis point x")).toHaveCount(0);
  await fillInput(solver.getByLabel("P(x,y,z)", { exact: true }), "-2*y");
  await expect(solver.getByTestId("symbolic-curl").getByRole("math", { name: "<0, 0, 3>", exact: true })).toBeVisible();
  await solver.getByRole("button", { name: "Show curl solution" }).click();
  await expect(solver.getByTestId("solution-final-answer").getByRole("math", { name: "<0, 0, 3>", exact: true })).toBeVisible();
  await expect(solver.getByRole("math", { name: "∂(-2*y)/∂y = -2", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(solver).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open field solver" })).toBeFocused();
});

test("a solved complex field plots into the existing scene and undoes in one step", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openSolver(page);
  const solver = page.getByTestId("field-solver-dialog");
  await solver.getByLabel("Field problem").selectOption("complex");
  await expect(solver.getByTestId("symbolic-cauchy–riemann-residuals").getByRole("math", { name: "<0, 0>", exact: true })).toBeVisible();
  await solver.getByRole("button", { name: "Add to scene" }).click();
  await expect(page.getByTestId("scene-object-count")).toHaveText("1");
  await page.getByRole("tab", { name: "Analyze", exact: true }).click();
  await expect(page.getByTestId("symbolic-vector-laplacian").getByRole("math", { name: "<0, 0>", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show divergence solution" }).click();
  await expect(page.getByRole("dialog", { name: "Divergence solution" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByTestId("scene-object-count")).toHaveText("0");
});

test("polar solving and long solution scrolling work on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await openSolver(page);
  const solver = page.getByTestId("field-solver-dialog");
  await solver.getByLabel("Field coordinates").selectOption("polar");
  await expect(solver.getByTestId("symbolic-divergence")).toHaveText("2");
  await expect(solver.getByTestId("symbolic-vector-laplacian").getByRole("math", { name: "<0, 0>", exact: true })).toBeVisible();
  await solver.getByRole("button", { name: "Show vector laplacian solution" }).click();
  await expect(solver.getByTestId("solution-final-answer").getByRole("math", { name: "<0, 0>", exact: true })).toBeVisible();
  const bounds = await solver.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(700);
  await solver.getByRole("button", { name: "Close solver" }).click();
  await expect(solver).toHaveCount(0);
});
