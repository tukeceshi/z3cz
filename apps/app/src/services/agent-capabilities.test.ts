import { describe, expect, it } from "vitest";

import {
  activeAgentRoles,
  AGENT_ANIMATION_IDENTITY,
  AGENT_BASE_IDENTITY,
  AGENT_CANVAS_IDENTITY,
  AGENT_ROLE_ANIMATION,
  AGENT_ROLE_BASE,
  AGENT_ROLE_CANVAS,
  ASK_QUESTION_TOOL,
  ENTER_DRAFT_TOOL,
  parseScheduledRole,
  SCHEDULE_ROLE_TOOL,
  capabilityForTool,
  capabilityLabel,
  enabledMakeCapabilityLabels,
  isMakeTool,
  isToolAllowed,
  SIMPLE_ANIMATION_CAPABILITY,
  SIMPLE_ANIMATION_TOOL,
  toolsForInform,
  toolsForRequest,
} from "./agent-capabilities";

describe("agent capabilities catalog", () => {
  it("treats canvas writes as make tools and animation as its own tool", () => {
    expect(isMakeTool("canvas_write_text")).toBe(true);
    expect(isMakeTool("canvas_get_state")).toBe(false);
    expect(isMakeTool(SIMPLE_ANIMATION_TOOL)).toBe(false);
    expect(isMakeTool("remotion_write")).toBe(false);
  });

  it("maps the unified animation tool to the simple animation capability", () => {
    expect(capabilityForTool(SIMPLE_ANIMATION_TOOL)).toBe(
      SIMPLE_ANIMATION_CAPABILITY
    );
    expect(capabilityForTool("canvas_get_state")).toBe("canvas");
    expect(capabilityForTool("remotion_open")).toBeNull();
  });

  it("allows animation in every mode, and ask to read and question", () => {
    expect(isToolAllowed("canvas_get_state", "ask")).toBe(true);
    expect(isToolAllowed(SIMPLE_ANIMATION_TOOL, "ask")).toBe(true);
    expect(isToolAllowed(SIMPLE_ANIMATION_TOOL, "draft")).toBe(true);
    expect(isToolAllowed(SIMPLE_ANIMATION_TOOL, "real")).toBe(true);
    expect(isToolAllowed("ask_question", "ask")).toBe(true);
    expect(isToolAllowed(ENTER_DRAFT_TOOL, "ask")).toBe(false);
    expect(isToolAllowed("remotion_write", "ask")).toBe(false);
    expect(isToolAllowed("switch_mode", "ask")).toBe(false);
    expect(isToolAllowed("ask_question", "draft")).toBe(true);
  });

  it("does not treat animation as a draft-only make tool", () => {
    expect(isToolAllowed("canvas_get_state", "draft")).toBe(true);
    expect(isToolAllowed("canvas_write_text", "draft")).toBe(true);
    expect(isToolAllowed(ENTER_DRAFT_TOOL, "draft")).toBe(false);
  });

  it("blocks unused enter_draft even in real", () => {
    expect(isToolAllowed("canvas_write_text", "real")).toBe(true);
    expect(isToolAllowed(ENTER_DRAFT_TOOL, "real")).toBe(false);
  });

  it("lists only schedule and ask until a role is on", () => {
    const askNames = toolsForInform("ask").map((tool) => tool.name);
    expect(askNames).toEqual([SCHEDULE_ROLE_TOOL, ASK_QUESTION_TOOL]);
    expect(askNames).not.toContain("canvas_get_state");
    expect(askNames).not.toContain(SIMPLE_ANIMATION_TOOL);
    const canvasNames = toolsForInform("ask", { canvas: true }).map(
      (tool) => tool.name
    );
    expect(canvasNames).toContain("canvas_get_state");
    expect(canvasNames).toContain("canvas_write_text");
    expect(canvasNames).toContain(SCHEDULE_ROLE_TOOL);
    expect(canvasNames).not.toContain(SIMPLE_ANIMATION_TOOL);
    expect(canvasNames).not.toContain(ENTER_DRAFT_TOOL);
    expect(
      toolsForInform("ask", { animation: true }).map((tool) => tool.name)
    ).toContain(SIMPLE_ANIMATION_TOOL);
    expect(
      toolsForInform("ask", { animation: true }).map((tool) => tool.name)
    ).not.toContain("canvas_get_state");
  });

  it("exposes OpenAI toolsForRequest without homemade protocol fields", () => {
    const ask = toolsForRequest("ask");
    const withCanvas = toolsForRequest("ask", { canvas: true });
    const withAnimation = toolsForRequest("ask", { animation: true });
    expect(ask.every((tool) => tool.type === "function")).toBe(true);
    expect(ask.map((tool) => tool.function.name)).toEqual([
      SCHEDULE_ROLE_TOOL,
      ASK_QUESTION_TOOL,
    ]);
    expect(withCanvas.map((tool) => tool.function.name)).toEqual([
      "canvas_get_state",
      "canvas_resolve_resource",
      "canvas_create_generation_flow",
      "canvas_connect_nodes",
      "canvas_write_text",
      "canvas_run_node",
      "canvas_stage_media",
      SCHEDULE_ROLE_TOOL,
      ASK_QUESTION_TOOL,
    ]);
    expect(ask[0]?.function.parameters.type).toBe("object");
    expect(enabledMakeCapabilityLabels()).toEqual(["画布"]);
    expect(
      withCanvas.find((tool) => tool.function.name === "canvas_get_state")
        ?.function.description
    ).toContain("不要反复取");
    expect(
      withCanvas.find((tool) => tool.function.name === "canvas_get_state")
        ?.function.description
    ).toContain("是不是空的");
    expect(
      withCanvas.find((tool) => tool.function.name === "canvas_resolve_resource")
        ?.function.description
    ).toContain("地址");
    expect(
      ask.find((tool) => tool.function.name === ASK_QUESTION_TOOL)?.function
        .description
    ).toContain("能直接答就别问");
    expect(
      withAnimation.find((tool) => tool.function.name === SIMPLE_ANIMATION_TOOL)
        ?.function.description
    ).not.toContain("草案");
    expect(
      withAnimation.find((tool) => tool.function.name === SIMPLE_ANIMATION_TOOL)
        ?.function.description
    ).not.toContain("点执行");
    expect(
      withAnimation.find((tool) => tool.function.name === SIMPLE_ANIMATION_TOOL)
        ?.function.description
    ).not.toContain("实做");
    expect(
      withCanvas.find(
        (tool) => tool.function.name === "canvas_create_generation_flow"
      )?.function.description
    ).not.toContain("实做");
    expect(
      withAnimation.find((tool) => tool.function.name === SIMPLE_ANIMATION_TOOL)
        ?.function.description
    ).toContain("清空");
    expect(
      withAnimation.find((tool) => tool.function.name === SIMPLE_ANIMATION_TOOL)
        ?.function.description
    ).toContain("关窗");
    expect(
      withAnimation.find((tool) => tool.function.name === SIMPLE_ANIMATION_TOOL)
        ?.function.parameters.properties
    ).toEqual(
      expect.objectContaining({
        action: expect.objectContaining({
          enum: ["get", "write", "open", "close", "clear"],
        }),
      })
    );
    expect(capabilityLabel(SIMPLE_ANIMATION_CAPABILITY)).toBe("简易动画");
    const draft = toolsForRequest("draft");
    expect(
      draft.find((tool) => tool.function.name === SIMPLE_ANIMATION_TOOL)
    ).toBeUndefined();
    expect(
      toolsForRequest("ask", { animation: true }).map(
        (tool) => tool.function.name
      )
    ).toContain(SIMPLE_ANIMATION_TOOL);
  });

  it("turns on only the scheduler until canvas or animation is scheduled", () => {
    expect(activeAgentRoles().map((role) => role.id)).toEqual([AGENT_ROLE_BASE]);
    expect(activeAgentRoles({ canvas: true }).map((role) => role.id)).toEqual([
      AGENT_ROLE_BASE,
      AGENT_ROLE_CANVAS,
    ]);
    expect(activeAgentRoles({ animation: true }).map((role) => role.id)).toEqual(
      [AGENT_ROLE_BASE, AGENT_ROLE_ANIMATION]
    );
    expect(
      activeAgentRoles({ canvas: true, animation: true }).map((role) => role.id)
    ).toEqual([AGENT_ROLE_BASE, AGENT_ROLE_CANVAS, AGENT_ROLE_ANIMATION]);
    expect(activeAgentRoles()[0]?.identity).toBe(AGENT_BASE_IDENTITY);
    expect(activeAgentRoles({ canvas: true })[1]?.identity).toBe(
      AGENT_CANVAS_IDENTITY
    );
    expect(activeAgentRoles({ animation: true })[1]?.identity).toBe(
      AGENT_ANIMATION_IDENTITY
    );
  });

  it("reads schedule role names", () => {
    expect(parseScheduledRole('{"role":"canvas"}')).toBe("canvas");
    expect(parseScheduledRole('{"role":"简易视频"}')).toBe("animation");
    expect(parseScheduledRole("画布")).toBe("canvas");
    expect(parseScheduledRole("其他")).toBeUndefined();
  });
});
