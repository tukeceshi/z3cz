import type { AgentChatAnswer } from "@dafthunk/types";
import { withAnswerStep, withAnswerStepIfNew } from "@dafthunk/types";
import { describe, expect, it } from "vitest";

import {
  CANVAS_GET_STATE_TOOL,
  CANVAS_RESOLVE_RESOURCE_TOOL,
} from "./agent-canvas-state";
import {
  AGENT_ANIMATION_IDENTITY,
  AGENT_CANVAS_IDENTITY,
  ASK_QUESTION_TOOL,
  CANVAS_CREATE_GENERATION_FLOW_TOOL,
  ENTER_DRAFT_TOOL,
  READ_URL_TOOL,
  SCHEDULE_ROLE_TOOL,
  SIMPLE_ANIMATION_TOOL,
  toolsForRequest,
} from "./agent-capabilities";
import {
  AGENT_CHAT_MAX_PLAN_STEPS,
  AGENT_IDENTITY,
  AGENT_MAIN_INSTRUCTION,
  canPauseForExecuteConfirm,
  EVENT_JUDGMENT_REMINDER,
  EXECUTE_TALK_REQUIRED,
  LAST_ROUND_REMINDER,
  buildAgentMainInstruction,
  buildEventFollowupReminder,
  buildMainSchedulerMessages,
  buildModeSystemReminder,
  parseEventJudgment,
  composeSavedAssistantContent,
  composeSavedAnswer,
  joinAgentTalk,
  parseAgentSchedulerOutput,
  parseAskQuestionArgs,
  parseCiteHeader,
  parseSavedAnswer,
  pendingAskFromTool,
  runAgentScheduler,
  splitSavedAssistantContent,
  TALK_MARKER,
  unansweredAnimationWriteFromAnswer,
  unansweredAskFromAnswer,
  THINK_MARKER,
} from "./agent-chat-scheduler";
import { AGENT_REMOTION_SKILL } from "./agent-remotion-skill";

describe("parseAgentSchedulerOutput", () => {
  it("treats unmarked text as talk", () => {
    const parsed = parseAgentSchedulerOutput("直接回答");
    expect(parsed.talk).toBe("直接回答");
    expect(parsed.thinking).toBe("");
  });

  it("splits think and talk markers", () => {
    const parsed = parseAgentSchedulerOutput(
      `${THINK_MARKER}\n先看需求\n${TALK_MARKER}\n可以这样做`
    );
    expect(parsed.thinking).toBe("先看需求");
    expect(parsed.talk).toBe("可以这样做");
  });

  it("ignores leftover SIDE text and does not treat it as a tool", () => {
    const parsed = parseSavedAnswer(
      `${THINK_MARKER}\n查画布\n<<<SIDE>>>\n${CANVAS_GET_STATE_TOOL}\n${TALK_MARKER}\n不该执行`
    );
    expect(parsed.thinking).toBe("查画布");
    expect(parsed.tools).toEqual([]);
    expect(parsed.talk).toBe("不该执行");
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

describe("joinAgentTalk", () => {
  it("keeps committed talk until new talk arrives, then appends", () => {
    expect(joinAgentTalk("先出方案", "")).toBe("先出方案");
    expect(joinAgentTalk("先出方案", "已经改好")).toBe("先出方案\n已经改好");
    expect(joinAgentTalk("先出方案\n已经改好", "已经改好")).toBe(
      "先出方案\n已经改好"
    );
    expect(joinAgentTalk("", "先出方案")).toBe("先出方案");
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

describe("parseAskQuestionArgs", () => {
  it("reads json and list payloads, and unanswered tools without a result", () => {
    expect(
      parseAskQuestionArgs(
        JSON.stringify({
          prompt: "选一条",
          options: [{ id: "a", label: "A" }],
        })
      )
    ).toEqual({
      prompt: "选一条",
      options: [{ id: "a", label: "A" }],
    });
    expect(
      parseAskQuestionArgs(
        JSON.stringify({
          prompt: "选一条",
          options: ["甲", "乙"],
        })
      )
    ).toEqual({
      prompt: "选一条",
      options: [
        { id: "opt-0", label: "甲" },
        { id: "opt-1", label: "乙" },
      ],
    });
    expect(
      parseAskQuestionArgs(
        "问题: 你想用哪个素材做简易动画？ 选项: 视频1|图片1|视频1-重拍|从零新建"
      )
    ).toEqual({
      prompt: "你想用哪个素材做简易动画？",
      options: [
        { id: "opt-0", label: "视频1" },
        { id: "opt-1", label: "图片1" },
        { id: "opt-2", label: "视频1-重拍" },
        { id: "opt-3", label: "从零新建" },
      ],
    });
    expect(
      parseAskQuestionArgs(
        '您希望动画使用哪些素材？ 选项: ["视频1+图片1", "仅视频1", "仅图片1", "新内容", "其他"]'
      )
    ).toEqual({
      prompt: "您希望动画使用哪些素材？",
      options: [
        { id: "opt-0", label: "视频1+图片1" },
        { id: "opt-1", label: "仅视频1" },
        { id: "opt-2", label: "仅图片1" },
        { id: "opt-3", label: "新内容" },
        { id: "opt-4", label: "其他" },
      ],
    });
    expect(
      parseAskQuestionArgs(
        "您希望动画使用哪些素材？\n选项: [\"视频1+图片1\", \"仅视频1\", \"仅图片1\"]"
      )
    ).toEqual({
      prompt: "您希望动画使用哪些素材？",
      options: [
        { id: "opt-0", label: "视频1+图片1" },
        { id: "opt-1", label: "仅视频1" },
        { id: "opt-2", label: "仅图片1" },
      ],
    });
    expect(
      parseAskQuestionArgs(
        "你想基于哪个现有资源做动画？|视频1|图片1|新建空白动画"
      )
    ).toEqual({
      prompt: "你想基于哪个现有资源做动画？",
      options: [
        { id: "opt-0", label: "视频1" },
        { id: "opt-1", label: "图片1" },
        { id: "opt-2", label: "新建空白动画" },
      ],
    });
    expect(
      parseAskQuestionArgs(
        "你想做哪种简易动画？例如：\n- 文字动画（标题/字幕）\n- 图片转动画（让图片动起来）"
      )
    ).toEqual({
      prompt: "你想做哪种简易动画？",
      options: [
        { id: "opt-0", label: "文字动画" },
        { id: "opt-1", label: "图片转动画" },
      ],
    });
    expect(
      unansweredAskFromAnswer({
        thinking: "",
        tools: [
          {
            id: "tool-0",
            name: ASK_QUESTION_TOOL,
            args: "选？\n- 甲\n- 乙",
            result: "",
          },
        ],
        talk: "",
      })
    ).toEqual({
      prompt: "选？",
      options: [
        { id: "opt-0", label: "甲" },
        { id: "opt-1", label: "乙" },
      ],
    });
    expect(
      unansweredAskFromAnswer({
        thinking: "",
        tools: [
          {
            id: "tool-0",
            name: ASK_QUESTION_TOOL,
            args: "",
            result: "",
          },
        ],
        talk: "你想做哪种？\n- 文字动画\n- 图片转动画",
      })
    ).toEqual({
      prompt: "你想做哪种？",
      options: [
        { id: "opt-0", label: "文字动画" },
        { id: "opt-1", label: "图片转动画" },
      ],
    });
    expect(
      unansweredAskFromAnswer({
        thinking: "",
        tools: [
          {
            id: "tool-0",
            name: ASK_QUESTION_TOOL,
            args: "选？\n- 甲",
            result: '{"error":"提问前缺少必要性审计"}',
          },
        ],
        talk: "",
      })
    ).toBeUndefined();
  });

  it("falls back to talk then a prompt with no options", () => {
    expect(
      pendingAskFromTool(
        "",
        "你想做哪种？\n- 文字动画\n- 图片转动画"
      )
    ).toEqual({
      prompt: "你想做哪种？",
      options: [
        { id: "opt-0", label: "文字动画" },
        { id: "opt-1", label: "图片转动画" },
      ],
    });
    expect(pendingAskFromTool("", "")).toEqual({
      prompt: "请选择",
      options: [],
    });
    expect(
      pendingAskFromTool(
        "",
        "你想基于哪个现有资源做动画？|视频1|图片1|新建空白动画"
      )
    ).toEqual({
      prompt: "你想基于哪个现有资源做动画？",
      options: [
        { id: "opt-0", label: "视频1" },
        { id: "opt-1", label: "图片1" },
        { id: "opt-2", label: "新建空白动画" },
      ],
    });
  });
});

describe("withAnswerStepIfNew", () => {
  it("does not stack the same talk twice", () => {
    const seed = withAnswerStep(
      { thinking: "", tools: [], talk: "" },
      "",
      "请点击执行"
    );
    expect(withAnswerStepIfNew(seed, "", "请点击执行").talk).toBe("请点击执行");
    expect(withAnswerStep(seed, "", "请点击执行").talk).toBe(
      "请点击执行\n请点击执行"
    );
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
    expect(parseSavedAnswer(saved)).toMatchObject({
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
    ).toMatchObject({
      thinking: "先看",
      tools: [],
      talk: "改片头",
    });
  });

  it("keeps think, tool, and talk in the order they happened", () => {
    const saved = composeSavedAnswer({
      thinking: "",
      tools: [],
      talk: "",
      blocks: [
        { kind: "think", text: "先看" },
        {
          kind: "tool",
          tool: {
            id: "tool-0",
            name: CANVAS_GET_STATE_TOOL,
            args: "",
            result: '{"nodes":[]}',
          },
        },
        { kind: "talk", text: "先出方案" },
        { kind: "think", text: "再看" },
        { kind: "talk", text: "已经改好" },
      ],
    });
    expect(parseSavedAnswer(saved).blocks).toEqual([
      { kind: "think", text: "先看" },
      {
        kind: "tool",
        tool: {
          id: "tool-0",
          name: CANVAS_GET_STATE_TOOL,
          args: "",
          result: '{"nodes":[]}',
        },
      },
      { kind: "talk", text: "先出方案" },
      { kind: "think", text: "再看" },
      { kind: "talk", text: "已经改好" },
    ]);
  });
});

describe("buildMainSchedulerMessages", () => {
  const now = new Date(2026, 8, 5);

  it("stacks identity, date, inventory, reminder, then the user query", () => {
    const messages = buildMainSchedulerMessages(
      [{ role: "user", content: "制作简易动画" }],
      [],
      {
        mode: "draft",
        locale: "zh",
        now,
        canvasInventory: "画布清单：\n- n1",
      }
    );
    expect(messages.map((message) => message.content)).toEqual([
      AGENT_IDENTITY,
      "<user_info>\nToday's date: Saturday Sep 5, 2026\nLocale: zh\n</user_info>",
      EVENT_JUDGMENT_REMINDER,
      "<user_query>\n制作简易动画\n</user_query>",
    ]);
    expect(messages.some((message) => message.content === AGENT_CANVAS_IDENTITY)).toBe(
      false
    );
    expect(messages.some((message) => message.content === "画布清单：\n- n1")).toBe(
      false
    );
    expect(messages[0]?.content).toBe(buildAgentMainInstruction("ask"));
    expect(messages[0]?.content).toBe(buildAgentMainInstruction("real"));
    expect(AGENT_IDENTITY).toContain("不要在正文里写调用");
    expect(AGENT_CANVAS_IDENTITY).toContain("没改过别反复取");
    expect(messages.some((message) => message.content.includes("<<<THINK>>>"))).toBe(
      false
    );
    expect(messages.some((message) => message.content.includes("from:"))).toBe(
      false
    );
    expect(messages.some((message) => message.content.includes("<canvas_skill>"))).toBe(
      false
    );
    expect(messages.some((message) => message.content.includes("startLine:endLine"))).toBe(
      false
    );
    expect(messages[0]?.content).not.toContain("enter_draft");
    expect(buildModeSystemReminder("ask")).not.toContain("enter_draft");
    expect(buildModeSystemReminder("ask")).not.toContain("草案");
    expect(buildModeSystemReminder("draft")).toBe(buildModeSystemReminder("ask"));
    expect(buildModeSystemReminder("real")).toBe(buildModeSystemReminder("ask"));
    expect(buildModeSystemReminder("ask")).not.toContain("SIDE");
    expect(buildModeSystemReminder("ask")).toContain("先说清楚做什么");
    expect(buildModeSystemReminder("ask")).toContain("再调工具");
    expect(buildModeSystemReminder("ask")).toContain("不要让用户点执行");
    expect(buildModeSystemReminder("ask")).toContain("只确认是否改画布");
    expect(AGENT_IDENTITY).toContain("先调度对应角色");
    expect(AGENT_IDENTITY).toContain("工具对不上就直说做不了");
    expect(buildModeSystemReminder("ask")).not.toContain("不要反复取画布");
    expect(buildModeSystemReminder("ask")).not.toContain("等用户点");
    expect(buildModeSystemReminder("real")).not.toContain("remotion_open");
    expect(buildModeSystemReminder("real")).not.toContain("simple_animation");
  });

  it("attaches remotion skill after inventory when animationSkill is on", () => {
    const messages = buildMainSchedulerMessages(
      [{ role: "user", content: "改简易动画" }],
      [],
      {
        mode: "ask",
        locale: "zh",
        now,
        canvasInventory: "画布清单：\n- n1",
        canvas: true,
        animation: true,
      }
    );
    const skill = messages.find((message) =>
      message.content.includes("<canvas_skill>")
    );
    expect(skill?.role).toBe("system");
    expect(skill?.content).toContain("不要 import remotion");
    expect(skill?.content).toContain("<Composition>");
    expect(skill?.content).toContain("https://www.remotion.dev/docs");
    expect(skill?.content).toContain(AGENT_REMOTION_SKILL);
    expect(messages.map((message) => message.content)).toEqual([
      AGENT_IDENTITY,
      AGENT_CANVAS_IDENTITY,
      AGENT_ANIMATION_IDENTITY,
      "<user_info>\nToday's date: Saturday Sep 5, 2026\nLocale: zh\n</user_info>",
      "画布清单：\n- n1",
      `<canvas_skill>\n${AGENT_REMOTION_SKILL}\n</canvas_skill>`,
      EVENT_JUDGMENT_REMINDER,
      "<user_query>\n改简易动画\n</user_query>",
    ]);
  });

  it("attaches canvas identity and inventory only when that role is on", () => {
    const messages = buildMainSchedulerMessages(
      [{ role: "user", content: "看画布" }],
      [],
      {
        locale: "zh",
        now,
        canvas: true,
        canvasInventory: "画布清单：\n- n1",
      }
    );
    expect(messages.map((message) => message.content)).toEqual([
      AGENT_IDENTITY,
      AGENT_CANVAS_IDENTITY,
      "<user_info>\nToday's date: Saturday Sep 5, 2026\nLocale: zh\n</user_info>",
      "画布清单：\n- n1",
      EVENT_JUDGMENT_REMINDER,
      "<user_query>\n看画布\n</user_query>",
    ]);
  });

  it("asks for a summary with no tools on the last round", () => {
    const messages = buildMainSchedulerMessages(
      [{ role: "user", content: "继续" }],
      [],
      {
        locale: "zh",
        now,
        lastRound: true,
      }
    );
    expect(messages.some((message) => message.content === LAST_ROUND_REMINDER)).toBe(
      true
    );
    expect(
      messages.some((message) => message.content === EVENT_JUDGMENT_REMINDER)
    ).toBe(false);
  });

  it("asks whether the previous event continues", () => {
    const previous = { title: "片头", ended: false };
    const messages = buildMainSchedulerMessages(
      [{ role: "user", content: "再改一下" }],
      [],
      {
        locale: "zh",
        now,
        previousEvent: previous,
      }
    );
    expect(messages.some((message) => message.content === EVENT_JUDGMENT_REMINDER)).toBe(
      false
    );
    expect(
      messages.some(
        (message) => message.content === buildEventFollowupReminder(previous)
      )
    ).toBe(true);
  });

  it("does not inject plan talk or draft source as canvas_draft", () => {
    const messages = buildMainSchedulerMessages(
      [{ role: "user", content: "帮我看看画布" }],
      ["画布是空的"],
      {
        locale: "zh",
        now,
        draftSourceCode: "export const A = 1;",
        planDocument: "先改片头",
      }
    );
    expect(messages.some((message) => message.content.includes("<canvas_draft>"))).toBe(
      false
    );
    expect(messages.some((message) => message.content.includes("先改片头"))).toBe(
      false
    );
    expect(messages.at(-2)).toEqual({
      role: "assistant",
      content: "",
      toolCalls: [
        { id: "prior-1", name: "tool-1", arguments: "" },
      ],
    });
    expect(messages.at(-1)?.role).toBe("tool");
    expect(messages.at(-1)?.content).toBe("画布是空的");
    expect(messages.at(-1)?.toolCallId).toBe("prior-1");
    expect(messages.some((message) => message.content.includes("<user_query>"))).toBe(
      true
    );
  });

  it("pairs tool results with the matching assistant call", () => {
    const messages = buildMainSchedulerMessages(
      [{ role: "user", content: "制作简易动画" }],
      [
        {
          id: "call_abc",
          name: SCHEDULE_ROLE_TOOL,
          arguments: '{"role":"animation"}',
          result: '{"scheduled":"animation"}',
        },
      ],
      { locale: "zh", now }
    );
    expect(messages.at(-2)).toEqual({
      role: "assistant",
      content: "",
      toolCalls: [
        {
          id: "call_abc",
          name: SCHEDULE_ROLE_TOOL,
          arguments: '{"role":"animation"}',
        },
      ],
    });
    expect(messages.at(-1)).toEqual({
      role: "tool",
      content: '{"scheduled":"animation"}',
      toolCallId: "call_abc",
    });
  });
});

describe("parseEventJudgment", () => {
  it("reads title and ended, and drops those lines from talk", () => {
    expect(
      parseEventJudgment("先改字号\n事件：片头\n结束：否")
    ).toEqual({
      title: "片头",
      ended: false,
      judged: true,
      talk: "先改字号",
    });
    expect(parseEventJudgment("随便问问\n事件：无")).toEqual({
      title: undefined,
      ended: undefined,
      judged: true,
      talk: "随便问问",
    });
    expect(parseEventJudgment("事件：收尾\n结束：已结束")).toEqual({
      title: "收尾",
      ended: true,
      judged: true,
      talk: "",
    });
    expect(parseEventJudgment("先改字号")).toEqual({
      title: undefined,
      ended: undefined,
      judged: false,
      talk: "先改字号",
    });
  });
});

describe("parseCiteHeader", () => {
  it("reads startLine:endLine:filepath", () => {
    expect(parseCiteHeader("12:20:animation.tsx")).toEqual({
      startLine: 12,
      endLine: 20,
      filepath: "animation.tsx",
    });
  });
});

describe("toolsForRequest", () => {
  it("lists schedule and ask until a role is on", () => {
    const ask = toolsForRequest("ask").map((tool) => tool.function.name);
    expect(ask).toEqual([READ_URL_TOOL, SCHEDULE_ROLE_TOOL, ASK_QUESTION_TOOL]);
    expect(ask).not.toContain(SIMPLE_ANIMATION_TOOL);
    expect(ask).not.toContain("canvas_get_state");
    expect(ask).not.toContain("switch_mode");
    expect(ask).not.toContain("remotion_write");
    expect(ask).not.toContain(ENTER_DRAFT_TOOL);
    const draft = toolsForRequest("draft").map((tool) => tool.function.name);
    expect(draft).toEqual(ask);
    expect(toolsForRequest("real").map((tool) => tool.function.name)).toEqual(ask);
    expect(
      toolsForRequest("ask", { canvas: true }).map((tool) => tool.function.name)
    ).toContain("canvas_get_state");
    expect(
      toolsForRequest("ask", { animation: true }).map((tool) => tool.function.name)
    ).toContain(SIMPLE_ANIMATION_TOOL);
  });
});

describe("runAgentScheduler", () => {
  it("stops after content and stores the conclusion", async () => {
    const contents: string[] = [];
    const result = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "你好" }],
      stream: async () => ({
        text: "先出方案",
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
      thinking: "",
      talk: "先出方案",
    });
    expect(parseSavedAnswer(result.content).tools).toEqual([]);
    expect(contents.at(-1)).toBe(result.content);
  });

  it("does not run tools from SIDE text without toolCalls", async () => {
    let toolCalls = 0;
    const result = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "看画布" }],
      stream: async () => ({
        text: `<<<SIDE>>>\n${CANVAS_GET_STATE_TOOL}`,
        stopped: false,
      }),
      runTool: async () => {
        toolCalls += 1;
        return '{"nodes":[]}';
      },
      onAssistantContent: () => undefined,
    });
    expect(toolCalls).toBe(0);
    expect(splitSavedAssistantContent(result.content).talk).toContain(
      CANVAS_GET_STATE_TOOL
    );
  });

  it("runs all pending toolCalls before the next stream", async () => {
    const toolNames: string[] = [];
    let streamCalls = 0;
    const result = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "看画布" }],
      initialAnswer: {
        thinking: "",
        tools: [],
        talk: "先查",
      },
      pendingToolCalls: [
        { id: "call-1", name: CANVAS_GET_STATE_TOOL, arguments: "" },
        {
          id: "call-2",
          name: CANVAS_RESOLVE_RESOURCE_TOOL,
          arguments: JSON.stringify({ resourceId: "res-1" }),
        },
      ],
      stream: async () => {
        streamCalls += 1;
        return { text: "画布是空的", stopped: false };
      },
      runTool: async (call) => {
        toolNames.push(call.name);
        return call.name === CANVAS_RESOLVE_RESOURCE_TOOL
          ? '{"url":"https://example.com"}'
          : '{"nodes":[]}';
      },
      onAssistantContent: () => undefined,
    });
    expect(toolNames).toEqual([
      CANVAS_GET_STATE_TOOL,
      CANVAS_RESOLVE_RESOURCE_TOOL,
    ]);
    expect(streamCalls).toBe(1);
    expect(parseSavedAnswer(result.content).tools).toEqual([
      {
        id: "tool-0",
        name: CANVAS_GET_STATE_TOOL,
        args: "",
        result: '{"nodes":[]}',
      },
      {
        id: "tool-1",
        name: CANVAS_RESOLVE_RESOURCE_TOOL,
        args: JSON.stringify({ resourceId: "res-1" }),
        result: '{"url":"https://example.com"}',
      },
    ]);
  });

  it("runs tools via tool_calls and feeds results as role tool", async () => {
    const streamPayloads: { role: string; content: string }[][] = [];
    const toolLists: string[][] = [];
    const toolNames: string[] = [];
    await runAgentScheduler({
      historyMessages: [{ role: "user", content: "secret-history" }],
      stream: async (messages, tools) => {
        streamPayloads.push(
          messages.map((message) => ({
            role: message.role,
            content: message.content,
          }))
        );
        toolLists.push(tools.map((tool) => tool.function.name));
        if (streamPayloads.length === 1) {
          return {
            text: "",
            toolCalls: [
              { id: "call-1", name: CANVAS_GET_STATE_TOOL, arguments: "" },
            ],
            stopped: false,
          };
        }
        return {
          text: "画布是空的",
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
        contents.some((message) => message.content === AGENT_MAIN_INSTRUCTION)
      )
    ).toBe(true);
    expect(streamPayloads[1]?.at(-2)?.role).toBe("assistant");
    expect(streamPayloads[1]?.at(-1)).toEqual({
      role: "tool",
      content: '{"nodes":[]}',
    });
    expect(
      streamPayloads[1]?.some((message) =>
        message.content.includes("<user_query>\nsecret-history\n</user_query>")
      )
    ).toBe(true);
    expect(toolNames).toEqual([CANVAS_GET_STATE_TOOL]);
    expect(toolLists[0]).toEqual([READ_URL_TOOL, SCHEDULE_ROLE_TOOL, ASK_QUESTION_TOOL]);
  });

  it("stores tool output on the saved answer", async () => {
    let streamCalls = 0;
    const result = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "看画布" }],
      stream: async () => {
        streamCalls += 1;
        if (streamCalls === 1) {
          return {
            text: "",
            toolCalls: [
              { id: "tool-0", name: CANVAS_GET_STATE_TOOL, arguments: "" },
            ],
            stopped: false,
          };
        }
        return {
          text: "画布是空的",
          stopped: false,
        };
      },
      runTool: async () => '{"nodes":[]}',
      onAssistantContent: () => undefined,
    });
    expect(parseSavedAnswer(result.content)).toMatchObject({
      thinking: "",
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

  it("stores streamed thinking beside talk", async () => {
    const snapshots: AgentChatAnswer[] = [];
    const result = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "你好" }],
      stream: async (_messages, _tools, onDelta) => {
        onDelta("", "先看");
        onDelta("可以", "先看");
        return { text: "可以", thinking: "先看", stopped: false };
      },
      runTool: async () => {
        throw new Error("should not run a tool");
      },
      onAssistantContent: (content) => {
        snapshots.push(parseSavedAnswer(content));
      },
    });
    expect(snapshots.some((answer) => answer.thinking === "先看")).toBe(true);
    expect(parseSavedAnswer(result.content)).toMatchObject({
      thinking: "先看",
      tools: [],
      talk: "可以",
    });
  });

  it("starts a new think after tools instead of joining the first", async () => {
    let streamCalls = 0;
    const result = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "按这个做" }],
      stream: async () => {
        streamCalls += 1;
        if (streamCalls === 1) {
          return {
            text: "",
            thinking: "先看",
            toolCalls: [
              { id: "tool-0", name: CANVAS_GET_STATE_TOOL, arguments: "" },
            ],
            stopped: false,
          };
        }
        return {
          text: "已经改好",
          thinking: "再看",
          stopped: false,
        };
      },
      runTool: async () => '{"nodes":[]}',
      onAssistantContent: () => undefined,
    });
    expect(parseSavedAnswer(result.content).blocks).toEqual([
      { kind: "think", text: "先看" },
      {
        kind: "tool",
        tool: {
          id: "tool-0",
          name: CANVAS_GET_STATE_TOOL,
          args: "",
          result: '{"nodes":[]}',
        },
      },
      { kind: "think", text: "再看" },
      { kind: "talk", text: "已经改好" },
    ]);
  });

  it("keeps earlier thinking when a later step only talks", async () => {
    const result = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "按这个做" }],
      initialAnswer: {
        thinking: "先看",
        tools: [],
        talk: "改片头",
      },
      stream: async () => ({
        text: "已经改好",
        stopped: false,
      }),
      runTool: async () => {
        throw new Error("should not run a tool");
      },
      onAssistantContent: () => undefined,
    });
    expect(parseSavedAnswer(result.content)).toMatchObject({
      thinking: "先看",
      tools: [],
      talk: "改片头\n已经改好",
    });
  });

  it("keeps earlier talk while a later step is still thinking", async () => {
    const snapshots: string[] = [];
    const result = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "继续" }],
      initialAnswer: {
        thinking: "",
        tools: [],
        talk: "先出方案",
      },
      stream: async (_messages, _tools, onDelta) => {
        onDelta("");
        onDelta("已经改好");
        return {
          text: "已经改好",
          stopped: false,
        };
      },
      runTool: async () => {
        throw new Error("should not run a tool");
      },
      onAssistantContent: (content) => {
        snapshots.push(splitSavedAssistantContent(content).talk);
      },
    });
    expect(snapshots[0]).toBe("先出方案");
    expect(snapshots.at(-1)).toBe("先出方案\n已经改好");
    expect(parseSavedAnswer(result.content).talk).toBe("先出方案\n已经改好");
  });

  it("caps plan tools then asks for a last-round summary without tools", async () => {
    let toolSteps = 0;
    let lastRoundCalls = 0;
    let toolCalls = 0;
    const result = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "继续" }],
      getMode: () => "draft",
      stream: async (_messages, tools) => {
        if (tools.length === 0) {
          lastRoundCalls += 1;
          return {
            text: "总结完了\n事件：片头\n结束：否",
            stopped: false,
          };
        }
        toolSteps += 1;
        return {
          text: `第${toolSteps}步`,
          toolCalls: [
            { id: `call-${toolSteps}`, name: CANVAS_GET_STATE_TOOL, arguments: "" },
          ],
          stopped: false,
        };
      },
      runTool: async () => {
        toolCalls += 1;
        return '{"nodes":[]}';
      },
      onAssistantContent: () => undefined,
    });
    expect(toolSteps).toBe(AGENT_CHAT_MAX_PLAN_STEPS);
    expect(lastRoundCalls).toBe(1);
    expect(toolCalls).toBe(AGENT_CHAT_MAX_PLAN_STEPS);
    expect(splitSavedAssistantContent(result.content).talk).toBe(
      [
        ...Array.from(
          { length: AGENT_CHAT_MAX_PLAN_STEPS },
          (_, index) => `第${index + 1}步`
        ),
        "总结完了",
      ].join("\n")
    );
    expect(result.eventTitle).toBe("片头");
    expect(result.eventEnded).toBe(false);
  });

  it("adds a last-round summary after max make steps", async () => {
    let toolCalls = 0;
    let streamCalls = 0;
    let lastRoundTools: number | undefined;
    const result = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "按这个做" }],
      maxSteps: 3,
      getMode: () => "real",
      stream: async (_messages, tools) => {
        streamCalls += 1;
        if (tools.length === 0) {
          lastRoundTools = tools.length;
          return {
            text: "做完了",
            stopped: false,
          };
        }
        return {
          text: "做",
          toolCalls: [
            { id: `call-${streamCalls}`, name: CANVAS_GET_STATE_TOOL, arguments: "" },
          ],
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
    expect(lastRoundTools).toBe(0);
    expect(splitSavedAssistantContent(result.content).talk).toBe("做\n做\n做\n做完了");
  });

  it("strips event lines from a natural stop", async () => {
    const result = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "做片头" }],
      stream: async () => ({
        text: "先改字号\n事件：片头\n结束：是",
        stopped: false,
      }),
      runTool: async () => {
        throw new Error("should not run a tool");
      },
      onAssistantContent: () => undefined,
    });
    expect(splitSavedAssistantContent(result.content).talk).toBe("先改字号");
    expect(result.eventTitle).toBe("片头");
    expect(result.eventEnded).toBe(true);
    expect(result.eventJudged).toBe(true);
  });

  it("feeds an empty tool name back without calling the tool", async () => {
    let toolCalls = 0;
    const payloads: string[] = [];
    await runAgentScheduler({
      historyMessages: [{ role: "user", content: "看一眼" }],
      maxSteps: 2,
      getMode: () => "draft",
      stream: async (messages) => {
        payloads.push(messages.at(-1)?.content ?? "");
        if (payloads.length === 1) {
          return {
            text: "",
            toolCalls: [{ id: "call-1", name: "", arguments: "" }],
            stopped: false,
          };
        }
        return {
          text: "缺工具名",
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

  it("continues from initial tool results as role tool", async () => {
    const lastRoles: string[] = [];
    const lastContents: string[] = [];
    await runAgentScheduler({
      historyMessages: [{ role: "user", content: "看画布" }],
      initialToolResults: ['{"nodes":[]}'],
      stream: async (messages) => {
        lastRoles.push(messages.at(-1)?.role ?? "");
        lastContents.push(messages.map((message) => message.content).join("\n"));
        return {
          text: "画布是空的",
          stopped: false,
        };
      },
      runTool: async () => {
        throw new Error("should not run another tool");
      },
      onAssistantContent: () => undefined,
    });
    expect(lastRoles[0]).toBe("tool");
    expect(lastContents[0]).toContain('{"nodes":[]}');
    expect(lastContents[0]).toContain("看画布");
    expect(lastContents[0]).not.toContain("工具 prior-1 结果");
  });

  it("strips saved markers from history before sending", async () => {
    const saved = composeSavedAnswer({
      thinking: "内部想",
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
    let seen = "";
    await runAgentScheduler({
      historyMessages: [
        { role: "user", content: "看画布" },
        { role: "assistant", content: saved },
      ],
      stream: async (messages) => {
        seen = messages.map((message) => message.content).join("\n");
        return { text: "继续", stopped: false };
      },
      runTool: async () => {
        throw new Error("should not run a tool");
      },
      onAssistantContent: () => undefined,
    });
    expect(seen).not.toContain("<<<THINK>>>");
    expect(seen).not.toContain("<<<EVENT>>>");
    expect(seen).toContain("画布是空的");
    expect(seen).toContain('{"nodes":[]}');
  });

  it("continues from a filled tool in history without appending another tool result", async () => {
    const saved = composeSavedAnswer({
      thinking: "",
      tools: [
        {
          id: "tool-0",
          name: ASK_QUESTION_TOOL,
          args: JSON.stringify({
            prompt: "选？",
            options: [{ id: "a", label: "甲" }],
          }),
          result: JSON.stringify({ selected: "a", label: "甲" }),
        },
      ],
      talk: "",
    });
    let toolMessages = 0;
    await runAgentScheduler({
      historyMessages: [
        { role: "user", content: "做视频" },
        { role: "assistant", content: saved },
      ],
      stream: async (messages) => {
        toolMessages = messages.filter((message) => message.role === "tool")
          .length;
        return { text: "好", stopped: false };
      },
      runTool: async () => {
        throw new Error("should not run a tool");
      },
      onAssistantContent: () => undefined,
    });
    expect(toolMessages).toBe(1);
  });

  it("attaches canvas inventory only after the canvas role is scheduled", async () => {
    let inventory = "画布清单：空";
    const seen: string[] = [];
    const toolLists: string[][] = [];
    await runAgentScheduler({
      historyMessages: [{ role: "user", content: "看" }],
      getCanvasInventory: () => inventory,
      stream: async (messages, tools) => {
        toolLists.push(tools.map((tool) => tool.function.name));
        seen.push(
          messages.find((message) => message.content.startsWith("画布清单"))
            ?.content ?? ""
        );
        if (seen.length === 1) {
          return {
            text: "",
            toolCalls: [
              {
                id: "sched-1",
                name: SCHEDULE_ROLE_TOOL,
                arguments: JSON.stringify({ role: "canvas" }),
              },
            ],
            stopped: false,
          };
        }
        inventory = "画布清单：\n新的";
        if (seen.length === 2) {
          return {
            text: "",
            toolCalls: [
              { id: "call-1", name: CANVAS_GET_STATE_TOOL, arguments: "" },
            ],
            stopped: false,
          };
        }
        return {
          text: "已更新",
          stopped: false,
        };
      },
      runTool: async () => '{"nodes":[]}',
      onAssistantContent: () => undefined,
    });
    expect(seen[0]).toBe("");
    expect(seen[1]).toBe("画布清单：空");
    expect(seen[2]).toContain("新的");
    expect(toolLists[0]).toEqual([READ_URL_TOOL, SCHEDULE_ROLE_TOOL, ASK_QUESTION_TOOL]);
    expect(toolLists[1]).toContain("canvas_get_state");
    expect(toolLists[1]).not.toContain(SIMPLE_ANIMATION_TOOL);
  });

  it("puts fresh canvas inventory on make tool results", async () => {
    let inventory = "画布清单：空";
    const seenToolResults: string[] = [];
    await runAgentScheduler({
      historyMessages: [{ role: "user", content: "做一张猫的图" }],
      getCanvasInventory: () => inventory,
      stream: async (messages) => {
        const tool = [...messages]
          .reverse()
          .find((message) => message.role === "tool");
        if (tool) {
          seenToolResults.push(tool.content);
        }
        if (seenToolResults.length === 0) {
          return {
            text: "先调度画布",
            toolCalls: [
              {
                id: "sched-1",
                name: SCHEDULE_ROLE_TOOL,
                arguments: JSON.stringify({ role: "canvas" }),
              },
            ],
            stopped: false,
          };
        }
        if (seenToolResults.length === 1) {
          return {
            text: "新建一条图片生成",
            toolCalls: [
              {
                id: "make-1",
                name: CANVAS_CREATE_GENERATION_FLOW_TOOL,
                arguments: JSON.stringify({
                  mode: "image",
                  prompt: "一只猫",
                }),
              },
            ],
            stopped: false,
          };
        }
        return { text: "已建一条图片生成", stopped: false };
      },
      runTool: async () => {
        inventory = '画布清单：\n{"nodes":[{"id":"ai-image-1"}]}';
        return JSON.stringify({ ok: true, nodeId: "ai-image-1" });
      },
      onAssistantContent: () => undefined,
    });
    expect(JSON.parse(seenToolResults[1] ?? "{}")).toEqual({
      ok: true,
      nodeId: "ai-image-1",
      canvasInventory: '画布清单：\n{"nodes":[{"id":"ai-image-1"}]}',
    });
  });

  it("schedules the animation role without giving canvas tools", async () => {
    const toolLists: string[][] = [];
    const identities: string[][] = [];
    const result = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "制作简易动画" }],
      stream: async (messages, tools) => {
        toolLists.push(tools.map((tool) => tool.function.name));
        identities.push(
          messages
            .filter((message) => message.role === "system")
            .map((message) => message.content)
        );
        if (toolLists.length === 1) {
          return {
            text: "先做简易视频",
            toolCalls: [
              {
                id: "sched-1",
                name: SCHEDULE_ROLE_TOOL,
                arguments: JSON.stringify({ role: "animation" }),
              },
            ],
            stopped: false,
          };
        }
        return {
          text: "开始写",
          stopped: false,
        };
      },
      runTool: async () => {
        throw new Error("schedule should not hit canvas tools");
      },
      onAssistantContent: () => undefined,
    });
    expect(toolLists[0]).toEqual([READ_URL_TOOL, SCHEDULE_ROLE_TOOL, ASK_QUESTION_TOOL]);
    expect(toolLists[1]).toContain(SIMPLE_ANIMATION_TOOL);
    expect(toolLists[1]).not.toContain("canvas_get_state");
    expect(identities[0]?.some((text) => text === AGENT_ANIMATION_IDENTITY)).toBe(
      false
    );
    expect(identities[1]?.some((text) => text === AGENT_ANIMATION_IDENTITY)).toBe(
      true
    );
    expect(identities[1]?.some((text) => text.includes("<canvas_skill>"))).toBe(
      true
    );
    expect(parseSavedAnswer(result.content).tools[0]?.result).toBe(
      JSON.stringify({ scheduled: "animation" })
    );
  });

  it("pauses on ask_question and reads list options", async () => {
    const jsonAsk = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "怎么办" }],
      getMode: () => "draft",
      stream: async () => ({
        text: "",
        toolCalls: [
          {
            id: "ask-1",
            name: ASK_QUESTION_TOOL,
            arguments: JSON.stringify({
              prompt: "选一条",
              options: [{ id: "a", label: "A" }],
            }),
          },
        ],
        stopped: false,
      }),
      runTool: async () => {
        throw new Error("ask_question should not hit canvas tools");
      },
      onAssistantContent: () => undefined,
    });
    expect(jsonAsk.pendingAsk).toEqual({
      prompt: "选一条",
      options: [{ id: "a", label: "A" }],
    });

    const listAsk = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "怎么办" }],
      getMode: () => "draft",
      stream: async () => ({
        text: "",
        toolCalls: [
          {
            id: "ask-2",
            name: ASK_QUESTION_TOOL,
            arguments: "你想做哪种？\n- 文字动画（标题）\n- 图片转动画",
          },
        ],
        stopped: false,
      }),
      runTool: async () => {
        throw new Error("ask_question should not hit canvas tools");
      },
      onAssistantContent: () => undefined,
    });
    expect(listAsk.pendingAsk).toEqual({
      prompt: "你想做哪种？",
      options: [
        { id: "opt-0", label: "文字动画" },
        { id: "opt-1", label: "图片转动画" },
      ],
    });
  });

  it("pauses on ask_question even when args are empty, using same-step content", async () => {
    let calls = 0;
    const fromTalk = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "做一段简易动画" }],
      getMode: () => "draft",
      stream: async () => {
        calls += 1;
        return {
          text: "你想做哪种？\n- 文字动画（标题）\n- 图片转动画",
          toolCalls: [{ id: "ask-1", name: ASK_QUESTION_TOOL, arguments: "" }],
          stopped: false,
        };
      },
      runTool: async () => {
        throw new Error("ask_question should not hit canvas tools");
      },
      onAssistantContent: () => undefined,
    });
    expect(calls).toBe(1);
    expect(fromTalk.pendingAsk).toEqual({
      prompt: "你想做哪种？",
      options: [
        { id: "opt-0", label: "文字动画" },
        { id: "opt-1", label: "图片转动画" },
      ],
    });

    calls = 0;
    const empty = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "做一段简易动画" }],
      getMode: () => "ask",
      stream: async () => {
        calls += 1;
        return {
          text: "",
          toolCalls: [{ id: "ask-2", name: ASK_QUESTION_TOOL, arguments: "" }],
          stopped: false,
        };
      },
      runTool: async () => {
        throw new Error("ask_question should not continue after invalid args");
      },
      onAssistantContent: () => undefined,
    });
    expect(calls).toBe(1);
    expect(empty.pendingAsk).toEqual({
      prompt: "请选择",
      options: [],
    });
  });

  it("does not apply enter_draft and keeps the same tools", async () => {
    const applied: string[] = [];
    const toolLists: string[][] = [];
    const result = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "改一下标题" }],
      getMode: () => "ask",
      applyMode: (next) => {
        applied.push(next);
      },
      stream: async (_messages, tools) => {
        toolLists.push(tools.map((tool) => tool.function.name));
        if (toolLists.length > 1) {
          return {
            text: "继续",
            stopped: false,
          };
        }
        return {
          text: "",
          toolCalls: [{ id: "enter-1", name: ENTER_DRAFT_TOOL, arguments: "" }],
          stopped: false,
        };
      },
      runTool: async () => {
        throw new Error("enter_draft is unused");
      },
      onAssistantContent: () => undefined,
    });
    expect(applied).toEqual([]);
    expect(toolLists[0]).not.toContain(ENTER_DRAFT_TOOL);
    expect(toolLists[1]).not.toContain(ENTER_DRAFT_TOOL);
    expect(parseSavedAnswer(result.content).tools.at(-1)?.result).toContain(
      "草案未启用"
    );
  });

  it("pauses make tools until the user confirms", async () => {
    let ran = false;
    const make = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "做一张猫的图" }],
      getMode: () => "ask",
      stream: async () => ({
        text: "写一段猫的文案",
        toolCalls: [
          {
            id: "write-1",
            name: "canvas_write_text",
            arguments: JSON.stringify({ nodeId: "n1", text: "hi" }),
          },
        ],
        stopped: false,
      }),
      runTool: async () => {
        ran = true;
        return JSON.stringify({ pendingConfirm: true });
      },
      onAssistantContent: () => undefined,
    });
    expect(ran).toBe(true);
    expect(make.pendingAnimationWrite).toBe(true);
    expect(parseSavedAnswer(make.content).talk).toBe("写一段猫的文案");
    expect(parseSavedAnswer(make.content).tools.at(-1)?.result).toBe("");
  });

  it("does not pause for confirm when the write has no talk", async () => {
    const skipped = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "做一张猫的图" }],
      getMode: () => "ask",
      stream: async () => ({
        text: "",
        toolCalls: [
          {
            id: "write-1",
            name: "canvas_write_text",
            arguments: JSON.stringify({ nodeId: "n1", text: "hi" }),
          },
        ],
        stopped: false,
      }),
      runTool: async () => JSON.stringify({ pendingConfirm: true }),
      onAssistantContent: () => undefined,
    });
    expect(skipped.pendingAnimationWrite).toBeUndefined();
    expect(parseSavedAnswer(skipped.content).tools.at(-1)?.result).toContain(
      EXECUTE_TALK_REQUIRED
    );
  });

  it("pauses on simple_animation write until the user confirms", async () => {
    let streamCalls = 0;
    let wrote = false;
    const paused = await runAgentScheduler({
      historyMessages: [{ role: "user", content: "改简易动画" }],
      getMode: () => "ask",
      stream: async () => {
        streamCalls += 1;
        return {
          text: "把片头改成淡入标题",
          toolCalls: [
            {
              id: "anim-1",
              name: SIMPLE_ANIMATION_TOOL,
              arguments: JSON.stringify({
                action: "write",
                source: "export const A = 1;",
              }),
            },
          ],
          stopped: false,
        };
      },
      runTool: async () => {
        wrote = true;
        return JSON.stringify({ pendingConfirm: true });
      },
      onAssistantContent: () => undefined,
    });
    expect(streamCalls).toBe(1);
    expect(wrote).toBe(true);
    expect(paused.pendingAnimationWrite).toBe(true);
    const savedWrite = parseSavedAnswer(paused.content).tools.at(-1);
    expect(savedWrite?.name).toBe(SIMPLE_ANIMATION_TOOL);
    expect(savedWrite?.args).toBe(
      JSON.stringify({
        action: "write",
        source: "export const A = 1;",
      })
    );
    expect(savedWrite?.result).toBe("");
    expect(
      unansweredAnimationWriteFromAnswer(parseSavedAnswer(paused.content))?.name
    ).toBe(SIMPLE_ANIMATION_TOOL);
  });

  it("only pauses for confirm after the agent says what it will do", () => {
    expect(canPauseForExecuteConfirm("")).toBe(false);
    expect(canPauseForExecuteConfirm("   ")).toBe(false);
    expect(canPauseForExecuteConfirm("写一段猫的文案")).toBe(true);
  });

  it("treats unanswered clear like a write waiting for confirm", () => {
    const args = JSON.stringify({ action: "clear" });
    expect(
      unansweredAnimationWriteFromAnswer({
        thinking: "",
        talk: "",
        tools: [
          {
            id: "clear-1",
            name: SIMPLE_ANIMATION_TOOL,
            args,
            result: "",
          },
        ],
      })?.args
    ).toBe(args);
  });
});
