import type {
  OrganizationAiInterface,
  VolcanoInterfaceMetadata,
  VolcanoMediaKitSnapshot,
  VolcanoSnapshotResponse,
} from "@dafthunk/types";
import {
  buildVolcanoMediaKitSnapshot,
  createDefaultVolcanoMediaKitConfig,
} from "@dafthunk/types";

export function isTosStorageEnabled(
  iface: OrganizationAiInterface,
  snapshot: VolcanoSnapshotResponse | null
): boolean {
  if (snapshot?.tosStorage?.enabled === true) {
    return true;
  }

  const metadata = iface.metadata as VolcanoInterfaceMetadata | null | undefined;
  const config = metadata?.tosStorage;
  if (config?.enabled !== true) {
    return false;
  }

  return Boolean(config.region?.trim() && config.bucket?.trim());
}

export function resolveMediaKitSnapshot(
  iface: OrganizationAiInterface,
  snapshot: VolcanoSnapshotResponse | null
): VolcanoMediaKitSnapshot {
  if (snapshot?.mediaKit) {
    return snapshot.mediaKit;
  }

  const metadata = iface.metadata as VolcanoInterfaceMetadata | null | undefined;
  if (metadata?.credentialMode === "volcengine_iam") {
    return buildVolcanoMediaKitSnapshot({ metadata });
  }

  return createDefaultVolcanoMediaKitConfig();
}

/** @deprecated Use resolveMediaKitSnapshot */
export function resolveMediaKitEnhanceSnapshot(
  iface: OrganizationAiInterface,
  snapshot: VolcanoSnapshotResponse | null
): VolcanoMediaKitSnapshot {
  return resolveMediaKitSnapshot(iface, snapshot);
}

export function countNotOpenModelsFromMetadata(
  iface: OrganizationAiInterface
): number {
  const metadata = iface.metadata as VolcanoInterfaceMetadata | null | undefined;
  const cache = metadata?.modelActivationCache;
  if (!cache) {
    return 0;
  }

  return Object.values(cache).filter(
    (entry) => entry.status === "not_open" || entry.status === "service_not_open"
  ).length;
}
