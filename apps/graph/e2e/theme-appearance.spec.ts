import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { addObject } from "./helpers/addObject";
import { fillInput } from "./helpers/mathInput";

const accents = ["indigo", "blue", "cyan", "emerald", "green", "amber", "orange", "rose", "pink", "violet"];

async function expectReadableError(page: Page) {
  const alert = page.locator("#graph-inspector").getByRole("alert");
  await expect(alert).toBeVisible();
  const colors = await alert.evaluate(element => {
    const probe = document.createElement("i");
    probe.style.color = "var(--status-error-fg)";
    element.appendChild(probe);
    const colors = { actual: getComputedStyle(element).color, expected: getComputedStyle(probe).color };
    probe.remove();
    return colors;
  });
  expect(colors.actual).toBe(colors.expected);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
}

for (const width of [390, 1440]) {
  for (const theme of ["dark", "light"] as const) {
    test(`${width}px ${theme} appearance stays legible and reloads`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
      await page.addInitScript(() => {
        localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true }));
      });
      await page.goto("/editor");
      await page.getByRole("button", { name: "Math Lab", exact: true }).click();
      await page.getByRole("button", { name: "2D only", exact: true }).click();
      if (width < 720) await page.getByRole("button", { name: "Objects", exact: true }).click();
      await addObject(page, "Surface");
      if (width < 720) await page.keyboard.press("Escape");
      // Surface creation reveals 3D. Return to 2D for stable UI/contrast checks.
      await page.getByRole("button", { name: "2D only", exact: true }).click();
      if (width < 720) {
        const more = page.getByRole("button", { name: "More actions" });
        for (let step = 0; step < 3; step++) {
          await more.click();
          const item = page.getByRole("menuitem", { name: /^Theme:/ });
          if (await item.textContent() === `Theme: ${theme}`) break;
          await item.click();
        }
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(page.getByRole("menuitem", { name: `Theme: ${theme}`, exact: true })).toBeVisible();
        expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
        await testInfo.attach(`${theme}-appearance-${width}`, { body: await page.screenshot(), contentType: "image/png" });
        await page.keyboard.press("Escape");
        await expect(more).toBeFocused();
        await page.reload();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        return;
      }
      const trigger = page.getByRole("button", { name: "Open theme and accent menu" });
      await trigger.click();
      const choice = page.getByRole("button", { name: `Use ${theme} theme` });
      await choice.click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(choice).toHaveAttribute("aria-pressed", "true");

      // Verify the real cascade: shared button utilities must not mask selection.
      const selection = await choice.evaluate(element => {
        const probe = document.createElement("i");
        probe.style.color = "var(--accent-ink)";
        probe.style.backgroundColor = "var(--accent-soft)";
        document.body.appendChild(probe);
        const actual = getComputedStyle(element), expected = getComputedStyle(probe);
        const result = { color: actual.color, background: actual.backgroundColor,
          expectedColor: expected.color, expectedBackground: expected.backgroundColor };
        probe.remove();
        return result;
      });
      expect(selection.color).toBe(selection.expectedColor);
      expect(selection.background).toBe(selection.expectedBackground);

      for (const accent of accents) {
        await page.getByRole("button", { name: `Accent ${accent}`, exact: true }).click();
        await expect(page.locator("html")).toHaveAttribute("data-accent", accent);
        if (theme === "dark") {
          const focusContrast = await page.evaluate(() => {
            const canvas = document.createElement("canvas"), probe = document.createElement("i");
            canvas.width = canvas.height = 1;
            const context = canvas.getContext("2d")!;
            document.body.appendChild(probe);
            const luminance = (variable: string) => {
              probe.style.color = `var(${variable})`;
              context.fillStyle = getComputedStyle(probe).color;
              context.fillRect(0, 0, 1, 1);
              const channels = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3)
                .map(value => value / 255)
                .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
              return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
            };
            const focus = luminance("--accent");
            const ratios = ["--editor-chrome", "--editor-control", "--surface-raised"]
              .map(variable => (focus + .05) / (luminance(variable) + .05));
            probe.remove();
            return Math.min(...ratios);
          });
          expect(focusContrast, `${accent} focus ring`).toBeGreaterThanOrEqual(3);
        }
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(result.violations, `${theme}/${accent}`).toEqual([]);
      }
      await page.getByRole("button", { name: "Accent indigo", exact: true }).click();
      await testInfo.attach(`${theme}-appearance-${width}`, { body: await page.screenshot(), contentType: "image/png" });
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.locator("html")).toHaveAttribute("data-accent", "indigo");
      await expect(page.locator('canvas[data-graph2d-canvas="true"]').first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

      // App theme selection must control errors even when the OS theme differs.
      await page.getByRole("button", { name: "Geometry Studio", exact: true }).click();
      await addObject(page, "Ray");
      await fillInput(page.locator("#graph-inspector").getByLabel("Ray direction x"), "x");
      await expectReadableError(page);
      await page.getByRole("button", { name: "Math Lab", exact: true }).click();
      await addObject(page, "2D Linear Transformation");
      await fillInput(page.locator("#graph-inspector").getByLabel("Row 1 column 1"), "sin(factorial(a))");
      await expectReadableError(page);
    });
  }
}
