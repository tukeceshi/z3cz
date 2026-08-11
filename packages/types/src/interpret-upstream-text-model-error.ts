import {
  buildGenerativeErrorHaystack,
  extractGenerativeErrorMessage,
  matchGenerativeErrorRule,
  type GenerativeErrorLocale,
} from "./generative-error-rules";

export { extractGenerativeErrorMessage as extractUpstreamErrorMessage };

export function interpretUpstreamTextModelError(
  raw: string,
  locale: GenerativeErrorLocale = "zh"
): string | undefined {
  return matchGenerativeErrorRule({
    raw,
    modelKind: "text",
    locale,
  })?.message;
}

/** Client disconnect / refresh — treated as a transient upstream failure. */
export function isClientCancelledTextModelError(raw: string): boolean {
  const haystack = raw.trim();
  if (!haystack) {
    return false;
  }

  return (
    /^generation cancelled\.?$/iu.test(haystack) ||
    /user aborted a request/iu.test(haystack) ||
    /this operation was aborted/iu.test(haystack) ||
    /the operation was aborted/iu.test(haystack) ||
    /request was aborted/iu.test(haystack) ||
    /stream ended without completion event/iu.test(haystack) ||
    /stream returned no text/iu.test(haystack) ||
    /network error when attempting to fetch resource/iu.test(haystack) ||
    /ECONNRESET|ECONNABORTED|connection reset|broken pipe/iu.test(haystack)
  );
}

/** Transient upstream failures (timeout, rate limit, 5xx, client cancel). */
export function isTransientTextModelUpstreamError(raw: string): boolean {
  if (isClientCancelledTextModelError(raw)) {
    return true;
  }

  const haystack = buildGenerativeErrorHaystack(raw);
  if (!haystack) {
    return false;
  }

  return (
    /timeout|timed\s+out|aborted|etimedout|请求超时/iu.test(haystack) ||
    /429|rate\s+limit|too\s+many\s+requests|请求过于频繁/iu.test(haystack) ||
    /5\d\d|bad\s+gateway|service\s+unavailable|gateway\s+timeout|暂时不可用/iu.test(
      haystack
    )
  );
}

export function buildTextModelInvocationErrorParts(params: {
  readonly upstreamError?: string;
  readonly locale?: GenerativeErrorLocale;
}): readonly string[] {
  const raw = params.upstreamError?.trim();
  if (!raw) {
    return [];
  }

  const locale = params.locale ?? "zh";
  const interpretation = interpretUpstreamTextModelError(raw, locale);
  const lines: string[] = [];

  if (interpretation) {
    lines.push(locale === "zh" ? `解读：${interpretation}` : `Hint: ${interpretation}`);
  }
  lines.push(raw);
  return lines;
}

export function buildTextModelInvocationError(params: {
  readonly upstreamError?: string;
  readonly locale?: GenerativeErrorLocale;
}): string {
  const lines = buildTextModelInvocationErrorParts(params);
  return lines.length > 0 ? lines.join("\n") : "";
}
