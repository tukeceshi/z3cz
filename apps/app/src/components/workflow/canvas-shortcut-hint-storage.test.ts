import { afterEach, describe, expect, it } from "vitest";

import {
  readCanvasShortcutHintCollapsed,
  writeCanvasShortcutHintCollapsed,
} from "./canvas-shortcut-hint-storage";

const store = new Map<string, string>();

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  },
});

describe("canvas-shortcut-hint-storage", () => {
  afterEach(() => {
    store.clear();
  });

  it("defaults to expanded when nothing is stored", () => {
    expect(readCanvasShortcutHintCollapsed()).toBe(false);
  });

  it("round-trips collapsed and expanded", () => {
    writeCanvasShortcutHintCollapsed(true);
    expect(readCanvasShortcutHintCollapsed()).toBe(true);

    writeCanvasShortcutHintCollapsed(false);
    expect(readCanvasShortcutHintCollapsed()).toBe(false);
  });
});
