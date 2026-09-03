import type { AgentChatMessage } from "@dafthunk/types";

import {
  type AgentToolCall,
  CANVAS_GET_STATE_TOOL,
  CANVAS_RESOLVE_RESOURCE_TOOL,
  CANVAS_RUN_NODE_TOOL,
  CANVAS_STAGE_MEDIA_TOOL,
  CANVAS_WRITE_TEXT_TOOL,
  emptyAgentToolCall,
  parseAgentToolCall,
  REMOTION_GET_TOOL,
  REMOTION_OPEN_TOOL,
  REMOTION_WRITE_TOOL,
} from "@/services/agent-canvas-state";
import type { AgentSessionMode } from "@/services/agent-session-mode";

export const AGENT_CHAT_MAX_PLAN_STEPS = 6;
export const AGENT_CHAT_MAX_MAKE_STEPS = 12;
export const AGENT_CHAT_MAX_MAIN_STEPS = AGENT_CHAT_MAX_PLAN_STEPS;

export const THINK_MARKER = "<<<THINK>>>" as const;
export const SIDE_MARKER = "<<<SIDE>>>" as const;
export const TALK_MARKER = "<<<TALK>>>" as const;

export const AGENT_PLAN_STATUS = "模式：方案" as const;
export const AGENT_EXECUTE_STATUS = "模式：执行" as const;

const CANVAS_READ_HINT = `${CANVAS_GET_STATE_TOOL}（当前画布清单，不含地址）；${CANVAS_RESOLVE_RESOURCE_TOOL}（下一行 resourceId: 某个资源，只用这个资源时才调用，向服务端要这一条地址）`;
const SIMPLE_ANIMATION_READ_HINT = `${REMOTION_GET_TOOL}（读当前简易动画源码）；${REMOTION_OPEN_TOOL}（打开简易动画窗口）`;
const MAKE_HINT = `${REMOTION_WRITE_TOOL}（下一行起整段替换简易动画源码）；${CANVAS_WRITE_TEXT_TOOL}（第一行 nodeId: 节点，其后为文本）；${CANVAS_RUN_NODE_TOOL}（nodeId: 运行该节点已有生成）；${CANVAS_STAGE_MEDIA_TOOL}（nodeId: 与 url: / mimeType: 挂媒体）`;

export function buildAgentMainInstruction(
  mode: AgentSessionMode = "agent"
): string {
  const thinkRule =
    "每次回复必须先写 <<<THINK>>> 再写思考正文，然后只选一个动作。先弄清要做成什么，写清要落地的内容。不要同时输出 SIDE 和 TALK。";
  if (mode === "agent") {
    return [
      `你是画布 Agent 的主对话。${AGENT_EXECUTE_STATUS}。按用户要的结果去做。不要问是否执行，不要声称做了没做的事。`,
      thinkRule,
      `<<<SIDE>>> 下一行写工具名。可读：${CANVAS_READ_HINT}；${SIMPLE_ANIMATION_READ_HINT}。可做：${MAKE_HINT}。`,
      "或 <<<TALK>>> 给用户看进度或结论。",
    ].join("\n");
  }
  return [
    `你是画布 Agent 的主对话。${AGENT_PLAN_STATUS}。只读，不要制作，不要声称已经改了。`,
    thinkRule,
    `<<<SIDE>>> 下一行写工具名。可用：${CANVAS_READ_HINT}；${SIMPLE_ANIMATION_READ_HINT}。不要调用制作工具。`,
    "或 <<<TALK>>> 只陈述要做成什么、要落地什么、准备怎么做。不要问是否执行、要不要做、能不能继续；确认由界面弹出。",
  ].join("\n");
}

export const AGENT_MAIN_INSTRUCTION = buildAgentMainInstruction("agent");

export interface AgentSchedulerMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface ParsedAgentSchedulerOutput {
  readonly thinking: string;
  readonly action: "side" | "talk";
  readonly toolCall: AgentToolCall;
  readonly talk: string;
}

export interface AgentSchedulerStreamResult {
  readonly text: string;
  readonly stopped: boolean;
}

export interface RunAgentSchedulerParams {
  readonly historyMessages: readonly AgentSchedulerMessage[];
  readonly maxSteps?: number;
  readonly isAborted?: () => boolean;
  readonly stream: (
    messages: readonly AgentSchedulerMessage[],
    onDelta: (fullText: string) => void
  ) => Promise<AgentSchedulerStreamResult>;
  readonly runTool: (call: AgentToolCall) => Promise<string>;
  readonly onTool?: (call: AgentToolCall) => void;
  readonly onAssistantContent: (content: string) => void;
  readonly getMode?: () => AgentSessionMode;
  readonly canvasInventory?: string;
  readonly planDocument?: string;
}

export interface RunAgentSchedulerResult {
  readonly content: string;
  readonly stopped: boolean;
}

export function parseAgentSchedulerOutput(
  text: string,
  options: { readonly complete?: boolean } = {}
): ParsedAgentSchedulerOutput {
  const complete = options.complete ?? true;
  const thinkAt = text.indexOf(THINK_MARKER);
  const sideAt = text.indexOf(SIDE_MARKER);
  const talkAt = text.indexOf(TALK_MARKER);

  if (thinkAt < 0 && sideAt < 0 && talkAt < 0) {
    return {
      thinking: "",
      action: "talk",
      toolCall: emptyAgentToolCall(),
      talk: text.trim(),
    };
  }

  const thinkEnd = nextMarkerIndex(text, thinkAt, sideAt, talkAt);
  const thinking =
    thinkAt >= 0
      ? text.slice(thinkAt + THINK_MARKER.length, thinkEnd).trim()
      : "";

  if (sideAt >= 0) {
    const sideEnd = talkAt > sideAt ? talkAt : text.length;
    const sideBody = text.slice(sideAt + SIDE_MARKER.length, sideEnd).trim();
    const parsedSide = parseAgentToolCall(sideBody);
    return {
      thinking,
      action: "side",
      toolCall: parsedSide,
      talk: "",
    };
  }

  if (talkAt >= 0) {
    return {
      thinking,
      action: "talk",
      toolCall: emptyAgentToolCall(),
      talk: text.slice(talkAt + TALK_MARKER.length).trim(),
    };
  }

  return {
    thinking,
    action: "talk",
    toolCall: emptyAgentToolCall(),
    talk: complete ? thinking : "",
  };
}

export function composeSavedAssistantContent(
  thinking: string,
  talk: string
): string {
  const think = thinking.trim();
  const reply = talk.trim();
  if (!think && !reply) {
    return "";
  }
  if (!think) {
    return reply;
  }
  if (!reply) {
    return `${THINK_MARKER}\n${think}`;
  }
  return `${THINK_MARKER}\n${think}\n${TALK_MARKER}\n${reply}`;
}

export function splitSavedAssistantContent(
  content: string,
  options: { readonly complete?: boolean } = {}
): {
  readonly thinking: string;
  readonly talk: string;
} {
  const parsed = parseAgentSchedulerOutput(content, options);
  return {
    thinking: parsed.thinking,
    talk: parsed.talk,
  };
}

export function buildMainSchedulerMessages(
  history: readonly AgentSchedulerMessage[],
  sideResults: readonly string[],
  options: {
    readonly mode?: AgentSessionMode;
    readonly canvasInventory?: string;
    readonly planDocument?: string;
  } = {}
): readonly AgentSchedulerMessage[] {
  const prefix: AgentSchedulerMessage[] = [
    {
      role: "user",
      content: buildAgentMainInstruction(options.mode ?? "agent"),
    },
  ];
  if (options.canvasInventory) {
    prefix.push({
      role: "user",
      content: options.canvasInventory,
    });
  }
  if (options.planDocument) {
    prefix.push({
      role: "user",
      content: `当前方案：\n${options.planDocument}`,
    });
  }
  return [
    ...prefix,
    ...history,
    ...sideResults.map((result, index) => ({
      role: "user" as const,
      content: `旁路结果 ${index + 1}：\n${result}`,
    })),
  ];
}

export async function runAgentScheduler(
  params: RunAgentSchedulerParams
): Promise<RunAgentSchedulerResult> {
  const mode = params.getMode?.() ?? "agent";
  const maxSteps =
    params.maxSteps ??
    (mode === "agent" ? AGENT_CHAT_MAX_MAKE_STEPS : AGENT_CHAT_MAX_PLAN_STEPS);
  const sideResults: string[] = [];
  let lastThinking = "";
  let stopped = false;

  const aborted = (): boolean => Boolean(params.isAborted?.());

  const publish = (thinking: string, talk: string): string => {
    const content = composeSavedAssistantContent(thinking, talk);
    params.onAssistantContent(content);
    return content;
  };

  const currentMode = (): AgentSessionMode => params.getMode?.() ?? mode;

  for (let step = 0; step < maxSteps; step += 1) {
    if (aborted()) {
      return { content: publish(lastThinking, ""), stopped: true };
    }

    const mainMessages = buildMainSchedulerMessages(
      params.historyMessages,
      sideResults,
      {
        mode: currentMode(),
        canvasInventory: params.canvasInventory,
        planDocument: params.planDocument,
      }
    );
    const mainResult = await params.stream(mainMessages, (fullText) => {
      const parsed = parseAgentSchedulerOutput(fullText, { complete: false });
      publish(parsed.thinking, parsed.action === "talk" ? parsed.talk : "");
    });
    stopped = mainResult.stopped;
    const parsed = parseAgentSchedulerOutput(mainResult.text, {
      complete: true,
    });
    lastThinking = parsed.thinking;

    if (stopped || aborted()) {
      return {
        content: publish(
          parsed.thinking,
          parsed.action === "talk" ? parsed.talk : parsed.thinking
        ),
        stopped: true,
      };
    }

    if (parsed.action === "talk") {
      return {
        content: publish(parsed.thinking, parsed.talk),
        stopped: false,
      };
    }

    const isLastMainStep = step === maxSteps - 1;
    if (isLastMainStep && currentMode() !== "agent") {
      return {
        content: publish(parsed.thinking, parsed.thinking),
        stopped: false,
      };
    }

    publish(parsed.thinking, "");
    params.onTool?.(parsed.toolCall);
    const sideResult = await params.runTool(parsed.toolCall);
    if (aborted()) {
      return {
        content: publish(parsed.thinking, parsed.thinking),
        stopped: true,
      };
    }
    if (isLastMainStep) {
      return {
        content: publish(parsed.thinking, parsed.thinking),
        stopped: false,
      };
    }
    sideResults.push(sideResult);
  }

  return { content: publish(lastThinking, lastThinking), stopped };
}

export function schedulerMessagesToChat(
  messages: readonly AgentSchedulerMessage[]
): readonly AgentChatMessage[] {
  return messages.map((message, index) => ({
    id: `scheduler-${index}`,
    role: message.role,
    content: message.content,
  }));
}

function nextMarkerIndex(
  text: string,
  thinkAt: number,
  sideAt: number,
  talkAt: number
): number {
  const start = thinkAt >= 0 ? thinkAt + THINK_MARKER.length : 0;
  const candidates = [sideAt, talkAt].filter((index) => index >= start);
  if (candidates.length === 0) {
    return text.length;
  }
  return Math.min(...candidates);
}
