import type {
  ModelActivationStatus,
  VolcanoModelActivationCacheEntry,
  VolcanoModelPackageSnapshot,
  VolcanoModelSnapshotRow,
} from "@dafthunk/types";
import { volcanoPackageProvisionModeForCanonicalId } from "@dafthunk/types";

const PROBE_BLOCKING_STATUSES: ReadonlySet<ModelActivationStatus> = new Set([
  "not_open",
  "service_not_open",
]);

export function isVolcanoProbeActivationBlocking(
  status: ModelActivationStatus
): boolean {
  return PROBE_BLOCKING_STATUSES.has(status);
}

export function resolveVolcanoEffectiveActivationStatus(params: {
  probe: VolcanoModelActivationCacheEntry | null;
  packageSnapshot: VolcanoModelPackageSnapshot | null;
  canonicalId: string;
}): ModelActivationStatus | null {
  const probeStatus = params.probe?.status;
  if (probeStatus === "open") return "open";
  if (probeStatus && isVolcanoProbeActivationBlocking(probeStatus)) {
    return probeStatus;
  }
  if (
    probeStatus === "invalid_model_id" ||
    probeStatus === "auth_error" ||
    probeStatus === "transient_error"
  ) {
    return probeStatus;
  }

  const mode = volcanoPackageProvisionModeForCanonicalId(params.canonicalId);
  if (mode === "none") {
    return probeStatus ?? null;
  }

  const provisioned = params.packageSnapshot?.provisioned ?? false;
  if (probeStatus) {
    return probeStatus;
  }

  if (mode === "required" && !provisioned) {
    return "not_open";
  }

  return "unknown";
}

export function isVolcanoModelActivationBlocking(
  row: Pick<
    VolcanoModelSnapshotRow,
    "activation" | "package" | "canonicalId"
  >
): boolean {
  const effective = resolveVolcanoEffectiveActivationStatus({
    probe: row.activation ?? null,
    packageSnapshot: row.package ?? null,
    canonicalId: row.canonicalId,
  });
  return effective !== null && isVolcanoProbeActivationBlocking(effective);
}

export function getVolcanoEffectiveActivationStatus(
  row: Pick<
    VolcanoModelSnapshotRow,
    "activation" | "package" | "canonicalId"
  >
): ModelActivationStatus | null {
  return resolveVolcanoEffectiveActivationStatus({
    probe: row.activation ?? null,
    packageSnapshot: row.package ?? null,
    canonicalId: row.canonicalId,
  });
}
