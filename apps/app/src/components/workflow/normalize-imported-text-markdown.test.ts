import { describe, expect, it } from "vitest";

import { normalizeImportedTextMarkdown } from "./normalize-imported-text-markdown";
import { parseMarkdownHeadingLevel } from "./split-markdown-sections";

describe("normalizeImportedTextMarkdown", () => {
  it("converts H1 to H2 and normalizes line endings", () => {
    const input = "\uFEFF# Title\r\n\r\nBody";
    const normalized = normalizeImportedTextMarkdown(input);
    expect(normalized).toBe("## Title\n\nBody");
    expect(parseMarkdownHeadingLevel("## Title")).toBe(2);
  });

  it("normalizes fullwidth table pipes", () => {
    const markdown = "| A｜B |\n| --- | --- |\n| 1 | 2 |";
    expect(normalizeImportedTextMarkdown(markdown)).toBe(
      "| A|B |\n| --- | --- |\n| 1 | 2 |"
    );
  });
});
