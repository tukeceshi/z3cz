import type { AgentSessionMode } from "@/services/agent-session-mode";

export const SIMPLE_ANIMATION_CAPABILITY = "simple-animation" as const;
export const CANVAS_MAKE_CAPABILITY = "canvas-make" as const;
export const SIMPLE_ANIMATION_TOOL = "simple_animation" as const;
export const ASK_QUESTION_TOOL = "ask_question" as const;
export const SCHEDULE_ROLE_TOOL = "schedule_role" as const;
export const ENTER_DRAFT_TOOL = "enter_draft" as const;

export type ScheduledAgentRole = "canvas" | "animation";
export const CANVAS_CREATE_GENERATION_FLOW_TOOL =
  "canvas_create_generation_flow" as const;
export const CANVAS_CONNECT_NODES_TOOL = "canvas_connect_nodes" as const;

export type AgentToolKind =
  | "read"
  | "make"
  | "consent-open"
  | "consent-close"
  | "ask"
  | "enter"
  | "use"
  | "schedule";

export interface AgentToolParameters {
  readonly type: "object";
  readonly properties: Readonly<Record<string, unknown>>;
  readonly required?: readonly string[];
  readonly additionalProperties: false;
}

export interface AgentCapabilityTool {
  readonly name: string;
  readonly kind: AgentToolKind;
  readonly capabilityId: string;
  readonly enabled: boolean;
  readonly description: string;
  readonly parameters: AgentToolParameters;
}

export interface AgentCapability {
  readonly id: string;
  readonly label: string;
}

export interface AgentRequestTool {
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: AgentToolParameters;
  };
}

const EMPTY_OBJECT: AgentToolParameters = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

const CAPABILITIES: readonly AgentCapability[] = [
  { id: "canvas", label: "画布" },
  { id: SIMPLE_ANIMATION_CAPABILITY, label: "简易动画" },
  { id: CANVAS_MAKE_CAPABILITY, label: "画布" },
  { id: "ask", label: "提问" },
  { id: "schedule", label: "调度" },
  { id: "mode", label: "模式" },
];

const TOOLS: readonly AgentCapabilityTool[] = [
  {
    name: "canvas_get_state",
    kind: "read",
    capabilityId: "canvas",
    enabled: true,
    description:
      "只在清单明显过期时再取。和清单同一份：名字、提示词摘要、有没有素材、是不是空的。再取不会多出内容，不含资源地址。不够就直说，不要反复取。",
    parameters: EMPTY_OBJECT,
  },
  {
    name: "canvas_resolve_resource",
    kind: "read",
    capabilityId: "canvas",
    enabled: true,
    description: "只有真正要用这个资源的地址时才调用。参数 resourceId。",
    parameters: {
      type: "object",
      properties: {
        resourceId: { type: "string", description: "资源 id" },
      },
      required: ["resourceId"],
      additionalProperties: false,
    },
  },
  {
    name: SIMPLE_ANIMATION_TOOL,
    kind: "use",
    capabilityId: SIMPLE_ANIMATION_CAPABILITY,
    enabled: true,
    description:
      "简易动画。get 读源码，立刻做。open 只开窗。write 整段替换（参数 source）。clear 清空成空白画面，重做时先用、不要读旧源码。close 只关窗，不撤执行。",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["get", "write", "open", "close", "clear"],
          description: "get 读，open 开窗，write 写，clear 清空，close 关窗",
        },
        source: { type: "string", description: "write 时的完整源码" },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
  {
    name: CANVAS_CREATE_GENERATION_FLOW_TOOL,
    kind: "make",
    capabilityId: CANVAS_MAKE_CAPABILITY,
    enabled: true,
    description:
      "在画布上搭一条生成：参数 mode 为 text/image/video/audio，prompt 为提示词。可选 referenceNodeIds 连已有节点作参考，autoRun 默认 true 会立刻运行。",
    parameters: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["text", "image", "video", "audio"],
          description: "生成类型",
        },
        prompt: { type: "string", description: "提示词" },
        referenceNodeIds: {
          type: "array",
          items: { type: "string" },
          description: "参考节点 id",
        },
        autoRun: { type: "boolean", description: "是否立刻运行，默认 true" },
        x: { type: "number" },
        y: { type: "number" },
      },
      required: ["mode", "prompt"],
      additionalProperties: false,
    },
  },
  {
    name: CANVAS_CONNECT_NODES_TOOL,
    kind: "make",
    capabilityId: CANVAS_MAKE_CAPABILITY,
    enabled: true,
    description:
      "把已有节点连成参考。参数 connections 为 {fromNodeId,toNodeId}。",
    parameters: {
      type: "object",
      properties: {
        connections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              fromNodeId: { type: "string" },
              toNodeId: { type: "string" },
            },
            required: ["fromNodeId", "toNodeId"],
          },
        },
      },
      required: ["connections"],
      additionalProperties: false,
    },
  },
  {
    name: "canvas_write_text",
    kind: "make",
    capabilityId: CANVAS_MAKE_CAPABILITY,
    enabled: true,
    description: "写入节点文字或提示词。参数 nodeId、text。",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string" },
        text: { type: "string" },
      },
      required: ["nodeId", "text"],
      additionalProperties: false,
    },
  },
  {
    name: "canvas_run_node",
    kind: "make",
    capabilityId: CANVAS_MAKE_CAPABILITY,
    enabled: true,
    description: "运行该节点已有生成。参数 nodeId。",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string" },
      },
      required: ["nodeId"],
      additionalProperties: false,
    },
  },
  {
    name: "canvas_stage_media",
    kind: "make",
    capabilityId: CANVAS_MAKE_CAPABILITY,
    enabled: true,
    description:
      "把图片或媒体挂到节点上。参数 nodeId、url，可选 mimeType。本轮上传的图用附件地址。",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string" },
        url: { type: "string" },
        mimeType: { type: "string" },
      },
      required: ["nodeId", "url"],
      additionalProperties: false,
    },
  },
  {
    name: SCHEDULE_ROLE_TOOL,
    kind: "schedule",
    capabilityId: "schedule",
    enabled: true,
    description:
      "要改画布或做简易视频时先调度。参数 role 为 canvas 或 animation。只问不调度。",
    parameters: {
      type: "object",
      properties: {
        role: {
          type: "string",
          enum: ["canvas", "animation"],
          description: "canvas 画布，animation 简易视频",
        },
      },
      required: ["role"],
      additionalProperties: false,
    },
  },
  {
    name: ASK_QUESTION_TOOL,
    kind: "ask",
    capabilityId: "ask",
    enabled: true,
    description:
      "缺关键选择、无法继续时才问。一次一事。参数 prompt，options 为 {id,label} 短标签。能直接答就别问。",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        options: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              label: { type: "string" },
            },
            required: ["id", "label"],
          },
        },
      },
      required: ["prompt", "options"],
      additionalProperties: false,
    },
  },
  {
    name: ENTER_DRAFT_TOOL,
    kind: "enter",
    capabilityId: "mode",
    enabled: false,
    description: "进入草案。当前未启用。",
    parameters: EMPTY_OBJECT,
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
    kind === "use" ||
    kind === "consent-open" ||
    kind === "consent-close"
  );
}

export function isToolAllowed(name: string, mode: AgentSessionMode): boolean {
  const tool = lookupAgentTool(name);
  if (!tool || !tool.enabled) {
    return false;
  }
  if (tool.kind === "enter") {
    return false;
  }
  if (
    tool.kind === "ask" ||
    tool.kind === "use" ||
    tool.kind === "make" ||
    tool.kind === "schedule"
  ) {
    return true;
  }
  if (mode === "ask") {
    return tool.kind === "read";
  }
  if (mode === "draft") {
    return tool.kind === "read" || tool.kind === "make";
  }
  return true;
}

export const AGENT_ROLE_BASE = "base" as const;
export const AGENT_ROLE_CANVAS = "canvas" as const;
export const AGENT_ROLE_ANIMATION = "animation" as const;

export type AgentRoleId =
  | typeof AGENT_ROLE_BASE
  | typeof AGENT_ROLE_CANVAS
  | typeof AGENT_ROLE_ANIMATION;

export interface AgentRolePack {
  readonly id: AgentRoleId;
  readonly identity: string;
  readonly toolNames: readonly string[];
}

export const AGENT_BASE_IDENTITY =
  "按 <user_query> 做事。做事用请求里给的工具，不要在正文里写调用。只是问就直接答。要改画布或做简易视频，先调度对应角色。要做就先说清楚做什么，再调工具，不要让用户点执行。第一次写，界面拿这段话出确认。";

export const AGENT_CANVAS_IDENTITY =
  "你是画布助手。清单已有节点和是否为空，不要反复取画布。";

export const AGENT_ANIMATION_IDENTITY = "你负责简易动画。";

const BASE_ROLE: AgentRolePack = {
  id: AGENT_ROLE_BASE,
  identity: AGENT_BASE_IDENTITY,
  toolNames: [SCHEDULE_ROLE_TOOL, ASK_QUESTION_TOOL],
};

const CANVAS_ROLE: AgentRolePack = {
  id: AGENT_ROLE_CANVAS,
  identity: AGENT_CANVAS_IDENTITY,
  toolNames: [
    "canvas_get_state",
    "canvas_resolve_resource",
    CANVAS_CREATE_GENERATION_FLOW_TOOL,
    CANVAS_CONNECT_NODES_TOOL,
    "canvas_write_text",
    "canvas_run_node",
    "canvas_stage_media",
  ],
};

const ANIMATION_ROLE: AgentRolePack = {
  id: AGENT_ROLE_ANIMATION,
  identity: AGENT_ANIMATION_IDENTITY,
  toolNames: [SIMPLE_ANIMATION_TOOL],
};

export interface AgentRoleOptions {
  readonly canvas?: boolean;
  readonly animation?: boolean;
}

export function parseScheduledRole(value: string): ScheduledAgentRole | undefined {
  const text = value.trim();
  let raw = text;
  try {
    const parsed = JSON.parse(text) as { role?: unknown };
    if (typeof parsed.role === "string") {
      raw = parsed.role;
    }
  } catch {
    // keep raw text
  }
  const key = raw.trim().toLowerCase();
  if (key === "canvas" || key === "画布") {
    return "canvas";
  }
  if (key === "animation" || key === "简易视频" || key === "简易动画") {
    return "animation";
  }
  return undefined;
}

export function activeAgentRoles(
  options: AgentRoleOptions = {}
): readonly AgentRolePack[] {
  const roles: AgentRolePack[] = [BASE_ROLE];
  if (options.canvas) {
    roles.push(CANVAS_ROLE);
  }
  if (options.animation) {
    roles.push(ANIMATION_ROLE);
  }
  return roles;
}

export function agentRoleIdentities(
  options: AgentRoleOptions = {}
): readonly string[] {
  return activeAgentRoles(options).map((role) => role.identity);
}

function toolNamesForRoles(options: AgentRoleOptions): ReadonlySet<string> {
  return new Set(
    activeAgentRoles(options).flatMap((role) => role.toolNames)
  );
}

export function toolsForInform(
  mode: AgentSessionMode,
  options: AgentRoleOptions = {}
): readonly AgentCapabilityTool[] {
  const allowed = toolNamesForRoles(options);
  return TOOLS.filter((tool) => {
    if (!tool.enabled || !allowed.has(tool.name)) {
      return false;
    }
    return isToolAllowed(tool.name, mode);
  });
}

export function toolsForRequest(
  mode: AgentSessionMode,
  options: AgentRoleOptions = {}
): readonly AgentRequestTool[] {
  return toolsForInform(mode, options).map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}
