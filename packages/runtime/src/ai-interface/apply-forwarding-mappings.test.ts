import { describe, expect, it } from "vitest";

import { applyForwardingMappings } from "./apply-forwarding-mappings";

describe("applyForwardingMappings", () => {
  const upstreamParams = [
    { id: "p1", name: "prompt", valueType: "string" as const },
    { id: "p2", name: "seconds", valueType: "string" as const },
    { id: "p3", name: "images", valueType: "object[]" as const },
    { id: "p4", name: "first_frame", valueType: "string" as const },
    { id: "p5", name: "size", valueType: "string" as const },
  ];

  const paramMappings = [
    {
      upstreamParamId: "p1",
      sourcePath: "$.content[?(@.type=='text')].text",
    },
    { upstreamParamId: "p2", sourcePath: "$.duration" },
    {
      upstreamParamId: "p3",
      sourcePath: "$.content[?(@.role=='reference_image')].image_url.url",
      collectMode: "all" as const,
    },
    {
      upstreamParamId: "p4",
      sourcePath: "$.content[?(@.role=='first_frame')].image_url.url",
    },
    {
      upstreamParamId: "p5",
      transform: "ratio_resolution_to_size" as const,
    },
  ];

  it("maps standard video body to upstream params", () => {
    const sourceBody = {
      model: "doubao-seedance-2",
      content: [
        { type: "text", text: "一剑开天门" },
        {
          type: "image_url",
          image_url: { url: "https://example.com/ref.png" },
          role: "reference_image",
        },
      ],
      duration: 10,
      ratio: "16:9",
      resolution: "720p",
    };

    expect(
      applyForwardingMappings({
        sourceBody,
        upstreamParams,
        paramMappings,
      })
    ).toEqual({
      prompt: "一剑开天门",
      seconds: "10",
      images: [{ url: "https://example.com/ref.png" }],
      size: "1280x720",
    });
  });

  it("omits empty optional fields", () => {
    expect(
      applyForwardingMappings({
        sourceBody: {
          content: [{ type: "text", text: "hello" }],
          duration: 5,
          ratio: "1:1",
          resolution: "720p",
        },
        upstreamParams,
        paramMappings,
      })
    ).toEqual({
      prompt: "hello",
      seconds: "5",
      size: "960x960",
    });
  });
});
