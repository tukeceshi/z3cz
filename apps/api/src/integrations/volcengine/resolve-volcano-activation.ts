import type {
  ModelActivationStatus,
  VolcanoModelActivationCacheEntry,
  VolcanoModelPackageSnapshot,
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

export function isVolcanoModelActivationBlocking(params: {
  probe: VolcanoModelActivationCacheEntry | null;
  packageSnapshot: VolcanoModelPackageSnapshot | null;
  canonicalId: string;
}): boolean {
  const effective = resolveVolcanoEffectiveActivationStatus(params);
  return effective !== null && isVolcanoProbeActivationBlocking(effective);
}
