import { describe, expect, it } from "vitest";

import {
  CANVAS_GET_STATE_TOOL,
  CANVAS_RESOLVE_RESOURCE_TOOL,
} from "./agent-canvas-state";
import {
  AGENT_CHAT_MAX_MAIN_STEPS,
  AGENT_EXECUTE_STATUS,
  AGENT_MAIN_INSTRUCTION,
  AGENT_PLAN_STATUS,
  buildAgentMainInstruction,
  buildMainSchedulerMessages,
  composeSavedAssistantContent,
  parseAgentSchedulerOutput,
  runAgentScheduler,
  SIDE_MARKER,
  splitSavedAssistantContent,
  TALK_MARKER,
  THINK_MARKER,
} from "./agent-chat-scheduler";

describe("parseAgentSchedulerOutput", () => {
  it("treats unmarked text as talk", () => {
    const parsed = parseAgentSchedulerOutput("直接回答");
    expect(parsed.action).toBe("talk");
    expect(parsed.talk).toBe("直接回答");
    expect(parsed.thinking).toBe("");
  });

  it("splits think and talk markers", () => {
    const parsed = parseAgentSchedulerOutput(
      `${THINK_MARKER}\n先看需求\n${TALK_MARKER}\n可以这样做`
    );
    expect(parsed.action).toBe("talk");
    expect(parsed.thinking).toBe("先看需求");
    expect(parsed.talk).toBe("可以这样做");
  });

  it("prefers side when both side and talk are present", () => {
    const parsed = parseAgentSchedulerOutput(
      `${THINK_MARKER}\n查画布\n${SIDE_MARKER}\n${CANVAS_GET_STATE_TOOL}\n${TALK_MARKER}\n不该执行`
    );
    expect(parsed.action).toBe("side");
    expect(parsed.toolCall).toEqual({
      name: CANVAS_GET_STATE_TOOL,
      resourceId: "",
      nodeId: "",
      payload: "",
    });
    expect(parsed.talk).toBe("");
  });

  it("reads resolve resourceId from the side body", () => {
    const parsed = parseAgentSchedulerOutput(
      `${THINK_MARKER}\n要地址\n${SIDE_MARKER}\n${CANVAS_RESOLVE_RESOURCE_TOOL}\nresourceId: res-9`
    );
    expect(parsed.action).toBe("side");
    expect(parsed.toolCall).toEqual({
      name: CANVAS_RESOLVE_RESOURCE_TOOL,
      resourceId: "res-9",
      nodeId: "",
      payload: "resourceId: res-9",
    });
  });

  it("keeps remotion source as the side payload", () => {
    const source = "function Composition() {\n  return <AbsoluteFill />;\n}";
    const parsed = parseAgentSchedulerOutput(
      `${THINK_MARKER}\n改片头\n${SIDE_MARKER}\nremotion_write\n${source}`
    );
    expect(parsed.action).toBe("side");
    expect(parsed.toolCall.name).toBe("remotion_write");
    expect(parsed.toolCall.payload).toBe(source);
  });

  it("keeps think-only incomplete until the stream finishes", () => {
    const streaming = parseAgentSchedulerOutput(`${THINK_MARKER}\n还在想`, {
      complete: false,
    });
    expect(streaming.talk).toBe("");
    const finished = parseAgentSchedulerOutput(`${THINK_MARKER}\n还在想`, {
      complete: true,
    });
    expect(finished.talk).toBe("还在想");
  });
});

describe("composeSavedAssistantContent", () => {
  it("round-trips thinking and talk", () => {
    const content = composeSavedAssistantContent("思考", "结论");
    expect(splitSavedAssistantContent(content)).toEqual({
      thinking: "思考",
      talk: "结论",
    });
  });
});

describe("buildMainSchedulerMessages", () => {
  it("prepends the instruction and appends side results without dropping history", () => {
    const messages = buildMainSchedulerMessages(
      [{ role: "user", content: "帮我看看画布" }],
      ["画布是空的"]
    );
    expect(messages[0]?.content).toBe(AGENT_MAIN_INSTRUCTION);
    expect(messages[0]?.content).toContain(AGENT_EXECUTE_STATUS);
    expect(messages.map((message) => message.content)).toContain(
      "帮我看看画布"
    );
    expect(messages.at(-1)?.content).toContain("画布是空的");
  });

  it("tells the model when executing", () => {
    const messages = buildMainSchedulerMessages([], [], { mode: "agent" });
    expect(messages[0]?.content).toBe(buildAgentMainInstruction("agent"));
    expect(messages[0]?.content).toContain(AGENT_EXECUTE_STATUS);
    expect(messages[0]?.content).toContain("remotion_close");
  });

  it("tells the model not to ask whether to execute in plan mode", () => {
    const messages = buildMainSchedulerMessages([], [], { mode: "plan" });
    expect(messages[0]?.content).toContain(AGENT_PLAN_STATUS);
    expect(messages[0]?.content).toContain("不要问是否执行");
  });

  it("injects the canvas inventory after the instruction", () => {
    const messages = buildMainSchedulerMessages([], [], {
      canvasInventory: "画布清单：\n- n1 ai-text 文",
    });
    expect(messages[1]?.content).toContain("n1 ai-text 文");
  });
});

describe("runAgentScheduler", () => {
  it("stops after TALK and stores thinking plus the conclusion", async () => {
    const contents: string[] = [];
    const result = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "你好" }],
      stream: async () => ({
        text: `${THINK_MARKER}\n看了一眼\n${TALK_MARKER}\n先出方案`,
        stopped: false,
      }),
      runTool: async () => {
        throw new Error("talk should not run a tool");
      },
      onAssistantContent: (content) => {
        contents.push(content);
      },
    });
    expect(result.stopped).toBe(false);
    expect(splitSavedAssistantContent(result.content)).toEqual({
      thinking: "看了一眼",
      talk: "先出方案",
    });
    expect(contents.at(-1)).toBe(result.content);
  });

  it("runs tools instead of a second chat and keeps history off the tool", async () => {
    const streamPayloads: string[][] = [];
    const toolNames: string[] = [];
    await runAgentScheduler({
      historyMessages: [{ role: "user", content: "secret-history" }],
      stream: async (messages) => {
        streamPayloads.push(messages.map((message) => message.content));
        if (streamPayloads.length === 1) {
          return {
            text: `${THINK_MARKER}\n需要观察\n${SIDE_MARKER}\n${CANVAS_GET_STATE_TOOL}`,
            stopped: false,
          };
        }
        return {
          text: `${THINK_MARKER}\n已看过\n${TALK_MARKER}\n画布是空的`,
          stopped: false,
        };
      },
      runTool: async (call) => {
        toolNames.push(call.name);
        return '{"nodes":[]}';
      },
      onAssistantContent: () => undefined,
    });
    expect(streamPayloads).toHaveLength(2);
    expect(
      streamPayloads.every((contents) =>
        contents.includes(AGENT_MAIN_INSTRUCTION)
      )
    ).toBe(true);
    expect(
      streamPayloads[1]?.some((content) => content.includes("旁路结果"))
    ).toBe(true);
    expect(streamPayloads[1]?.join("\n")).toContain("secret-history");
    expect(toolNames).toEqual([CANVAS_GET_STATE_TOOL]);
  });

  it("caps main calls at six and skips the last tool", async () => {
    let mainCalls = 0;
    let toolCalls = 0;
    const result = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "继续" }],
      getMode: () => "plan",
      stream: async () => {
        mainCalls += 1;
        return {
          text: `${THINK_MARKER}\n第${mainCalls}步\n${SIDE_MARKER}\n${CANVAS_GET_STATE_TOOL}`,
          stopped: false,
        };
      },
      runTool: async () => {
        toolCalls += 1;
        return '{"nodes":[]}';
      },
      onAssistantContent: () => undefined,
    });
    expect(mainCalls).toBe(AGENT_CHAT_MAX_MAIN_STEPS);
    expect(toolCalls).toBe(AGENT_CHAT_MAX_MAIN_STEPS - 1);
    expect(splitSavedAssistantContent(result.content).talk).toBe("第6步");
  });

  it("runs the last tool when executing", async () => {
    let toolCalls = 0;
    await runAgentScheduler({
      historyMessages: [{ role: "user", content: "按这个做" }],
      maxSteps: 3,
      getMode: () => "agent",
      stream: async () => ({
        text: `${THINK_MARKER}\n做\n${SIDE_MARKER}\n${CANVAS_GET_STATE_TOOL}`,
        stopped: false,
      }),
      runTool: async () => {
        toolCalls += 1;
        return '{"nodes":[]}';
      },
      onAssistantContent: () => undefined,
    });
    expect(toolCalls).toBe(3);
  });
});
