import { describe, expect, it } from "vitest";

import { SIMPLE_ANIMATION_TOOL } from "./agent-capabilities";
import {
  capabilityForTool,
  clearedPlanFields,
  hasCapability,
  isMakeTool,
  isPlanConfirmPending,
  modeOnOpenConversation,
  SIMPLE_ANIMATION_CAPABILITY,
  stateAfterRun,
  withoutWriteConsent,
} from "./agent-session-mode";

describe("parked draft fields", () => {
  it("still records draft after a talk, but request tests must not send it", () => {
    expect(stateAfterRun({ runMode: "draft", talk: "先改片头" }).planDocument).toBe(
      "先改片头"
    );
  });
});

describe("isPlanConfirmPending", () => {
  it("is pending only in draft after a talk and while idle", () => {
    expect(
      isPlanConfirmPending({
        sessionMode: "draft",
        planPending: true,
        streaming: false,
      })
    ).toBe(true);
    expect(
      isPlanConfirmPending({
        sessionMode: "real",
        planPending: true,
        streaming: false,
      })
    ).toBe(false);
    expect(
      isPlanConfirmPending({
        sessionMode: "draft",
        planPending: true,
        streaming: true,
      })
    ).toBe(false);
    expect(
      isPlanConfirmPending({
        sessionMode: "draft",
        planPending: false,
        streaming: false,
      })
    ).toBe(false);
  });
});

describe("make tools", () => {
  it("treats writes as make tools", () => {
    expect(isMakeTool(SIMPLE_ANIMATION_TOOL)).toBe(false);
    expect(isMakeTool("canvas_write_text")).toBe(true);
    expect(isMakeTool("canvas_get_state")).toBe(false);
    expect(isMakeTool("remotion_close")).toBe(false);
  });

  it("maps the unified animation tool to simple animation", () => {
    expect(capabilityForTool(SIMPLE_ANIMATION_TOOL)).toBe(
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

  it("drops write approval and keeps other consents", () => {
    expect(
      withoutWriteConsent([
        "simple-animation",
        "canvas-make",
        "other",
      ])
    ).toEqual(["other"]);
    expect(withoutWriteConsent(undefined)).toEqual([]);
  });
});

describe("modeOnOpenConversation", () => {
  it("resumes the saved phase, defaulting to ask", () => {
    expect(
      modeOnOpenConversation({
        sessionMode: "real",
        activeInvocationId: "inv-1",
      })
    ).toBe("real");
    expect(
      modeOnOpenConversation({
        sessionMode: "real",
      })
    ).toBe("real");
    expect(
      modeOnOpenConversation({
        sessionMode: "draft",
        activeInvocationId: "inv-1",
      })
    ).toBe("draft");
    expect(
      modeOnOpenConversation({
        sessionMode: "view",
      })
    ).toBe("ask");
    expect(
      modeOnOpenConversation({
        sessionMode: "ask",
      })
    ).toBe("ask");
    expect(modeOnOpenConversation({})).toBe("ask");
  });
});

describe("stateAfterRun", () => {
  it("keeps a draft waiting after a talk", () => {
    expect(stateAfterRun({ runMode: "draft", talk: "先改片头" })).toEqual({
      sessionMode: "draft",
      planPending: true,
      planDocument: "先改片头",
    });
    expect(stateAfterRun({ runMode: "draft", talk: "" })).toEqual({
      sessionMode: "draft",
      planPending: false,
      planDocument: undefined,
    });
    expect(stateAfterRun({ runMode: "draft", talk: "   " })).toEqual({
      sessionMode: "draft",
      planPending: false,
      planDocument: undefined,
    });
  });

  it("stays in real after a successful run", () => {
    expect(stateAfterRun({ runMode: "real", talk: "已经改好" })).toEqual({
      sessionMode: "real",
      planPending: false,
      planDocument: undefined,
    });
  });

  it("keeps the draft after a failed or stopped real run", () => {
    expect(
      stateAfterRun({
        runMode: "real",
        talk: "",
        preservePlan: true,
        previousPlanDocument: "先改片头",
      })
    ).toEqual({
      sessionMode: "draft",
      planPending: true,
      planDocument: "先改片头",
    });
  });

  it("clears a waiting draft when the user revises", () => {
    expect(clearedPlanFields()).toEqual({
      sessionMode: "ask",
      planPending: false,
      planDocument: undefined,
    });
  });
});
