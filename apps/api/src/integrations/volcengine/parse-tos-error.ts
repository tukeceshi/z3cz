export interface ParsedTosError {
  readonly httpStatus: number;
  readonly code: string | null;
  readonly message: string | null;
}

export function parseTosErrorResponse(
  httpStatus: number,
  body: string
): ParsedTosError {
  const trimmed = body.trim();

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const code =
        typeof parsed.Code === "string"
          ? parsed.Code
          : typeof parsed.code === "string"
            ? parsed.code
            : null;
      const message =
        typeof parsed.Message === "string"
          ? parsed.Message
          : typeof parsed.message === "string"
            ? parsed.message
            : null;
      return { httpStatus, code, message };
    } catch {
      return { httpStatus, code: null, message: trimmed.slice(0, 200) };
    }
  }

  const codeMatch = trimmed.match(/<Code>([^<]+)<\/Code>/i);
  const messageMatch = trimmed.match(/<Message>([^<]+)<\/Message>/i);
  const xmlMessage = messageMatch?.[1]?.trim();
  return {
    httpStatus,
    code: codeMatch?.[1]?.trim() ?? null,
    message: xmlMessage ?? (trimmed.slice(0, 200) || null),
  };
}
