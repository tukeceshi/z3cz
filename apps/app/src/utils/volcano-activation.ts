import type {
  ModelActivationStatus,
  VolcanoModelSnapshotRow,
} from "@dafthunk/types";
import {
  isVolcanoModelActivationBlocking as isVolcanoModelActivationBlockingFromTypes,
  isVolcanoProbeActivationBlocking,
  resolveVolcanoEffectiveActivationStatus,
} from "@dafthunk/types";

export {
  isVolcanoProbeActivationBlocking,
  resolveVolcanoEffectiveActivationStatus,
};

export function isVolcanoModelActivationBlocking(
  row: Pick<
    VolcanoModelSnapshotRow,
    "activation" | "package" | "canonicalId"
  >
): boolean {
  return isVolcanoModelActivationBlockingFromTypes({
    probe: row.activation ?? null,
    packageSnapshot: row.package ?? null,
    canonicalId: row.canonicalId,
  });
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
