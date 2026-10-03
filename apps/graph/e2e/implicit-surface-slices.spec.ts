import { expect, test } from "@playwright/test";
import { fillInput } from "./helpers/mathInput";

for (const width of [390, 1440]) test(`${width}px torus has a labeled XY cross-section in 2D`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true }));
  });
  await page.goto("/editor");
  if (width < 720) await page.getByRole("button", { name: "Objects", exact: true }).click();
  const field = page.locator('[data-auto-equation-input]').last();
  await fillInput(field.locator('[aria-label="New equation"]').first(), "(x^2+y^2+z^2+3.75)^2-16*(x^2+y^2)=0");
  await field.locator('input.math-source-input').press("Enter");
  if (width < 720) await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "2D only", exact: true }).click();
  await expect(page.getByTestId("implicit-slice-label").first()).toHaveText(" · Surface slice: z = 0");
  const canvas = page.locator('canvas[data-graph2d-canvas="true"]').first();
  await expect.poll(async () => canvas.evaluate((node: HTMLCanvasElement) => {
    const pixels = node.getContext("2d")!.getImageData(0, 0, node.width, node.height).data;
    let ink = 0;
    for (let i=0; i<pixels.length; i+=4) if (pixels[i+2]>pixels[i]+40 && pixels[i+2]>pixels[i+1]+20) ink++;
    return ink;
  })).toBeGreaterThan(200);
});
