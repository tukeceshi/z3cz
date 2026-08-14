import {
  inferAiTextMimeType,
  isResourceIdReference,
  type WorkflowMediaValue,
} from "@dafthunk/types";
import { getResourceIdFromValue } from "@dafthunk/types";

import { notifyAiMediaCacheChanged } from "@/services/ai-media-cache-events";
import {
  cacheMediaFromBlob,
  getCachedMediaBlob,
} from "@/services/ai-media-cache-service";
import { readAiTextContent } from "@/services/ai-text-storage-service";
import { notifyTextContentConflict } from "@/services/text-content-conflict";
import {
  downloadTextContentFromUrl,
  syncTextContent,
} from "@/services/text-content-service";
import { resolveMediaResourceFetchUrl } from "@/services/resolve-media-resource-fetch-url";
import { sha256HexFromText } from "@/utils/text-content-utils";

const FAILED_COOLDOWN_MS = 30_000;

type HydrateState = "idle" | "downloading" | "done" | "failed";

interface HydrateEntry {
  readonly state: HydrateState;
  readonly promise: Promise<boolean> | null;
  readonly failedAt: number | null;
}

export interface EnsureAiTextCachedParams {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly reference: WorkflowMediaValue;
  readonly workflowSha?: string;
}

const hydrateCoordinator = new Map<string, HydrateEntry>();

function hydrateKey(
  organizationId: string,
  workflowId: string,
  mediaId: string
): string {
  return `${organizationId}:${workflowId}:${mediaId}`;
}

function readHydrateEntry(key: string): HydrateEntry {
  return (
    hydrateCoordinator.get(key) ?? {
      state: "idle",
      promise: null,
      failedAt: null,
    }
  );
}

function isInFailedCooldown(entry: HydrateEntry): boolean {
  if (entry.state !== "failed" || entry.failedAt == null) {
    return false;
  }
  return Date.now() - entry.failedAt < FAILED_COOLDOWN_MS;
}

/** @internal — exported for unit tests */
export function isEmptyLocalText(body: string): boolean {
  return body.trim().length === 0;
}

/** Sync 前提：本地有正文且指纹与 workflow 一致；空本地视为首次 hydrate。 */
/** @internal — exported for unit tests */
export async function isLocalTextTrustedForSync(
  localBody: string,
  workflowSha: string | undefined
): Promise<boolean> {
  if (isEmptyLocalText(localBody)) {
    return false;
  }
  if (!workflowSha) {
    return true;
  }
  const localSha = await sha256HexFromText(localBody.trim());
  return localSha === workflowSha;
}

async function bodyMatchesWorkflowSha(
  body: string,
  workflowSha: string | undefined
): Promise<boolean> {
  if (isEmptyLocalText(body)) {
    return false;
  }
  if (!workflowSha) {
    return true;
  }
  return (await sha256HexFromText(body.trim())) === workflowSha;
}

interface SyncTextFromCloudParams {
  readonly organizationId: string;
  readonly resourceId: string;
  readonly localText: string;
  readonly localSha?: string;
}

async function syncTextFromCloud(
  params: SyncTextFromCloudParams
): Promise<{
  readonly text: string | null;
  readonly conflict: boolean;
}> {
  const sync = await syncTextContent({
    organizationId: params.organizationId,
    resourceId: params.resourceId,
    localText: params.localText,
    ...(params.localSha ? { localSha: params.localSha } : {}),
  });

  if (sync.conflict) {
    return { text: null, conflict: true };
  }

  if (sync.downloadUrl) {
    const downloaded = await downloadTextContentFromUrl(sync.downloadUrl);
    return { text: downloaded, conflict: false };
  }

  if (sync.text.trim()) {
    return { text: sync.text, conflict: false };
  }

  return { text: null, conflict: false };
}

async function fetchAiTextBodyFromCloud(
  params: EnsureAiTextCachedParams
): Promise<string | null> {
  if (!isResourceIdReference(params.reference)) {
    return null;
  }

  const localBody =
    (await readAiTextContent({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      value: params.reference,
    })) ?? "";

  const trusted = await isLocalTextTrustedForSync(
    localBody,
    params.workflowSha
  );

  try {
    const firstPass = await syncTextFromCloud({
      organizationId: params.organizationId,
      resourceId: params.reference.resourceId,
      localText: trusted ? localBody : "",
      ...(trusted && params.workflowSha
        ? { localSha: params.workflowSha }
        : {}),
    });

    if (firstPass.conflict) {
      notifyTextContentConflict();
      return trusted ? localBody : null;
    }

    let body = firstPass.text;

    if (
      body &&
      params.workflowSha &&
      !(await bodyMatchesWorkflowSha(body, params.workflowSha))
    ) {
      body = null;
    }

    // 空本地 / unchanged 误判 / 指纹不对 → 不带 localSha 全量拉取
    if (!body?.trim()) {
      const fullDownload = await syncTextFromCloud({
        organizationId: params.organizationId,
        resourceId: params.reference.resourceId,
        localText: "",
      });

      if (fullDownload.conflict) {
        notifyTextContentConflict();
        return null;
      }

      body = fullDownload.text;
    }

    if (body?.trim()) {
      return body;
    }
  } catch {
    // fall through to resource resolve
  }

  const fetchUrl = await resolveMediaResourceFetchUrl({
    organizationId: params.organizationId,
    media: params.reference,
  });
  if (!fetchUrl) {
    return null;
  }

  try {
    const response = await fetch(fetchUrl, { credentials: "include" });
    if (!response.ok) {
      return null;
    }
    return response.text();
  } catch {
    return null;
  }
}

async function localBodyMatchesSha(
  body: string,
  workflowSha: string | undefined
): Promise<boolean> {
  return bodyMatchesWorkflowSha(body, workflowSha);
}

async function writeAiTextToIndexedDb(
  params: EnsureAiTextCachedParams,
  body: string
): Promise<boolean> {
  const mediaId = getResourceIdFromValue(params.reference);
  if (!mediaId) {
    return false;
  }

  const mimeType =
    params.reference.mimeType ?? inferAiTextMimeType(body);
  const blob = new Blob([body], { type: mimeType });

  const stored = await cacheMediaFromBlob({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    workflowName: params.workflowId,
    mediaId,
    blob,
    mimeType,
    nodeType: "ai-text",
  });

  if (stored) {
    notifyAiMediaCacheChanged();
  }

  return stored;
}

async function runEnsureAiTextCached(
  params: EnsureAiTextCachedParams
): Promise<boolean> {
  const mediaId = getResourceIdFromValue(params.reference);
  if (!mediaId) {
    return false;
  }

  const existingBlob = await getCachedMediaBlob({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    mediaId,
  });

  if (existingBlob) {
    const existingText = await existingBlob.text();
    if (
      existingText.trim() &&
      (await localBodyMatchesSha(existingText, params.workflowSha))
    ) {
      return true;
    }
  }

  if (!isResourceIdReference(params.reference)) {
    return false;
  }

  const body = await fetchAiTextBodyFromCloud(params);
  if (!body?.trim()) {
    return false;
  }

  return writeAiTextToIndexedDb(params, body);
}

/** Ensure ai-text blob exists in IndexedDB — rehydrate from cloud when missing. */
export async function ensureAiTextCached(
  params: EnsureAiTextCachedParams
): Promise<boolean> {
  const mediaId = getResourceIdFromValue(params.reference);
  if (!mediaId || !params.workflowId) {
    return false;
  }

  const key = hydrateKey(params.organizationId, params.workflowId, mediaId);
  const entry = readHydrateEntry(key);

  if (entry.state === "done") {
    const blob = await getCachedMediaBlob({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      mediaId,
    });
    if (blob != null) {
      return true;
    }
    hydrateCoordinator.delete(key);
  }

  if (entry.state === "downloading" && entry.promise) {
    return entry.promise;
  }

  if (isInFailedCooldown(entry)) {
    return false;
  }

  const promise = runEnsureAiTextCached(params)
    .then((ok) => {
      hydrateCoordinator.set(key, {
        state: ok ? "done" : "failed",
        promise: null,
        failedAt: ok ? null : Date.now(),
      });
      return ok;
    })
    .catch(() => {
      hydrateCoordinator.set(key, {
        state: "failed",
        promise: null,
        failedAt: Date.now(),
      });
      return false;
    });

  hydrateCoordinator.set(key, {
    state: "downloading",
    promise,
    failedAt: null,
  });

  return promise;
}

export function ensureAiTextCachedInBackground(
  params: EnsureAiTextCachedParams
): void {
  void ensureAiTextCached(params).catch(() => {
    // Best-effort background hydrate.
  });
}

/** Reset coordinator state when local cache entry is deleted. */
export function invalidateAiTextHydrateState(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
}): void {
  hydrateCoordinator.delete(
    hydrateKey(params.organizationId, params.workflowId, params.mediaId)
  );
}
