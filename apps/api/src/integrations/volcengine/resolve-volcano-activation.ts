import type {
  AiModelCatalogEntry,
  VolcanoActivationProbeResult,
  VolcanoModelPackageSnapshot,
} from "@dafthunk/types";
import {
  isVolcanoModelActivationBlocking,
  isVolcanoProbeActivationBlocking,
  resolveVolcanoEffectiveActivationStatus,
} from "@dafthunk/types";

export {
  isVolcanoModelActivationBlocking,
  isVolcanoProbeActivationBlocking,
  resolveVolcanoEffectiveActivationStatus,
};

/**
 * Wizard credential probe: when billing shows a provisioned package, treat the
 * model as opened even if inference probe is inconclusive (common after
 * openManagement without custom endpoints).
 */
export function enrichVolcanoProbeResultsWithPackages(params: {
  results: readonly VolcanoActivationProbeResult[];
  packageByCanonicalId: ReadonlyMap<string, VolcanoModelPackageSnapshot>;
}): VolcanoActivationProbeResult[] {
  return params.results.map((result) => {
    const snapshot = params.packageByCanonicalId.get(result.canonicalId);
    if (!snapshot?.provisioned) {
      return result;
    }
    if (result.status === "open" || result.status === "auth_error") {
      return result;
    }
    return {
      ...result,
      status: "open",
    };
  });
}

export function hasProvisionedVolcanoPackageModels(
  packageByCanonicalId: ReadonlyMap<string, VolcanoModelPackageSnapshot>
): boolean {
  for (const snapshot of packageByCanonicalId.values()) {
    if (snapshot.provisioned) {
      return true;
    }
  }
  return false;
}

export function buildVolcanoProbeResultsFromPackages(params: {
  entries: readonly AiModelCatalogEntry[];
  packageByCanonicalId: ReadonlyMap<string, VolcanoModelPackageSnapshot>;
}): VolcanoActivationProbeResult[] {
  const probedAt = new Date().toISOString();

  return params.entries.map((entry) => {
    const provisioned =
      params.packageByCanonicalId.get(entry.canonicalId)?.provisioned ?? false;

    return {
      canonicalId: entry.canonicalId,
      providerModelId: entry.providerModelId,
      status: provisioned ? "open" : "not_open",
      errorCode: null,
      message: null,
      probedAt,
    };
  });
}

/** Wizard probe: collapse inconclusive statuses into open vs not_open. */
export function normalizeVolcanoWizardProbeResults(
  results: readonly VolcanoActivationProbeResult[]
): VolcanoActivationProbeResult[] {
  return results.map((result) => {
    if (result.status === "open" || result.status === "auth_error") {
      return result;
    }
    return { ...result, status: "not_open" };
  });
}
