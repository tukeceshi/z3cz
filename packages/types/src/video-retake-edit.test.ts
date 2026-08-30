import { describe, expect, it } from "vitest";

import {
  buildVolcanoVideoGenerationBody,
  DEFAULT_VIDEO_GENERATION_FIELDS,
  mergeImageGenerationParams,
  omitAdaptiveVideoRatioFromRequestBody,
} from "./platform-ai-model";
import {
  applyVideoRetakeEditOverrides,
  applyVideoRetakeEditOverridesToRequestBody,
  isVideoRetakeEditRequest,
  VIDEO_RETAKE_EDIT_DURATION,
  VIDEO_RETAKE_EDIT_OVERRIDES,
} from "./video-retake-edit";

describe("video-retake-edit", () => {
  it("overlays edit / adaptive / -1 after ordinary merge", () => {
    const merged = mergeImageGenerationParams(DEFAULT_VIDEO_GENERATION_FIELDS, {
      resolution: "720p",
      duration: VIDEO_RETAKE_EDIT_DURATION,
      ratio: "adaptive",
    });
    expect(merged.duration).not.toBe(VIDEO_RETAKE_EDIT_DURATION);

    const overlaid = applyVideoRetakeEditOverrides(merged);
    expect(overlaid).toMatchObject(VIDEO_RETAKE_EDIT_OVERRIDES);
    expect(overlaid.resolution).toBe("720p");
    expect(isVideoRetakeEditRequest(overlaid)).toBe(true);
  });

  it("restores the three fields after adaptive ratio is omitted", () => {
    const generationParams = applyVideoRetakeEditOverrides({
      resolution: "720p",
      generate_audio: true,
    });
    const body = buildVolcanoVideoGenerationBody({
      providerModelId: "doubao-seedance-2-5",
      prompt: "retake this clip",
      generationFields: DEFAULT_VIDEO_GENERATION_FIELDS,
      params: generationParams,
      referenceVideoUrls: ["https://example.com/retake.mp4"],
    });
    const omitted = omitAdaptiveVideoRatioFromRequestBody(body);
    expect(omitted.ratio).toBeUndefined();
    expect(omitted.duration).not.toBe(VIDEO_RETAKE_EDIT_DURATION);

    const outbound = applyVideoRetakeEditOverridesToRequestBody(
      omitted,
      generationParams
    );
    expect(outbound).toMatchObject(VIDEO_RETAKE_EDIT_OVERRIDES);
    expect(outbound.resolution).toBe("720p");
    expect(isVideoRetakeEditRequest(undefined)).toBe(false);
  });
});
