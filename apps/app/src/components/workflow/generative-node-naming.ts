import {
  AI_AUDIO_NODE_TYPE,
  AI_GENERATIVE_NODE_TYPES,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  type AiGenerativeNodeType,
} from "@dafthunk/types";

interface GenerativeNodeNamingNode {
  readonly data: {
    readonly nodeType?: string;
  };
}

export function isGenerativeNodeType(
  nodeType: string
): nodeType is AiGenerativeNodeType {
  return (AI_GENERATIVE_NODE_TYPES as readonly string[]).includes(nodeType);
}

/** Localized type label used only when creating a default node name. */
export function resolveGenerativeNodeDefaultBaseName(
  nodeType: string,
  catalogName: string,
  t: (key: string) => string
): string {
  if (nodeType === AI_TEXT_NODE_TYPE) {
    return t("workflow.canvas.aiText");
  }
  if (nodeType === AI_IMAGE_NODE_TYPE) {
    return t("workflow.canvas.aiImage");
  }
  if (nodeType === AI_VIDEO_NODE_TYPE) {
    return t("workflow.canvas.aiVideo");
  }
  if (nodeType === AI_AUDIO_NODE_TYPE) {
    return t("workflow.canvas.aiAudio");
  }
  return catalogName;
}

/**
 * Build a default node name at create time only (type label + sequence).
 * After creation, `data.name` is the single source of truth.
 */
export function resolveGenerativeNodeDisplayName(params: {
  readonly nodeType: string;
  readonly baseName: string;
  readonly existingNodes: ReadonlyArray<GenerativeNodeNamingNode>;
  readonly additionalSameTypeCount?: number;
}): string {
  const { nodeType, baseName, existingNodes, additionalSameTypeCount = 0 } =
    params;

  if (!isGenerativeNodeType(nodeType)) {
    return baseName;
  }

  const existingCount = existingNodes.filter(
    (node) => node.data.nodeType === nodeType
  ).length;

  return `${baseName} ${existingCount + additionalSameTypeCount + 1}`;
}
