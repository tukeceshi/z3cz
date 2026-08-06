const RESPONSE_EXCERPT_MAX = 2048;
const BASE64_REDACT_MIN_CHARS = 256;

export interface UpstreamRequestLogSink {
  (record: {
    readonly method: string;
    readonly url: string;
    readonly httpStatus: number | null;
    readonly durationMs: number | null;
    readonly upstreamRequestId: string | null;
    readonly requestBody: Record<string, unknown> | null;
    readonly responseExcerpt: string | null;
    readonly error: string | null;
  }): void | Promise<void>;
}

/** Strip query/hash so signed URLs are not persisted. */
export function redactMediaUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    const withoutQuery = raw.split("?")[0] ?? raw;
    return withoutQuery.split("#")[0] ?? withoutQuery;
  }
}

function looksLikeBase64Payload(value: string): boolean {
  if (value.startsWith("data:") && value.includes(";base64,")) {
    return true;
  }
  if (value.length < BASE64_REDACT_MIN_CHARS) {
    return false;
  }
  return /^[A-Za-z0-9+/=\s]+$/.test(value.slice(0, 120));
}

export function redactJsonValue(value: unknown): unknown {
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value) || value.includes("://")) {
      return redactMediaUrl(value);
    }
    if (looksLikeBase64Payload(value)) {
      return `[redacted base64, ${value.length} chars]`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactJsonValue(entry));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (
        lower === "authorization" ||
        lower === "api_key" ||
        lower === "apikey" ||
        lower === "access_key" ||
        lower === "secret_key" ||
        lower === "databas64" ||
        lower === "data_base64" ||
        lower === "b64_json" ||
        lower.includes("base64")
      ) {
        out[key] = "[redacted]";
        continue;
      }
      out[key] = redactJsonValue(entry);
    }
    return out;
  }
  return value;
}

export function redactRequestBody(
  body: unknown
): Record<string, unknown> | null {
  if (body === undefined || body === null) {
    return null;
  }
  if (typeof body === "string") {
    try {
      return redactRequestBody(JSON.parse(body) as unknown);
    } catch {
      return { raw: "[non-json body redacted]" };
    }
  }
  const redacted = redactJsonValue(body);
  if (redacted && typeof redacted === "object" && !Array.isArray(redacted)) {
    return redacted as Record<string, unknown>;
  }
  return { value: redacted as unknown };
}

export function excerptResponseText(text: string): string {
  if (text.length <= RESPONSE_EXCERPT_MAX) {
    return text;
  }
  return `${text.slice(0, RESPONSE_EXCERPT_MAX)}…`;
}

export function extractUpstreamRequestId(
  responseText: string,
  parsed: unknown
): string | null {
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    const id = obj.id;
    if (typeof id === "string" && id.trim().length > 0) {
      return id.trim();
    }
    const error = obj.error;
    if (error && typeof error === "object") {
      const errObj = error as Record<string, unknown>;
      const requestId = errObj.request_id ?? errObj.requestId;
      if (typeof requestId === "string" && requestId.trim().length > 0) {
        return requestId.trim();
      }
    }
  }
  const match = /Request id:\s*([A-Za-z0-9_-]+)/i.exec(responseText);
  return match?.[1] ?? null;
}

export interface FetchWithUpstreamLogOptions {
  /** When "stream", success responses are returned untouched (body not buffered). */
  readonly responseMode?: "json" | "stream";
}

/**
 * fetch wrapper that persists a redacted upstream request log via sink.
 * Logging failures never fail the caller.
 */
export async function fetchWithUpstreamLog(
  url: string,
  init: RequestInit,
  sink?: UpstreamRequestLogSink,
  options?: FetchWithUpstreamLogOptions
): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const requestBody = redactRequestBody(init.body ?? null);
  const started = Date.now();
  const responseMode = options?.responseMode ?? "json";

  if (!sink) {
    return fetch(url, init);
  }

  try {
    const response = await fetch(url, init);
    const durationMs = Date.now() - started;

    if (responseMode === "stream" && response.ok) {
      try {
        await sink({
          method,
          url: redactMediaUrl(url),
          httpStatus: response.status,
          durationMs,
          upstreamRequestId: null,
          requestBody,
          responseExcerpt: "[sse stream]",
          error: null,
        });
      } catch {
        // never block upstream path on log persistence
      }
      return response;
    }

    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = null;
    }

    try {
      await sink({
        method,
        url: redactMediaUrl(url),
        httpStatus: response.status,
        durationMs,
        upstreamRequestId: extractUpstreamRequestId(text, parsed),
        requestBody,
        responseExcerpt: excerptResponseText(text),
        error: response.ok
          ? null
          : excerptResponseText(
              typeof parsed === "object" &&
                parsed &&
                "error" in parsed &&
                typeof (parsed as { error?: { message?: string } }).error
                  ?.message === "string"
                ? String(
                    (parsed as { error?: { message?: string } }).error?.message
                  )
                : text
            ),
      });
    } catch {
      // never block upstream path on log persistence
    }

    return new Response(text, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    const durationMs = Date.now() - started;
    const message =
      error instanceof Error ? error.message : "Upstream fetch failed";
    try {
      await sink({
        method,
        url: redactMediaUrl(url),
        httpStatus: null,
        durationMs,
        upstreamRequestId: null,
        requestBody,
        responseExcerpt: null,
        error: message,
      });
    } catch {
      // ignore
    }
    throw error;
  }
}
