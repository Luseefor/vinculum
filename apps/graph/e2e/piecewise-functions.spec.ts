import { readRecoveryScene } from "./helpers/recoveryScene";
import { expect, test } from "@playwright/test";
import { fillInput } from "./helpers/mathInput";

for (const width of [390, 1440]) {
  test(`${width}px piecewise input plots separated branches and survives reload`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true })));
    await page.goto("/editor");
    if (width < 720) await page.getByRole("button", { name: "Objects", exact: true }).click();
    const row = page.locator('[data-auto-equation-input]').filter({ has: page.locator('[aria-label="New equation"]') });
    await fillInput(row.locator('[aria-label="New equation"]').first(), "f(t)={0 for t<0.13; 1 for t>=0.13}");
    const source = row.locator('input.math-source-input');
    await source.press("Enter");
    await expect.poll(async () => (await readRecoveryScene(page))?.objects[0]?.kind).toBe("implicitCurve");
    if (width < 720) await page.keyboard.press("Escape");
    const canvas = page.locator('canvas[data-graph2d-canvas="true"]').first();
    await expect(canvas).toBeVisible();
    // A step is two horizontal blue branches. A joined jump would paint
    // blue pixels throughout the empty band between those branches.
    await expect.poll(() => canvas.evaluate((node: HTMLCanvasElement) => {
      const ctx = node.getContext("2d")!;
      const { data } = ctx.getImageData(0, 0, node.width, node.height);
      const coloredRows = new Set<number>();
      for (let y = 0; y < node.height; y++) for (let x = 0; x < node.width; x++) {
        const i = (y * node.width + x) * 4;
        if (data[i + 2] > 180 && data[i + 1] > 80 && data[i] < 130 && data[i + 2] > data[i + 1] + 40) coloredRows.add(y);
      }
      return coloredRows.size;
    })).toBeGreaterThan(2);
    const coloredRows = await canvas.evaluate((node: HTMLCanvasElement) => {
      const { data } = node.getContext("2d")!.getImageData(0, 0, node.width, node.height);
      const rows = new Set<number>();
      for (let y = 0; y < node.height; y++) for (let x = 0; x < node.width; x++) {
        const i = (y * node.width + x) * 4;
        if (data[i + 2] > 180 && data[i + 1] > 80 && data[i] < 130 && data[i + 2] > data[i + 1] + 40) rows.add(y);
      }
      return rows.size;
    });
    expect(coloredRows).toBeLessThan(20);
    await page.reload();
    if (width < 720) await page.getByRole("button", { name: "Objects", exact: true }).click();
    await expect(page.locator('math-field').first()).toBeAttached();
    await expect.poll(async () => { const object = (await readRecoveryScene(page))?.objects[0]; return object && "equation" in object ? object.equation : ""; }).toContain("f(t)");
  });
}

test("pasting cases into the visual editor and editing a 3D step surface", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true })));
  await page.goto("/editor");
  await page.getByRole("button", { name: "2D only", exact: true }).click();
  const row = page.locator('[data-auto-equation-input]').filter({ has: page.locator('[aria-label="New equation"]') });
  const math = row.locator('math-field[aria-label="New equation"]');
  await expect(math).toBeVisible();
  await math.click();
  await math.evaluate(field => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", "f(t)={0 for t<0;1 otherwise}");
    const paste = new Event("paste", { bubbles: true, composed: true, cancelable: true });
    // Firefox discards clipboardData in a synthetic ClipboardEvent constructor.
    Object.defineProperty(paste, "clipboardData", { value: clipboardData });
    field.dispatchEvent(paste);
  });
  await expect.poll(() => row.locator('input.math-source-input').inputValue()).toContain("?");
  await expect.poll(async () => (await readRecoveryScene(page))?.objects[0]?.kind).toBe("implicitCurve");
  const pastedSource = await row.locator('input.math-source-input').inputValue();
  await row.locator('button.math-source-toggle').click();
  await expect(row.locator('input.math-source-input')).toBeVisible();
  await expect(row.locator('input.math-source-input')).toHaveValue(pastedSource);
  await row.locator('button.math-source-toggle').click();
  await expect(math).toBeVisible();
  await expect(row.locator('input.math-source-input')).toHaveValue(pastedSource);
  await fillInput(row.locator('[aria-label="New equation"]').first(), "z={0 for x+y<0.13; 1 otherwise}");
  await expect(page.getByRole("button", { name: "3D only", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await readRecoveryScene(page))?.objects[0]?.kind).toBe("surface");
  await expect(page.locator('[data-graph3d-canvas="true"]').first()).toBeVisible();
});
