import {
  isVolcanoAiInterfaceProvider,
  type SingleModelProviderMetadata,
} from "@dafthunk/types";

import type { Database } from "../db";
import {
  getOrganizationAiInterfaceRow,
  updateOrganizationAiInterface,
} from "../db/ai-interface-queries";
import { listPlatformAiModels } from "../db/platform-ai-model-queries";
import { mergeSingleModelModelEnabledMetadata } from "../integrations/single-model/metadata";
import {
  isVolcanoMetadata,
  mergeVolcanoModelEnabled,
  parseInterfaceMetadata,
  serializeInterfaceMetadata,
} from "../integrations/volcengine/metadata";
import { toVolcanoCatalogEntriesFromPlatform } from "./resolve-text-model-interface";

export async function disableTextModelOnInterface(
  db: Database,
  organizationId: string,
  interfaceId: string,
  canonicalId: string
): Promise<boolean> {
  const row = await getOrganizationAiInterfaceRow(
    db,
    organizationId,
    interfaceId
  );
  if (!row || !row.enabled) {
    return false;
  }

  const metadata = parseInterfaceMetadata(row.metadata);
  const platformModels = await listPlatformAiModels(db, "text");
  const catalogEntries = toVolcanoCatalogEntriesFromPlatform(platformModels);

  if (isVolcanoAiInterfaceProvider(row.provider)) {
    if (!isVolcanoMetadata(metadata)) {
      return false;
    }
    const nextMetadata = mergeVolcanoModelEnabled(
      metadata,
      { [canonicalId]: false },
      catalogEntries
    );
    await updateOrganizationAiInterface(db, organizationId, interfaceId, {
      metadata: serializeInterfaceMetadata(nextMetadata),
    });
    return true;
  }

  if (row.provider === "custom") {
    const singleMetadata = metadata as SingleModelProviderMetadata | null;
    if (
      !singleMetadata ||
      typeof singleMetadata !== "object" ||
      !("models" in singleMetadata) ||
      !singleMetadata.models[canonicalId]
    ) {
      return false;
    }
    const nextMetadata = mergeSingleModelModelEnabledMetadata(
      singleMetadata,
      { [canonicalId]: false }
    );
    await updateOrganizationAiInterface(db, organizationId, interfaceId, {
      metadata: serializeInterfaceMetadata(nextMetadata),
    });
    return true;
  }

  return false;
}
