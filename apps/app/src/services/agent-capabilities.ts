import type { AgentSessionMode } from "@/services/agent-session-mode";

export const SIMPLE_ANIMATION_CAPABILITY = "simple-animation" as const;
export const CANVAS_MAKE_CAPABILITY = "canvas-make" as const;
export const SIMPLE_ANIMATION_TOOL = "simple_animation" as const;
export const ASK_QUESTION_TOOL = "ask_question" as const;
export const SCHEDULE_ROLE_TOOL = "schedule_role" as const;
export const ENTER_DRAFT_TOOL = "enter_draft" as const;
export const READ_URL_TOOL = "read_url" as const;

export type ScheduledAgentRole = "canvas" | "animation";
export const CANVAS_CREATE_GENERATION_FLOW_TOOL =
  "canvas_create_generation_flow" as const;
export const CANVAS_WRITE_NODES_TOOL = "canvas_write_nodes" as const;
export const CANVAS_CONNECT_NODES_TOOL = "canvas_connect_nodes" as const;
export const CANVAS_IMPORT_TOOL = "canvas_import" as const;

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
  { id: "web", label: "链接" },
  { id: "mode", label: "模式" },
];

const TOOLS: readonly AgentCapabilityTool[] = [
  {
    name: "canvas_get_state",
    kind: "read",
    capabilityId: "canvas",
    enabled: true,
    description:
      "和清单同一份：名字、提示词摘要、有没有素材、是不是空的。没改过别取。刚写过若工具结果已带最新清单就别再取。不含资源地址。",
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
    name: CANVAS_IMPORT_TOOL,
    kind: "make",
    capabilityId: CANVAS_MAKE_CAPABILITY,
    enabled: true,
    description:
      "从链接或 JSON 导入整张画布。不要把画布内容抄进参数。参数 url 或 json，mode 为 append 或 replace。画布已有节点时先问追加还是替换。源节点带资源链接的会一并挂上；没挂上再用 canvas_stage_media，url 看工具结果。默认不跑生成。",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "画布 JSON 地址" },
        json: { type: "string", description: "画布 JSON 文本" },
        mode: {
          type: "string",
          enum: ["append", "replace"],
          description: "追加或替换",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: CANVAS_CREATE_GENERATION_FLOW_TOOL,
    kind: "make",
    capabilityId: CANVAS_MAKE_CAPABILITY,
    enabled: true,
    description:
      "只新建一条生成，不是导入或恢复已有画布。参数 mode 为 text/image/video/audio，prompt 为要生成的内容，不要写用户任务原话。可选 referenceNodeIds，autoRun 默认 true 会立刻运行。导入用 canvas_import。",
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
    name: CANVAS_WRITE_NODES_TOOL,
    kind: "make",
    capabilityId: CANVAS_MAKE_CAPABILITY,
    enabled: true,
    description:
      "一次写入多个节点并连线，默认不跑生成。参数 nodes 为 {id,mode,prompt,x,y,url,mimeType}，url 为要挂上的资源链接（外部节点链接或本轮附件）；id 给本批连线用；connections 为 {from,to}，可以是本批 id 或画布已有节点。多节点用这个，不要反复新建一条。",
    parameters: {
      type: "object",
      properties: {
        nodes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "本批别名" },
              mode: {
                type: "string",
                enum: ["text", "image", "video", "audio"],
              },
              prompt: { type: "string" },
              x: { type: "number" },
              y: { type: "number" },
              url: { type: "string", description: "要挂上的资源链接" },
              mimeType: { type: "string", description: "可选" },
            },
            required: ["mode"],
          },
        },
        connections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              from: { type: "string" },
              to: { type: "string" },
            },
            required: ["from", "to"],
          },
        },
      },
      required: ["nodes"],
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
      "把图片或媒体挂到已有节点。参数 nodeId、url，可选 mimeType。url 可以是外部节点上的资源链接，或本轮附件。不要把外链当 resourceId。",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "画布节点 id" },
        url: {
          type: "string",
          description: "外部资源链接或本轮附件地址",
        },
        mimeType: { type: "string", description: "可选" },
      },
      required: ["nodeId", "url"],
      additionalProperties: false,
    },
  },
  {
    name: READ_URL_TOOL,
    kind: "read",
    capabilityId: "web",
    enabled: true,
    description:
      "读取网页链接并整理成标题、要点和正文。参数 url。用户给了链接、需要看页面内容时用。不要假装已经读过。",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "http 或 https 地址" },
      },
      required: ["url"],
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
  "按 <user_query> 做事。做事用请求里给的工具，不要在正文里写调用。只是问就直接答。用户给了网页链接、需要看内容时用 read_url，不要假装读过。read_url 失败时先用消息里的完整原链接重试一次，仍失败就改用其他适用工具完成目标，没有就说明读取失败和原因，不要编造链接内容。要改画布或做简易视频，先调度对应角色。要做就先说清楚做什么，再调工具，不要让用户点执行。工具对不上就直说做不了，不要拿附近的工具顶替。不要把用户原话写进生成提示词。第一次写，界面只确认是否改画布。";

export const AGENT_CANVAS_IDENTITY =
  "你是画布助手。清单已有节点和是否为空。没改过别反复取。刚写完先看最新清单，对不上不要声称已导入或已恢复。整图导入用 canvas_import，不要用 canvas_write_nodes 抄整图。画布已有内容时先问追加还是替换。多个节点新建用 canvas_write_nodes 一次写入并连线。外部素材用链接挂到节点，不要只建空节点。canvas_create_generation_flow 只新建一条生成。";

export const AGENT_ANIMATION_IDENTITY = "你负责简易动画。";

const BASE_ROLE: AgentRolePack = {
  id: AGENT_ROLE_BASE,
  identity: AGENT_BASE_IDENTITY,
  toolNames: [READ_URL_TOOL, SCHEDULE_ROLE_TOOL, ASK_QUESTION_TOOL],
};

const CANVAS_ROLE: AgentRolePack = {
  id: AGENT_ROLE_CANVAS,
  identity: AGENT_CANVAS_IDENTITY,
  toolNames: [
    "canvas_get_state",
    "canvas_resolve_resource",
    CANVAS_IMPORT_TOOL,
    CANVAS_CREATE_GENERATION_FLOW_TOOL,
    CANVAS_WRITE_NODES_TOOL,
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
