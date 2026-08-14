import { createDefaultTransformPollMapping } from "@dafthunk/types";
import { describe, expect, it } from "vitest";

import { getValueByDotPath, parsePollResponse } from "./parse-poll-response";

describe("getValueByDotPath", () => {
  it("reads nested paths", () => {
    expect(
      getValueByDotPath({ content: { video_url: "https://example.com/a.mp4" } }, "content.video_url")
    ).toBe("https://example.com/a.mp4");
  });
});

describe("parsePollResponse", () => {
  const pollMapping = createDefaultTransformPollMapping();

  it("parses official succeeded responses", () => {
    expect(
      parsePollResponse(
        {
          status: "succeeded",
          content: { video_url: "https://example.com/a.mp4" },
        },
        pollMapping
      )
    ).toEqual({
      status: "completed",
      videoUrl: "https://example.com/a.mp4",
    });
  });

  it("parses failed responses", () => {
    expect(
      parsePollResponse(
        {
          status: "failed",
          error: { message: "upstream failed" },
        },
        pollMapping
      )
    ).toEqual({
      status: "failed",
      error: "upstream failed",
    });
  });

  it("treats unknown statuses as pending", () => {
    expect(parsePollResponse({ status: "running" }, pollMapping)).toEqual({
      status: "pending",
      upstreamPhase: "running",
    });
  });

  it("supports custom poll mappings", () => {
    expect(
      parsePollResponse(
        {
          state: "completed",
          output: { url: "https://example.com/custom.mp4" },
        },
        {
          statusKey: "state",
          successValues: ["completed"],
          failedValues: ["error"],
          outputKey: "output.url",
        }
      )
    ).toEqual({
      status: "completed",
      videoUrl: "https://example.com/custom.mp4",
    });
  });
});
