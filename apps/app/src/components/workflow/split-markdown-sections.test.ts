import { describe, expect, it } from "vitest";

import {
  sectionBodyMarkdown,
  splitMarkdownSections,
} from "./split-markdown-sections";

describe("splitMarkdownSections", () => {
  it("returns preamble when there is no heading", () => {
    const markdown = "Intro\n\nplain text\n\n| A | B |";
    const parts = splitMarkdownSections(markdown);

    expect(parts).toEqual([{ type: "preamble", start: 0, end: markdown.length }]);
  });

  it("splits preamble and multiple leaf H2 sections", () => {
    const markdown = ["Intro", "", "## Alpha", "a", "", "## Beta", "b"].join(
      "\n"
    );
    const parts = splitMarkdownSections(markdown);

    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatchObject({ type: "preamble", start: 0 });
    expect(parts[1]).toMatchObject({ type: "section", index: 0, level: 2 });
    expect(parts[2]).toMatchObject({ type: "section", index: 1, level: 2 });
  });

  it("does not trigger parent H2 when H3 children exist", () => {
    const markdown = [
      "## Scene",
      "intro under scene",
      "",
      "### Shot 1",
      "body one",
      "",
      "### Shot 2",
      "body two",
    ].join("\n");

    const parts = splitMarkdownSections(markdown);
    const sections = parts.filter((part) => part.type === "section");

    expect(sections).toHaveLength(2);
    expect(parts[0]).toMatchObject({ type: "preamble" });
    expect(markdown.slice(parts[0]!.start, parts[0]!.end)).toBe(
      ["## Scene", "intro under scene", ""].join("\n")
    );

    expect(sections[0]).toMatchObject({ index: 0, level: 3 });
    expect(sectionBodyMarkdown(markdown, sections[0]!)).toBe("body one\n\n");
    expect(sections[1]).toMatchObject({ index: 1, level: 3 });
    expect(sectionBodyMarkdown(markdown, sections[1]!)).toBe("body two");
  });

  it("triggers H3-only document sections", () => {
    const markdown = ["### Solo", "only h3"].join("\n");
    const parts = splitMarkdownSections(markdown);

    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ type: "section", level: 3 });
    if (parts[0]?.type !== "section") {
      return;
    }
    expect(sectionBodyMarkdown(markdown, parts[0])).toBe("only h3");
  });

  it("treats the last leaf section as running to EOF", () => {
    const markdown = [
      "## Scene A",
      "line one",
      "",
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
      "",
      "after table",
      "",
      "## Scene B",
      "closing",
    ].join("\n");

    const parts = splitMarkdownSections(markdown);
    const lastSection = parts.find(
      (part) => part.type === "section" && part.index === 1
    );

    expect(lastSection?.type).toBe("section");
    if (lastSection?.type !== "section") {
      return;
    }

    expect(lastSection.end).toBe(markdown.length);
    expect(sectionBodyMarkdown(markdown, lastSection)).toBe("closing");
  });

  it("handles a trailing leaf heading with no body while streaming", () => {
    const markdown = "## Generating";
    const parts = splitMarkdownSections(markdown);

    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ type: "section", index: 0 });
    if (parts[0]?.type !== "section") {
      return;
    }

    expect(sectionBodyMarkdown(markdown, parts[0])).toBe("");
  });

  it("includes trailing table and text in the last section body", () => {
    const markdown = [
      "## Sheet",
      "",
      "| Name | Value |",
      "| --- | --- |",
      "| x | 1 |",
      "",
      "footer note",
    ].join("\n");

    const parts = splitMarkdownSections(markdown);
    const section = parts[0];

    expect(section?.type).toBe("section");
    if (section?.type !== "section") {
      return;
    }

    expect(sectionBodyMarkdown(markdown, section)).toBe(
      [
        "",
        "| Name | Value |",
        "| --- | --- |",
        "| x | 1 |",
        "",
        "footer note",
      ].join("\n")
    );
  });

  it("uses the deepest leaf heading under nested headings", () => {
    const markdown = [
      "## Act",
      "",
      "### Scene",
      "",
      "#### Beat",
      "deepest body",
    ].join("\n");

    const parts = splitMarkdownSections(markdown);
    const sections = parts.filter((part) => part.type === "section");

    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ level: 4 });
    expect(sectionBodyMarkdown(markdown, sections[0]!)).toBe("deepest body");
  });
});
