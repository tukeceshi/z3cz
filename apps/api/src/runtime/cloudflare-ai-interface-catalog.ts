import type { NodeType } from "@dafthunk/types";

import type { Bindings } from "../context";
import { cachedJson } from "../utils/edge-cache";
import { CloudflareAiInterfaceService } from "./cloudflare-ai-interface-service";

const CACHE_HOST = "https://cache.dafthunk.internal";
const NODE_TYPES_CACHE_KEY = `${CACHE_HOST}/ai-interface/node-types`;
const NODE_TYPES_TTL = 60 * 15;

async function fetchAiInterfaceNodeTypes(env: Bindings): Promise<NodeType[]> {
  const service = new CloudflareAiInterfaceService(env);
  const manifest = await service.loadManifest();
  return manifest?.nodeTypes ? [...manifest.nodeTypes] : [];
}

export async function getAiInterfaceNodeTypes(
  env: Bindings,
  executionCtx?: ExecutionContext
): Promise<NodeType[]> {
  if (env.RUNTIME === "node" || !executionCtx) {
    return fetchAiInterfaceNodeTypes(env);
  }

  return cachedJson(
    NODE_TYPES_CACHE_KEY,
    NODE_TYPES_TTL,
    executionCtx,
    () => fetchAiInterfaceNodeTypes(env)
  );
}
