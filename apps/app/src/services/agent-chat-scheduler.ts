import type {
  AgentChatAnswer,
  AgentChatBlock,
  AgentChatToolCall,
} from "@dafthunk/types";
import {
  answerBlocks,
  answerFromBlocks,
  appendAnswerTool,
  emptyAgentChatAnswer,
  replaceLastAnswerTool,
  withAnswerStep,
} from "@dafthunk/types";

import {
  type AgentToolCall,
  attachMakeToolInventory,
  isPendingAnimationConfirm,
  toolCallFromFunctionArgs,
} from "@/services/agent-canvas-state";
import {
  AGENT_BASE_IDENTITY,
  AGENT_CANVAS_IDENTITY,
  agentRoleIdentities,
  ASK_QUESTION_TOOL,
  ENTER_DRAFT_TOOL,
  isMakeTool,
  parseScheduledRole,
  SCHEDULE_ROLE_TOOL,
  SIMPLE_ANIMATION_TOOL,
  type AgentRequestTool,
  type AgentRoleOptions,
  toolsForRequest,
} from "@/services/agent-capabilities";
import {
  AGENT_REMOTION_SKILL,
  wrapAgentRemotionSkill,
} from "@/services/agent-remotion-skill";
import { type AgentSessionMode } from "@/services/agent-session-mode";

export const AGENT_CHAT_MAX_PLAN_STEPS = 6;
export const AGENT_CHAT_MAX_MAKE_STEPS = 12;

const EMPTY_TOOL_RESULT = JSON.stringify({ error: "缺少工具名" });

export const THINK_MARKER = "<<<THINK>>>" as const;
export const TALK_MARKER = "<<<TALK>>>" as const;
export const EVENT_MARKER = "<<<EVENT>>>" as const;
export const EXEC_MARKER = "<<<EXEC>>>" as const;
export const NOTE_MARKER = "<<<NOTE>>>" as const;

export const AGENT_CITE_FORMAT = `You MUST use the following format when citing code regions or blocks:

\`\`\`startLine:endLine:filepath
// ... existing code ...
\`\`\`

This is the ONLY acceptable format for code citations. The format is \`\`\`startLine:endLine:filepath where startLine and endLine are line numbers.`;

export const AGENT_IDENTITY = AGENT_BASE_IDENTITY;

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatAgentToday(date: Date = new Date()): string {
  return `${WEEKDAYS[date.getDay()]} ${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function buildAgentIdentity(): string {
  return AGENT_IDENTITY;
}

export function buildCanvasRoleIdentity(): string {
  return AGENT_CANVAS_IDENTITY;
}

export function buildAgentMainInstruction(
  _mode: AgentSessionMode = "ask"
): string {
  return AGENT_IDENTITY;
}

export const AGENT_MAIN_INSTRUCTION = AGENT_IDENTITY;

export const EXECUTE_TALK_REQUIRED = "先说明要做什么，再调用" as const;

export function buildModeSystemReminder(_mode: AgentSessionMode = "ask"): string {
  return AGENT_BASE_IDENTITY;
}

export function canPauseForExecuteConfirm(talk: string): boolean {
  return talk.trim().length > 0;
}

export interface AgentEventJudgment {
  readonly title?: string;
  readonly ended?: boolean;
  readonly judged: boolean;
  readonly talk: string;
}

export interface AgentPreviousEvent {
  readonly title: string;
  readonly ended: boolean;
}

export const EVENT_JUDGMENT_REMINDER =
  "若是一件要跨多轮的连续事，最后两行写：事件：短标题\n结束：是 或 结束：否。不是这种事就写：事件：无" as const;

export const LAST_ROUND_REMINDER =
  "这是最后一轮。不要调工具。做总结。若是一件要跨多轮的连续事，最后两行写：事件：短标题\n结束：是 或 结束：否。不是这种事就写：事件：无" as const;

export function buildEventFollowupReminder(event: AgentPreviousEvent): string {
  const state = event.ended ? "已结束" : "未结束";
  const title = event.title.trim() || "未命名";
  return `上一轮事件「${title}」判断为${state}。判断用户现在是继续这件事，还是已经结束。最后两行写：事件：短标题\n结束：是 或 结束：否。`;
}

const EVENT_TITLE_LINE = /^事件\s*[:：]\s*(.+)$/;
const EVENT_ENDED_LINE = /^结束\s*[:：]\s*(.+)$/;

function readEndedFlag(value: string): boolean | undefined {
  const text = value.trim();
  if (!text || text === "无") {
    return undefined;
  }
  if (/^(是|结束|已结束)$/.test(text)) {
    return true;
  }
  if (/^(否|未结束|继续)$/.test(text)) {
    return false;
  }
  return undefined;
}

export function parseEventJudgment(talk: string): AgentEventJudgment {
  const kept: string[] = [];
  let title: string | undefined;
  let ended: boolean | undefined;
  let judged = false;
  for (const line of talk.split("\n")) {
    const titleMatch = line.trim().match(EVENT_TITLE_LINE);
    if (titleMatch?.[1]) {
      const value = titleMatch[1].trim();
      title = value === "无" ? undefined : value || undefined;
      judged = true;
      continue;
    }
    const endedMatch = line.trim().match(EVENT_ENDED_LINE);
    if (endedMatch?.[1]) {
      ended = readEndedFlag(endedMatch[1]);
      judged = true;
      continue;
    }
    kept.push(line);
  }
  if (!title) {
    ended = undefined;
  }
  return {
    title,
    ended,
    judged,
    talk: kept.join("\n").trim(),
  };
}

export function wrapUserQuery(text: string): string {
  if (text.includes("<user_query>")) {
    return text;
  }
  return `<user_query>\n${text}\n</user_query>`;
}

export function buildUserInfoMessage(params: {
  readonly locale: string;
  readonly now?: Date;
}): string {
  return `<user_info>\nToday's date: ${formatAgentToday(params.now)}\nLocale: ${params.locale}\n</user_info>`;
}

export interface AgentAskQuestion {
  readonly prompt: string;
  readonly options: readonly {
    readonly id: string;
    readonly label: string;
  }[];
}

export interface AgentSchedulerToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: string;
}

export interface AgentSchedulerMessage {
  readonly role: "user" | "assistant" | "system" | "tool";
  readonly content: string;
  readonly toolCallId?: string;
  readonly toolCalls?: readonly AgentSchedulerToolCall[];
}

export interface ParsedAgentSchedulerOutput {
  readonly thinking: string;
  readonly talk: string;
}

export interface AgentSchedulerStreamResult {
  readonly text: string;
  readonly thinking?: string;
  readonly toolCalls?: readonly AgentSchedulerToolCall[];
  readonly stopped: boolean;
}

export interface RunAgentSchedulerParams {
  readonly historyMessages: readonly AgentSchedulerMessage[];
  readonly maxSteps?: number;
  readonly isAborted?: () => boolean;
  readonly stream: (
    messages: readonly AgentSchedulerMessage[],
    tools: readonly AgentRequestTool[],
    onDelta: (fullText: string, fullThinking?: string) => void
  ) => Promise<AgentSchedulerStreamResult>;
  readonly runTool: (call: AgentToolCall) => Promise<string>;
  readonly onTool?: (call: AgentToolCall) => void;
  readonly applyMode?: (mode: AgentSessionMode) => void;
  readonly onAssistantContent: (content: string) => void;
  readonly getMode?: () => AgentSessionMode;
  readonly getCanvasInventory?: () => string;
  readonly canvasInventory?: string;
  readonly planDocument?: string;
  readonly draftSourceCode?: string;
  readonly previousEvent?: AgentPreviousEvent;
  readonly locale?: string;
  readonly now?: Date;
  readonly initialToolResults?: readonly string[];
  readonly initialAnswer?: AgentChatAnswer;
  readonly pendingToolCalls?: readonly AgentSchedulerToolCall[];
}

export interface RunAgentSchedulerResult {
  readonly content: string;
  readonly stopped: boolean;
  readonly pendingAsk?: AgentAskQuestion;
  readonly pendingAnimationWrite?: boolean;
  readonly eventTitle?: string;
  readonly eventEnded?: boolean;
  readonly eventJudged?: boolean;
}

function optionFromUnknown(
  value: unknown,
  index: number
): { id: string; label: string } | undefined {
  if (typeof value === "string") {
    const label = value.trim();
    if (!label) {
      return undefined;
    }
    return { id: `opt-${index}`, label: shortAskOptionLabel(label) };
  }
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const row = value as { readonly id?: unknown; readonly label?: unknown };
  const label = typeof row.label === "string" ? row.label.trim() : "";
  if (!label) {
    return undefined;
  }
  const id =
    typeof row.id === "string" && row.id.trim()
      ? row.id.trim()
      : `opt-${index}`;
  return { id, label };
}

function parseAskQuestionFromJson(
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
    const options = record.options.flatMap((option, index) => {
      const parsedOption = optionFromUnknown(option, index);
      return parsedOption ? [parsedOption] : [];
    });
    if (options.length === 0) {
      return undefined;
    }
    return { prompt, options };
  } catch {
    return undefined;
  }
}

function parseAskQuestionFromLabeled(
  payload: string
): AgentAskQuestion | undefined {
  const match =
    /^(?:问题\s*[:：]\s*)?([\s\S]+?)\s*选项\s*[:：]\s*([\s\S]+)$/.exec(
      payload.trim()
    );
  if (!match?.[1] || !match[2]) {
    return undefined;
  }
  const prompt = match[1].trim();
  const rawOptions = match[2].trim();
  let values: unknown[] = [];
  if (rawOptions.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(rawOptions);
      if (Array.isArray(parsed)) {
        values = parsed;
      }
    } catch {
      values = [];
    }
  }
  if (values.length === 0) {
    values = rawOptions
      .split(/\s*[|｜、,，]\s*/)
      .map((part) => part.replace(/^["']|["']$/g, "").trim())
      .filter((part) => part.length > 0);
  }
  const options = values.flatMap((option, index) => {
    const parsedOption = optionFromUnknown(option, index);
    return parsedOption ? [parsedOption] : [];
  });
  if (!prompt || options.length === 0) {
    return undefined;
  }
  return { prompt, options };
}

function shortAskOptionLabel(text: string): string {
  const cut = text.replace(/[（(].*$/, "").trim();
  return cut || text.trim();
}

function parseAskQuestionFromList(
  payload: string
): AgentAskQuestion | undefined {
  const lines = payload
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const optionLines: string[] = [];
  const promptLines: string[] = [];
  for (const line of lines) {
    const item = /^(?:[-*•]|\d+[.)、])\s+(.+)$/.exec(line);
    if (item?.[1]) {
      optionLines.push(item[1].trim());
      continue;
    }
    if (optionLines.length === 0) {
      promptLines.push(line);
    }
  }
  if (optionLines.length === 0) {
    return undefined;
  }
  const prompt =
    promptLines
      .join(" ")
      .replace(/例如[：:].*$/, "")
      .trim() || "请选择";
  return {
    prompt,
    options: optionLines.map((text, index) => ({
      id: `opt-${index}`,
      label: shortAskOptionLabel(text),
    })),
  };
}

function parseAskQuestionFromPipes(
  payload: string
): AgentAskQuestion | undefined {
  const line = payload.replace(/\r\n/g, "\n").trim();
  if (!line || line.includes("\n") || !/[|｜]/.test(line)) {
    return undefined;
  }
  const parts = line
    .split(/\s*[|｜]\s*/)
    .map((part) => part.replace(/^["']|["']$/g, "").trim())
    .filter((part) => part.length > 0);
  if (parts.length < 3) {
    return undefined;
  }
  const prompt = parts[0];
  const options = parts.slice(1).map((text, index) => ({
    id: `opt-${index}`,
    label: shortAskOptionLabel(text),
  }));
  if (!prompt || options.length === 0) {
    return undefined;
  }
  return { prompt, options };
}

export function parseAskQuestionArgs(
  payload: string
): AgentAskQuestion | undefined {
  return (
    parseAskQuestionFromJson(payload) ??
    parseAskQuestionFromLabeled(payload) ??
    parseAskQuestionFromList(payload) ??
    parseAskQuestionFromPipes(payload)
  );
}

export function pendingAskFromTool(
  payload: string,
  talk: string
): AgentAskQuestion {
  return (
    parseAskQuestionArgs(payload) ??
    parseAskQuestionArgs(talk) ?? {
      prompt: (talk || payload).trim() || "请选择",
      options: [],
    }
  );
}

export function unansweredAskToolFromAnswer(
  answer: AgentChatAnswer
): AgentChatToolCall | undefined {
  for (let index = answer.tools.length - 1; index >= 0; index -= 1) {
    const tool = answer.tools[index];
    if (!tool || tool.name !== ASK_QUESTION_TOOL) {
      continue;
    }
    if (tool.result.trim()) {
      return undefined;
    }
    return tool;
  }
  return undefined;
}

export function unansweredAskFromAnswer(
  answer: AgentChatAnswer
): AgentAskQuestion | undefined {
  const tool = unansweredAskToolFromAnswer(answer);
  if (!tool) {
    return undefined;
  }
  return parseAskQuestionArgs(tool.args) ?? parseAskQuestionArgs(answer.talk);
}

export function unansweredAnimationWriteFromAnswer(
  answer: AgentChatAnswer
): AgentChatToolCall | undefined {
  return unansweredPendingWriteFromAnswer(answer);
}

export function unansweredPendingWriteFromAnswer(
  answer: AgentChatAnswer
): AgentChatToolCall | undefined {
  for (let index = answer.tools.length - 1; index >= 0; index -= 1) {
    const tool = answer.tools[index];
    if (!tool) {
      continue;
    }
    const pending =
      !tool.result.trim() || isPendingAnimationConfirm(tool.result);
    if (isMakeTool(tool.name)) {
      return pending ? tool : undefined;
    }
    if (tool.name !== SIMPLE_ANIMATION_TOOL) {
      continue;
    }
    if (!pending) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(tool.args) as { action?: unknown };
      if (parsed.action !== "write" && parsed.action !== "clear") {
        continue;
      }
    } catch {
      continue;
    }
    return tool;
  }
  return undefined;
}

const LEGACY_SIDE_MARKER = "<<<SIDE>>>" as const;

const LIVE_ANSWER_MARKERS = [THINK_MARKER, TALK_MARKER, EVENT_MARKER] as const;

const ANSWER_MARKERS = [...LIVE_ANSWER_MARKERS, LEGACY_SIDE_MARKER] as const;

export function parseAgentSchedulerOutput(
  text: string,
  _options: { readonly complete?: boolean } = {}
): ParsedAgentSchedulerOutput {
  const answer = parseSavedAnswer(text);
  return { thinking: answer.thinking, talk: answer.talk };
}

export function joinAgentTalk(committed: string, incoming: string): string {
  const prior = committed.trim();
  const next = incoming.trim();
  if (!prior) {
    return next;
  }
  if (!next || prior === next || prior.endsWith(`\n${next}`)) {
    return prior;
  }
  return `${prior}\n${next}`;
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
  for (const block of answerBlocks(answer)) {
    if (block.kind === "think") {
      parts.push(`${THINK_MARKER}\n${block.text.trim()}`);
      continue;
    }
    if (block.kind === "talk") {
      parts.push(`${TALK_MARKER}\n${block.text.trim()}`);
      continue;
    }
    const body: string[] = [`${EXEC_MARKER}\n${block.tool.name}`];
    if (block.tool.args.trim()) {
      body.push(block.tool.args.trim());
    }
    if (block.tool.result.trim()) {
      body.push(`${NOTE_MARKER}\n${block.tool.result.trim()}`);
    }
    parts.push(`${EVENT_MARKER}\n${body.join("\n")}`);
  }
  return parts.join("\n");
}

export function parseSavedAnswer(
  content: string,
  _options: { readonly complete?: boolean } = {}
): AgentChatAnswer {
  const first = nextAnswerMarker(content, 0);
  if (!first) {
    const talk = content.trim();
    return answerFromBlocks(talk ? [{ kind: "talk", text: talk }] : []);
  }
  const blocks: AgentChatBlock[] = [];
  if (first.at > 0) {
    const lead = content.slice(0, first.at).trim();
    if (lead) {
      blocks.push({ kind: "talk", text: lead });
    }
  }
  let cursor = first.at;
  let toolIndex = 0;
  while (cursor < content.length) {
    const tagged = nextAnswerMarker(content, cursor);
    if (!tagged) {
      break;
    }
    const after = tagged.at + tagged.tag.length;
    const following = nextAnswerMarker(
      content,
      after,
      tagged.tag === TALK_MARKER ? LIVE_ANSWER_MARKERS : ANSWER_MARKERS
    );
    const end = following ? following.at : content.length;
    const body = content.slice(after, end).trim();
    if (tagged.tag === THINK_MARKER && body) {
      blocks.push({ kind: "think", text: body });
    } else if (tagged.tag === TALK_MARKER && body) {
      blocks.push({ kind: "talk", text: body });
    } else if (tagged.tag === EVENT_MARKER) {
      const tool = parseToolChunk(body, toolIndex);
      toolIndex += 1;
      if (tool.name.trim() || tool.result.trim()) {
        blocks.push({ kind: "tool", tool });
      }
    }
    cursor = end;
  }
  return answerFromBlocks(blocks);
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

const CITE_HEADER = /^(\d+):(\d+):(\S+)$/;

export function parseCiteHeader(
  header: string
): { readonly startLine: number; readonly endLine: number; readonly filepath: string } | undefined {
  const match = CITE_HEADER.exec(header.trim());
  if (!match) {
    return undefined;
  }
  return {
    startLine: Number(match[1]),
    endLine: Number(match[2]),
    filepath: match[3] ?? "",
  };
}

function historyForModel(
  history: readonly AgentSchedulerMessage[]
): AgentSchedulerMessage[] {
  const out: AgentSchedulerMessage[] = [];
  for (const message of history) {
    if (message.role === "system" || message.role === "tool") {
      out.push(message);
      continue;
    }
    if (message.role === "user") {
      out.push({ role: "user", content: wrapUserQuery(message.content) });
      continue;
    }
    const answer = parseSavedAnswer(message.content);
    const toolCalls = answer.tools
      .filter((tool) => tool.name.trim())
      .map((tool) => ({
        id: tool.id,
        name: tool.name,
        arguments: tool.args,
      }));
    if (answer.talk.trim() || toolCalls.length > 0) {
      out.push({
        role: "assistant",
        content: answer.talk,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      });
    }
    for (const tool of answer.tools) {
      if (!tool.result.trim()) {
        continue;
      }
      out.push({
        role: "tool",
        content: tool.result,
        toolCallId: tool.id,
      });
    }
  }
  return out;
}

export function buildMainSchedulerMessages(
  history: readonly AgentSchedulerMessage[],
  toolResults: readonly (
    | string
    | {
        readonly name: string;
        readonly result: string;
        readonly id?: string;
        readonly arguments?: string;
      }
  )[],
  options: {
    readonly mode?: AgentSessionMode;
    readonly canvasInventory?: string;
    readonly planDocument?: string;
    readonly draftSourceCode?: string;
    readonly canvas?: boolean;
    readonly animation?: boolean;
    readonly lastRound?: boolean;
    readonly previousEvent?: AgentPreviousEvent;
    readonly currentTalk?: string;
    readonly locale?: string;
    readonly now?: Date;
  } = {}
): readonly AgentSchedulerMessage[] {
  const canvas = Boolean(options.canvas);
  const animation = Boolean(options.animation);
  const prefix: AgentSchedulerMessage[] = agentRoleIdentities({
    canvas,
    animation,
  }).map((identity) => ({
    role: "system" as const,
    content: identity,
  }));
  prefix.push({
    role: "system",
    content: buildUserInfoMessage({
      locale: options.locale ?? "zh",
      now: options.now,
    }),
  });
  if (canvas && options.canvasInventory) {
    prefix.push({
      role: "system",
      content: options.canvasInventory,
    });
  }
  if (animation) {
    prefix.push({
      role: "system",
      content: wrapAgentRemotionSkill(AGENT_REMOTION_SKILL),
    });
  }
  if (options.previousEvent) {
    prefix.push({
      role: "system",
      content: buildEventFollowupReminder(options.previousEvent),
    });
  } else if (!options.lastRound) {
    prefix.push({
      role: "system",
      content: EVENT_JUDGMENT_REMINDER,
    });
  }
  if (options.lastRound) {
    prefix.push({
      role: "system",
      content: LAST_ROUND_REMINDER,
    });
  }
  const results = toolResults.map((result, index) =>
    typeof result === "string"
      ? {
          id: `prior-${index + 1}`,
          name: `tool-${index + 1}`,
          arguments: "",
          result,
        }
      : {
          id: result.id ?? `prior-${index + 1}`,
          name: result.name,
          arguments:
            "arguments" in result && typeof result.arguments === "string"
              ? result.arguments
              : "",
          result: result.result,
        }
  );
  const followUp: AgentSchedulerMessage[] =
    results.length === 0
      ? []
      : [
          {
            role: "assistant" as const,
            content: options.currentTalk ?? "",
            toolCalls: results.map((result) => ({
              id: result.id,
              name: result.name,
              arguments: result.arguments,
            })),
          },
          ...results.map((result) => ({
            role: "tool" as const,
            content: result.result,
            toolCallId: result.id,
          })),
        ];
  return [...prefix, ...historyForModel(history), ...followUp];
}

function schedulerCallToTool(call: AgentSchedulerToolCall): AgentToolCall {
  return toolCallFromFunctionArgs(call.name, call.arguments);
}

export function rolesFromAnswer(answer?: AgentChatAnswer): AgentRoleOptions {
  let canvas = false;
  let animation = false;
  for (const tool of answer?.tools ?? []) {
    if (tool.name === SCHEDULE_ROLE_TOOL) {
      const role =
        parseScheduledRole(tool.args) || parseScheduledRole(tool.result);
      if (role === "canvas") {
        canvas = true;
      }
      if (role === "animation") {
        animation = true;
      }
      continue;
    }
    if (tool.name.startsWith("canvas_")) {
      canvas = true;
    }
    if (tool.name === SIMPLE_ANIMATION_TOOL) {
      animation = true;
    }
  }
  return { canvas, animation };
}

export async function runAgentScheduler(
  params: RunAgentSchedulerParams
): Promise<RunAgentSchedulerResult> {
  const mode = params.getMode?.() ?? "ask";
  const maxSteps =
    params.maxSteps ??
    (mode === "real" ? AGENT_CHAT_MAX_MAKE_STEPS : AGENT_CHAT_MAX_PLAN_STEPS);
  const toolResults: {
    id: string;
    name: string;
    arguments: string;
    result: string;
  }[] = (params.initialToolResults ?? []).map((result, index) => ({
    id: `prior-${index + 1}`,
    name: `prior-${index + 1}`,
    arguments: "",
    result,
  }));
  let answer: AgentChatAnswer = answerFromBlocks(
    answerBlocks(params.initialAnswer ?? emptyAgentChatAnswer())
  );
  const initialRoles = rolesFromAnswer(params.initialAnswer);
  let canvasOn = Boolean(initialRoles.canvas);
  let animationOn = Boolean(initialRoles.animation);

  const aborted = (): boolean => Boolean(params.isAborted?.());

  const publish = (): string => {
    const content = composeSavedAnswer(answer);
    params.onAssistantContent(content);
    return content;
  };

  const currentMode = (): AgentSessionMode => params.getMode?.() ?? mode;

  const canvasInventory = (): string | undefined =>
    params.getCanvasInventory?.() ?? params.canvasInventory;

  const finish = (
    extras: Partial<RunAgentSchedulerResult> = {}
  ): RunAgentSchedulerResult => {
    const blocks = [...answerBlocks(answer)];
    let lastTalkIndex = -1;
    for (let index = blocks.length - 1; index >= 0; index -= 1) {
      if (blocks[index]?.kind === "talk") {
        lastTalkIndex = index;
        break;
      }
    }
    const lastTalk =
      lastTalkIndex >= 0 && blocks[lastTalkIndex]?.kind === "talk"
        ? blocks[lastTalkIndex].text
        : answer.talk;
    const judgment = parseEventJudgment(lastTalk);
    if (lastTalkIndex >= 0 && judgment.talk !== lastTalk.trim()) {
      if (judgment.talk) {
        blocks[lastTalkIndex] = { kind: "talk", text: judgment.talk };
      } else {
        blocks.splice(lastTalkIndex, 1);
      }
      answer = answerFromBlocks(blocks);
    }
    return {
      content: publish(),
      stopped: false,
      eventTitle: judgment.title,
      eventEnded: judgment.ended,
      eventJudged: judgment.judged,
      ...extras,
    };
  };

  const streamStep = async (
    options: { readonly lastRound?: boolean } = {}
  ): Promise<{
    readonly text: string;
    readonly thinking: string;
    readonly toolCalls: readonly AgentSchedulerToolCall[];
    readonly stopped: boolean;
  }> => {
    const lastRound = Boolean(options.lastRound);
    const stepMode = currentMode();
    const mainMessages = buildMainSchedulerMessages(
      params.historyMessages,
      toolResults,
      {
        mode: stepMode,
        canvasInventory: canvasInventory(),
        planDocument: params.planDocument,
        draftSourceCode: params.draftSourceCode,
        canvas: canvasOn,
        animation: animationOn,
        lastRound,
        previousEvent: params.previousEvent,
        currentTalk: answer.talk,
        locale: params.locale,
        now: params.now,
      }
    );
    const mainResult = await params.stream(
      mainMessages,
      lastRound
        ? []
        : toolsForRequest(stepMode, {
            canvas: canvasOn,
            animation: animationOn,
          }),
      (fullText, fullThinking) => {
        params.onAssistantContent(
          composeSavedAnswer(withAnswerStep(answer, fullThinking ?? "", fullText))
        );
      }
    );
    return {
      text: mainResult.text,
      thinking: mainResult.thinking ?? "",
      toolCalls: lastRound ? [] : (mainResult.toolCalls ?? []),
      stopped: mainResult.stopped,
    };
  };

  const runOneTool = async (
    call: AgentSchedulerToolCall,
    talk: string
  ): Promise<RunAgentSchedulerResult | undefined> => {
    const toolCall = schedulerCallToTool(call);
    const toolName = toolCall.name.trim() || call.name.trim();
    const tool: AgentChatToolCall = {
      id: call.id || `tool-${answer.tools.length}`,
      name: toolName,
      args: call.arguments || toolCall.payload,
      result: "",
    };
    answer = appendAnswerTool(answer, tool);
    publish();
    if (!toolName) {
      const result = EMPTY_TOOL_RESULT;
      toolResults.push({ id: tool.id, name: "", arguments: tool.args, result });
      answer = replaceLastAnswerTool(answer, { ...tool, result });
      publish();
      return undefined;
    }
    params.onTool?.(toolCall);
    if (toolName === ASK_QUESTION_TOOL) {
      return {
        content: publish(),
        stopped: false,
        pendingAsk: pendingAskFromTool(tool.args, talk),
      };
    }
    if (toolName === ENTER_DRAFT_TOOL) {
      const result = JSON.stringify({ error: "草案未启用" });
      toolResults.push({
        id: tool.id,
        name: toolName,
        arguments: tool.args,
        result,
      });
      answer = replaceLastAnswerTool(answer, { ...tool, result });
      publish();
      return undefined;
    }
    if (toolName === SCHEDULE_ROLE_TOOL) {
      const role = parseScheduledRole(tool.args);
      if (!role) {
        const result = JSON.stringify({ error: "只能调度画布或简易视频" });
        toolResults.push({
          id: tool.id,
          name: toolName,
          arguments: tool.args,
          result,
        });
        answer = replaceLastAnswerTool(answer, { ...tool, result });
        publish();
        return undefined;
      }
      if (role === "canvas") {
        canvasOn = true;
      }
      if (role === "animation") {
        animationOn = true;
      }
      const result = JSON.stringify({ scheduled: role });
      toolResults.push({
        id: tool.id,
        name: toolName,
        arguments: tool.args,
        result,
      });
      answer = replaceLastAnswerTool(answer, { ...tool, result });
      publish();
      return undefined;
    }
    const rawToolResult = await params.runTool(toolCall);
    if (aborted()) {
      return { content: publish(), stopped: true };
    }
    const toolResult = attachMakeToolInventory(
      toolName,
      rawToolResult,
      canvasInventory()
    );
    if (isPendingAnimationConfirm(toolResult)) {
      if (!canPauseForExecuteConfirm(answer.talk)) {
        const result = JSON.stringify({ error: EXECUTE_TALK_REQUIRED });
        toolResults.push({
          id: tool.id,
          name: toolName,
          arguments: tool.args,
          result,
        });
        answer = replaceLastAnswerTool(answer, { ...tool, result });
        publish();
        return undefined;
      }
      return {
        content: publish(),
        stopped: false,
        pendingAnimationWrite: true,
      };
    }
    toolResults.push({
      id: tool.id,
      name: toolName,
      arguments: tool.args,
      result: toolResult,
    });
    answer = replaceLastAnswerTool(answer, { ...tool, result: toolResult });
    publish();
    return undefined;
  };

  const pending = params.pendingToolCalls ?? [];
  if (pending.length > 0) {
    const talk = answer.talk.trim();
    for (const call of pending) {
      const paused = await runOneTool(call, talk);
      if (paused) {
        return paused;
      }
      if (aborted()) {
        return { content: publish(), stopped: true };
      }
    }
  }

  for (let step = 0; step < maxSteps; step += 1) {
    if (aborted()) {
      return { content: publish(), stopped: true };
    }

    const mainResult = await streamStep();
    const talk = mainResult.text.trim();
    const thinking = mainResult.thinking.trim();
    if (talk || thinking) {
      answer = withAnswerStep(answer, thinking, talk);
    }

    if (mainResult.stopped || aborted()) {
      return { content: publish(), stopped: true };
    }

    if (mainResult.toolCalls.length === 0) {
      return finish();
    }

    for (const call of mainResult.toolCalls) {
      const paused = await runOneTool(call, talk);
      if (paused) {
        return paused;
      }
      if (aborted()) {
        return { content: publish(), stopped: true };
      }
    }
  }

  const summary = await streamStep({ lastRound: true });
  if (summary.text.trim() || summary.thinking.trim()) {
    answer = withAnswerStep(answer, summary.thinking, summary.text);
  }
  if (summary.stopped || aborted()) {
    return { content: publish(), stopped: true };
  }
  return finish();
}

export function schedulerMessagesToChat(
  messages: readonly AgentSchedulerMessage[]
): readonly {
  readonly id: string;
  readonly role: "user" | "assistant" | "system" | "tool";
  readonly content: string;
  readonly toolCallId?: string;
  readonly toolCalls?: readonly AgentSchedulerToolCall[];
}[] {
  return messages.map((message, index) => ({
    id: `scheduler-${index}`,
    role: message.role,
    content: message.content,
    toolCallId: message.toolCallId,
    toolCalls: message.toolCalls,
  }));
}

function nextAnswerMarker(
  text: string,
  from: number,
  tags: readonly (typeof ANSWER_MARKERS)[number][] = ANSWER_MARKERS
): { readonly tag: (typeof ANSWER_MARKERS)[number]; readonly at: number } | undefined {
  let best:
    | { readonly tag: (typeof ANSWER_MARKERS)[number]; readonly at: number }
    | undefined;
  for (const tag of tags) {
    const at = text.indexOf(tag, from);
    if (at < 0) {
      continue;
    }
    if (!best || at < best.at) {
      best = { tag, at };
    }
  }
  return best;
}
