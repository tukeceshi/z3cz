import {
  getResourceIdFromValue,
  isLocalMediaReference,
  type WorkflowMediaValue,
} from "@dafthunk/types";

const memoryAliases = new Map<string, string>();

function aliasStorageKey(
  organizationId: string,
  workflowId: string
): string {
  return `dafthunk:media-aliases:${organizationId}:${workflowId}`;
}

function aliasMapKey(
  organizationId: string,
  workflowId: string,
  fromMediaId: string
): string {
  return `${organizationId}:${workflowId}:${fromMediaId}`;
}

function readPersistedAliases(
  organizationId: string,
  workflowId: string
): Record<string, string> {
  try {
    const raw = localStorage.getItem(aliasStorageKey(organizationId, workflowId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

function writePersistedAlias(
  organizationId: string,
  workflowId: string,
  fromMediaId: string,
  toMediaId: string
): void {
  const persisted = readPersistedAliases(organizationId, workflowId);
  persisted[fromMediaId] = toMediaId;
  localStorage.setItem(
    aliasStorageKey(organizationId, workflowId),
    JSON.stringify(persisted)
  );
}

export function recordMediaResourceAlias(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly fromMediaId: string;
  readonly toMediaId: string;
}): void {
  if (
    !params.fromMediaId ||
    !params.toMediaId ||
    params.fromMediaId === params.toMediaId
  ) {
    return;
  }

  const key = aliasMapKey(
    params.organizationId,
    params.workflowId,
    params.fromMediaId
  );
  memoryAliases.set(key, params.toMediaId);
  writePersistedAlias(
    params.organizationId,
    params.workflowId,
    params.fromMediaId,
    params.toMediaId
  );
}

export function resolveMediaResourceAlias(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly fromMediaId: string;
}): string | null {
  const key = aliasMapKey(
    params.organizationId,
    params.workflowId,
    params.fromMediaId
  );
  const cached = memoryAliases.get(key);
  if (cached) return cached;

  const persisted = readPersistedAliases(params.organizationId, params.workflowId);
  const toMediaId = persisted[params.fromMediaId];
  if (toMediaId) {
    memoryAliases.set(key, toMediaId);
    return toMediaId;
  }
  return null;
}

export function objectReferenceFromStorageKey(params: {
  readonly storageKey: string;
  readonly mimeType: string;
}): ObjectReference {
  return {
    id: params.storageKey,
    mimeType: params.mimeType,
    storageBackend: "volcengine_tos",
    storageKey: params.storageKey,
  };
}

export function resolveCanonicalResourceId(params: {
  readonly media: WorkflowMediaValue;
  readonly organizationId: string;
  readonly workflowId: string;
}): string {
  const key = getResourceIdFromValue(params.media);
  if (!key) {
    return "";
  }
  if (!isLocalMediaReference(params.media)) {
    return key;
  }
  return (
    resolveMediaResourceAlias({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      fromMediaId: params.media.mediaId,
    }) ?? key
  );
}

export function resolveCanonicalMediaReference(params: {
  readonly media: WorkflowMediaValue;
  readonly organizationId: string;
  readonly workflowId: string;
}): WorkflowMediaValue {
  if (!isLocalMediaReference(params.media)) {
    return params.media;
  }

  const alias = resolveMediaResourceAlias({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    fromMediaId: params.media.mediaId,
  });
  if (!alias) {
    return params.media;
  }

  return {
    resourceId: alias,
    mimeType: params.media.mimeType,
  };
}
