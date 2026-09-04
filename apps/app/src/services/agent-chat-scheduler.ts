import type { AgentChatAnswer, AgentChatToolCall } from "@dafthunk/types";
import { emptyAgentChatAnswer } from "@dafthunk/types";

import {
  type AgentToolCall,
  emptyAgentToolCall,
  parseAgentToolCall,
} from "@/services/agent-canvas-state";
import {
  ASK_QUESTION_TOOL,
  SWITCH_MODE_TOOL,
  describeCapabilityBoundary,
  formatInformToolList,
  thinkingHasAskAudit,
  toolsForInform,
} from "@/services/agent-capabilities";
import {
  type AgentSessionMode,
  formatSwitchModeArgs,
  isAllowedModeSwitch,
  parseSwitchModeTarget,
} from "@/services/agent-session-mode";

export const AGENT_CHAT_MAX_PLAN_STEPS = 6;
export const AGENT_CHAT_MAX_MAKE_STEPS = 12;

const EMPTY_TOOL_RESULT = JSON.stringify({ error: "缺少工具名" });

export const THINK_MARKER = "<<<THINK>>>" as const;
export const SIDE_MARKER = "<<<SIDE>>>" as const;
export const TALK_MARKER = "<<<TALK>>>" as const;
export const EVENT_MARKER = "<<<EVENT>>>" as const;
export const EXEC_MARKER = "<<<EXEC>>>" as const;
export const NOTE_MARKER = "<<<NOTE>>>" as const;

export const AGENT_ASK_STATUS = "模式：问答" as const;
export const AGENT_PLAN_STATUS = "模式：方案" as const;
export const AGENT_EXECUTE_STATUS = "模式：执行" as const;

const AGENT_OUTPUT_FORMAT =
  "每次先 <<<THINK>>>。然后可以 <<<SIDE>>>（下一行工具名，其后为参数）和/或 <<<TALK>>>（给用户的话）。思考、工具、发言分开，不要把工具结果写进 TALK。";

const SWITCH_MODE_FORMAT =
  "需要切换时只许 <<<SIDE>>> 下一行 switch_mode，其后两行 from: 当前模式 与 to: 目标（ask、plan、agent）。不要用自然语言说要切模式。";

export function buildModeSystemReminder(mode: AgentSessionMode): string {
  if (mode === "ask") {
    return [
      "系统提醒：仍在问答。只回答，不改画布。",
      "可切执行（to: agent）：有具体事件要做，不是想法确认，意思不模糊。",
      "可切方案（to: plan）：来信在提方案，且预计正文超过 500 字。",
      SWITCH_MODE_FORMAT,
      formatSwitchModeArgs({ from: "ask", to: "plan" }),
    ].join("\n");
  }
  if (mode === "plan") {
    return [
      "系统提醒：方案仍有效。只出方案，不执行，等用户确认。",
      "可切执行（to: agent）：被要求执行，或上文问过要不要做且已被确认。",
      SWITCH_MODE_FORMAT,
      formatSwitchModeArgs({ from: "plan", to: "agent" }),
    ].join("\n");
  }
  return [
    "系统提醒：按已确认方案去做，不要问是否执行。",
    "可切方案（to: plan）：来信在提方案，且预计正文超过 500 字。",
    "可切问答（to: ask）：这件事做完了，话题已和执行无关。",
    SWITCH_MODE_FORMAT,
    formatSwitchModeArgs({ from: "agent", to: "ask" }),
  ].join("\n");
}

export function buildAgentMainInstruction(
  mode: AgentSessionMode = "agent"
): string {
  const tools = formatInformToolList(mode);
  if (mode === "ask") {
    return [
      `你是画布 Agent。${AGENT_ASK_STATUS}。`,
      describeCapabilityBoundary("ask"),
      AGENT_OUTPUT_FORMAT,
      `SIDE 只许 ${tools}。不要读写画布。`,
      "TALK 直接回答。",
    ].join("\n");
  }
  if (mode === "plan") {
    const readTools = toolsForInform("plan")
      .map((tool) => tool.name)
      .join("、");
    return [
      `你是画布 Agent。${AGENT_PLAN_STATUS}。`,
      describeCapabilityBoundary("plan"),
      AGENT_OUTPUT_FORMAT,
      `SIDE 可用：${readTools}。不要调用制作工具。`,
      "TALK 写短方案：要达成什么、改哪里。短句、少条目。不写步骤拆解、术语、编造的数量或耗时。不要执行。",
    ].join("\n");
  }
  return [
    `你是画布 Agent。${AGENT_EXECUTE_STATUS}。按用户要的结果去做。不要问是否执行，不要声称做了没做的事。`,
    describeCapabilityBoundary("agent"),
    AGENT_OUTPUT_FORMAT,
    `SIDE 可用：${tools}。`,
    "TALK 给用户看进度或结论。",
  ].join("\n");
}

export function buildAgentPlanInstruction(): string {
  return buildAgentMainInstruction("plan");
}

export const AGENT_MAIN_INSTRUCTION = buildAgentMainInstruction("agent");

export interface AgentAskQuestion {
  readonly prompt: string;
  readonly options: readonly {
    readonly id: string;
    readonly label: string;
  }[];
}

export interface AgentSchedulerMessage {
  readonly role: "user" | "assistant" | "system";
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
  readonly applyMode?: (mode: AgentSessionMode) => void;
  readonly onAssistantContent: (content: string) => void;
  readonly getMode?: () => AgentSessionMode;
  readonly getCanvasInventory?: () => string;
  readonly canvasInventory?: string;
  readonly planDocument?: string;
  readonly initialSideResults?: readonly string[];
  readonly initialAnswer?: AgentChatAnswer;
}

export interface AgentPendingSwitch {
  readonly from: AgentSessionMode;
  readonly to: AgentSessionMode;
}

export interface RunAgentSchedulerResult {
  readonly content: string;
  readonly stopped: boolean;
  readonly pendingAsk?: AgentAskQuestion;
  readonly pendingSwitch?: AgentPendingSwitch;
}

export function parseAskQuestionArgs(
  payload: string
): AgentAskQuestion | undefined {
  try {
    const parsed: unknown = JSON.parse(payload.trim());
    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }
    const record = parsed as {
      readonly prompt?: unknown;
      readonly options?: unknown;
    };
    const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
    if (!prompt || !Array.isArray(record.options)) {
      return undefined;
    }
    const options: { id: string; label: string }[] = [];
    for (const [index, option] of record.options.entries()) {
      if (!option || typeof option !== "object") {
        continue;
      }
      const row = option as { readonly id?: unknown; readonly label?: unknown };
      const label = typeof row.label === "string" ? row.label.trim() : "";
      if (!label) {
        continue;
      }
      const id =
        typeof row.id === "string" && row.id.trim()
          ? row.id.trim()
          : `opt-${index}`;
      options.push({ id, label });
    }
    if (options.length === 0) {
      return undefined;
    }
    return { prompt, options };
  } catch {
    return undefined;
  }
}

export function parseAgentSchedulerOutput(
  text: string,
  _options: { readonly complete?: boolean } = {}
): ParsedAgentSchedulerOutput {
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
  const talk =
    talkAt >= 0 ? text.slice(talkAt + TALK_MARKER.length).trim() : "";

  if (sideAt >= 0) {
    const sideEnd = talkAt > sideAt ? talkAt : text.length;
    const sideBody = text.slice(sideAt + SIDE_MARKER.length, sideEnd).trim();
    return {
      thinking,
      action: "side",
      toolCall: parseAgentToolCall(sideBody),
      talk,
    };
  }

  return {
    thinking,
    action: "talk",
    toolCall: emptyAgentToolCall(),
    talk,
  };
}

export function composeSavedAssistantContent(
  thinking: string,
  talk: string
): string {
  return composeSavedAnswer({
    thinking,
    tools: [],
    talk,
  });
}

export function composeSavedAnswer(answer: AgentChatAnswer): string {
  const parts: string[] = [];
  if (answer.thinking.trim()) {
    parts.push(`${THINK_MARKER}\n${answer.thinking.trim()}`);
  }
  for (const tool of answer.tools) {
    const body: string[] = [`${EXEC_MARKER}\n${tool.name}`];
    if (tool.args.trim()) {
      body.push(tool.args.trim());
    }
    if (tool.result.trim()) {
      body.push(`${NOTE_MARKER}\n${tool.result.trim()}`);
    }
    parts.push(`${EVENT_MARKER}\n${body.join("\n")}`);
  }
  if (answer.talk.trim()) {
    parts.push(`${TALK_MARKER}\n${answer.talk.trim()}`);
  }
  return parts.join("\n");
}

export function parseSavedAnswer(
  content: string,
  options: { readonly complete?: boolean } = {}
): AgentChatAnswer {
  if (
    content.includes(EVENT_MARKER) ||
    content.includes(EXEC_MARKER) ||
    content.includes(NOTE_MARKER)
  ) {
    return parseStructuredAnswer(content);
  }
  const parsed = parseAgentSchedulerOutput(content, options);
  const tools: AgentChatToolCall[] = [];
  if (parsed.action === "side" && parsed.toolCall.name.trim()) {
    tools.push({
      id: "live-0",
      name: parsed.toolCall.name.trim(),
      args: parsed.toolCall.payload,
      result: "",
    });
  }
  return {
    thinking: parsed.thinking,
    tools,
    talk: parsed.talk,
  };
}

function parseStructuredAnswer(content: string): AgentChatAnswer {
  const talkAt = content.indexOf(TALK_MARKER);
  const talk =
    talkAt >= 0 ? content.slice(talkAt + TALK_MARKER.length).trim() : "";
  const eventsPart = talkAt >= 0 ? content.slice(0, talkAt) : content;
  const thinkAt = eventsPart.indexOf(THINK_MARKER);
  const firstEvent = eventsPart.indexOf(EVENT_MARKER);
  const thinking =
    thinkAt >= 0
      ? eventsPart
          .slice(
            thinkAt + THINK_MARKER.length,
            firstEvent > thinkAt ? firstEvent : eventsPart.length
          )
          .trim()
      : "";
  const tools = eventsPart
    .split(EVENT_MARKER)
    .slice(1)
    .map((chunk, index) => parseToolChunk(chunk, index))
    .filter((tool) => tool.name.trim().length > 0 || tool.result.trim().length > 0);
  return { thinking, tools, talk };
}

function parseToolChunk(chunk: string, index: number): AgentChatToolCall {
  const text = chunk.trim();
  const execAt = text.indexOf(EXEC_MARKER);
  const noteAt = text.indexOf(NOTE_MARKER);
  const execBody = sliceMarkerBody(text, execAt, EXEC_MARKER, [noteAt]);
  const newlineAt = execBody.indexOf("\n");
  const name =
    newlineAt < 0 ? execBody.trim() : execBody.slice(0, newlineAt).trim();
  const args = newlineAt < 0 ? "" : execBody.slice(newlineAt + 1).trim();
  return {
    id: `tool-${index}`,
    name,
    args,
    result: sliceMarkerBody(text, noteAt, NOTE_MARKER, []),
  };
}

function sliceMarkerBody(
  text: string,
  at: number,
  marker: string,
  nextAts: readonly number[]
): string {
  if (at < 0) {
    return "";
  }
  const start = at + marker.length;
  const ends = nextAts.filter((index) => index > at);
  const end = ends.length > 0 ? Math.min(...ends) : text.length;
  return text.slice(start, end).trim();
}

export function splitSavedAssistantContent(
  content: string,
  options: { readonly complete?: boolean } = {}
): {
  readonly thinking: string;
  readonly talk: string;
} {
  const answer = parseSavedAnswer(content, options);
  return { thinking: answer.thinking, talk: answer.talk };
}

export function answerToHistoryContent(content: string): string {
  const answer = parseSavedAnswer(content);
  return composeSavedAssistantContent(answer.thinking, answer.talk);
}

export function buildMainSchedulerMessages(
  history: readonly AgentSchedulerMessage[],
  sideResults: readonly (
    | string
    | { readonly name: string; readonly result: string }
  )[],
  options: {
    readonly mode?: AgentSessionMode;
    readonly canvasInventory?: string;
    readonly planDocument?: string;
  } = {}
): readonly AgentSchedulerMessage[] {
  const prefix: AgentSchedulerMessage[] = [
    {
      role: "system",
      content: buildAgentMainInstruction(options.mode ?? "agent"),
    },
  ];
  if (options.canvasInventory) {
    prefix.push({
      role: "system",
      content: options.canvasInventory,
    });
  }
  if (options.planDocument) {
    prefix.push({
      role: "system",
      content: `当前方案：\n${options.planDocument}`,
    });
  }
  prefix.push({
    role: "system",
    content: buildModeSystemReminder(options.mode ?? "agent"),
  });
  const results = sideResults.map((result, index) =>
    typeof result === "string"
      ? { name: `tool-${index + 1}`, result }
      : result
  );
  return [
    ...prefix,
    ...history,
    ...results.map((result) => ({
      role: "system" as const,
      content: `工具 ${result.name} 结果：\n${result.result}`,
    })),
  ];
}

export function mergeLiveSchedulerAnswer(
  seed: AgentChatAnswer,
  parsed: ParsedAgentSchedulerOutput
): AgentChatAnswer {
  return liveAnswerFromParse(seed, parsed);
}

function liveAnswerFromParse(
  seed: AgentChatAnswer,
  parsed: ParsedAgentSchedulerOutput
): AgentChatAnswer {
  const tools = [...seed.tools];
  if (parsed.action === "side" && parsed.toolCall.name.trim()) {
    const last = tools[tools.length - 1];
    const nextTool: AgentChatToolCall = {
      id: last && !last.result.trim() ? last.id : `live-${tools.length}`,
      name: parsed.toolCall.name.trim(),
      args: parsed.toolCall.payload,
      result: last && !last.result.trim() ? last.result : "",
    };
    if (last && !last.result.trim()) {
      tools[tools.length - 1] = nextTool;
    } else {
      tools.push(nextTool);
    }
  }
  return {
    thinking: parsed.thinking || seed.thinking,
    tools,
    talk: parsed.talk || seed.talk,
  };
}

export async function runAgentScheduler(
  params: RunAgentSchedulerParams
): Promise<RunAgentSchedulerResult> {
  const mode = params.getMode?.() ?? "agent";
  const maxSteps =
    params.maxSteps ??
    (mode === "ask"
      ? AGENT_CHAT_MAX_PLAN_STEPS
      : mode === "agent"
        ? AGENT_CHAT_MAX_MAKE_STEPS
        : AGENT_CHAT_MAX_PLAN_STEPS);
  const sideResults: { name: string; result: string }[] = (
    params.initialSideResults ?? []
  ).map((result, index) => ({ name: `prior-${index + 1}`, result }));
  let answer: AgentChatAnswer = params.initialAnswer ?? emptyAgentChatAnswer();
  let lastThinking = answer.thinking;

  const aborted = (): boolean => Boolean(params.isAborted?.());

  const publish = (): string => {
    const content = composeSavedAnswer(answer);
    params.onAssistantContent(content);
    return content;
  };

  const currentMode = (): AgentSessionMode => params.getMode?.() ?? mode;

  const canvasInventory = (): string | undefined =>
    params.getCanvasInventory?.() ?? params.canvasInventory;

  const streamStep = async (): Promise<{
    readonly parsed: ParsedAgentSchedulerOutput;
    readonly stopped: boolean;
  }> => {
    const mainMessages = buildMainSchedulerMessages(
      params.historyMessages,
      sideResults,
      {
        mode: currentMode(),
        canvasInventory: canvasInventory(),
        planDocument: params.planDocument,
      }
    );
    const mainResult = await params.stream(mainMessages, (fullText) => {
      const parsed = parseAgentSchedulerOutput(fullText, { complete: false });
      params.onAssistantContent(
        composeSavedAnswer(liveAnswerFromParse(answer, parsed))
      );
    });
    return {
      parsed: parseAgentSchedulerOutput(mainResult.text, { complete: true }),
      stopped: mainResult.stopped,
    };
  };

  const runSide = async (
    parsed: ParsedAgentSchedulerOutput
  ): Promise<RunAgentSchedulerResult | undefined> => {
    const toolName = parsed.toolCall.name.trim();
    const tool: AgentChatToolCall = {
      id: `tool-${answer.tools.length}`,
      name: toolName,
      args: parsed.toolCall.payload,
      result: "",
    };
    answer = {
      thinking: parsed.thinking || answer.thinking,
      tools: [...answer.tools, tool],
      talk: parsed.talk || answer.talk,
    };
    publish();
    if (!toolName) {
      const result = EMPTY_TOOL_RESULT;
      sideResults.push({ name: "", result });
      answer = {
        ...answer,
        tools: [
          ...answer.tools.slice(0, -1),
          { ...tool, result },
        ],
      };
      publish();
      return undefined;
    }
    if (
      toolName === ASK_QUESTION_TOOL &&
      currentMode() !== "ask" &&
      !thinkingHasAskAudit(parsed.thinking)
    ) {
      const result = JSON.stringify({ error: "提问前缺少必要性审计" });
      sideResults.push({ name: toolName, result });
      answer = {
        ...answer,
        tools: [...answer.tools.slice(0, -1), { ...tool, result }],
      };
      publish();
      return undefined;
    }
    params.onTool?.(parsed.toolCall);
    if (toolName === ASK_QUESTION_TOOL) {
      const pendingAsk = parseAskQuestionArgs(parsed.toolCall.payload);
      if (!pendingAsk) {
        const result = JSON.stringify({ error: "提问格式无效" });
        sideResults.push({ name: toolName, result });
        answer = {
          ...answer,
          tools: [...answer.tools.slice(0, -1), { ...tool, result }],
        };
        publish();
        return undefined;
      }
      return { content: publish(), stopped: false, pendingAsk };
    }
    if (toolName === SWITCH_MODE_TOOL) {
      const parsedSwitch = parseSwitchModeTarget(parsed.toolCall.payload);
      const from = currentMode();
      if (
        !parsedSwitch ||
        parsedSwitch.from !== from ||
        !isAllowedModeSwitch(parsedSwitch.from, parsedSwitch.to)
      ) {
        const result = JSON.stringify({ error: "无效模式" });
        sideResults.push({ name: toolName, result });
        answer = {
          ...answer,
          tools: [...answer.tools.slice(0, -1), { ...tool, result }],
        };
        publish();
        return undefined;
      }
      if (parsedSwitch.from === "plan" && parsedSwitch.to === "agent") {
        return {
          content: publish(),
          stopped: false,
          pendingSwitch: {
            from: parsedSwitch.from,
            to: parsedSwitch.to,
          },
        };
      }
      params.applyMode?.(parsedSwitch.to);
      const result = JSON.stringify({ ok: true, mode: parsedSwitch.to });
      sideResults.push({ name: toolName, result });
      answer = {
        ...answer,
        tools: [...answer.tools.slice(0, -1), { ...tool, result }],
      };
      publish();
      return undefined;
    }
    const sideResult = await params.runTool(parsed.toolCall);
    if (aborted()) {
      return { content: publish(), stopped: true };
    }
    sideResults.push({ name: toolName, result: sideResult });
    answer = {
      ...answer,
      tools: [...answer.tools.slice(0, -1), { ...tool, result: sideResult }],
    };
    publish();
    return undefined;
  };

  for (let step = 0; step < maxSteps; step += 1) {
    if (aborted()) {
      if (lastThinking && !answer.thinking.trim()) {
        answer = { ...answer, thinking: lastThinking };
      }
      return { content: publish(), stopped: true };
    }

    const mainResult = await streamStep();
    const parsed = mainResult.parsed;
    lastThinking = parsed.thinking;

    if (mainResult.stopped || aborted()) {
      answer = liveAnswerFromParse(answer, parsed);
      return { content: publish(), stopped: true };
    }

    if (parsed.action === "talk") {
      answer = {
        thinking: parsed.thinking || answer.thinking,
        tools: answer.tools,
        talk: parsed.talk,
      };
      return { content: publish(), stopped: false };
    }

    const paused = await runSide(parsed);
    if (paused) {
      return paused;
    }
    if (aborted()) {
      return { content: publish(), stopped: true };
    }

    const isLastMainStep = step === maxSteps - 1;
    if (!isLastMainStep) {
      continue;
    }

    const talkResult = await streamStep();
    lastThinking = talkResult.parsed.thinking;
    answer = liveAnswerFromParse(answer, talkResult.parsed);
    if (talkResult.parsed.action === "talk" || talkResult.parsed.talk) {
      answer = { ...answer, talk: talkResult.parsed.talk || answer.talk };
    }
    return {
      content: publish(),
      stopped: talkResult.stopped || aborted(),
    };
  }

  if (lastThinking && !answer.thinking.trim()) {
    answer = { ...answer, thinking: lastThinking };
  }
  return { content: publish(), stopped: false };
}

export function schedulerMessagesToChat(
  messages: readonly AgentSchedulerMessage[]
): readonly {
  readonly id: string;
  readonly role: "user" | "assistant" | "system";
  readonly content: string;
}[] {
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
