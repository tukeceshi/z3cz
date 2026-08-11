import type { MediaReference } from "@dafthunk/types";
import { isLocalMediaReference } from "@dafthunk/types";

import type { GenerativeCardError } from "@dafthunk/types";
import type { TranslateFn } from "@/i18n";

import { notifyAiMediaCacheChanged } from "@/hooks/use-ai-media-cache";
import { cacheMediaFromUrl } from "@/services/ai-media-cache-service";

import { prepareGenerativeCardError } from "./prepare-generative-card-error";
import type { WorkflowParameter } from "./workflow-types";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png"]);
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

  if (kind === "image") {
    if (IMAGE_MIME_TYPES.has(mime)) {
      return file;
    }
    if (!extensions.has(ext)) {
      return null;
    }
    const resolvedMime = EXTENSION_MIME[ext] ?? "image/jpeg";
    return new File([file], file.name, { type: resolvedMime });
  }

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

/** File picker accept list for generative image card / studio uploads. */
export const GENERATIVE_IMAGE_UPLOAD_ACCEPT = "image/png,image/jpeg,.png,.jpg,.jpeg";

const GENERATIVE_STUDIO_DROP_EXTENSION_SET = new Set<string>([
  ...IMAGE_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
  ...AUDIO_EXTENSIONS,
]);

/** Supported extensions for studio list file-drop (display + validation). */
export const GENERATIVE_STUDIO_DROP_EXTENSIONS = [
  ...GENERATIVE_STUDIO_DROP_EXTENSION_SET,
].sort() as readonly string[];

export type GenerativeStudioDropKind = "image" | "video" | "audio";

export interface GenerativeStudioDropFile {
  readonly kind: GenerativeStudioDropKind;
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
  readonly file: File;
}

export function resolveGenerativeStudioDropFile(
  file: File
): GenerativeStudioDropFile | null {
  for (const kind of ["image", "video", "audio"] as const) {
    const normalized = normalizeGenerativeCardUploadFile(file, kind);
    if (!normalized) {
      continue;
    }
    return {
      kind,
      nodeType:
        kind === "image"
          ? "ai-image"
          : kind === "video"
            ? "ai-video"
            : "ai-audio",
      file: normalized,
    };
  }
  return null;
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

export type GenerativeCardUploadKind = "image" | "video" | "audio";

const GENERATIVE_UPLOAD_DISPLAY_TYPES: Readonly<
  Record<GenerativeCardUploadKind, readonly string[]>
> = {
  image: ["PNG", "JPG"],
  video: ["MP4", "WebM", "MOV", "MKV", "M4V"],
  audio: ["MP3", "WAV", "M4A", "AAC", "OGG", "FLAC"],
};

export function formatGenerativeCardUploadFileTypes(
  kind: GenerativeCardUploadKind
): string {
  return GENERATIVE_UPLOAD_DISPLAY_TYPES[kind].join("、");
}

export function canGenerativeCardUpload(params: {
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
