import type {
  ModelActivationStatus,
  VolcanoModelActivationCacheEntry,
} from "./volcano-activation";
import { volcanoPackageProvisionModeForCanonicalId } from "./volcano-package-catalog";
import type { VolcanoModelPackageSnapshot } from "./volcano-snapshot";

const PROBE_BLOCKING_STATUSES: ReadonlySet<ModelActivationStatus> = new Set([
  "not_open",
  "service_not_open",
]);

export function isVolcanoProbeActivationBlocking(
  status: ModelActivationStatus
): boolean {
  return PROBE_BLOCKING_STATUSES.has(status);
}

/**
 * Effective activation for panel / snapshot display.
 * Provisioned billing packages override stale inconclusive probes (common for
 * newly added catalog models probed before package mapping existed).
 */
export function resolveVolcanoEffectiveActivationStatus(params: {
  readonly probe: VolcanoModelActivationCacheEntry | null;
  readonly packageSnapshot: VolcanoModelPackageSnapshot | null;
  readonly canonicalId: string;
}): ModelActivationStatus | null {
  const probeStatus = params.probe?.status;
  const provisioned = params.packageSnapshot?.provisioned ?? false;
  const mode = volcanoPackageProvisionModeForCanonicalId(params.canonicalId);

  if (probeStatus === "open") {
    return "open";
  }

  if (probeStatus === "auth_error") {
    return "auth_error";
  }

  if (provisioned && mode === "required") {
    return "open";
  }

  if (probeStatus && isVolcanoProbeActivationBlocking(probeStatus)) {
    return probeStatus;
  }

  if (
    probeStatus === "invalid_model_id" ||
    probeStatus === "transient_error"
  ) {
    return probeStatus;
  }

  if (mode === "none") {
    return probeStatus ?? null;
  }

  if (probeStatus) {
    return probeStatus;
  }

  if (mode === "required" && !provisioned) {
    return "not_open";
  }

  return "unknown";
}

export function isVolcanoModelActivationBlocking(params: {
  readonly probe: VolcanoModelActivationCacheEntry | null;
  readonly packageSnapshot: VolcanoModelPackageSnapshot | null;
  readonly canonicalId: string;
}): boolean {
  const effective = resolveVolcanoEffectiveActivationStatus(params);
  return effective !== null && isVolcanoProbeActivationBlocking(effective);
}
