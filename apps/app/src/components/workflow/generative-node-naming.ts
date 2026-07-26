import {
  AI_GENERATIVE_NODE_TYPES,
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

export function formatLocalizedGenerativeNodeDisplayName(params: {
  readonly nodeType: string;
  readonly storedName: string;
  readonly localizedBaseName: string;
}): string {
  if (!isGenerativeNodeType(params.nodeType)) {
    return params.storedName;
  }

  const suffixMatch = params.storedName.match(/\s(\d+)$/);
  if (!suffixMatch) {
    return params.localizedBaseName;
  }

  return `${params.localizedBaseName} ${suffixMatch[1]}`;
}
