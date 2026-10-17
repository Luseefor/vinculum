import { expect, type Page } from "@playwright/test";

/** Panel-switch setup: a focused MathLive field can consume the first Escape. */
export async function closeObjectsSheet(page: Page): Promise<void> {
  const sheet = page.getByRole("dialog", { name: "Objects", exact: true });
  await sheet.getByRole("button", { name: "Close", exact: true }).click();
  await expect(sheet).not.toBeVisible();
}
