import { AiAudioNode } from "@dafthunk/runtime/nodes/ai/ai-audio-node";
import { AiImageNode } from "@dafthunk/runtime/nodes/ai/ai-image-node";
import { AiTextNode } from "@dafthunk/runtime/nodes/ai/ai-text-node";
import { AiVideoNode } from "@dafthunk/runtime/nodes/ai/ai-video-node";
import type { NodeType } from "@dafthunk/types";
import { AI_GENERATIVE_NODE_TYPES } from "@dafthunk/types";

import type { Bindings } from "../context";

const CORE_NODE_TYPES: readonly NodeType[] = [
  AiTextNode.nodeType,
  AiImageNode.nodeType,
  AiVideoNode.nodeType,
  AiAudioNode.nodeType,
];

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
    return filterToCoreGenerativeNodeTypes(CORE_NODE_TYPES);
  }

  const { createCloudflareNodeRegistry } = await import(
    "../runtime/cloudflare-node-registry"
  );
  const registry = await createCloudflareNodeRegistry(env, developerMode);
  return filterToCoreGenerativeNodeTypes(registry.getNodeTypes());
}
