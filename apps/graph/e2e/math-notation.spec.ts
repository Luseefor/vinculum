import { expect, test } from "@playwright/test";
import { evaluate } from "mathjs";
import AxeBuilder from "@axe-core/playwright";

test.setTimeout(60_000);

async function start(page: import("@playwright/test").Page, width: number) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" || message.text().includes("Math editor could not load")) console.error("Math editor console:", message.text()); });
  await page.setViewportSize({ width, height: width === 320 ? 568 : 900 });
  await page.addInitScript(() => localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true })));
  await page.goto("/editor");
  await page.getByRole("button", { name: "Math Lab", exact: true }).click();
  return errors;
}

for (const width of [1440, 320]) {
  test(`${width}px typeset equation editing, source paste, and output`, async ({ page }) => {
    const pageErrors = await start(page, width);
    await page.getByRole("button", { name: "Create Surface", exact: true }).click();
    await page.getByRole("button", { name: "2D only", exact: true }).click();
    if (width === 320) await page.getByRole("button", { name: "Inspector", exact: true }).click();
    const field = page.locator("math-field[aria-label='Surface expression z = f(x,y)']");
    await expect(field).toBeVisible({ timeout: 30000 });
    await field.click();
    await expect.poll(() => field.evaluate(element => document.activeElement === element)).toBe(true);
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("6*cos^2(x^2)", { delay: 40 });
    await expect.poll(() => field.evaluate((element) => (element as HTMLElement & {value:string}).value)).toContain("\\cos");
    await expect.poll(async () => {
      const typedSource = await field.evaluate((element) => element.closest(".math-input")!.querySelector("input")!.value);
      try { return evaluate(typedSource, { x: .7 }); } catch { return Number.NaN; }
    }).toBeCloseTo(6 * Math.cos(.7 ** 2) ** 2);
    await expect(page.locator('[data-testid="math-definition-diagnostic"]')).toHaveCount(0);
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("x^12", { delay: 40 });
    await expect.poll(async () => {
      const source = await field.evaluate(element => element.closest(".math-input")!.querySelector("input")!.value);
      try { return evaluate(source, { x: .7 }); } catch { return Number.NaN; }
    }).toBeCloseTo(.7 ** 12, 8);
    const sourceButton = page.getByRole("button", { name: "Edit as text: Surface expression z = f(x,y)", exact: true });
    await sourceButton.click();
    const source = page.locator(".math-input input[aria-label='Surface expression z = f(x,y)']");
    await expect(source).toBeVisible();
    await source.fill("6*cos^2(x^2)");
    await page.getByRole("button", { name: "Use math editor for Surface expression z = f(x,y)", exact: true }).click();
    await expect.poll(() => field.evaluate(element => document.activeElement === element)).toBe(true);
    await expect.poll(() => field.evaluate((element) => (element as HTMLElement & {value:string}).value)).toContain("\\cos^{2}");
    await expect.poll(() => field.evaluate((element) => (element as HTMLElement & {value:string}).value)).toMatch(/x.*\^.*2/);
    const errors = page.locator('[data-testid="math-definition-diagnostic"]');
    await expect(errors).toHaveCount(0);
    const bounds = await field.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    const scan = await new AxeBuilder({ page }).include(".math-input").analyze();
    expect(scan.violations).toEqual([]);
    await field.click();
    await expect.poll(() => field.evaluate(element => document.activeElement === element)).toBe(true);
    await page.keyboard.press("ControlOrMeta+A");
    await field.evaluate((element) => {
      // Firefox restricts ClipboardEvent clipboardData on synthetic events.
      const event = new Event("paste", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "clipboardData", { value: { getData: () => "sqrt(1+x^2)/(1+x)" } });
      element.dispatchEvent(event);
    });
    await expect.poll(() => field.evaluate((element) => (element as HTMLElement & {value:string}).value)).toContain("\\frac");
    await page.keyboard.press("Escape");
    if (width === 320) await expect(page.getByRole("dialog", { name: "Inspector", exact: true })).toHaveCount(0);
    else await expect.poll(() => field.evaluate((element) => (element as HTMLElement & {hasFocus:()=>boolean}).hasFocus())).toBe(false);
    expect(pageErrors).toEqual([]);
  });
}

test("solver typesets fractions, vector results, and worked steps", async ({ page }) => {
  await start(page, 1440);
  await page.getByRole("button", { name: "Open field solver" }).click();
  const dialog = page.getByTestId("field-solver-dialog");
  await dialog.getByLabel("Field dimension").selectOption("2");
  await expect(dialog.locator("math-field").first()).toBeVisible({ timeout: 30000 });
  await dialog.getByRole("button", { name: "Edit as text: P(x,y)", exact: true }).click();
  await dialog.locator("input[aria-label='P(x,y)']").fill("6*cos^2(x^2)");
  await dialog.getByRole("button", { name: "Edit as text: Q(x,y)", exact: true }).click();
  await dialog.locator("input[aria-label='Q(x,y)']").fill("y");
  await expect(dialog.getByTestId("symbolic-divergence").locator(".katex")).toBeVisible();
  await dialog.getByRole("button", { name: "Show divergence solution" }).click();
  await expect(dialog.getByRole("math", { name: /div F/ })).toBeVisible();
  await expect(dialog.getByTestId("solution-final-answer").locator(".katex")).toBeVisible();
});
