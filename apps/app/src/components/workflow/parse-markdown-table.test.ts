import { describe, expect, it } from "vitest";

import { parseMarkdownTableRows } from "./parse-markdown-table";

describe("parseMarkdownTableRows", () => {
  it("parses header and body rows", () => {
    const markdown = ["| A | B |", "| --- | --- |", "| 1 | 2 |", "| 3 | 4 |"].join(
      "\n"
    );

    expect(parseMarkdownTableRows(markdown)).toEqual({
      header: [" A ", " B "],
      rows: [[" 1 ", " 2 "], [" 3 ", " 4 "]],
    });
  });

  it("returns null for incomplete tables", () => {
    expect(parseMarkdownTableRows("| A | B |")).toBeNull();
    expect(parseMarkdownTableRows("| A |\n| no sep |")).toBeNull();
  });
});
