import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [320, 768, 1440]) {
  test(`${width}px public pages keep navigation and guide usable`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Make sense of math");
    await expect(page.getByRole("link", { name: "Start graphing", exact: true })).toHaveAttribute("href", "/editor");
    expect((await new AxeBuilder({ page }).analyze()).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical")).toEqual([]);
    await page.getByRole("button", { name: /Use (light|dark) theme/ }).click();
    const theme = await page.locator("html").getAttribute("data-theme");
    await page.getByRole("navigation", { name: "Primary", exact: true }).getByRole("link", { name: "Guide", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Find your way around." })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme!);
    await page.getByRole("searchbox", { name: "Find a topic" }).fill("gradient");
    const toc = page.getByRole("navigation", { name: "On this page" });
    await expect(toc.getByRole("link")).toHaveCount(1);
    await toc.getByRole("link", { name: "Analyzing a graph" }).click();
    await expect(page).toHaveURL(/#analyze$/);
    await page.getByRole("searchbox", { name: "Find a topic" }).fill("no-such-topic");
    await expect(page.getByRole("status")).toContainText("No topics match");
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(toc.getByRole("link")).toHaveCount(7);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
    expect(violations).toEqual([]);
    await page.getByRole("button", { name: /Use (light|dark) theme/ }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical")).toEqual([]);
    await page.goto("/missing-public-page");
    await expect(page.getByRole("heading", { name: "Let’s get you back." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Read the guide" })).toHaveAttribute("href", "/documentations");
  });
}

for (const width of [320, 768, 1440]) {
  test(`${width}px public footer has aligned, accessible links and stays outside the editor`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/", "/documentations", "/missing-public-page"]) {
      await page.goto(route);
      const footer = page.getByRole("contentinfo");
      await footer.scrollIntoViewIfNeeded();
      await expect(footer).toBeVisible();
      await expect(footer.getByText("A workspace for mathematics", { exact: true })).toBeVisible();
      const nav = footer.getByRole("navigation", { name: "Footer", exact: true });
      for (const [name, href] of [["Editor", "/editor"], ["Examples", "/examples"], ["Guide", "/documentations"]]) {
        const link = nav.getByRole("link", { name, exact: true });
        await expect(link).toHaveAttribute("href", href);
        const box = (await link.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x+box.width).toBeLessThanOrEqual(width);
        await link.focus();
        await expect(link).toBeFocused();
      }
      expect(await footer.evaluate(element => {
        const { left, right } = element.getBoundingClientRect();
        return left >= 0 && right <= window.innerWidth && document.documentElement.scrollWidth <= window.innerWidth;
      })).toBe(true);
      if (route === "/missing-public-page") {
        expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(901);
        const bounds = (await footer.boundingBox())!;
        expect(bounds.y+bounds.height).toBeCloseTo(900, 0);
      }
      const violations = (await new AxeBuilder({ page }).include(".public-footer").analyze()).violations;
      expect(violations).toEqual([]);
    }
    await page.getByRole("contentinfo").getByRole("link", { name: "Guide", exact: true }).click();
    await expect(page).toHaveURL(/documentations$/);
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Guide", exact: true })).toHaveAttribute("aria-current", "page");
    await page.goto("/editor");
    await expect(page.getByRole("contentinfo")).toHaveCount(0);
  });
}
