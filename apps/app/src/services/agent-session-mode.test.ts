import { describe, expect, it } from "vitest";

import {
  capabilityForTool,
  clearedPlanFields,
  hasCapability,
  isExecuteConfirmPending,
  isMakeTool,
  isPlanConfirmPending,
  modeOnOpenConversation,
  formatSwitchModeArgs,
  isAllowedModeSwitch,
  parseSwitchModeTarget,
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

describe("isExecuteConfirmPending", () => {
  it("is pending only in agent after a send and while idle", () => {
    expect(
      isExecuteConfirmPending({
        sessionMode: "agent",
        executePending: true,
        streaming: false,
      })
    ).toBe(true);
    expect(
      isExecuteConfirmPending({
        sessionMode: "ask",
        executePending: true,
        streaming: false,
      })
    ).toBe(false);
    expect(
      isExecuteConfirmPending({
        sessionMode: "agent",
        executePending: true,
        streaming: true,
      })
    ).toBe(false);
  });
});

describe("parseSwitchModeTarget", () => {
  it("reads from and to lines", () => {
    expect(parseSwitchModeTarget("from: ask\nto: plan")).toEqual({
      from: "ask",
      to: "plan",
    });
    expect(parseSwitchModeTarget("TO: Agent\nFROM: Plan")).toEqual({
      from: "plan",
      to: "agent",
    });
    expect(parseSwitchModeTarget("plan")).toBeUndefined();
    expect(parseSwitchModeTarget("from: ask\nto: debug")).toBeUndefined();
    expect(parseSwitchModeTarget("from: ask")).toBeUndefined();
  });

  it("allows only the documented pairs", () => {
    expect(isAllowedModeSwitch("ask", "agent")).toBe(true);
    expect(isAllowedModeSwitch("ask", "plan")).toBe(true);
    expect(isAllowedModeSwitch("agent", "plan")).toBe(true);
    expect(isAllowedModeSwitch("agent", "ask")).toBe(true);
    expect(isAllowedModeSwitch("plan", "agent")).toBe(true);
    expect(isAllowedModeSwitch("plan", "ask")).toBe(false);
    expect(isAllowedModeSwitch("ask", "ask")).toBe(false);
    expect(formatSwitchModeArgs({ from: "ask", to: "plan" })).toBe(
      "from: ask\nto: plan"
    );
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
    expect(capabilityForTool("canvas_get_state")).toBe("canvas");
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
  it("resumes the saved mode, defaulting to ask", () => {
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
    ).toBe("agent");
    expect(
      modeOnOpenConversation({
        sessionMode: "plan",
        activeInvocationId: "inv-1",
      })
    ).toBe("plan");
    expect(
      modeOnOpenConversation({
        sessionMode: "ask",
      })
    ).toBe("ask");
    expect(modeOnOpenConversation({})).toBe("ask");
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
    expect(stateAfterRun({ runMode: "plan", talk: "   " })).toEqual({
      sessionMode: "plan",
      planPending: false,
      planDocument: undefined,
    });
  });

  it("stays in agent after a successful execute", () => {
    expect(stateAfterRun({ runMode: "agent", talk: "已经改好" })).toEqual({
      sessionMode: "agent",
      planPending: false,
      planDocument: undefined,
    });
  });

  it("keeps the plan after a failed or stopped execute", () => {
    expect(
      stateAfterRun({
        runMode: "agent",
        talk: "",
        preservePlan: true,
        previousPlanDocument: "先改片头",
      })
    ).toEqual({
      sessionMode: "plan",
      planPending: true,
      planDocument: "先改片头",
    });
  });

  it("clears a waiting plan when the user revises", () => {
    expect(clearedPlanFields()).toEqual({
      sessionMode: "ask",
      planPending: false,
      planDocument: undefined,
    });
  });
});
