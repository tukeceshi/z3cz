import { describe, expect, it } from "vitest";

import {
  capabilitiesGrantedOnExecute,
  isMakeTool,
  isPlanConfirmPending,
  SIMPLE_ANIMATION_CAPABILITY,
} from "./agent-session-mode";

describe("isPlanConfirmPending", () => {
  it("is pending only in plan after a talk and while idle", () => {
    expect(
      isPlanConfirmPending({
        sessionMode: "plan",
        planPending: true,
        streaming: false,
      })
    ).toBe(true);
    expect(
      isPlanConfirmPending({
        sessionMode: "agent",
        planPending: true,
        streaming: false,
      })
    ).toBe(false);
    expect(
      isPlanConfirmPending({
        sessionMode: "plan",
        planPending: true,
        streaming: true,
      })
    ).toBe(false);
    expect(
      isPlanConfirmPending({
        sessionMode: "plan",
        planPending: false,
        streaming: false,
      })
    ).toBe(false);
  });
});

describe("make tools", () => {
  it("treats writes as make tools", () => {
    expect(isMakeTool("remotion_write")).toBe(true);
    expect(isMakeTool("canvas_write_text")).toBe(true);
    expect(isMakeTool("canvas_get_state")).toBe(false);
    expect(capabilitiesGrantedOnExecute()).toContain(SIMPLE_ANIMATION_CAPABILITY);
  });
});
