import { describe, expect, it } from "vitest";

import { patchMarkdownTableEdit } from "./patch-markdown-table-edit";

describe("patchMarkdownTableEdit", () => {
  const original = [
    "| A | B |",
    "| --- | --- |",
    "| 1 | 2 |",
    "| wide cell     | x |",
  ].join("\n");

  it("preserves unchanged cells and the separator row", () => {
    const edited = [
      "| A | B |",
      "| ----- | ----- |",
      "| 9 | 2 |",
      "| wide cell          | x |",
    ].join("\n");

    expect(patchMarkdownTableEdit(`${original}\n`, edited)).toBe(
      ["| A | B |", "| --- | --- |", "| 9 | 2 |", "| wide cell     | x |"].join(
        "\n"
      ) + "\n"
    );
  });

  it("returns the original table when nothing changed", () => {
    const edited = [
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
      "| wide cell | x |",
    ].join("\n");

    expect(patchMarkdownTableEdit(`${original}\n`, edited)).toBe(
      `${original}\n`
    );
  });

  it("updates multiple edited cells without padding untouched cells", () => {
    const edited = [
      "| A | changed |",
      "| --- | --- |",
      "| 1 | 2 |",
      "| wide cell | y |",
    ].join("\n");

    expect(patchMarkdownTableEdit(original, edited)).toBe(
      [
        "| A | changed |",
        "| --- | --- |",
        "| 1 | 2 |",
        "| wide cell     | y |",
      ].join("\n")
    );
  });
});
