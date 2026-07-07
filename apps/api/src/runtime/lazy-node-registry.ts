import type { Bindings } from "../context";

export async function createCloudflareNodeRegistry(
  env: Bindings,
  includeTools: boolean
) {
  const { CloudflareNodeRegistry } = await import(
    "./cloudflare-node-registry"
  );
  return new CloudflareNodeRegistry(env, includeTools);
}
