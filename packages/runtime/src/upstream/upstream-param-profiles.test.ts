import { describe, expect, it } from "vitest";

import {
  buildRelayRequestBody,
  SEEDANCE_2_0_T2V_PROFILE,
} from "./upstream-param-profiles";
import { parseNewApiRelaySubmitResponse } from "./newapi-relay-upstream";

describe("upstream param profiles", () => {
  it("builds Seedance official request bodies", () => {
    const body = buildRelayRequestBody(SEEDANCE_2_0_T2V_PROFILE, {
      prompt: "A drone shot over the ocean at sunset",
      resolution: "720p",
      duration: "8",
      aspect_ratio: "16:9",
      generate_audio: true,
    });

    expect(body).toEqual({
      model: "seedance-2.0",
      prompt: "A drone shot over the ocean at sunset",
      resolution: "720p",
      duration: "8",
      aspect_ratio: "16:9",
      generate_audio: true,
      bitrate_mode: "standard",
    });
  });

  it("requires prompt for Seedance profile", () => {
    const body = buildRelayRequestBody(SEEDANCE_2_0_T2V_PROFILE, {
      resolution: "720p",
    });

    expect(body).toEqual({ error: "prompt is required" });
  });
});

describe("newapi relay submit parsing", () => {
  it("parses task id and poll url from nested data", () => {
    const parsed = parseNewApiRelaySubmitResponse(
      {
        data: {
          task_id: "task-123",
          poll_url: "https://relay.example/v1/videos/generations/task-123",
        },
      },
      "https://relay.example/v1/videos/generations"
    );

    expect(parsed).toEqual({
      taskId: "task-123",
      pollUrl: "https://relay.example/v1/videos/generations/task-123",
    });
  });
});
