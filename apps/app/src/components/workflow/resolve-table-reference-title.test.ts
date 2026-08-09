import { describe, expect, it } from "vitest";

import { resolveTableReferenceTitle } from "./resolve-table-reference-title";

describe("resolveTableReferenceTitle", () => {
  it("returns the nearest heading before the table", () => {
    expect(
      resolveTableReferenceTitle("Intro\n\n## Scene list\n\nSome notes\n")
    ).toBe("Scene list");
  });

  it("strips heading markers and trims whitespace", () => {
    expect(resolveTableReferenceTitle("###   Character sheet   \n")).toBe(
      "Character sheet"
    );
  });

  it("returns undefined when no heading exists", () => {
    expect(resolveTableReferenceTitle("Plain text only\n\n")).toBeUndefined();
  });

  it("skips blank lines when searching from the end", () => {
    expect(resolveTableReferenceTitle("## Title\n\n\n")).toBe("Title");
  });
});
