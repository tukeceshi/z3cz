import { describe, expect, it } from "vitest";

import {
  isAiVideoEnhancePanel,
  isAiVideoRetakePanel,
  parseAiVideoPanelKind,
  withAiVideoPanelKind,
} from "./ai-video-panel";

describe("ai-video-panel", () => {
  it("defaults to generate when metadata is missing", () => {
    expect(parseAiVideoPanelKind(undefined)).toBe("generate");
    expect(isAiVideoEnhancePanel(undefined)).toBe(false);
  });

  it("reads enhance kind from metadata json", () => {
    const metadata = withAiVideoPanelKind(undefined, "enhance");
    expect(parseAiVideoPanelKind(metadata)).toBe("enhance");
    expect(isAiVideoEnhancePanel(metadata)).toBe(true);
  });

  it("reads retake kind from metadata json", () => {
    const metadata = withAiVideoPanelKind(undefined, "retake");
    expect(parseAiVideoPanelKind(metadata)).toBe("retake");
    expect(isAiVideoRetakePanel(metadata)).toBe(true);
  });
});
