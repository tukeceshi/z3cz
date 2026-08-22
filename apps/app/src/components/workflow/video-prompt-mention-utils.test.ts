import { describe, expect, it } from "vitest";

import {
  applyMentionPick,
  detectMention,
  flatIndexToStoredIndex,
  resolveEffectiveFlatCaretIndex,
  storedToFlatText,
} from "./video-prompt-mention-utils";

describe("storedToFlatText", () => {
  it("replaces ref tokens with a single placeholder char", () => {
    expect(storedToFlatText("hello {{ref:abc}} world")).toBe(
      `hello \uFFFC world`
    );
  });
});

describe("detectMention", () => {
  it("detects trailing @ after text", () => {
    const stored = "一段描述@";
    const mention = detectMention(stored, stored.length);
    expect(mention?.query).toBe("");
    expect(mention?.mentionStartStored).toBe(4);
    expect(mention?.mentionEndStored).toBe(5);
  });

  it("detects @ when caret is reported at 0 but text ends with @", () => {
    const flat = storedToFlatText("hello @");
    expect(resolveEffectiveFlatCaretIndex(flat, 0)).toBe(flat.length);
    const mention = detectMention("hello @", 0);
    expect(mention?.query).toBe("");
    expect(mention?.mentionStartStored).toBe(6);
  });

  it("detects @ after a ref chip", () => {
    const stored = `before {{ref:edge-1}}@`;
    const flat = storedToFlatText(stored);
    const mention = detectMention(stored, flat.length);
    expect(mention?.query).toBe("");
    expect(mention?.mentionStartStored).toBe(stored.length - 1);
  });

  it("returns null when there is no active @ mention", () => {
    expect(detectMention("hello world", 11)).toBeNull();
  });
});

describe("applyMentionPick", () => {
  it("replaces @query with a ref token", () => {
    expect(applyMentionPick("hello @foo", 6, 10, "edge-1")).toBe(
      "hello {{ref:edge-1}}"
    );
  });
});

describe("flatIndexToStoredIndex", () => {
  it("maps flat indices across ref tokens", () => {
    const stored = "ab{{ref:x}}cd";
    expect(flatIndexToStoredIndex(stored, 2)).toBe(2);
    expect(flatIndexToStoredIndex(stored, 3)).toBe("ab{{ref:x}}".length);
    expect(flatIndexToStoredIndex(stored, 4)).toBe(stored.length);
  });
});
