import type { TransformPollMapping } from "@dafthunk/types";

import type { VolcanoVideoPollResult } from "./execute-volcano-video";

export function getValueByDotPath(source: unknown, path: string): unknown {
  const trimmedPath = path.trim();
  if (!trimmedPath || source === null || source === undefined) {
    return undefined;
  }

  let current: unknown = source;
  for (const segment of trimmedPath.split(".")) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function extractPollErrorMessage(body: unknown, fallback: string): string {
  if (typeof body !== "object" || body === null) {
    return fallback;
  }

  const errorValue = (body as { error?: unknown }).error;
  if (typeof errorValue === "string" && errorValue.trim()) {
    return errorValue.trim();
  }
  if (
    typeof errorValue === "object" &&
    errorValue !== null &&
    "message" in errorValue &&
    typeof (errorValue as { message?: unknown }).message === "string"
  ) {
    const message = (errorValue as { message: string }).message.trim();
    if (message) {
      return message;
    }
  }

  return fallback;
}

export function parsePollResponse(
  body: unknown,
  pollMapping: TransformPollMapping
): VolcanoVideoPollResult {
  const statusRaw = getValueByDotPath(body, pollMapping.statusKey);
  const status = String(statusRaw ?? "").trim().toLowerCase();
  const failedValues = new Set(
    pollMapping.failedValues.map((value) => value.trim().toLowerCase())
  );
  const successValues = new Set(
    pollMapping.successValues.map((value) => value.trim().toLowerCase())
  );

  if (failedValues.has(status)) {
    return {
      status: "failed",
      error: extractPollErrorMessage(body, `Video task ${status || "failed"}`),
    };
  }

  if (successValues.has(status)) {
    const outputValue = getValueByDotPath(body, pollMapping.outputKey);
    const videoUrl =
      typeof outputValue === "string" && outputValue.trim()
        ? outputValue.trim()
        : undefined;
    if (!videoUrl) {
      return {
        status: "failed",
        error: "Task succeeded but no video URL was returned",
      };
    }
    return { status: "completed", videoUrl };
  }

  if (status === "queued" || status === "pending" || status === "created") {
    return { status: "pending", upstreamPhase: "queued" };
  }

  return { status: "pending", upstreamPhase: "running" };
}
