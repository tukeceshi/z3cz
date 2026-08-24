import type {
  TextContentSaveResponse,
  TextContentSyncEvent,
} from "@dafthunk/types";

import { ApiRequestError, makeRequest } from "@/services/utils";

function textContentEndpoint(organizationId: string): string {
  return `/${organizationId}/text-content`;
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

export async function saveTextContent(params: {
  readonly organizationId: string;
  readonly text: string;
  readonly mimeType: string;
  readonly workflowId?: string;
  readonly resourceId?: string;
  readonly baseSha256?: string;
}): Promise<TextContentSaveResponse> {
  try {
    return await makeRequest<TextContentSaveResponse>(
      `${textContentEndpoint(params.organizationId)}/save`,
      {
        method: "POST",
        body: JSON.stringify({
          text: params.text,
          mimeType: params.mimeType,
          workflowId: params.workflowId,
          resourceId: params.resourceId,
          baseSha256: params.baseSha256,
        }),
      }
    );
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 409) {
      throw new TextContentConflictError();
    }
    throw error;
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
    if (event.type === "missing") {
      return;
    }
    if (event.type === "conflict") {
      if (!event.dbSha256) {
        return;
      }
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
