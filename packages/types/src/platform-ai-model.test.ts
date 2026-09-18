import { describe, expect, it } from "vitest";

import {
  AI_TEXT_DEFAULT_QUESTION,
  appendVideoReferenceImagesToContent,
  applyAiImageRatioToPrompt,
  buildAiTextUserPrompt,
  buildDurationOptions,
  buildGenerateCountOptions,
  buildImageGenerationRequestSnapshot,
  buildVolcanoImageGenerationBody,
  buildVolcanoVideoGenerationBody,
  DEFAULT_IMAGE_GENERATION_FIELDS,
  DEFAULT_VIDEO_GENERATION_FIELDS,
  formatAiTextReferenceBlock,
  IMAGE_GENERATION_FIELD_CATALOG,
  mergeImageGenerationParams,
  mapVideoGenerationFieldsToBody,
  normalizeAiTextReferences,
  omitAdaptiveVideoRatioFromRequestBody,
  resolveVideoReferenceMode,
  sanitizeImageGenerationParams,
  validateAiTextPromptAssembly,
  validateSubmitAiVideoReferences,
  normalizeVideoModelParameterRules,
  DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
  VIDEO_GENERATION_FIELD_CATALOG,
  VIDEO_RATIO_OPTIONS,
  type UpstreamParamProfileField,
} from "./platform-ai-model";

function imageGenerationFieldsWithCount(): readonly UpstreamParamProfileField[] {
  const generateCount = IMAGE_GENERATION_FIELD_CATALOG.find(
    (field) => field.name === "generate_count"
  );
  if (!generateCount) {
    throw new Error(
      "generate_count missing from IMAGE_GENERATION_FIELD_CATALOG"
    );
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
    expect(buildAiTextUserPrompt({ question: " summarize " })).toBe(
      "summarize"
    );
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
    expect(
      sanitizeImageGenerationParams(DEFAULT_IMAGE_GENERATION_FIELDS)
    ).toEqual({
      size: "auto",
      ratio: "auto",
      watermark: false,
    });
  });

  it("keeps video duration up to model enum max", () => {
    const durationField = {
      name: "duration",
      apiName: "duration",
      type: "number",
      description: "Video duration in seconds",
      default: 5,
      enumValues: buildDurationOptions(4, 30),
    } as const satisfies UpstreamParamProfileField;

    expect(
      sanitizeImageGenerationParams([durationField], { duration: 20 })
    ).toEqual({ duration: 20 });
  });

  it("caps generate_count at model options", () => {
    const generateCountField = {
      name: "generate_count",
      apiName: "max_images",
      type: "number",
      description: "Generate count",
      default: 1,
      enumValues: buildGenerateCountOptions(15),
    } as const satisfies UpstreamParamProfileField;

    expect(
      sanitizeImageGenerationParams([generateCountField], {
        generate_count: 16,
      })
    ).toEqual({ generate_count: 1 });
    expect(
      sanitizeImageGenerationParams([generateCountField], {
        generate_count: 12,
      })
    ).toEqual({ generate_count: 12 });
  });

  it("accepts finite numbers for numeric fields without enum options", () => {
    const numericField = {
      name: "voice_setting.speed",
      apiName: "voice_setting.speed",
      type: "number",
      description: "Speed",
      default: 1,
    } as const satisfies UpstreamParamProfileField;

    expect(
      sanitizeImageGenerationParams([numericField], {
        "voice_setting.speed": 1.5,
      })
    ).toEqual({ "voice_setting.speed": 1.5 });
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
      countPolicy: {
        enabled: false,
        effectMode: "sequential_image_generation",
      },
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
    expect(body.sequential_image_generation_options).toBeUndefined();
    expect(body.max_images).toBe(2);
    expect(body.n).toBeUndefined();
  });

  it("direct mode sends count even when generate_count is 1", () => {
    const generationFields = imageGenerationFieldsWithCount().map((field) =>
      field.name === "generate_count" ? { ...field, apiName: "n" } : field
    );
    const body = buildVolcanoImageGenerationBody({
      providerModelId: "gpt-image-2",
      prompt: "a cat",
      generationFields,
      params: mergeImageGenerationParams(generationFields, {
        generate_count: 1,
      }),
      countPolicy: { enabled: true, effectMode: "direct" },
    });
    expect(body.n).toBe(1);
    expect(body.sequential_image_generation).toBe("disabled");
    expect(body.sequential_image_generation_options).toBeUndefined();
  });

  it("sequential mode does not send direct count field", () => {
    const generationFields = imageGenerationFieldsWithCount();
    const body = buildVolcanoImageGenerationBody({
      providerModelId: "seedream",
      prompt: "a cat",
      generationFields,
      params: mergeImageGenerationParams(generationFields, {
        generate_count: 3,
      }),
      countPolicy: {
        enabled: true,
        effectMode: "sequential_image_generation",
      },
    });
    expect(body.sequential_image_generation).toBe("auto");
    expect(body.sequential_image_generation_options).toEqual({
      max_images: 3,
    });
    expect(body.n).toBeUndefined();
    expect(body.max_images).toBeUndefined();
  });

  it("sequential mode disables group generation when generate_count is 1", () => {
    const generationFields = imageGenerationFieldsWithCount();
    const body = buildVolcanoImageGenerationBody({
      providerModelId: "seedream",
      prompt: "a cat",
      generationFields,
      params: mergeImageGenerationParams(generationFields, {
        generate_count: 1,
      }),
      countPolicy: {
        enabled: true,
        effectMode: "sequential_image_generation",
      },
    });
    expect(body.sequential_image_generation).toBe("disabled");
    expect(body.sequential_image_generation_options).toBeUndefined();
    expect(body.n).toBeUndefined();
    expect(body.max_images).toBeUndefined();
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

describe("buildDurationOptions", () => {
  it("builds an inclusive second range", () => {
    expect(buildDurationOptions(4, 6)).toEqual(["4", "5", "6"]);
  });
});

describe("VIDEO_GENERATION_FIELD_CATALOG", () => {
  it("lists adaptive ratio first", () => {
    expect(VIDEO_RATIO_OPTIONS[0]).toBe("adaptive");
  });

  it("includes optional fields beyond defaults", () => {
    const catalogNames = new Set(
      VIDEO_GENERATION_FIELD_CATALOG.map((field) => field.name)
    );
    expect(catalogNames.has("reference_mode")).toBe(true);
    expect(catalogNames.has("web_search")).toBe(true);
    expect(catalogNames.has("virtual_avatar_library")).toBe(true);
    expect(catalogNames.has("camera_fixed")).toBe(false);
    expect(catalogNames.has("generate_count")).toBe(false);
    const duration = VIDEO_GENERATION_FIELD_CATALOG.find(
      (field) => field.name === "duration"
    );
    expect(duration?.apiName).toBe("duration");
  });

  it("includes full Seedance default field set", () => {
    const defaultNames = new Set(
      DEFAULT_VIDEO_GENERATION_FIELDS.map((field) => field.name)
    );
    expect(defaultNames.has("reference_mode")).toBe(true);
    expect(defaultNames.has("web_search")).toBe(true);
    expect(defaultNames.has("virtual_avatar_library")).toBe(true);
    expect(defaultNames.has("return_last_frame")).toBe(true);
    expect(defaultNames.has("seed")).toBe(true);
    expect(defaultNames.has("ratio")).toBe(true);
    expect(defaultNames.has("duration")).toBe(true);
    expect(defaultNames.has("resolution")).toBe(true);
  });
});

describe("appendVideoReferenceImagesToContent", () => {
  it("uses reference_image for a single image in first_last_frame mode", () => {
    const content: Record<string, unknown>[] = [];
    appendVideoReferenceImagesToContent(
      content,
      ["https://example.com/a.jpg"],
      "first_last_frame",
      false
    );
    expect(content[0]).toMatchObject({ role: "reference_image" });
  });

  it("maps two images to first and last frame", () => {
    const content: Record<string, unknown>[] = [];
    appendVideoReferenceImagesToContent(
      content,
      ["https://example.com/a.jpg", "https://example.com/b.jpg"],
      "first_last_frame",
      false
    );
    expect(content.map((entry) => entry.role)).toEqual([
      "first_frame",
      "last_frame",
    ]);
  });
});

describe("resolveVideoReferenceMode", () => {
  it("defaults to reference_image from default fields", () => {
    expect(resolveVideoReferenceMode(DEFAULT_VIDEO_GENERATION_FIELDS)).toBe(
      "reference_image"
    );
  });
});

describe("buildVolcanoVideoGenerationBody", () => {
  it("maps enabled fields and uses reference_image by default", () => {
    const body = buildVolcanoVideoGenerationBody({
      providerModelId: "doubao-seedance-2-0-260128",
      prompt: "a cat running",
      generationFields: DEFAULT_VIDEO_GENERATION_FIELDS,
      params: {
        ratio: "16:9",
        duration: 8,
        resolution: "4k",
        generate_audio: true,
        watermark: false,
        web_search: true,
      },
      referenceImageUrls: ["https://example.com/a.jpg"],
    });
    expect(body.tools).toEqual([{ type: "web_search" }]);
    expect(body.content).toEqual([
      { type: "text", text: "a cat running" },
      {
        type: "image_url",
        image_url: { url: "https://example.com/a.jpg" },
        role: "reference_image",
      },
    ]);
  });

  it("assigns first and last frame roles when mode is enabled with two images", () => {
    const body = buildVolcanoVideoGenerationBody({
      providerModelId: "doubao-seedance-2-0-260128",
      prompt: "motion",
      generationFields: DEFAULT_VIDEO_GENERATION_FIELDS,
      params: { reference_mode: "first_last_frame" },
      referenceImageUrls: [
        "https://example.com/a.jpg",
        "https://example.com/b.jpg",
      ],
    });
    expect(
      body.content?.slice(1).map((entry) => (entry as { role?: string }).role)
    ).toEqual(["first_frame", "last_frame"]);
  });

  it("maps reference audio urls into content", () => {
    const body = buildVolcanoVideoGenerationBody({
      providerModelId: "doubao-seedance-2-0-260128",
      prompt: "sync motion",
      generationFields: DEFAULT_VIDEO_GENERATION_FIELDS,
      params: {},
      referenceImageUrls: ["https://example.com/a.jpg"],
      referenceAudioUrls: ["https://example.com/voice.mp3"],
    });
    expect(body.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "audio_url",
          role: "reference_audio",
        }),
      ])
    );
  });

  it("keeps adaptive ratio in the built body for forwarding source mapping", () => {
    const body = buildVolcanoVideoGenerationBody({
      providerModelId: "doubao-seedance-2-0-260128",
      prompt: "motion",
      generationFields: DEFAULT_VIDEO_GENERATION_FIELDS,
      params: { ratio: "adaptive", resolution: "720p", duration: 5 },
    });
    expect(body.ratio).toBe("adaptive");
    expect(omitAdaptiveVideoRatioFromRequestBody(body)).toEqual(
      expect.not.objectContaining({ ratio: expect.anything() })
    );
    expect(omitAdaptiveVideoRatioFromRequestBody(body)).toMatchObject({
      resolution: "720p",
      duration: 5,
    });
  });

  it("passes fixed ratios through omit helper unchanged", () => {
    const body = buildVolcanoVideoGenerationBody({
      providerModelId: "doubao-seedance-2-0-260128",
      prompt: "motion",
      generationFields: DEFAULT_VIDEO_GENERATION_FIELDS,
      params: { ratio: "16:9", resolution: "720p", duration: 5 },
    });
    expect(omitAdaptiveVideoRatioFromRequestBody(body).ratio).toBe("16:9");
  });
});

describe("mapVideoGenerationFieldsToBody", () => {
  const fields: readonly UpstreamParamProfileField[] = [
    {
      name: "ratio",
      apiName: "ratio",
      type: "string",
      default: "16:9",
      enumValues: ["16:9", "9:16"],
    },
    {
      name: "duration",
      apiName: "duration",
      type: "number",
      default: 5,
      enumValues: ["5"],
    },
    {
      name: "resolution",
      apiName: "resolution",
      type: "string",
      default: "768p",
      enumValues: ["768p", "2k"],
    },
    {
      name: "watermark",
      apiName: "aigc_watermark",
      type: "boolean",
      default: false,
    },
  ];

  it("uses admin apiName for outbound keys", () => {
    const body = mapVideoGenerationFieldsToBody({
      generationFields: fields,
      params: { ratio: "16:9", duration: 5, resolution: "768p" },
      omitAdaptiveRatio: true,
    });
    expect(body).toEqual({
      ratio: "16:9",
      duration: 5,
      resolution: "768p",
      aigc_watermark: false,
    });
  });

  it("respects customized ratio apiName", () => {
    const customFields = fields.map((field) =>
      field.name === "ratio" ? { ...field, apiName: "aspect_ratio" } : field
    );
    const body = mapVideoGenerationFieldsToBody({
      generationFields: customFields,
      params: { ratio: "9:16" },
      omitAdaptiveRatio: true,
    });
    expect(body.aspect_ratio).toBe("9:16");
    expect(body.ratio).toBeUndefined();
  });

  it("omits adaptive ratio when configured", () => {
    const body = mapVideoGenerationFieldsToBody({
      generationFields: fields,
      params: { ratio: "adaptive", resolution: "768p" },
      omitAdaptiveRatio: true,
    });
    expect(body.ratio).toBeUndefined();
    expect(body.resolution).toBe("768p");
  });

  it("mutates the provided target in place", () => {
    const body: Record<string, unknown> = { model: "MiniMax-H3" };
    mapVideoGenerationFieldsToBody({
      generationFields: fields,
      params: { ratio: "16:9", duration: 5, resolution: "768p" },
      target: body,
      omitAdaptiveRatio: true,
    });
    expect(body).toMatchObject({
      model: "MiniMax-H3",
      ratio: "16:9",
      duration: 5,
      resolution: "768p",
      aigc_watermark: false,
    });
  });

  it("does not send hidden fields unless explicitly provided", () => {
    const body = mapVideoGenerationFieldsToBody({
      generationFields: [
        ...fields,
        {
          name: "seed",
          apiName: "seed",
          type: "number",
          default: -1,
          hidden: true,
        },
      ],
      params: { ratio: "16:9" },
      omitAdaptiveRatio: true,
    });
    expect(body.seed).toBeUndefined();
  });

  it("maps web_search to top-level tools", () => {
    const body = mapVideoGenerationFieldsToBody({
      generationFields: [
        ...fields,
        {
          name: "web_search",
          apiName: "web_search",
          type: "boolean",
          default: false,
        },
      ],
      params: { web_search: true, ratio: "16:9" },
      targetRoot: "parameters",
      target: { sampleCount: 1 },
      omitAdaptiveRatio: true,
    });
    expect(body.tools).toEqual([{ type: "web_search" }]);
    expect(body.parameters).toMatchObject({
      sampleCount: 1,
      ratio: "16:9",
    });
  });
});

describe("validateSubmitAiVideoReferences", () => {
  it("rejects audio-only references", () => {
    const result = validateSubmitAiVideoReferences({
      prompt: "hello",
      counts: { imageCount: 0, videoCount: 0, audioCount: 1 },
      rules: DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
    });
    expect(result.ok).toBe(false);
  });

  it("accepts audio with image references", () => {
    const result = validateSubmitAiVideoReferences({
      prompt: "hello",
      counts: { imageCount: 1, videoCount: 0, audioCount: 1 },
      rules: DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
    });
    expect(result.ok).toBe(true);
  });
});

describe("normalizeVideoModelParameterRules", () => {
  it("fills audio reference and generation field defaults", () => {
    const normalized = normalizeVideoModelParameterRules({
      schemaVersion: 1,
      maxReferenceImages: 1,
      maxImageReferenceBytes: 1,
      maxReferenceVideos: 1,
      maxVideoReferenceBytes: 1,
      maxVideoReferenceSeconds: 1,
      promptMaxChars: 100,
      generationFields: [],
    });
    expect(normalized.maxReferenceAudios).toBe(3);
    expect(normalized.maxAudioReferenceBytes).toBe(15 * 1024 * 1024);
    expect(normalized.maxAudioReferenceSeconds).toBe(15);
    expect(
      normalized.generationFields.some(
        (field) => field.name === "reference_mode"
      )
    ).toBe(true);
    expect(
      normalized.generationFields.some((field) => field.name === "web_search")
    ).toBe(true);
  });
});
