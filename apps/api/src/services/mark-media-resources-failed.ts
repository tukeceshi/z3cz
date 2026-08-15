import type { Database } from "../db";
import { upsertMediaResources } from "../db/media-resource-queries";

export async function markMediaResourcesFailed(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly resourceIds: readonly string[];
    readonly mimeType: string;
  }
): Promise<void> {
  if (params.resourceIds.length === 0) {
    return;
  }

  await upsertMediaResources(
    db,
    params.resourceIds.map((id) => ({
      id,
      organizationId: params.organizationId,
      kind: "ephemeral",
      mimeType: params.mimeType,
      generating: false,
      failed: true,
    }))
  );
}

export function placeholderMimeTypeForModality(
  modality: string | null | undefined
): string {
  switch (modality) {
    case "video":
      return "video/mp4";
    case "audio":
      return "audio/mpeg";
    default:
      return "image/png";
  }
}
