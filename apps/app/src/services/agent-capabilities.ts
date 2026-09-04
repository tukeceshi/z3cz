import type { AgentSessionMode } from "@/services/agent-session-mode";

export const SIMPLE_ANIMATION_CAPABILITY = "simple-animation" as const;
export const ASK_QUESTION_TOOL = "ask_question" as const;
export const SWITCH_MODE_TOOL = "switch_mode" as const;

export type AgentToolKind =
  | "read"
  | "make"
  | "consent-open"
  | "consent-close"
  | "ask"
  | "mode";

export interface AgentCapabilityTool {
  readonly name: string;
  readonly kind: AgentToolKind;
  readonly capabilityId: string;
  readonly enabled: boolean;
  readonly hint: string;
}

export interface AgentCapability {
  readonly id: string;
  readonly label: string;
}

const CAPABILITIES: readonly AgentCapability[] = [
  { id: "canvas", label: "画布" },
  { id: SIMPLE_ANIMATION_CAPABILITY, label: "简易动画" },
  { id: "canvas-edit", label: "画布文字" },
  { id: "canvas-run", label: "运行节点" },
  { id: "canvas-media", label: "挂媒体" },
  { id: "ask", label: "提问" },
  { id: "mode", label: "模式" },
];

const TOOLS: readonly AgentCapabilityTool[] = [
  {
    name: "canvas_get_state",
    kind: "read",
    capabilityId: "canvas",
    enabled: true,
    hint: "当前画布清单，不含地址",
  },
  {
    name: "canvas_resolve_resource",
    kind: "read",
    capabilityId: "canvas",
    enabled: true,
    hint: "下一行 resourceId: 某个资源，只用这个资源时才调用",
  },
  {
    name: "remotion_get",
    kind: "read",
    capabilityId: SIMPLE_ANIMATION_CAPABILITY,
    enabled: true,
    hint: "读当前源码",
  },
  {
    name: "remotion_open",
    kind: "consent-open",
    capabilityId: SIMPLE_ANIMATION_CAPABILITY,
    enabled: true,
    hint: "进入后才能写",
  },
  {
    name: "remotion_close",
    kind: "consent-close",
    capabilityId: SIMPLE_ANIMATION_CAPABILITY,
    enabled: true,
    hint: "退出后不再写",
  },
  {
    name: "remotion_write",
    kind: "make",
    capabilityId: SIMPLE_ANIMATION_CAPABILITY,
    enabled: true,
    hint: "下一行起整段替换源码",
  },
  {
    name: "canvas_write_text",
    kind: "make",
    capabilityId: "canvas-edit",
    enabled: false,
    hint: "第一行 nodeId: 节点，其后为文本",
  },
  {
    name: "canvas_run_node",
    kind: "make",
    capabilityId: "canvas-run",
    enabled: false,
    hint: "nodeId: 运行该节点已有生成",
  },
  {
    name: "canvas_stage_media",
    kind: "make",
    capabilityId: "canvas-media",
    enabled: false,
    hint: "nodeId: 与 url: / mimeType: 挂媒体",
  },
  {
    name: ASK_QUESTION_TOOL,
    kind: "ask",
    capabilityId: "ask",
    enabled: true,
    hint: '下一行短 JSON：prompt 与 options（id/label），一次一事',
  },
  {
    name: SWITCH_MODE_TOOL,
    kind: "mode",
    capabilityId: "mode",
    enabled: true,
    hint: "其后两行 from: 与 to:，值为 ask、plan 或 agent",
  },
];

const TOOL_BY_NAME = new Map(TOOLS.map((tool) => [tool.name, tool]));
const CAPABILITY_BY_ID = new Map(
  CAPABILITIES.map((capability) => [capability.id, capability])
);

export function agentCapabilityTools(): readonly AgentCapabilityTool[] {
  return TOOLS;
}

export function lookupAgentTool(name: string): AgentCapabilityTool | undefined {
  return TOOL_BY_NAME.get(name);
}

export function capabilityLabel(capabilityId: string): string {
  return CAPABILITY_BY_ID.get(capabilityId)?.label ?? capabilityId;
}

export function isMakeTool(name: string): boolean {
  return lookupAgentTool(name)?.kind === "make";
}

export function capabilityForTool(name: string): string | null {
  return lookupAgentTool(name)?.capabilityId ?? null;
}

export function enabledMakeCapabilityLabels(): readonly string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const tool of TOOLS) {
    if (!tool.enabled || tool.kind !== "make") {
      continue;
    }
    const label = capabilityLabel(tool.capabilityId);
    if (seen.has(label)) {
      continue;
    }
    seen.add(label);
    labels.push(label);
  }
  return labels;
}

export function isCanvasReadWriteTool(name: string): boolean {
  const kind = lookupAgentTool(name)?.kind;
  return (
    kind === "read" ||
    kind === "make" ||
    kind === "consent-open" ||
    kind === "consent-close"
  );
}

export function isToolAllowed(name: string, mode: AgentSessionMode): boolean {
  const tool = lookupAgentTool(name);
  if (!tool || !tool.enabled) {
    return false;
  }
  if (tool.kind === "ask" || tool.kind === "mode") {
    return true;
  }
  if (mode === "ask") {
    return false;
  }
  if (mode === "plan" && (tool.kind === "make" || tool.kind === "consent-open")) {
    return false;
  }
  return true;
}

export function toolsForInform(
  mode: AgentSessionMode
): readonly AgentCapabilityTool[] {
  return TOOLS.filter((tool) => {
    if (!tool.enabled) {
      return false;
    }
    return isToolAllowed(tool.name, mode);
  });
}

export function formatInformToolList(mode: AgentSessionMode): string {
  return toolsForInform(mode)
    .map((tool) => `${tool.name}（${tool.hint}）`)
    .join("；");
}

export function describeCapabilityBoundary(mode: AgentSessionMode): string {
  const labels = enabledMakeCapabilityLabels();
  const makeList = labels.length > 0 ? labels.join("、") : "无";
  const askRules = [
    "不虚构、不猜测。看不懂输入框刚发来的话（不含工具结果、不含画布清单）才能 ask_question，选项必须是短标签、一次一事。",
    "不要问是否执行。",
  ];
  if (mode === "ask") {
    return [
      "你在工作流画布上协助用户。<<<THINK>>> 从全局梳理后直接回答。",
      "本模式不能读写画布。只能思考和回答。",
      ...askRules,
    ].join("\n");
  }
  if (mode === "plan") {
    return [
      "你在工作流画布上协助用户。<<<THINK>>> 从全局梳理：用户要什么、画布上有什么、节点与资源如何配合、各段怎么衔接。",
      `当前可执行的制作能力：${makeList}。本模式只读，把可做的部分和其他待办分开写进方案，不要声称已改。`,
      ...askRules,
      "路线多样或有更优做法时，先在 THINK 写清这次提问是否必要，答必要才 ask_question。",
    ].join("\n");
  }
  return [
    "你在工作流画布上协助用户。<<<THINK>>> 从全局梳理：用户要什么、画布上有什么、节点与资源如何配合、各段怎么衔接。",
    `当前可执行的制作能力：${makeList}。按已确认方案去做，不要声称做了没做的事。`,
    ...askRules,
    "执行和当前方案严重不符时，先在 THINK 写清这次提问是否必要，答必要才 ask_question。轻微偏差自己收。",
  ].join("\n");
}

export function thinkingHasAskAudit(thinking: string): boolean {
  return /提问是否必要|必要性审计|问：必要/.test(thinking);
}
