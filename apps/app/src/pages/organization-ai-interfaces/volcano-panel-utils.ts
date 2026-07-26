import type {
  OrganizationAiInterface,
  VolcanoInterfaceMetadata,
  VolcanoSnapshotResponse,
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
