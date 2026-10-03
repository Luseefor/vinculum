import { expect, type Locator } from "@playwright/test";

/** Resolve the source editor while preserving existing accessible input locators. */
async function sourceInput(locator: Locator): Promise<Locator> {
  const matches = await locator.evaluateAll((elements) => elements.map((element) => {
    const root = element.getRootNode();
    const field = element.matches("math-field, .math-source-input, .math-source-toggle") ? element : root instanceof ShadowRoot && root.host.tagName === "MATH-FIELD" ? root.host : null;
    return field?.closest<HTMLElement>(".math-input")?.dataset.mathInputId ?? null;
  }));
  if (!matches.length) { await locator.waitFor(); return sourceInput(locator); }
  if (matches.every((id) => id && id === matches[0])) {
    // MathLive exposes the host label and an accessible keyboard sink for the same editor.
    const container = locator.page().locator(`[data-math-input-id="${matches[0]}"]`);
    const input = container.locator("input.math-source-input");
    // Wait for lazy MathLive initialization before choosing source mode: it
    // replaces the initially visible fallback input on slower browser starts.
    const toggle = container.locator("button.math-source-toggle");
    await expect(toggle).toBeVisible();
    if (await toggle.getAttribute("aria-pressed") !== "true") await toggle.click();
    await expect(input).toBeVisible();
    return input;
  }
  return locator;
}

export async function fillInput(locator: Locator, value: string, options?: Parameters<Locator["fill"]>[1]): Promise<void> {
  await (await sourceInput(locator)).fill(value, options);
}

export async function pressInput(locator: Locator, key: string): Promise<void> {
  await (await sourceInput(locator)).press(key);
}

/** Assert creation focus without switching a typeset editor into source mode. */
export async function expectInputFocused(locator: Locator, options: { timeout?: number } = {}): Promise<void> {
  await expect.poll(() => locator.evaluateAll(elements => elements.some(element => {
    const root = element.getRootNode();
    const host = root instanceof ShadowRoot ? root.host : element;
    const container = host.closest(".math-input");
    const active = document.activeElement;
    return container ? active === container.querySelector("math-field") || active === container.querySelector("input.math-source-input") : active === element;
  })), options).toBe(true);
}

/** MathLive's keyboard sink has no visible box; assert the rendered editor. */
export async function expectInputVisible(locator: Locator, options: { timeout?: number } = {}): Promise<void> {
  await expect.poll(() => locator.evaluateAll(elements => elements.some(element => {
    const root = element.getRootNode();
    const host = root instanceof ShadowRoot ? root.host : element;
    const container = host.closest(".math-input");
    const editors = container ? Array.from(container.querySelectorAll("math-field, input.math-source-input")) : [element];
    return editors.some(editor => editor.getClientRects().length > 0 && getComputedStyle(editor).visibility !== "hidden");
  })), options).toBe(true);
}

export async function expectInputValue(locator: Locator, value: string | RegExp, options: { timeout?: number; not?: boolean } = {}): Promise<void> {
  const input = await sourceInput(locator);
  const assertion = expect(input);
  if (options.not) await assertion.not.toHaveValue(value, { timeout: options.timeout });
  else await assertion.toHaveValue(value, { timeout: options.timeout });
}

export async function readInputValue(locator: Locator, options?: Parameters<Locator["inputValue"]>[0]): Promise<string> {
  return (await sourceInput(locator)).inputValue(options);
}
