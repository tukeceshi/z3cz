import { describe, expect, it } from "vitest";

import {
  AGENT_REMOTION_SKILL,
  shouldAttachAnimationSkill,
  wrapAgentRemotionSkill,
} from "./agent-remotion-skill";

describe("shouldAttachAnimationSkill", () => {
  it("attaches only when the animation window is open or already allowed", () => {
    expect(shouldAttachAnimationSkill()).toBe(false);
    expect(shouldAttachAnimationSkill({ remotionViewportOpen: false })).toBe(
      false
    );
    expect(shouldAttachAnimationSkill({ consentedCapabilities: [] })).toBe(
      false
    );
    expect(shouldAttachAnimationSkill({ remotionViewportOpen: true })).toBe(
      true
    );
    expect(
      shouldAttachAnimationSkill({
        consentedCapabilities: ["simple-animation"],
      })
    ).toBe(true);
  });
});

describe("wrapAgentRemotionSkill", () => {
  it("wraps the remotion skill for the request", () => {
    expect(wrapAgentRemotionSkill()).toBe(
      `<canvas_skill>\n${AGENT_REMOTION_SKILL}\n</canvas_skill>`
    );
    expect(wrapAgentRemotionSkill()).toContain("https://www.remotion.dev/docs");
    expect(wrapAgentRemotionSkill()).toContain("先判断是改还是重做");
    expect(wrapAgentRemotionSkill()).toContain("先 clear 清空");
    expect(wrapAgentRemotionSkill()).toContain("不要用 close 来重做");
  });
});
