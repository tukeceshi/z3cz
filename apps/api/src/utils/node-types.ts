import type { NodeType } from "@dafthunk/types";
import { AI_GENERATIVE_NODE_TYPES } from "@dafthunk/types";

import type { Bindings } from "../context";
import { loadNodeTypesFromJson } from "../runtime/node-types-from-json";

function filterToCoreGenerativeNodeTypes(
  nodeTypes: readonly NodeType[]
): NodeType[] {
  const allowed = new Set<string>(AI_GENERATIVE_NODE_TYPES);
  return nodeTypes.filter((entry) => allowed.has(entry.type));
}

export async function getAllNodeTypes(
  env: Bindings,
  _executionCtx?: ExecutionContext,
  developerMode = false
): Promise<NodeType[]> {
  if (env.RUNTIME === "node") {
    return filterToCoreGenerativeNodeTypes(loadNodeTypesFromJson());
  }

  const { createCloudflareNodeRegistry } = await import(
    "../runtime/cloudflare-node-registry"
  );
  const registry = await createCloudflareNodeRegistry(env, developerMode);
  return filterToCoreGenerativeNodeTypes(registry.getNodeTypes());
}
