import { describe, expect, it } from "vitest";

import {
  capabilityForTool,
  hasCapability,
  isMakeTool,
  isPlanConfirmPending,
  modeOnOpenConversation,
  SIMPLE_ANIMATION_CAPABILITY,
  stateAfterRun,
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
    expect(isMakeTool("remotion_close")).toBe(false);
  });

  it("maps remotion tools to simple animation", () => {
    expect(capabilityForTool("remotion_open")).toBe(
      SIMPLE_ANIMATION_CAPABILITY
    );
    expect(capabilityForTool("remotion_close")).toBe(
      SIMPLE_ANIMATION_CAPABILITY
    );
    expect(capabilityForTool("remotion_write")).toBe(
      SIMPLE_ANIMATION_CAPABILITY
    );
    expect(capabilityForTool("canvas_get_state")).toBeNull();
  });

  it("reads simple animation from consented list", () => {
    expect(
      hasCapability(["simple-animation"], SIMPLE_ANIMATION_CAPABILITY)
    ).toBe(true);
    expect(hasCapability([], SIMPLE_ANIMATION_CAPABILITY)).toBe(false);
    expect(hasCapability(undefined, SIMPLE_ANIMATION_CAPABILITY)).toBe(false);
  });
});

describe("modeOnOpenConversation", () => {
  it("stays in agent only when an execute run is still open", () => {
    expect(
      modeOnOpenConversation({
        sessionMode: "agent",
        activeInvocationId: "inv-1",
      })
    ).toBe("agent");
    expect(
      modeOnOpenConversation({
        sessionMode: "agent",
      })
    ).toBe("plan");
    expect(
      modeOnOpenConversation({
        sessionMode: "plan",
        activeInvocationId: "inv-1",
      })
    ).toBe("plan");
    expect(modeOnOpenConversation({})).toBe("plan");
  });
});

describe("stateAfterRun", () => {
  it("keeps a plan waiting after an ask talk", () => {
    expect(stateAfterRun({ runMode: "plan", talk: "先改片头" })).toEqual({
      sessionMode: "plan",
      planPending: true,
      planDocument: "先改片头",
    });
    expect(stateAfterRun({ runMode: "plan", talk: "" })).toEqual({
      sessionMode: "plan",
      planPending: false,
      planDocument: undefined,
    });
  });

  it("returns to ask after execute and drops the plan", () => {
    expect(stateAfterRun({ runMode: "agent", talk: "已经改好" })).toEqual({
      sessionMode: "plan",
      planPending: false,
      planDocument: undefined,
    });
  });
});
