import type { NodeContext } from "../../node-types";

export async function resolveModelInterfaceIdFromInputs(
  rawInterfaceId: string | undefined,
  modelCanonicalId: string,
  infer?: (canonicalId: string) => Promise<string | undefined>
): Promise<string | undefined> {
  const trimmedInterfaceId = rawInterfaceId?.trim();
  if (trimmedInterfaceId) {
    return trimmedInterfaceId;
  }

  const modelId = modelCanonicalId.trim();
  if (!modelId || !infer) {
    return undefined;
  }

  return infer(modelId);
}

export function readModelInterfaceIdInput(
  context: NodeContext
): string | undefined {
  return typeof context.inputs.ai_interface_id === "string" &&
    context.inputs.ai_interface_id.trim().length > 0
    ? context.inputs.ai_interface_id.trim()
    : undefined;
}
