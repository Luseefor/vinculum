import { expect, test } from "@playwright/test";

test("a sketch stays where it was drawn and repeated strokes remain visible", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true })));
  await page.goto("/editor");
  await page.getByRole("button", { name: "2D only", exact: true }).click();
  const canvas = page.locator('canvas[data-graph2d-canvas="true"]').first();
  await expect(canvas).toBeVisible();
  // Inspector may open after creation; keep the canvas dimensions stable.
  const inspectorToggle = page.getByRole("button", { name: "Inspector", exact: true });
  if (await inspectorToggle.getAttribute("aria-pressed") === "true") await inspectorToggle.click();
  const expectedStrokes: { x: number; y: number }[][] = [];
  const scales: number[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole("combobox", { name: "Tool", exact: true }).selectOption("draw");
    const currentBox = (await canvas.boundingBox())!;
    const points = Array.from({ length: 41 }, (_, i) => ({ x: Math.round(currentBox.x + currentBox.width * (0.3 + 0.4 * i / 40)) - currentBox.x, y: Math.round(currentBox.y + currentBox.height * (0.7 - 0.3 * i / 40)) - currentBox.y }));
    const viewport = await page.evaluate(() => JSON.parse(sessionStorage.getItem("vinculum-graph-session")!).state.ui.viewport2d);
    scales.push(viewport.scale);
    expectedStrokes.push([points[0], points[points.length - 1]].map(p => ({
      x: (p.x - currentBox.width / 2) / viewport.scale + viewport.centerX,
      y: -(p.y - currentBox.height / 2) / viewport.scale + viewport.centerY
    })));
    await page.mouse.move(currentBox.x + points[0].x, currentBox.y + points[0].y);
    await page.mouse.down();
    for (const p of points.slice(1)) await page.mouse.move(currentBox.x + p.x, currentBox.y + p.y);
    await page.mouse.up();
    await expect(page.getByTestId("scene-object-count")).toHaveText(String(attempt + 1));
  }
  const objects = await page.evaluate(() => JSON.parse(sessionStorage.getItem("vinculum-graph-session")!).state.scene.objects);
  for (const [index, object] of objects.entries()) {
    expect(object.kind).toBe("parametricCurve");
    expect(object.zExpr).toBe("0");
    // A straight stroke should remain a line, with no spurious polynomial terms.
    expect(object.xExpr).not.toContain("t^");
    expect(object.yExpr).not.toContain("t^");
    const evaluateLinear = (expr: string, t: number) => {
      const terms = expr.replace(/\s/g, "").match(/^(-?[\d.e+-]+)([+-][\d.e+-]+)\*t$/);
      expect(terms).not.toBeNull();
      return Number(terms![1]) + Number(terms![2]) * t;
    };
    for (const t of [0, 1]) {
      const expected = expectedStrokes[index][t];
      // Browser pointer samples use whole pixels; a least-squares line may
      // smooth that quantization, but its endpoints must stay within one pixel.
      expect(Math.hypot(evaluateLinear(object.xExpr, t) - expected.x, evaluateLinear(object.yExpr, t) - expected.y) * scales[index]).toBeLessThan(1);
    }
  }
  await page.reload();
  await expect(page.getByTestId("scene-object-count")).toHaveText("2");
  await expect(canvas).toBeVisible();
});
