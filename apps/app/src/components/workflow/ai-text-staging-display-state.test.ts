import { describe, expect, it } from "vitest";

import {
  AI_TEXT_STAGING_STATE_META_KEY,
  readAiTextStagingDisplayState,
  withAiTextStagingDisplayState,
} from "./ai-text-staging-display-state";

describe("ai-text-staging-display-state", () => {
  it("writes and reads display state", () => {
    const next = withAiTextStagingDisplayState(undefined, "loading");
    expect(next?.[AI_TEXT_STAGING_STATE_META_KEY]).toBe("loading");
    expect(readAiTextStagingDisplayState(next)).toBe("loading");
  });

  it("returns the same metadata object when unchanged", () => {
    const metadata = withAiTextStagingDisplayState(undefined, "ready");
    expect(withAiTextStagingDisplayState(metadata, "ready")).toBe(metadata);
  });
});
