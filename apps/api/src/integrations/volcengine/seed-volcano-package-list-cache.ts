import type { Bindings } from "../../context";
import { createDatabase } from "../../db";
import {
  getOrganizationAiInterfaceRow,
  updateOrganizationAiInterface,
} from "../../db/ai-interface-queries";
import { getVolcanoCredentials } from "./ensure-api-key";
import {
  isVolcanoMetadata,
  parseInterfaceMetadata,
  serializeInterfaceMetadata,
} from "./metadata";
import { readPackageListCache } from "./package-list-cache";
import { resolveVolcanoPackageRows } from "./resolve-package-rows";

export async function seedVolcanoPackageListCache(params: {
  readonly env: Bindings;
  readonly organizationId: string;
  readonly interfaceId: string;
}): Promise<void> {
  const db = createDatabase(params.env);
  const row = await getOrganizationAiInterfaceRow(
    db,
    params.organizationId,
    params.interfaceId
  );
  if (!row) {
    return;
  }

  const metadata = parseInterfaceMetadata(row.metadata);
  if (!isVolcanoMetadata(metadata)) {
    return;
  }

  if (readPackageListCache(metadata)) {
    return;
  }

  const credentials = await getVolcanoCredentials(
    params.env,
    params.organizationId,
    row.metadata
  );
  if (!credentials) {
    return;
  }

  await resolveVolcanoPackageRows({
    credentials,
    metadata,
    refreshPackages: true,
    onMetadataCacheUpdate: async (nextMetadata) => {
      await updateOrganizationAiInterface(db, params.organizationId, row.id, {
        metadata: serializeInterfaceMetadata(nextMetadata),
      });
    },
  });
}
