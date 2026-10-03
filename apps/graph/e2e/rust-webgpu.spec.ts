import { addObject } from "./helpers/addObject";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

async function openGeometry(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true, updatedAt: new Date().toISOString() }));
  });
  await page.goto("/editor");
  await page.getByRole("button", { name: "Geometry Studio", exact: true }).click();
  await addObject(page, "Surface");
  const canvas = page.locator('canvas[data-graph3d-canvas="true"]:visible');
  await expect(canvas).toHaveAttribute("data-render-backend", /^(webgpu|webgl2)$/);
  await expect(canvas).toHaveAttribute("data-math-backend", "rust-wasm");
  return canvas;
}

async function assertExportPixels(page: Page) {
  // Give asynchronous pipeline compilation and the geometry worker time to
  // present the surface before exercising the user-facing download path.
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("dialog").getByRole("button", { name: "3D PNG", exact: true }).click();
  const download = await downloadPromise;
  const file = await download.path();
  expect(file).not.toBeNull();
  const png = await readFile(file!);
  expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  const result = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const image = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const target = document.createElement("canvas");
    target.width = image.width; target.height = image.height;
    const context = target.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const colors = new Set<number>();
    let opaque = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] === 255) opaque++;
      colors.add((pixels[index]! << 16) | (pixels[index + 1]! << 8) | pixels[index + 2]!);
    }
    image.close();
    return { width: target.width, height: target.height, colors: colors.size, opaque };
  }, png.toString("base64"));
  expect(result.width).toBeGreaterThan(200);
  expect(result.height).toBeGreaterThan(200);
  expect(result.colors).toBeGreaterThan(20);
  expect(result.opaque).toBeGreaterThan(result.width * result.height * 0.95);
  const active = page.locator('canvas[data-graph3d-canvas="true"]:visible');
  expect(result.width).toBe(await active.evaluate((canvas: HTMLCanvasElement) => canvas.width));
  expect(result.height).toBe(await active.evaluate((canvas: HTMLCanvasElement) => canvas.height));
}

test.describe("Rust math and GPU viewport migration", () => {
  test.setTimeout(60_000);
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 }); });

  test("uses WebGPU when an adapter exists and exports the active quad view", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const canvas = await openGeometry(page);
    const hasAdapter = await page.evaluate(async () => {
      const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
      return gpu ? Boolean(await gpu.requestAdapter()) : false;
    });
    await expect(canvas).toHaveAttribute("data-render-backend", hasAdapter ? "webgpu" : "webgl2");
    await page.getByLabel("Geometry layout").selectOption("quad");
    await assertExportPixels(page);
    expect(errors).toEqual([]);
  });

  test("falls back to WebGL2 without WebGPU and exports a real frame", async ({ page }) => {
    await page.addInitScript(() => { Object.defineProperty(navigator, "gpu", { value: undefined, configurable: true }); });
    const canvas = await openGeometry(page);
    await expect(canvas).toHaveAttribute("data-render-backend", "webgl2");
    await assertExportPixels(page);
  });

  test("failed GPU initialization keeps scene export available and retry reconnects", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "gpu", { value: undefined, configurable: true });
      const state = window as Window & { failGpu?: boolean };
      state.failGpu = true;
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof getContext>) {
        if (state.failGpu && args[0] === "webgl2") return null;
        return getContext.apply(this, args);
      } as typeof getContext;
      localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true, updatedAt: new Date().toISOString() }));
    });
    await page.goto("/editor");
    await expect(page.getByText("Something went wrong")).toBeVisible();
    await addObject(page, "Surface");
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export scene JSON", exact: true }).click();
    const download = await downloadPromise;
    const scene = JSON.parse(await readFile((await download.path())!, "utf8")) as { schemaVersion: number; objects: unknown[] };
    expect(scene.schemaVersion).toBeGreaterThan(0);
    expect(scene.objects).toHaveLength(1);
    await page.evaluate(() => { (window as Window & { failGpu?: boolean }).failGpu = false; });
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.locator('canvas[data-graph3d-canvas="true"]:visible')).toHaveAttribute("data-render-backend", "webgl2");
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  });
});
