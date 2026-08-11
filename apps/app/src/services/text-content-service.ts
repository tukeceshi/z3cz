import type {
  TextContentConflictResponse,
  TextContentRegisterResponse,
  TextContentStageRequest,
  TextContentSyncEvent,
} from "@dafthunk/types";

import { makeRequest } from "@/services/utils";
import {
  applyTextEditOps,
  diffTextToOps,
} from "@/utils/text-content-utils";

function textContentEndpoint(organizationId: string): string {
  return `/api/${organizationId}/text-content`;
}

export async function registerTextContent(params: {
  readonly organizationId: string;
  readonly contentSha256: string;
  readonly mimeType: string;
  readonly contentLength: number;
  readonly workflowId?: string;
  readonly replacesResourceId?: string;
}): Promise<TextContentRegisterResponse> {
  return makeRequest<TextContentRegisterResponse>(
    `${textContentEndpoint(params.organizationId)}/register`,
    {
      method: "POST",
      body: JSON.stringify({
        contentSha256: params.contentSha256,
        mimeType: params.mimeType,
        contentLength: params.contentLength,
        workflowId: params.workflowId,
        replacesResourceId: params.replacesResourceId,
      }),
    }
  );
}

export async function uploadTextContentBlob(params: {
  readonly uploadUrl: string;
  readonly uploadHeaders: Record<string, string>;
  readonly blob: Blob;
}): Promise<void> {
  const response = await fetch(params.uploadUrl, {
    method: "PUT",
    headers: {
      ...params.uploadHeaders,
      "Content-Type": params.blob.type || "text/plain; charset=utf-8",
    },
    body: params.blob,
  });
  if (!response.ok) {
    throw new Error(`Text upload failed (${response.status})`);
  }
}

export class TextContentConflictError extends Error {
  readonly conflict = true as const;
  readonly dbSha256?: string;

  constructor(dbSha256?: string) {
    super("Text content conflict");
    this.name = "TextContentConflictError";
    this.dbSha256 = dbSha256;
  }
}

export async function stageTextContentEdits(params: {
  readonly organizationId: string;
  readonly request: TextContentStageRequest;
}): Promise<void> {
  const { buildApiUrl } = await import("@/config/api");
  const response = await fetch(
    buildApiUrl(`${textContentEndpoint(params.organizationId)}/stage`),
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params.request),
    }
  );

  if (response.status === 409) {
    const body = (await response.json()) as TextContentConflictResponse;
    throw new TextContentConflictError(body.dbSha256);
  }

  if (!response.ok) {
    throw new Error(`Text stage failed (${response.status})`);
  }
}

async function readSyncEventStream(
  response: Response,
  onEvent: (event: TextContentSyncEvent) => void
): Promise<void> {
  if (!response.body) {
    throw new Error("No sync stream body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const line = chunk
        .split("\n")
        .map((entry) => entry.trim())
        .find((entry) => entry.startsWith("data:"));
      if (!line) {
        continue;
      }
      const data = line.slice(5).trim();
      if (!data) {
        continue;
      }
      onEvent(JSON.parse(data) as TextContentSyncEvent);
    }
  }
}

export async function syncTextContent(params: {
  readonly organizationId: string;
  readonly resourceId: string;
  readonly localSha?: string;
  readonly localText?: string;
}): Promise<{
  readonly text: string;
  readonly contentSha256: string;
  readonly conflict?: boolean;
  readonly downloadUrl?: string;
  readonly dbSha256?: string;
}> {
  const { buildApiUrl } = await import("@/config/api");
  const query = new URLSearchParams({ resourceId: params.resourceId });
  if (params.localSha) {
    query.set("localSha", params.localSha);
  }

  const response = await fetch(
    buildApiUrl(`${textContentEndpoint(params.organizationId)}/sync?${query}`),
    { credentials: "include" }
  );

  if (!response.ok) {
    throw new Error(`Text sync failed (${response.status})`);
  }

  let text = params.localText ?? "";
  let contentSha256 = params.localSha ?? "";
  let conflict = false;
  let downloadUrl: string | undefined;
  let dbSha256: string | undefined;

  await readSyncEventStream(response, (event) => {
    if (event.type === "conflict") {
      conflict = true;
      dbSha256 = event.dbSha256;
      return;
    }
    if (event.type === "unchanged") {
      contentSha256 = event.dbSha256;
      return;
    }
    if (event.type === "download") {
      downloadUrl = event.downloadUrl;
      dbSha256 = event.dbSha256;
      contentSha256 = event.dbSha256;
      return;
    }
    if (event.type === "append") {
      text += event.text;
      return;
    }
    if (event.type === "replace") {
      text = applyTextEditOps(text, [event]);
      return;
    }
    if (event.type === "done") {
      contentSha256 = event.pendingSha256;
    }
  });

  return {
    text,
    contentSha256,
    ...(conflict ? { conflict: true } : {}),
    ...(downloadUrl ? { downloadUrl } : {}),
    ...(dbSha256 ? { dbSha256 } : {}),
  };
}

export async function downloadTextContentFromUrl(
  downloadUrl: string
): Promise<string> {
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Text download failed (${response.status})`);
  }
  return response.text();
}

export function buildTextStageRequest(params: {
  readonly resourceId: string;
  readonly baseSha256: string;
  readonly pendingSha256: string;
  readonly oldText: string;
  readonly newText: string;
}): TextContentStageRequest {
  return {
    resourceId: params.resourceId,
    baseSha256: params.baseSha256,
    pendingSha256: params.pendingSha256,
    ops: diffTextToOps(params.oldText, params.newText),
  };
}
