import { describe, expect, it } from "vitest";

import {
  capabilityForTool,
  capabilityLabel,
  describeCapabilityBoundary,
  enabledMakeCapabilityLabels,
  isMakeTool,
  isToolAllowed,
  SIMPLE_ANIMATION_CAPABILITY,
  toolsForInform,
} from "./agent-capabilities";

describe("agent capabilities catalog", () => {
  it("treats writes as make tools from the catalog", () => {
    expect(isMakeTool("remotion_write")).toBe(true);
    expect(isMakeTool("canvas_write_text")).toBe(true);
    expect(isMakeTool("canvas_get_state")).toBe(false);
    expect(isMakeTool("remotion_close")).toBe(false);
  });

  it("maps remotion tools to the simple animation capability", () => {
    expect(capabilityForTool("remotion_open")).toBe(
      SIMPLE_ANIMATION_CAPABILITY
    );
    expect(capabilityForTool("canvas_get_state")).toBe("canvas");
  });

  it("blocks canvas tools in ask and still allows questions", () => {
    expect(isToolAllowed("canvas_get_state", "ask")).toBe(false);
    expect(isToolAllowed("remotion_get", "ask")).toBe(false);
    expect(isToolAllowed("ask_question", "ask")).toBe(true);
    expect(isToolAllowed("switch_mode", "ask")).toBe(true);
    expect(isToolAllowed("ask_question", "plan")).toBe(true);
  });

  it("allows plan mode only enabled read tools", () => {
    expect(isToolAllowed("canvas_get_state", "plan")).toBe(true);
    expect(isToolAllowed("remotion_get", "plan")).toBe(true);
    expect(isToolAllowed("remotion_write", "plan")).toBe(false);
    expect(isToolAllowed("remotion_open", "plan")).toBe(false);
    expect(isToolAllowed("canvas_write_text", "plan")).toBe(false);
  });

  it("blocks disabled make tools even while executing", () => {
    expect(isToolAllowed("remotion_write", "agent")).toBe(true);
    expect(isToolAllowed("canvas_write_text", "agent")).toBe(false);
  });

  it("lists inform tools without disabled make names", () => {
    const planNames = toolsForInform("plan").map((tool) => tool.name);
    expect(planNames).toContain("canvas_get_state");
    expect(planNames).not.toContain("remotion_write");
    expect(planNames).not.toContain("canvas_write_text");
    const agentNames = toolsForInform("agent").map((tool) => tool.name);
    expect(agentNames).toContain("remotion_write");
    expect(agentNames).not.toContain("canvas_write_text");
  });

  it("puts make labels only in the catalog, then into the boundary view", () => {
    expect(enabledMakeCapabilityLabels()).toEqual([
      capabilityLabel(SIMPLE_ANIMATION_CAPABILITY),
    ]);
    const plan = describeCapabilityBoundary("plan");
    expect(plan).toContain(capabilityLabel(SIMPLE_ANIMATION_CAPABILITY));
    expect(plan).toContain("全局");
    const ask = describeCapabilityBoundary("ask");
    expect(ask).toContain("不能读写画布");
  });
});
