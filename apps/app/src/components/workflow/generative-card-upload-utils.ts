import type { MediaReference } from "@dafthunk/types";
import { isLocalMediaReference } from "@dafthunk/types";

import type { GenerativeCardError } from "@dafthunk/types";
import type { TranslateFn } from "@/i18n";

import { notifyAiMediaCacheChanged } from "@/hooks/use-ai-media-cache";
import { cacheMediaFromUrl } from "@/services/ai-media-cache-service";

import { prepareGenerativeCardError } from "./prepare-generative-card-error";
import type { WorkflowParameter } from "./workflow-types";

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".mkv", ".m4v"]);
const AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".ogg",
  ".flac",
  ".webm",
]);

const EXTENSION_MIME: Readonly<Record<string, string>> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".m4v": "video/x-mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
};

function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

export function normalizeGenerativeCardUploadFile(
  file: File,
  kind: "image" | "video" | "audio"
): File | null {
  const mime = file.type.split(";")[0]?.trim().toLowerCase() ?? "";
  const ext = fileExtension(file.name);
  const extensions =
    kind === "image"
      ? IMAGE_EXTENSIONS
      : kind === "video"
        ? VIDEO_EXTENSIONS
        : AUDIO_EXTENSIONS;
  const prefix = `${kind}/`;

  if (mime.startsWith(prefix)) {
    return file;
  }

  if (!extensions.has(ext)) {
    return null;
  }

  const resolvedMime = EXTENSION_MIME[ext] ?? `${prefix}*`;
  if (mime === resolvedMime) {
    return file;
  }

  return new File([file], file.name, { type: resolvedMime });
}

export function warmGenerativeCardUploadCache(params: {
  readonly organizationId: string;
  readonly workflowId: string | undefined;
  readonly media: MediaReference;
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
}): void {
  if (!params.workflowId || isLocalMediaReference(params.media)) {
    return;
  }

  void cacheMediaFromUrl({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    workflowName: params.workflowId,
    media: params.media,
    nodeType: params.nodeType,
  }).then((cachedOk) => {
    if (cachedOk) {
      notifyAiMediaCacheChanged();
    }
  });
}

export function readGenerativePrompt(
  inputs: readonly WorkflowParameter[]
): string {
  const value = inputs.find((input) => input.id === "prompt")?.value;
  return typeof value === "string" ? value : "";
}

export function withGenerativePromptCleared(
  inputs: readonly WorkflowParameter[]
): WorkflowParameter[] {
  return inputs.map((input) =>
    input.id === "prompt" ? { ...input, value: "" } : input
  );
}

export function canGenerativeCardDoubleClickUpload(params: {
  readonly hasMedia: boolean;
  readonly isGenerating: boolean;
  readonly disabled?: boolean;
  readonly uploading?: boolean;
}): boolean {
  if (params.disabled || params.uploading) {
    return false;
  }
  if (params.hasMedia || params.isGenerating) {
    return false;
  }
  return true;
}

export function hasGenerativePrompt(prompt: string): boolean {
  return prompt.trim().length > 0;
}

export function resolveGenerativeCardUploadError(params: {
  readonly value: MediaReference;
  readonly cloudConfigured: boolean;
  readonly t: TranslateFn;
}): GenerativeCardError | null {
  if (!params.cloudConfigured || !isLocalMediaReference(params.value)) {
    return null;
  }
  return prepareGenerativeCardError(
    params.t("workflow.generativeErrors.cloudUploadFailedSavedLocally"),
    params.t
  );
}

export function generativePromptWithinModelLimit(
  prompt: string,
  maxChars: number
): boolean {
  return prompt.trim().length <= maxChars;
}
