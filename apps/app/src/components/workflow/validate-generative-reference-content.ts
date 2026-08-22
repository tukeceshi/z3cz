import {
  isResourceIdReference,
  normalizeTextModelParameterRules,
  type TextModelParameterRules,
  type WorkflowMediaValue,
} from "@dafthunk/types";

import { resolveMediaResourceFetchUrl } from "@/services/resolve-media-resource-fetch-url";

import {
  classifyReferenceFromNodeType,
  probeVideoUrlDurationSeconds,
} from "./ai-text-node-utils";
import { evaluateGenerativeReferenceReadiness } from "./generative-reference-readiness";
import { resolveReferenceMediaFromSource } from "./generative-reference-utils";
import { probeMediaDuration } from "./studio-media-file-meta";
import { readAiTextCanvasBodySync } from "./resolve-ai-text-result";
import type { WorkflowNodeType } from "./workflow-types";

export type GenerativeReferenceContentLimitReason =
  | "too_large"
  | "too_long"
  | "probe_failed"
  | "not_ready";

export interface GenerativeReferenceContentLimitVerdict {
  readonly ok: boolean;
  readonly reason?: GenerativeReferenceContentLimitReason;
}

async function probeUrlByteSize(url: string): Promise<number | null> {
  try {
    const response = await fetch(url, { method: "HEAD" });
    if (!response.ok) {
      return null;
    }
    const lengthHeader = response.headers.get("content-length");
    if (!lengthHeader) {
      return null;
    }
    const parsed = Number.parseInt(lengthHeader, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  } catch {
    return null;
  }
}

async function resolveMediaFetchUrl(params: {
  readonly media: WorkflowMediaValue;
  readonly organizationId?: string;
}): Promise<string | null> {
  if (!params.organizationId || !isResourceIdReference(params.media)) {
    return null;
  }

  return resolveMediaResourceFetchUrl({
    organizationId: params.organizationId,
    media: params.media,
  });
}

/** Read-only async limits for AI text panel reference pick (size / duration / text length). */
export async function validateGenerativeReferenceContentLimits(params: {
  readonly kind: "text" | "image" | "video";
  readonly rules: TextModelParameterRules;
  readonly sourceData: WorkflowNodeType;
  readonly targetNodeType?: string;
  readonly targetHandleId?: string | null;
  readonly organizationId?: string;
}): Promise<GenerativeReferenceContentLimitVerdict> {
  const rules = normalizeTextModelParameterRules(params.rules);

  const readiness = evaluateGenerativeReferenceReadiness({
    sourceData: params.sourceData,
    targetNodeType: params.targetNodeType,
    targetHandleId: params.targetHandleId,
  });
  if (!readiness.ok) {
    return { ok: false, reason: "not_ready" };
  }

  if (params.kind === "text") {
    const text = readAiTextCanvasBodySync(params.sourceData);
    if (text.length > rules.maxTextReferenceChars) {
      return { ok: false, reason: "too_large" };
    }
    return { ok: true };
  }

  const mediaKind = classifyReferenceFromNodeType(params.sourceData.nodeType);
  if (!mediaKind || mediaKind === "text") {
    return { ok: false, reason: "probe_failed" };
  }

  const output = params.sourceData.outputs?.find(
    (entry) => entry.id === (mediaKind === "image" ? "images" : "videos")
  );
  const media = resolveReferenceMediaFromSource({
    kind: mediaKind,
    sourceData: params.sourceData,
    outputValue: output?.value,
  });
  if (!media) {
    return { ok: false, reason: "not_ready" };
  }

  const fetchUrl = await resolveMediaFetchUrl({
    media,
    organizationId: params.organizationId,
  });
  if (!fetchUrl) {
    return { ok: false, reason: "probe_failed" };
  }

  if (params.kind === "image") {
    const bytes = await probeUrlByteSize(fetchUrl);
    if (bytes == null) {
      return { ok: false, reason: "probe_failed" };
    }
    if (bytes > rules.maxImageReferenceBytes) {
      return { ok: false, reason: "too_large" };
    }
    return { ok: true };
  }

  const bytes = await probeUrlByteSize(fetchUrl);
  if (bytes == null) {
    return { ok: false, reason: "probe_failed" };
  }
  if (bytes > rules.maxVideoReferenceBytes) {
    return { ok: false, reason: "too_large" };
  }

  try {
    const seconds = fetchUrl.startsWith("blob:")
      ? await probeVideoUrlDurationSeconds(fetchUrl)
      : await probeMediaDuration(fetchUrl, "video");
    if (seconds > rules.maxVideoReferenceSeconds) {
      return { ok: false, reason: "too_long" };
    }
  } catch {
    return { ok: false, reason: "probe_failed" };
  }

  return { ok: true };
}
