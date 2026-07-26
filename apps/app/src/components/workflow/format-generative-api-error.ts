import type { TranslateFn, TranslationKey } from "@/i18n";

interface KnownGenerativeErrorRule {
  readonly pattern: RegExp;
  readonly key: TranslationKey;
}

const KNOWN_GENERATIVE_ERROR_RULES: readonly KnownGenerativeErrorRule[] = [
  {
    pattern: /prompt is required|a prompt or reference/i,
    key: "workflow.generativeErrors.promptRequired",
  },
  {
    pattern: /prompt exceeds maximum length/i,
    key: "workflow.generativeErrors.promptTooLong",
  },
  {
    pattern: /video generation timed out|generation timed out/i,
    key: "workflow.generativeErrors.timedOut",
  },
  {
    pattern: /video generation failed|generation failed/i,
    key: "workflow.generativeErrors.generationFailed",
  },
  {
    pattern: /model is not available|not available for this organization/i,
    key: "workflow.generativeErrors.modelUnavailable",
  },
  {
    pattern: /could not resolve ai interface|no ai interface configured/i,
    key: "workflow.generativeErrors.interfaceUnavailable",
  },
  {
    pattern: /submit failed|upstream returned non-json/i,
    key: "workflow.generativeErrors.upstreamFailed",
  },
  {
    pattern: /request failed with status:\s*502/i,
    key: "workflow.generativeErrors.upstreamFailed",
  },
  {
    pattern: /request failed with status:\s*429/i,
    key: "workflow.generativeErrors.rateLimited",
  },
  {
    pattern: /invalid url|invalid parameter|parameter error|400/i,
    key: "workflow.generativeErrors.invalidParams",
  },
  {
    pattern: /local browser-only reference/i,
    key: "workflow.generativeErrors.localReferenceUnsupported",
  },
  {
    pattern: /cloud_storage_unhealthy|cloud storage is unavailable|bucket cors does not allow/i,
    key: "workflow.generativeErrors.cloudStorageUnavailable",
  },
  {
    pattern: /cloud upload failed|failed to fetch|browser direct upload/i,
    key: "workflow.generativeErrors.cloudUploadFailed",
  },
] as const;

function readNestedMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const candidates = [record.message, record.error, record.detail, record.msg];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
    if (candidate && typeof candidate === "object") {
      const nested = readNestedMessage(candidate);
      if (nested) return nested;
    }
  }

  return null;
}

/** Pull a human-readable message from API / thrown error text. */
export function extractGenerativeApiErrorMessage(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      const nested = readNestedMessage(parsed);
      if (nested) return nested;
    } catch {
      // fall through
    }
  }

  return trimmed.replace(/^Error:\s*/i, "").trim();
}

function simplifyFallbackDetail(message: string): string {
  const withoutJson = message
    .replace(/^\{[\s\S]*\}$/u, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!withoutJson) return message.slice(0, 160);
  if (withoutJson.length <= 160) return withoutJson;
  return `${withoutJson.slice(0, 157)}…`;
}

/** Format API errors for card display with locale-aware copy. */
export function formatGenerativeApiError(
  raw: string,
  t: TranslateFn
): string {
  const message = extractGenerativeApiErrorMessage(raw);
  if (!message) {
    return t("workflow.generativeErrors.generationFailed");
  }

  for (const rule of KNOWN_GENERATIVE_ERROR_RULES) {
    if (rule.pattern.test(message)) {
      return t(rule.key);
    }
  }

  return t("workflow.generativeErrors.generic", {
    detail: simplifyFallbackDetail(message),
  });
}
