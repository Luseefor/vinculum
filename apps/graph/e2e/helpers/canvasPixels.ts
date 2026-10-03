import type { Locator, Page } from "@playwright/test";

/** Read scene pixels without transient pointer emphasis or hover badges,
 * independent of GPU drawing-buffer lifetime. */
export async function screenshotPixels(page: Page, canvas: Locator): Promise<string | null> {
  try {
    await page.mouse.move(0, 0);
    const png = await canvas.screenshot({
      scale: "css",
      animations: "disabled",
      // Frame-rate feedback changes with shader warmup and machine load; it
      // is editor chrome rather than mathematical scene content.
      style: '[data-graph3d-performance-warning="true"], [data-graph3d-perf="true"] { visibility: hidden !important; }'
    });
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}
