const UPSTREAM_HTTP_ERROR_PREFIX =
  /^Upstream request failed \(\d+\):\s*/iu;

interface InterpretationRule {
  readonly test: (text: string) => boolean;
  readonly zh: string;
  readonly en: string;
}

const INTERPRETATION_RULES: readonly InterpretationRule[] = [
  {
    test: (text) =>
      /余额不足|insufficient\s+balance|accountoverdue|account.?overdue|overdue.?balance/iu.test(
        text
      ),
    zh: "账户余额不足，请充值后重试。",
    en: "Account balance is insufficient. Please top up and retry.",
  },
  {
    test: (text) =>
      /invalid\s+api\s+key|incorrect\s+api\s+key|unauthorized|authentication|api\s+key.*invalid|401/iu.test(
        text
      ),
    zh: "API Key 无效或已失效，请检查接口配置。",
    en: "API Key is invalid or expired. Check the interface settings.",
  },
  {
    test: (text) =>
      /429|rate\s+limit|too\s+many\s+requests|请求过于频繁/iu.test(text),
    zh: "请求过于频繁，请稍后重试。",
    en: "Too many requests. Please try again later.",
  },
  {
    test: (text) =>
      /model\s+not\s+found|invalid\s+model|does\s+not\s+exist|unknown\s+model|模型不存在|无效模型/iu.test(
        text
      ),
    zh: "模型 ID 配置有误，请在接口设置中核对。",
    en: "Model ID is misconfigured. Verify it in interface settings.",
  },
  {
    test: (text) =>
      /quota|额度|资源包|insufficientquota|exceeded.*limit|用量.*用尽/iu.test(
        text
      ),
    zh: "免费额度或资源包已用尽。",
    en: "Free quota or resource package has been used up.",
  },
  {
    test: (text) =>
      /timeout|timed\s+out|aborted|etimedout|请求超时/iu.test(text),
    zh: "请求超时，请稍后重试。",
    en: "Request timed out. Please try again later.",
  },
];

function readJsonMessageField(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const errorField = record.error;
  if (errorField && typeof errorField === "object") {
    const nested = errorField as Record<string, unknown>;
    if (typeof nested.message === "string" && nested.message.trim()) {
      return nested.message.trim();
    }
  }
  if (typeof record.message === "string" && record.message.trim()) {
    return record.message.trim();
  }
  return undefined;
}

/** Strip HTTP wrapper and pull message from JSON bodies when present. */
export function extractUpstreamErrorMessage(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }

  const withoutPrefix = trimmed.replace(UPSTREAM_HTTP_ERROR_PREFIX, "").trim();
  if (!withoutPrefix.startsWith("{") && !withoutPrefix.startsWith("[")) {
    return withoutPrefix || trimmed;
  }

  try {
    const parsed: unknown = JSON.parse(withoutPrefix);
    return readJsonMessageField(parsed) ?? withoutPrefix;
  } catch {
    return withoutPrefix || trimmed;
  }
}

export function interpretUpstreamTextModelError(
  raw: string,
  locale: "zh" | "en" = "zh"
): string | undefined {
  const extracted = extractUpstreamErrorMessage(raw);
  const haystack = `${raw}\n${extracted}`.trim();
  if (!haystack) {
    return undefined;
  }

  for (const rule of INTERPRETATION_RULES) {
    if (rule.test(haystack)) {
      return locale === "zh" ? rule.zh : rule.en;
    }
  }

  return undefined;
}

/** Client disconnect / refresh — must not auto-disable the org model/interface. */
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

/** Transient upstream failures must not auto-disable the org model/interface. */
export function isTransientTextModelUpstreamError(raw: string): boolean {
  if (isClientCancelledTextModelError(raw)) {
    return true;
  }

  const extracted = extractUpstreamErrorMessage(raw);
  const haystack = `${raw}\n${extracted}`.trim();
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
  readonly locale?: "zh" | "en";
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
  readonly locale?: "zh" | "en";
}): string {
  const lines = buildTextModelInvocationErrorParts(params);
  return lines.length > 0 ? lines.join("\n") : "";
}
