import { describe, expect, it } from "vitest";

import {
  AI_TEXT_DEFAULT_QUESTION,
  applyAiImageRatioToPrompt,
  buildAiTextUserPrompt,
  buildImageGenerationRequestSnapshot,
  buildVolcanoImageGenerationBody,
  DEFAULT_IMAGE_GENERATION_FIELDS,
  formatAiTextReferenceBlock,
  IMAGE_GENERATION_FIELD_CATALOG,
  mergeImageGenerationParams,
  normalizeAiTextReferences,
  sanitizeImageGenerationParams,
  validateAiTextPromptAssembly,
  type UpstreamParamProfileField,
} from "./platform-ai-model";

function imageGenerationFieldsWithCount(): readonly UpstreamParamProfileField[] {
  const generateCount = IMAGE_GENERATION_FIELD_CATALOG.find(
    (field) => field.name === "generate_count"
  );
  if (!generateCount) {
    throw new Error("generate_count missing from IMAGE_GENERATION_FIELD_CATALOG");
  }
  return [...DEFAULT_IMAGE_GENERATION_FIELDS, generateCount];
}

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

describe("sanitizeImageGenerationParams", () => {
  it("drops params outside current model fields", () => {
    expect(
      sanitizeImageGenerationParams(DEFAULT_IMAGE_GENERATION_FIELDS, {
        size: "2K",
        ratio: "16:9",
        watermark: false,
        web_search: true,
      })
    ).toEqual({
      size: "2K",
      ratio: "16:9",
      watermark: false,
    });
  });

  it("falls back to field default for invalid enum values", () => {
    expect(
      sanitizeImageGenerationParams(DEFAULT_IMAGE_GENERATION_FIELDS, {
        size: "8K",
        ratio: "16:9",
      })
    ).toEqual({
      size: "auto",
      ratio: "16:9",
      watermark: false,
    });
  });

  it("uses admin defaults when stored params are missing", () => {
    expect(sanitizeImageGenerationParams(DEFAULT_IMAGE_GENERATION_FIELDS)).toEqual({
      size: "auto",
      ratio: "auto",
      watermark: false,
    });
  });
});

describe("applyAiImageRatioToPrompt", () => {
  it("returns prompt unchanged for auto ratio", () => {
    expect(applyAiImageRatioToPrompt("hello", "auto")).toBe("hello");
  });

  it("appends ratio hint for fixed ratio", () => {
    expect(applyAiImageRatioToPrompt("hello", "16:9")).toBe(
      "hello, 画面比例 16:9"
    );
  });
});

describe("buildVolcanoImageGenerationBody", () => {
  it("passes size auto to outbound body", () => {
    const body = buildVolcanoImageGenerationBody({
      providerModelId: "gpt-image-2",
      prompt: "a cat",
      generationFields: DEFAULT_IMAGE_GENERATION_FIELDS,
      params: { size: "auto" },
    });
    expect(body.size).toBe("auto");
    expect(body.prompt).toBe("a cat");
  });

  it("skips clientOnly ratio field", () => {
    const body = buildVolcanoImageGenerationBody({
      providerModelId: "seedream",
      prompt: "a cat",
      generationFields: DEFAULT_IMAGE_GENERATION_FIELDS,
      params: { ratio: "16:9", size: "2K" },
    });
    expect(body.ratio).toBeUndefined();
    expect(body.size).toBe("2K");
  });

  it("enables sequential generation when generate_count > 1", () => {
    const generationFields = imageGenerationFieldsWithCount();
    const body = buildVolcanoImageGenerationBody({
      providerModelId: "seedream",
      prompt: "a cat",
      generationFields,
      params: mergeImageGenerationParams(generationFields, {
        generate_count: 3,
      }),
    });
    expect(body.sequential_image_generation).toBe("auto");
    expect(body.sequential_image_generation_options).toEqual({
      max_images: 3,
    });
  });

  it("uses generate_count apiName for sequential options key", () => {
    const generationFields = imageGenerationFieldsWithCount().map((field) =>
      field.name === "generate_count"
        ? { ...field, apiName: "batch_size" }
        : field
    );
    const body = buildVolcanoImageGenerationBody({
      providerModelId: "seedream",
      prompt: "a cat",
      generationFields,
      params: mergeImageGenerationParams(generationFields, {
        generate_count: 2,
      }),
    });
    expect(body.sequential_image_generation_options).toEqual({
      batch_size: 2,
    });
  });

  it("skips multi-image body when countPolicy is disabled", () => {
    const generationFields = imageGenerationFieldsWithCount();
    const body = buildVolcanoImageGenerationBody({
      providerModelId: "seedream",
      prompt: "a cat",
      generationFields,
      params: mergeImageGenerationParams(generationFields, {
        generate_count: 3,
      }),
      countPolicy: { enabled: false, effectMode: "sequential_image_generation" },
    });
    expect(body.sequential_image_generation).toBe("disabled");
    expect(body.sequential_image_generation_options).toBeUndefined();
  });

  it("uses direct countPolicy effectMode for top-level api field", () => {
    const generationFields = imageGenerationFieldsWithCount();
    const body = buildVolcanoImageGenerationBody({
      providerModelId: "gpt-image-2",
      prompt: "a cat",
      generationFields,
      params: mergeImageGenerationParams(generationFields, {
        generate_count: 2,
      }),
      countPolicy: { enabled: true, effectMode: "direct" },
    });
    expect(body.sequential_image_generation).toBe("disabled");
    expect(body.max_images).toBe(2);
  });
});

describe("buildImageGenerationRequestSnapshot", () => {
  it("captures outbound generation fields without secrets", () => {
    const generationFields = imageGenerationFieldsWithCount();
    const body = buildVolcanoImageGenerationBody({
      providerModelId: "gpt-image-2",
      prompt: "a cat",
      generationFields,
      params: { size: "auto", watermark: false, generate_count: 2 },
    });
    expect(
      buildImageGenerationRequestSnapshot({ body, prompt: "a cat" })
    ).toEqual({
      size: "auto",
      watermark: false,
      sequentialImageGeneration: "auto",
      maxImages: 2,
      promptExcerpt: "a cat",
    });
  });
});
