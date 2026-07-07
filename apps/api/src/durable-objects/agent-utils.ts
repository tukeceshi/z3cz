/**
 * Agent SDK utilities
 *
 * Typed wrapper for `getAgentByName` from the agents SDK.
 * The runtime export exists but its type declaration is not visible to
 * TypeScript due to bundled d.ts transitive dependency resolution issues.
 */

type GetAgentByName = <T extends Rpc.DurableObjectBranded | undefined>(
  namespace: DurableObjectNamespace<T>,
  name: string
) => Promise<DurableObjectStub<T>>;

let cachedGetAgentByName: GetAgentByName | null | undefined;

async function loadGetAgentByName(): Promise<GetAgentByName | null> {
  if (cachedGetAgentByName !== undefined) {
    return cachedGetAgentByName;
  }

  try {
    const agents = await import("agents");
    cachedGetAgentByName = (agents as unknown as Record<string, unknown>)
      .getAgentByName as GetAgentByName;
  } catch (error) {
    console.warn("Agents SDK is not available in this runtime:", error);
    cachedGetAgentByName = null;
  }

  return cachedGetAgentByName;
}

/**
 * Get an Agent stub by name with proper partyserver initialization.
 *
 * This is the SDK's `getAgentByName` which internally sends a dummy fetch
 * with the x-partykit-room header to initialize the DO name before returning
 * the stub. This ensures `this.name` is available for subsequent RPC calls.
 */
export async function getAgentByName<
  T extends Rpc.DurableObjectBranded | undefined,
>(
  namespace: DurableObjectNamespace<T>,
  name: string
): Promise<DurableObjectStub<T>> {
  const getAgent = await loadGetAgentByName();
  if (!getAgent) {
    throw new Error(
      "Durable Object agents are not available in the Node.js runtime yet"
    );
  }

  return getAgent(namespace, name);
}
