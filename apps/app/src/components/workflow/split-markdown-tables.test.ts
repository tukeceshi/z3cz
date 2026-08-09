import { describe, expect, it } from "vitest";

import {
  mergeMarkdownSegmentEdits,
  mergeMarkdownTableEdits,
  splitMarkdownTables,
  textSegmentKey,
} from "./split-markdown-tables";

describe("splitMarkdownTables", () => {
  it("returns plain text when there is no table", () => {
    const markdown = "## Title\n\nHello **world**";
    const segments = splitMarkdownTables(markdown);

    expect(segments).toEqual([{ type: "text", start: 0, end: markdown.length }]);
  });

  it("splits text around a complete table", () => {
    const markdown = [
      "Intro line",
      "",
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
      "",
      "Outro line",
    ].join("\n");

    const segments = splitMarkdownTables(markdown);

    expect(segments).toHaveLength(3);
    expect(segments[0]).toMatchObject({ type: "text" });
    expect(segments[1]).toMatchObject({ type: "table", index: 0 });
    expect(segments[2]).toMatchObject({ type: "text" });

    expect(markdown.slice(segments[0].start, segments[0].end)).toBe(
      "Intro line\n\n"
    );
    expect(markdown.slice(segments[1].start, segments[1].end)).toBe(
      "| A | B |\n| --- | --- |\n| 1 | 2 |\n"
    );
    expect(markdown.slice(segments[2].start, segments[2].end)).toBe(
      "\nOutro line"
    );
  });

  it("keeps a header-only table line as plain text while streaming", () => {
    const markdown = "Before\n| A | B |\nAfter";

    const segments = splitMarkdownTables(markdown);

    expect(segments).toEqual([{ type: "text", start: 0, end: markdown.length }]);
  });

  it("recognizes a minimal complete table", () => {
    const markdown = "| A | B |\n| --- | --- |";

    const segments = splitMarkdownTables(markdown);

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ type: "table", index: 0 });
  });
});

describe("mergeMarkdownSegmentEdits", () => {
  it("replaces an edited text segment while preserving tables", () => {
    const markdown = "Head\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\nTail";
    const segments = splitMarkdownTables(markdown);
    const textSegment = segments.find((segment) => segment.type === "text");

    expect(textSegment?.type).toBe("text");
    if (textSegment?.type !== "text") {
      return;
    }

    const updated = mergeMarkdownSegmentEdits(markdown, segments, {
      textUpdates: new Map([[textSegmentKey(textSegment), "Updated head\n\n"]]),
    });

    expect(updated).toBe(
      "Updated head\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\nTail"
    );
  });
});

describe("mergeMarkdownTableEdits", () => {
  it("replaces an edited table while preserving surrounding text", () => {
    const markdown = "Head\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\nTail";
    const segments = splitMarkdownTables(markdown);
    const tableSegment = segments.find((segment) => segment.type === "table");

    expect(tableSegment?.type).toBe("table");
    if (tableSegment?.type !== "table") {
      return;
    }

    const updated = mergeMarkdownTableEdits(
      markdown,
      segments,
      new Map([
        [
          tableSegment.index,
          "| A | B |\n| --- | --- |\n| 9 | 8 |",
        ],
      ])
    );

    expect(updated).toBe(
      "Head\n\n| A | B |\n| --- | --- |\n| 9 | 8 |\n\nTail"
    );
  });
});
