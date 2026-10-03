import { addObject } from "./helpers/addObject";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { fillInput, expectInputValue } from "./helpers/mathInput";

test.setTimeout(60_000);

async function start(page: Page, width: number) {
  await page.setViewportSize({ width, height: width < 720 ? 740 : 900 });
  await page.addInitScript(() => localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true })));
  await page.goto("/editor");
  await page.getByRole("button", { name: "Math Lab", exact: true }).click();
  await page.getByRole("button", { name: "Create Surface", exact: true }).click();
  // Typography and panel workflows do not require a continuously drawn 3D mesh.
  await page.getByRole("button", { name: "2D only", exact: true }).click();
  if (width < 720) await page.getByRole("button", { name: "Inspector", exact: true }).click();
}

for (const width of [1440, 320]) {
  test(`${width}px inspector makes editing, analysis and secondary tools discoverable`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await start(page, width);
    const inspector = page.getByRole("complementary", { name: "Inspector", exact: true });
    await expect(inspector.getByRole("tab")).toHaveText(["Edit", "Analyze", "Settings"]);
    await expect(inspector.getByText("Explicit surface", { exact: true })).toBeVisible();
    await inspector.getByRole("button", { name: "Hide selected object" }).click();
    await expect(inspector.getByText("Explicit surface · Hidden", { exact: true })).toBeVisible();
    await inspector.getByRole("button", { name: "Show selected object" }).click();
    await expect(inspector.getByRole("button", { name: "Hide selected object" })).toHaveAttribute("aria-pressed", "true");

    await fillInput(inspector.getByLabel("Surface expression z = f(x,y)", { exact: true }), "6*cos^2(x^2)");
    await inspector.getByRole("tab", { name: "Analyze", exact: true }).click();
    await expect(inspector.getByText("Gradient, Laplacian, field colors and integrals.", { exact: true })).toBeVisible();
    await inspector.getByRole("tab", { name: "Edit", exact: true }).click();
    await expectInputValue(inspector.getByLabel("Surface expression z = f(x,y)", { exact: true }), "6*(cos(x^2))^2");
    await inspector.getByText("How to type math", { exact: true }).click();
    await expect(inspector.getByText("Choose Text to edit or paste a plain-text expression.", { exact: true })).toBeVisible();
    await inspector.getByText("How to type math", { exact: true }).click();

    await inspector.getByLabel("Dependent variable", { exact: true }).selectOption("x");
    await expect(inspector.getByLabel("y min", { exact: true })).toBeVisible();
    await expect(inspector.getByLabel("z max", { exact: true })).toBeVisible();
    await expect(inspector.getByLabel("x min", { exact: true })).toHaveCount(0);
    await fillInput(inspector.getByLabel("Surface expression x = f(y,z)", { exact: true }), "y^2+z^2");
    await fillInput(inspector.getByLabel("y min", { exact: true }), "-3");
    await fillInput(inspector.getByLabel("z max", { exact: true }), "7");
    await expect(inspector.getByTestId("math-definition-diagnostic")).toHaveCount(0);

    await inspector.getByRole("tab", { name: "Settings", exact: true }).click();
    await expect(inspector.getByLabel("Surface color", { exact: true })).toBeVisible();
    await expect(inspector.getByText("Object links", { exact: true })).toHaveCount(0);
    await expect(inspector.getByText("Selected object JSON", { exact: true })).toHaveCount(0);
    await inspector.getByText("Object data", { exact: true }).click();
    await expect(inspector.getByRole("button", { name: "Copy JSON", exact: true })).toBeVisible();
    await inspector.getByText("Object data", { exact: true }).click();
    await expect(inspector.getByText("Selected object JSON", { exact: true })).toHaveCount(0);
    for (const tab of await inspector.getByRole("tab").all()) {
      const bounds = (await tab.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      if (width < 720) expect(bounds.height).toBeGreaterThanOrEqual(44);
    }
    expect(await inspector.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).include(".inspector-panel").analyze()).violations).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("object links remain available when a second object exists", async ({ page }) => {
  await start(page, 1440);
  await addObject(page, "Surface");
  const inspector = page.getByRole("complementary", { name: "Inspector", exact: true });
  await inspector.getByRole("tab", { name: "Settings", exact: true }).click();
  await inspector.getByText("Object links", { exact: true }).click();
  await expect(inspector.getByLabel("Target object", { exact: true })).toBeEnabled();
  await expect(inspector.getByLabel("Target object", { exact: true }).locator("option")).toHaveCount(1);
});
