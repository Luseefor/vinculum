import { expect, test, type Page } from "@playwright/test";

async function dismissBlockingDialogs(page: Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const visibleDialogs = page.locator('[role="dialog"]:visible');
    if ((await visibleDialogs.count()) === 0) {
      break;
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(120);
  }
}

test.describe("Graph shell", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem(
        "vinculum-welcome-onboarding-v1",
        JSON.stringify({
          version: 1,
          dismissed: true,
          updatedAt: new Date().toISOString()
        })
      );
    });
  });

  test("loads editor toolbar with 2D+3D split and 3D canvas visible", async ({ page }) => {
    await page.goto("/editor");
    await dismissBlockingDialogs(page);
    await expect(page.getByRole("button", { name: "Scene" })).toBeVisible();
    const viewGroup = page.getByRole("group", { name: "View type" });
    await expect(viewGroup.getByRole("button", { name: "2D and 3D together" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    await expect(page.locator('label:has-text("Tool") select')).toBeVisible();
  });

  test("2D Plane and 3D Base are separate toolbar selects; labels track store", async ({ page }) => {
    await page.goto("/editor");
    await dismissBlockingDialogs(page);
    const plane2d = page.getByTestId("toolbar-2d-plane-select");
    const base3d = page.getByTestId("toolbar-3d-base-select");
    await expect(plane2d).toBeVisible();
    await expect(base3d).toBeVisible();
    expect(await plane2d.locator("option").allTextContents()).toEqual(["XY", "XZ", "YZ"]);
    expect(await base3d.locator("option").allTextContents()).toEqual(["Base XY", "Base XZ", "Base YZ"]);

    await plane2d.selectOption("xz");
    await expect(page.getByText(/2D Graph\s*·\s*XZ/).first()).toBeVisible();

    await base3d.selectOption({ label: "Base YZ" });
    await expect(page.getByText(/3D Scene\s*·\s*Base YZ/).first()).toBeVisible();
  });

  test("switches between 2D, 2D+3D, and 3D view types and layout split/quad", async ({ page }) => {
    await page.goto("/editor");
    await dismissBlockingDialogs(page);
    const viewGroup = page.getByRole("group", { name: "View type" });
    const layoutGroup = page.getByRole("group", { name: "Multi-panel layout" });
    await viewGroup.getByRole("button", { name: "2D only" }).click();
    await expect(viewGroup.getByRole("button", { name: "2D only" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('canvas[data-graph2d-canvas="true"]').first()).toBeVisible();

    await viewGroup.getByRole("button", { name: "2D and 3D together" }).click();
    await expect(viewGroup.getByRole("button", { name: "2D and 3D together" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('canvas[data-graph2d-canvas="true"]').first()).toBeVisible();
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();

    await layoutGroup.getByRole("button", { name: "Four-panel layout" }).click();
    await expect(layoutGroup.getByRole("button", { name: "Four-panel layout" })).toHaveAttribute("aria-pressed", "true");

    await layoutGroup.getByRole("button", { name: "Side-by-side layout" }).click();
    await expect(layoutGroup.getByRole("button", { name: "Side-by-side layout" })).toHaveAttribute("aria-pressed", "true");

    await viewGroup.getByRole("button", { name: "3D only" }).click();
    await expect(viewGroup.getByRole("button", { name: "3D only" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
  });

  test("new scene opens confirmation when the scene has objects", async ({ page }) => {
    await page.goto("/editor");
    await dismissBlockingDialogs(page);
    await page.getByRole("button", { name: "Examples" }).click();
    await page.getByRole("button", { name: "Open example" }).first().click();
    await expect(page.getByTestId("scene-object-count")).not.toHaveText("0");

    await page.getByRole("button", { name: "Scene" }).click();
    await page.getByRole("menuitem", { name: "New Scene" }).click({ force: true });
    await expect(page.getByTestId("new-scene-dialog")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("new-scene-dialog")).not.toBeVisible();
  });

  test("3D canvas remains stable during orbit", async ({ page }) => {
    await page.goto("/editor");
    await dismissBlockingDialogs(page);
    await page.getByRole("group", { name: "View type" }).getByRole("button", { name: "3D only" }).click();
    const canvas3d = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await expect(canvas3d).toBeVisible();

    const box = await canvas3d.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
      return;
    }

    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.55);
    await page.mouse.up();

    await expect(canvas3d).toBeVisible();
    await expect(page.getByRole("group", { name: "View type" }).getByRole("button", { name: "3D only" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  test("3D probe shows hover coordinate box", async ({ page }) => {
    await page.goto("/editor");
    await dismissBlockingDialogs(page);
    await page.getByRole("group", { name: "View type" }).getByRole("button", { name: "3D only" }).click();
    await page.locator('label:has-text("Tool") select').selectOption("probe");

    const canvas3d = page.locator('canvas[data-graph3d-canvas="true"]').first();
    await expect(canvas3d).toBeVisible();
    const box = await canvas3d.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
      return;
    }

    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await expect(page.locator('[data-graph3d-probe-hover="true"]').first()).toBeVisible();
  });

  test("theme menu can set light then dark resolved theme", async ({ page }) => {
    await page.goto("/editor");
    await dismissBlockingDialogs(page);
    await page.getByRole("button", { name: "Open theme and accent menu" }).click();
    await page.getByRole("button", { name: "Use light theme" }).click();
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.dataset.theme))
      .toBe("light");

    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Open theme and accent menu" }).click();
    await page.getByRole("button", { name: "Use dark theme" }).click();
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.dataset.theme))
      .toBe("dark");
  });

  test("sketch in 2D adds parametric object visible in 3D", async ({ page }) => {
    await page.goto("/editor");
    await dismissBlockingDialogs(page);
    await page.getByRole("group", { name: "View type" }).getByRole("button", { name: "2D only" }).click();
    await page.locator('label:has-text("Tool") select').selectOption("draw");

    const canvas2d = page.locator('canvas[data-graph2d-canvas="true"]').first();
    await expect(canvas2d).toBeVisible();
    const box = await canvas2d.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
      return;
    }

    const drawStroke = async () => {
      await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.65);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.55);
      await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.5);
      await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.4);
      await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.35);
      await page.mouse.up();
      await page.waitForTimeout(250);
    };
    await drawStroke();
    let countText = (await page.getByTestId("scene-object-count").textContent())?.trim() ?? "0";
    if (countText === "0") {
      await drawStroke();
      countText = (await page.getByTestId("scene-object-count").textContent())?.trim() ?? "0";
    }
    expect(countText).not.toBe("0");

    await page.getByRole("group", { name: "View type" }).getByRole("button", { name: "3D only" }).click();
    await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
    await expect(page.getByTestId("scene-object-count")).toHaveText("1");
  });

  test("examples query entrypoint opens examples dialog", async ({ page }) => {
    await page.goto("/editor?examples=1");
    await expect(page.getByRole("dialog", { name: "Examples" })).toBeVisible();
  });

  test("examples route redirects to editor examples entrypoint", async ({ page }) => {
    await page.goto("/examples");
    await expect(page).toHaveURL(/\/editor\?examples=1$/);
    await expect(page.getByRole("dialog", { name: "Examples" })).toBeVisible();
  });

  test("share dialog opens with export actions", async ({ page }) => {
    await page.goto("/editor");
    await dismissBlockingDialogs(page);
    await page.getByRole("button", { name: "Share" }).click();
    await expect(page.getByRole("dialog", { name: "Share and export" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy share link" })).toBeVisible();
    await expect(page.getByRole("button", { name: "JSON" })).toBeVisible();
  });
});
