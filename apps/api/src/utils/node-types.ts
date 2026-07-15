import type { NodeType } from "@dafthunk/types";
import { AI_INTERFACE_NODE_TYPE } from "@dafthunk/types";

import type { Bindings } from "../context";
import { getCloudflareModelNodeTypes } from "../runtime/cloudflare-model-catalog";
import { createCloudflareNodeRegistry } from "../runtime/lazy-node-registry";
import { loadNodeTypesFromJson } from "../runtime/node-types-from-json";

/** Canvas template-as-node types — kept executable for legacy graphs, omitted from catalogs. */
export function isLegacyAiInterfaceCanvasNodeType(nodeType: NodeType): boolean {
  return (
    nodeType.type === AI_INTERFACE_NODE_TYPE ||
    nodeType.id === AI_INTERFACE_NODE_TYPE ||
    nodeType.id.startsWith(`${AI_INTERFACE_NODE_TYPE}-`)
  );
}

export function omitLegacyAiInterfaceCanvasNodes(
  nodeTypes: readonly NodeType[]
): NodeType[] {
  return nodeTypes.filter((entry) => !isLegacyAiInterfaceCanvasNodeType(entry));
}

export async function getAllNodeTypes(
  env: Bindings,
  executionCtx?: ExecutionContext,
  developerMode = false
): Promise<NodeType[]> {
  if (env.RUNTIME === "node") {
    return omitLegacyAiInterfaceCanvasNodes(loadNodeTypesFromJson());
  }

  const registry = await createCloudflareNodeRegistry(env, developerMode);
  const staticNodeTypes = registry.getNodeTypes();

  try {
    const cloudflareNodeTypes = await getCloudflareModelNodeTypes(
      env,
      executionCtx
    );
    return omitLegacyAiInterfaceCanvasNodes([
      ...staticNodeTypes,
      ...cloudflareNodeTypes,
    ]);
  } catch {
    return omitLegacyAiInterfaceCanvasNodes(staticNodeTypes);
  }
}
