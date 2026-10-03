import type { Page } from "@playwright/test";

/** Creation now uses the categorized Add catalog rather than permanent rail chips. */
export async function addObject(page: Page, name: string) {
  const entry = page.getByRole("button", { name, exact: true });
  if (await entry.count() === 0) await page.getByRole("button", { name: "Open object menu", exact: true }).click();
  await entry.click();
}
