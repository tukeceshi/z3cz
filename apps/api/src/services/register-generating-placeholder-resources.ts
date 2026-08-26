import type { Database } from "../db";
import { registerMediaResources } from "./media-resource-catalog-service";

export async function registerGeneratingPlaceholderResources(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly count?: number;
    readonly mimeType: string;
    readonly modelCanonicalId?: string;
  }
): Promise<readonly string[]> {
  const count = params.count ?? 1;
  const resourceIds = Array.from({ length: count }, () => crypto.randomUUID());

  await registerMediaResources(db, {
    organizationId: params.organizationId,
    resources: resourceIds.map((id) => ({
      id,
      kind: "ephemeral" as const,
      mimeType: params.mimeType,
      generating: true,
      ...(params.modelCanonicalId
        ? { modelCanonicalId: params.modelCanonicalId }
        : {}),
    })),
  });

  return resourceIds;
}
