import type { NodeType } from "@dafthunk/types";

import type { Bindings } from "../context";
import { getCloudflareModelNodeTypes } from "../runtime/cloudflare-model-catalog";
import { getAiInterfaceNodeTypes } from "../runtime/cloudflare-ai-interface-catalog";
import { createCloudflareNodeRegistry } from "../runtime/lazy-node-registry";
import { loadNodeTypesFromJson } from "../runtime/node-types-from-json";

export async function getAllNodeTypes(
  env: Bindings,
  executionCtx?: ExecutionContext,
  developerMode = false
): Promise<NodeType[]> {
  if (env.RUNTIME === "node") {
    const staticTypes = loadNodeTypesFromJson();
    try {
      const aiNodeTypes = await getAiInterfaceNodeTypes(env, executionCtx);
      return [...staticTypes, ...aiNodeTypes];
    } catch {
      return staticTypes;
    }
  }

  const registry = await createCloudflareNodeRegistry(env, developerMode);
  const staticNodeTypes = registry.getNodeTypes();

  try {
    const cloudflareNodeTypes = await getCloudflareModelNodeTypes(
      env,
      executionCtx
    );
    const aiNodeTypes = await getAiInterfaceNodeTypes(env, executionCtx);
    return [...staticNodeTypes, ...cloudflareNodeTypes, ...aiNodeTypes];
  } catch {
    return staticNodeTypes;
  }
}
