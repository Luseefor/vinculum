import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// jsdom: ResizeObserver for layout-dependent overlays (e.g. 2D cursor tooltip)
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Bun + Vitest + jsdom: `sessionStorage` is provided but `localStorage` is
// missing (S0-U2 diagnosis). Install a minimal in-memory Storage shim only
// when the native implementation is absent. Never replace working storage.
function createInMemoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length(): number {
      return entries.size;
    },
    clear(): void {
      entries.clear();
    },
    getItem(key: string): string | null {
      const name = String(key);
      return entries.has(name) ? (entries.get(name) as string) : null;
    },
    key(index: number): string | null {
      if (!Number.isInteger(index) || index < 0) {
        return null;
      }
      return [...entries.keys()][index] ?? null;
    },
    removeItem(key: string): void {
      entries.delete(String(key));
    },
    setItem(key: string, value: string): void {
      entries.set(String(key), String(value));
    }
  };
}

function ensureWebStorage(name: "localStorage" | "sessionStorage"): void {
  const globalTarget = globalThis as unknown as Record<string, unknown>;
  const windowValue = typeof window !== "undefined" ? window[name] : undefined;
  const globalValue = globalTarget[name];
  if (typeof windowValue !== "undefined" && typeof globalValue !== "undefined") {
    return;
  }
  const storage: Storage =
    (typeof windowValue !== "undefined" ? (windowValue as Storage) : undefined) ??
    (typeof globalValue !== "undefined" ? (globalValue as Storage) : undefined) ??
    createInMemoryStorage();
  if (typeof window !== "undefined" && typeof window[name] === "undefined") {
    Object.defineProperty(window, name, {
      configurable: true,
      writable: true,
      value: storage
    });
  }
  if (typeof globalTarget[name] === "undefined") {
    Object.defineProperty(globalTarget, name, {
      configurable: true,
      writable: true,
      value: storage
    });
  }
}

ensureWebStorage("localStorage");
ensureWebStorage("sessionStorage");

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
