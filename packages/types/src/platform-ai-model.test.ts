import { describe, expect, it } from "vitest";

import {
  AI_TEXT_DEFAULT_QUESTION,
  buildAiTextUserPrompt,
  formatAiTextReferenceBlock,
  normalizeAiTextReferences,
  validateAiTextPromptAssembly,
} from "./platform-ai-model";

describe("formatAiTextReferenceBlock", () => {
  it("wraps content in DeepSeek file blocks", () => {
    expect(formatAiTextReferenceBlock("Node A", "hello")).toBe(
      "[file name]: Node A\n[file content begin]\nhello\n[file content end]"
    );
  });
});

describe("buildAiTextUserPrompt", () => {
  it("uses question only when there are no references", () => {
    expect(buildAiTextUserPrompt({ question: " summarize " })).toBe("summarize");
  });

  it("combines references with the user question", () => {
    expect(
      buildAiTextUserPrompt({
        references: [{ name: "Node A", content: "upstream" }],
        question: "manual",
      })
    ).toBe(
      "[file name]: Node A\n[file content begin]\nupstream\n[file content end]\nmanual"
    );
  });

  it("uses the default question when references exist without a prompt", () => {
    expect(
      buildAiTextUserPrompt({
        references: [{ name: "Node A", content: "upstream" }],
      })
    ).toBe(
      `[file name]: Node A\n[file content begin]\nupstream\n[file content end]\n${AI_TEXT_DEFAULT_QUESTION}`
    );
  });

  it("joins multiple references before the question", () => {
    expect(
      buildAiTextUserPrompt({
        references: [
          { name: "A", content: "one" },
          { name: "B", content: "two" },
        ],
        question: "compare",
      })
    ).toBe(
      "[file name]: A\n[file content begin]\none\n[file content end]\n[file name]: B\n[file content begin]\ntwo\n[file content end]\ncompare"
    );
  });

  it("returns empty string when both references and question are empty", () => {
    expect(buildAiTextUserPrompt({ references: [], question: "  " })).toBe("");
  });
});

describe("normalizeAiTextReferences", () => {
  it("maps string keywords to a single reference", () => {
    expect(normalizeAiTextReferences(" upstream ")).toEqual([
      { name: "reference", content: "upstream" },
    ]);
  });

  it("maps string arrays to numbered references", () => {
    expect(normalizeAiTextReferences([" first ", "second"])).toEqual([
      { name: "reference-1", content: "first" },
      { name: "reference-2", content: "second" },
    ]);
  });
});

describe("validateAiTextPromptAssembly", () => {
  const rules = { keywordsMaxChars: 100, promptMaxChars: 200 };

  it("accepts valid reference and question input", () => {
    const result = validateAiTextPromptAssembly({
      references: [{ name: "A", content: "ctx" }],
      question: "go",
      parameterRules: rules,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.prompt).toContain("go");
    }
  });

  it("rejects empty input", () => {
    expect(
      validateAiTextPromptAssembly({
        parameterRules: rules,
      }).ok
    ).toBe(false);
  });
});
