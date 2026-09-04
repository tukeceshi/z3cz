import { describe, expect, it } from "vitest";

import {
  CANVAS_GET_STATE_TOOL,
  CANVAS_RESOLVE_RESOURCE_TOOL,
} from "./agent-canvas-state";
import {
  ASK_QUESTION_TOOL,
  SWITCH_MODE_TOOL,
  capabilityLabel,
  SIMPLE_ANIMATION_CAPABILITY,
} from "./agent-capabilities";
import {
  AGENT_CHAT_MAX_PLAN_STEPS,
  AGENT_EXECUTE_STATUS,
  AGENT_MAIN_INSTRUCTION,
  AGENT_PLAN_STATUS,
  buildAgentMainInstruction,
  buildAgentPlanInstruction,
  buildMainSchedulerMessages,
  buildModeSystemReminder,
  composeSavedAssistantContent,
  composeSavedAnswer,
  parseAgentSchedulerOutput,
  parseSavedAnswer,
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
    expect(parsed.talk).toBe("不该执行");
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

  it("does not treat think-only as a plan talk", () => {
    const streaming = parseAgentSchedulerOutput(`${THINK_MARKER}\n还在想`, {
      complete: false,
    });
    expect(streaming.thinking).toBe("还在想");
    expect(streaming.talk).toBe("");
    const finished = parseAgentSchedulerOutput(`${THINK_MARKER}\n还在想`, {
      complete: true,
    });
    expect(finished.thinking).toBe("还在想");
    expect(finished.talk).toBe("");
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

  it("round-trips think-only without inventing a plan talk", () => {
    const content = composeSavedAssistantContent("还在想", "");
    expect(content).toBe(`${THINK_MARKER}\n还在想`);
    expect(splitSavedAssistantContent(content)).toEqual({
      thinking: "还在想",
      talk: "",
    });
  });
});

describe("composeSavedAnswer", () => {
  it("round-trips thinking, tools, and talk, and still reads old think/talk text", () => {
    const saved = composeSavedAnswer({
      thinking: "查画布",
      tools: [
        {
          id: "tool-0",
          name: CANVAS_GET_STATE_TOOL,
          args: "",
          result: '{"nodes":[]}',
        },
      ],
      talk: "先出方案",
    });
    expect(parseSavedAnswer(saved)).toEqual({
      thinking: "查画布",
      tools: [
        {
          id: "tool-0",
          name: CANVAS_GET_STATE_TOOL,
          args: "",
          result: '{"nodes":[]}',
        },
      ],
      talk: "先出方案",
    });
    expect(
      parseSavedAnswer(`${THINK_MARKER}\n先看\n${TALK_MARKER}\n改片头`)
    ).toEqual({
      thinking: "先看",
      tools: [],
      talk: "改片头",
    });
  });
});

describe("buildMainSchedulerMessages", () => {
  it("prepends the instruction and appends side results without dropping history", () => {
    const messages = buildMainSchedulerMessages(
      [{ role: "user", content: "帮我看看画布" }],
      ["画布是空的"]
    );
    expect(messages[0]?.role).toBe("system");
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
    expect(messages[0]?.content).toContain(
      capabilityLabel(SIMPLE_ANIMATION_CAPABILITY)
    );
    expect(messages[0]?.content).not.toContain("canvas_write_text");
  });

  it("tells the model not to ask whether to execute in plan mode", () => {
    const messages = buildMainSchedulerMessages([], [], { mode: "plan" });
    const planLabel = capabilityLabel(SIMPLE_ANIMATION_CAPABILITY);
    expect(messages[0]?.content).toBe(buildAgentPlanInstruction());
    expect(messages[0]?.content).toContain(AGENT_PLAN_STATUS);
    expect(messages[0]?.content).toContain("全局");
    expect(messages[0]?.content).toContain("不要问是否执行");
    expect(messages[0]?.content).toContain(planLabel);
    expect(messages[0]?.content).not.toContain("canvas_write_text");
    expect(messages[0]?.content.includes("只有「简单动画」")).toBe(false);
  });

  it("injects a mode reminder after inventory and plan", () => {
    const messages = buildMainSchedulerMessages([], [], {
      mode: "plan",
      canvasInventory: "画布清单：\n- n1",
      planDocument: "先改片头",
    });
    expect(messages.map((message) => message.content)).toEqual([
      buildAgentPlanInstruction(),
      "画布清单：\n- n1",
      "当前方案：\n先改片头",
      buildModeSystemReminder("plan"),
    ]);
    expect(buildModeSystemReminder("ask")).toContain("500 字");
    expect(buildModeSystemReminder("ask")).toContain("from: ask");
    expect(buildModeSystemReminder("agent")).toContain("to: ask");
  });

  it("injects the canvas inventory after the instruction as system", () => {
    const messages = buildMainSchedulerMessages([], [], {
      canvasInventory: "画布清单：\n- n1 ai-text 文",
    });
    expect(messages[1]?.role).toBe("system");
    expect(messages[1]?.content).toContain("n1 ai-text 文");
  });

  it("does not inject a previous plan when none is provided", () => {
    const messages = buildMainSchedulerMessages(
      [{ role: "user", content: "改成横屏" }],
      [],
      { mode: "plan" }
    );
    expect(messages.some((message) => message.content.startsWith("当前方案："))).toBe(
      false
    );
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
    expect(parseSavedAnswer(result.content).tools).toEqual([]);
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
      streamPayloads[1]?.some((content) => content.includes("工具"))
    ).toBe(true);
    expect(
      streamPayloads[1]?.some((content) => content.includes("旁路结果"))
    ).toBe(false);
    expect(streamPayloads[1]?.join("\n")).toContain("secret-history");
    expect(toolNames).toEqual([CANVAS_GET_STATE_TOOL]);
  });

  it("stores execute and event output on the saved answer", async () => {
    let streamCalls = 0;
    const result = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "看画布" }],
      stream: async () => {
        streamCalls += 1;
        if (streamCalls === 1) {
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
      runTool: async () => '{"nodes":[]}',
      onAssistantContent: () => undefined,
    });
    expect(parseSavedAnswer(result.content)).toEqual({
      thinking: "已看过",
      tools: [
        {
          id: "tool-0",
          name: CANVAS_GET_STATE_TOOL,
          args: "",
          result: '{"nodes":[]}',
        },
      ],
      talk: "画布是空的",
    });
  });

  it("keeps the plan output when appending execute onto an existing answer", async () => {
    const result = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "按这个做" }],
      initialAnswer: {
        thinking: "先看",
        tools: [],
        talk: "改片头",
      },
      stream: async () => ({
        text: `${THINK_MARKER}\n做完了\n${TALK_MARKER}\n已经改好`,
        stopped: false,
      }),
      runTool: async () => {
        throw new Error("should not run a tool");
      },
      onAssistantContent: () => undefined,
    });
    expect(parseSavedAnswer(result.content)).toEqual({
      thinking: "做完了",
      tools: [],
      talk: "已经改好",
    });
  });

  it("caps plan tools then asks for a talk", async () => {
    let mainCalls = 0;
    let toolCalls = 0;
    const result = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "继续" }],
      getMode: () => "plan",
      stream: async () => {
        mainCalls += 1;
        if (mainCalls > AGENT_CHAT_MAX_PLAN_STEPS) {
          return {
            text: `${THINK_MARKER}\n收尾\n${TALK_MARKER}\n先看完再做`,
            stopped: false,
          };
        }
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
    expect(mainCalls).toBe(AGENT_CHAT_MAX_PLAN_STEPS + 1);
    expect(toolCalls).toBe(AGENT_CHAT_MAX_PLAN_STEPS);
    expect(splitSavedAssistantContent(result.content).talk).toBe("先看完再做");
  });

  it("runs the last tool then asks for a talk when executing", async () => {
    let toolCalls = 0;
    let streamCalls = 0;
    const result = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "按这个做" }],
      maxSteps: 3,
      getMode: () => "agent",
      stream: async () => {
        streamCalls += 1;
        if (streamCalls > 3) {
          return {
            text: `${THINK_MARKER}\n做完了\n${TALK_MARKER}\n已经改好`,
            stopped: false,
          };
        }
        return {
          text: `${THINK_MARKER}\n做\n${SIDE_MARKER}\n${CANVAS_GET_STATE_TOOL}`,
          stopped: false,
        };
      },
      runTool: async () => {
        toolCalls += 1;
        return '{"nodes":[]}';
      },
      onAssistantContent: () => undefined,
    });
    expect(toolCalls).toBe(3);
    expect(streamCalls).toBe(4);
    expect(splitSavedAssistantContent(result.content).talk).toBe("已经改好");
  });

  it("feeds an empty tool name back without calling the tool", async () => {
    let toolCalls = 0;
    const payloads: string[] = [];
    await runAgentScheduler({
      historyMessages: [{ role: "user", content: "看一眼" }],
      maxSteps: 2,
      getMode: () => "plan",
      stream: async (messages) => {
        payloads.push(messages.at(-1)?.content ?? "");
        if (payloads.length === 1) {
          return {
            text: `${THINK_MARKER}\n空\n${SIDE_MARKER}\n`,
            stopped: false,
          };
        }
        return {
          text: `${THINK_MARKER}\n知道了\n${TALK_MARKER}\n缺工具名`,
          stopped: false,
        };
      },
      runTool: async () => {
        toolCalls += 1;
        return '{"nodes":[]}';
      },
      onAssistantContent: () => undefined,
    });
    expect(toolCalls).toBe(0);
    expect(payloads[1]).toContain("缺少工具名");
  });

  it("continues from initial side results without putting them in history", async () => {
    const histories: string[] = [];
    await runAgentScheduler({
      historyMessages: [{ role: "user", content: "看画布" }],
      initialSideResults: ['{"nodes":[]}'],
      stream: async (messages) => {
        histories.push(messages.map((message) => message.content).join("\n"));
        return {
          text: `${THINK_MARKER}\n已看过\n${TALK_MARKER}\n画布是空的`,
          stopped: false,
        };
      },
      runTool: async () => {
        throw new Error("should not run another tool");
      },
      onAssistantContent: () => undefined,
    });
    expect(histories[0]).toContain("工具 prior-1 结果");
    expect(histories[0]).toContain("看画布");
    expect(histories[0]).not.toContain("旁路结果");
  });

  it("rereads canvas inventory on each step", async () => {
    let inventory = "画布清单：空";
    const seen: string[] = [];
    await runAgentScheduler({
      historyMessages: [{ role: "user", content: "看" }],
      getCanvasInventory: () => inventory,
      stream: async (messages) => {
        seen.push(messages.find((message) => message.content.startsWith("画布清单"))?.content ?? "");
        if (seen.length === 1) {
          inventory = "画布清单：\n新的";
          return {
            text: `${THINK_MARKER}\n查\n${SIDE_MARKER}\n${CANVAS_GET_STATE_TOOL}`,
            stopped: false,
          };
        }
        return {
          text: `${THINK_MARKER}\n好\n${TALK_MARKER}\n已更新`,
          stopped: false,
        };
      },
      runTool: async () => '{"nodes":[]}',
      onAssistantContent: () => undefined,
    });
    expect(seen[0]).toBe("画布清单：空");
    expect(seen[1]).toContain("新的");
  });

  it("rejects ask_question in plan without an audit, then pauses when audited", async () => {
    let calls = 0;
    const first = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "怎么办" }],
      getMode: () => "plan",
      stream: async () => {
        calls += 1;
        if (calls === 1) {
          return {
            text: `${THINK_MARKER}\n随便问\n${SIDE_MARKER}\n${ASK_QUESTION_TOOL}\n${JSON.stringify({
              prompt: "选一条",
              options: [{ id: "a", label: "A" }],
            })}`,
            stopped: false,
          };
        }
        return {
          text: `${THINK_MARKER}\n记下\n${TALK_MARKER}\n先自己判断`,
          stopped: false,
        };
      },
      runTool: async () => {
        throw new Error("ask_question should not hit canvas tools");
      },
      onAssistantContent: () => undefined,
    });
    expect(first.pendingAsk).toBeUndefined();
    expect(parseSavedAnswer(first.content).tools[0]?.result).toContain(
      "必要性审计"
    );

    const audited = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "怎么办" }],
      getMode: () => "plan",
      stream: async () => ({
        text: `${THINK_MARKER}\n提问是否必要：必要\n${SIDE_MARKER}\n${ASK_QUESTION_TOOL}\n${JSON.stringify({
          prompt: "选路线",
          options: [{ id: "fast", label: "快" }],
        })}`,
        stopped: false,
      }),
      runTool: async () => {
        throw new Error("ask_question should not hit canvas tools");
      },
      onAssistantContent: () => undefined,
    });
    expect(audited.pendingAsk).toEqual({
      prompt: "选路线",
      options: [{ id: "fast", label: "快" }],
    });
  });

  it("applies switch_mode immediately except when leaving plan", async () => {
    const applied: string[] = [];
    let mode: "ask" | "plan" | "agent" = "ask";
    await runAgentScheduler({
      historyMessages: [{ role: "user", content: "改成方案" }],
      getMode: () => mode,
      applyMode: (next) => {
        applied.push(next);
        mode = next;
      },
      stream: async () => {
        if (mode === "plan") {
          return {
            text: `${THINK_MARKER}\n好\n${TALK_MARKER}\n已切到方案`,
            stopped: false,
          };
        }
        return {
          text: `${THINK_MARKER}\n切\n${SIDE_MARKER}\n${SWITCH_MODE_TOOL}\nfrom: ask\nto: plan`,
          stopped: false,
        };
      },
      runTool: async () => {
        throw new Error("switch_mode is host-only");
      },
      onAssistantContent: () => undefined,
    });
    expect(applied).toEqual(["plan"]);

    const leaving = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "去做" }],
      getMode: () => "plan",
      applyMode: () => {
        throw new Error("leaving plan must wait for confirm");
      },
      stream: async () => ({
        text: `${THINK_MARKER}\n切\n${SIDE_MARKER}\n${SWITCH_MODE_TOOL}\nfrom: plan\nto: agent`,
        stopped: false,
      }),
      runTool: async () => {
        throw new Error("switch_mode is host-only");
      },
      onAssistantContent: () => undefined,
    });
    expect(leaving.pendingSwitch).toEqual({ from: "plan", to: "agent" });
  });

  it("rejects switch_mode pairs that are not allowed", async () => {
    let calls = 0;
    const result = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "离开" }],
      getMode: () => "plan",
      applyMode: () => {
        throw new Error("plan to ask is not allowed");
      },
      stream: async () => {
        calls += 1;
        if (calls > 1) {
          return {
            text: `${THINK_MARKER}\n停\n${TALK_MARKER}\n仍在方案`,
            stopped: false,
          };
        }
        return {
          text: `${THINK_MARKER}\n切\n${SIDE_MARKER}\n${SWITCH_MODE_TOOL}\nfrom: plan\nto: ask`,
          stopped: false,
        };
      },
      runTool: async () => {
        throw new Error("switch_mode is host-only");
      },
      onAssistantContent: () => undefined,
    });
    expect(result.pendingSwitch).toBeUndefined();
    expect(parseSavedAnswer(result.content).tools.at(-1)?.result).toContain(
      "无效模式"
    );
  });
});
