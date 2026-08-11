export interface GenerativeCardError {
  readonly summary: string;
  readonly cardLines?: readonly string[];
  readonly subline?: string;
  readonly detail?: string;
}

const SUMMARY_MAX_LENGTH = 48;

function truncateSummary(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= SUMMARY_MAX_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, SUMMARY_MAX_LENGTH - 1)}…`;
}

function isGenerativeCardError(value: unknown): value is GenerativeCardError {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.summary === "string" && record.summary.trim().length > 0;
}

function readCardLines(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const lines = value
    .filter(
      (line): line is string =>
        typeof line === "string" && line.trim().length > 0
    )
    .map((line) => line.trim());
  return lines.length > 0 ? lines : undefined;
}

export function getGenerativeCardLines(
  error: GenerativeCardError
): readonly string[] {
  if (error.cardLines?.length) {
    return error.cardLines;
  }
  const lines = [error.summary, error.subline].filter(
    (line): line is string => Boolean(line?.trim())
  );
  return lines.length > 0 ? lines : [error.summary];
}

export function serializeGenerativeCardError(
  error: GenerativeCardError
): string {
  const cardLines = getGenerativeCardLines(error);
  return JSON.stringify({
    summary: error.summary.trim(),
    cardLines,
    ...(error.subline?.trim() ? { subline: error.subline.trim() } : {}),
    ...(error.detail?.trim() ? { detail: error.detail.trim() } : {}),
  });
}

export function parseGenerativeCardErrorStored(
  raw: string
): GenerativeCardError | undefined {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!isGenerativeCardError(parsed)) {
      return undefined;
    }
    const record = parsed as unknown as Record<string, unknown>;
    const cardLines = readCardLines(record.cardLines);
    return {
      summary: parsed.summary.trim(),
      cardLines,
      subline:
        typeof parsed.subline === "string" && parsed.subline.trim()
          ? parsed.subline.trim()
          : undefined,
      detail:
        typeof parsed.detail === "string" && parsed.detail.trim()
          ? parsed.detail.trim()
          : undefined,
    };
  } catch {
    return undefined;
  }
}

/** Parse text-model failure copy into card fields. */
export function parseTextModelFailureMessageToCardError(
  raw: string
): GenerativeCardError | undefined {
  const detail = raw.trim();
  if (!detail) {
    return undefined;
  }

  const lines = detail.split("\n").map((line) => line.trim()).filter(Boolean);
  const firstLine = lines[0];
  if (!firstLine) {
    return undefined;
  }

  const isTextModelFailure =
    firstLine.endsWith("调用失败") ||
    firstLine.endsWith(" request failed") ||
    firstLine.endsWith(" request failed.");

  if (!isTextModelFailure) {
    return undefined;
  }

  const cardLines = lines.map((line) => {
    if (line.startsWith("原因：")) {
      return line.slice("原因：".length).trim();
    }
    if (line.startsWith("Reason:")) {
      return line.replace(/^Reason:\s*/iu, "").trim();
    }
    return line;
  });

  return {
    summary: firstLine,
    cardLines,
    detail: cardLines.join("\n"),
  };
}

export function normalizeGenerativeCardError(raw: string): GenerativeCardError {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      summary: "生成失败",
      cardLines: ["生成失败"],
      detail: trimmed,
    };
  }

  const stored = parseGenerativeCardErrorStored(trimmed);
  if (stored) {
    return stored;
  }

  const textModel = parseTextModelFailureMessageToCardError(trimmed);
  if (textModel) {
    return textModel;
  }

  const lines = trimmed.split("\n").map((line) => line.trim()).filter(Boolean);
  const firstLine = lines[0] ?? trimmed;
  const summary = truncateSummary(firstLine);

  return {
    summary,
    cardLines: lines.length > 0 ? lines : [summary],
    subline: lines.length > 1 ? truncateSummary(lines[1]!) : undefined,
    detail: trimmed,
  };
}

export function ensureGenerativeCardErrorDetail(
  error: GenerativeCardError,
  rawFallback?: string
): GenerativeCardError {
  const withLines =
    error.cardLines?.length && error.cardLines.length > 0
      ? error
      : {
          ...error,
          cardLines: getGenerativeCardLines(error),
        };

  if (withLines.detail?.trim()) {
    return withLines;
  }

  const fallback = rawFallback?.trim() || withLines.summary.trim();
  return {
    ...withLines,
    detail: fallback,
  };
}
