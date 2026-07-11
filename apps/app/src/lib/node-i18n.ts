import type { AppLocale, NodeType } from "@dafthunk/types";

import { nodeLabelsZh } from "@/i18n/locales/zh/nodes";

export function localizeNodeType(
  node: NodeType,
  locale: AppLocale
): NodeType {
  if (locale !== "zh") return node;

  const labels = nodeLabelsZh[node.type];
  if (!labels) return node;

  return {
    ...node,
    name: labels.name ?? node.name,
    description: labels.description ?? node.description,
    inputs: node.inputs?.map((input) => ({
      ...input,
      description:
        labels.inputs?.[input.name] ?? input.description,
    })),
    outputs: node.outputs?.map((output) => ({
      ...output,
      description:
        labels.outputs?.[output.name] ?? output.description,
    })),
  };
}

export function localizeNodeTypes(
  nodes: NodeType[],
  locale: AppLocale
): NodeType[] {
  return nodes.map((node) => localizeNodeType(node, locale));
}
