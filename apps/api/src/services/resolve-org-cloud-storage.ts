import type {
  OrganizationAiInterface,
  VolcanoInterfaceMetadata,
  VolcanoTosStorageConfig,
} from "@dafthunk/types";

import type { Database } from "../db/index";
import { listOrganizationAiInterfaces } from "../db/ai-interface-queries";
import {
  isVolcanoMetadata,
  parseInterfaceMetadata,
} from "../integrations/volcengine/metadata";
import { isVolcanoAiInterfaceProvider } from "@dafthunk/types";

export interface ResolvedOrgCloudStorage {
  readonly interfaceId: string;
  readonly accessKeyId: string;
  readonly secretAccessKeyEncrypted: string;
  readonly tosStorage: VolcanoTosStorageConfig;
  readonly region: string;
}

export function resolveTosStorageFromMetadata(
  metadata: unknown
): VolcanoTosStorageConfig | null {
  if (!isVolcanoMetadata(metadata)) return null;
  const tos = metadata.tosStorage;
  if (!tos?.enabled || !tos.bucket.trim()) return null;
  return {
    enabled: true,
    bucket: tos.bucket.trim(),
    region: tos.region?.trim() || metadata.region,
    prefix: tos.prefix?.trim() || "z3cz",
  };
}

export function isOrgCloudStorageConfigured(
  interfaces: readonly OrganizationAiInterface[]
): boolean {
  return interfaces.some((iface) => {
    if (!iface.enabled || !isVolcanoAiInterfaceProvider(iface.provider)) {
      return false;
    }
    return resolveTosStorageFromMetadata(iface.metadata) !== null;
  });
}

export async function resolveOrgCloudStorage(
  db: Database,
  organizationId: string
): Promise<ResolvedOrgCloudStorage | null> {
  const interfaces = await listOrganizationAiInterfaces(db, organizationId);

  for (const iface of interfaces) {
    if (!iface.enabled || !isVolcanoAiInterfaceProvider(iface.provider)) {
      continue;
    }

    const metadata = parseInterfaceMetadata(iface.metadata);
    if (!isVolcanoMetadata(metadata)) continue;

    const tosStorage = resolveTosStorageFromMetadata(metadata);
    if (!tosStorage) continue;

    return {
      interfaceId: iface.id,
      accessKeyId: metadata.accessKeyId,
      secretAccessKeyEncrypted: metadata.secretAccessKeyEncrypted,
      tosStorage,
      region: metadata.region,
    };
  }

  return null;
}

export function mergeVolcanoTosStorage(
  metadata: VolcanoInterfaceMetadata,
  tosStorage: VolcanoTosStorageConfig
): VolcanoInterfaceMetadata {
  return {
    ...metadata,
    tosStorage: {
      enabled: tosStorage.enabled,
      bucket: tosStorage.bucket.trim(),
      region: tosStorage.region.trim() || metadata.region,
      prefix: tosStorage.prefix.trim() || "z3cz",
    },
  };
}
