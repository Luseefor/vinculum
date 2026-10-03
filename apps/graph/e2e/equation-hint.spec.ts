import { expect, test } from "@playwright/test";

test("empty equation hints are italic placeholders, never editable selections", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("vinculum-welcome-onboarding-v1", JSON.stringify({ version: 1, dismissed: true })));
  await page.goto("/editor");
  const field = page.locator('math-field[aria-label="New equation"]');
  const hint = page.locator('.math-input-placeholder').filter({ hasText: "Type an equation" }).first();
  await expect(hint).toBeVisible();
  await expect(hint).toHaveAttribute("aria-hidden", "true");
  expect(await hint.evaluate(element => { const style = getComputedStyle(element); return style.getPropertyValue("user-select") || style.getPropertyValue("-webkit-user-select"); })).toBe("none");
  await expect(hint.locator(".textit")).toBeVisible();
  await field.focus();
  await expect.poll(() => field.evaluate(element => document.activeElement === element)).toBe(true);
  await page.keyboard.press("ControlOrMeta+a");
  await expect.poll(() => field.evaluate(element => (element as HTMLElement & { value: string }).value)).toBe("");
  await expect(hint).toBeVisible();
  await page.keyboard.type("x=y^2");
  await expect(hint).toBeHidden();
  await page.getByRole("button", { name: /Edit as text:.*New equation/i }).click();
  const source = page.getByRole("textbox", { name: "New equation", exact: true });
  await source.fill("");
  await expect(source).toHaveAttribute("placeholder", "Type an equation");
  expect(await source.evaluate(element => getComputedStyle(element, "::placeholder").fontStyle)).toBe("italic");
});
