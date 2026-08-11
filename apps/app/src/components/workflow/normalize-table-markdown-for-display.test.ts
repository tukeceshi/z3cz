import { describe, expect, it } from "vitest";

import { normalizeTableMarkdownForDisplay } from "./normalize-table-markdown-for-display";
import { parseMarkdownTableRows } from "./parse-markdown-table";

describe("normalizeTableMarkdownForDisplay", () => {
  it("leaves ASCII-only markdown unchanged", () => {
    const markdown = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    expect(normalizeTableMarkdownForDisplay(markdown)).toBe(markdown);
  });

  it("converts fullwidth pipes so preview tables parse into columns", () => {
    const markdown = [
      "| 镜头｜时间线｜时长｜音效 |",
      "|---|---:|---:|---|",
      "| 1｜00:00-00:02 | 2秒 | 远景 | 海浪 |",
    ].join("\n");

    const normalized = normalizeTableMarkdownForDisplay(markdown);
    expect(parseMarkdownTableRows(normalized)).toEqual({
      header: [" 镜头", "时间线", "时长", "音效 "],
      rows: [[" 1", "00:00-00:02 ", " 2秒 ", " 远景 ", " 海浪 "]],
    });
  });
});
