import {
  isResourceIdReference,
  type MediaResourceKind,
  type WorkflowMediaValue,
} from "@dafthunk/types";

export function markResourceRefFailed(
  media: WorkflowMediaValue
): WorkflowMediaValue {
  if (!isResourceIdReference(media)) {
    return media;
  }
  const { generating: _generating, ...rest } = media;
  return {
    ...rest,
    failed: true,
  };
}

export function stripGeneratingFlag(
  media: WorkflowMediaValue
): WorkflowMediaValue {
  if (!isResourceIdReference(media) || !media.generating) {
    return media;
  }
  const { generating: _generating, ...rest } = media;
  return rest;
}

export function applyResourceKind(
  media: WorkflowMediaValue,
  kind: MediaResourceKind
): WorkflowMediaValue {
  if (!isResourceIdReference(media) || media.kind === kind) {
    return media;
  }
  return { ...media, kind };
}

export function mapMediaResourceKinds(
  media: readonly WorkflowMediaValue[],
  kindsById: ReadonlyMap<string, MediaResourceKind>
): readonly WorkflowMediaValue[] {
  if (kindsById.size === 0) {
    return media;
  }
  let changed = false;
  const next = media.map((entry) => {
    if (!isResourceIdReference(entry)) {
      return entry;
    }
    const kind = kindsById.get(entry.resourceId);
    if (!kind) {
      return entry;
    }
    const mapped = applyResourceKind(entry, kind);
    if (mapped !== entry) {
      changed = true;
    }
    return mapped;
  });
  return changed ? next : media;
}
