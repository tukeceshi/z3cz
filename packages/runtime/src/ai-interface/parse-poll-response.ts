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

const VIDEO_POLL_FAILED_STATUSES = new Set([
  "failed",
  "failure",
  "expired",
  "error",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readErrorMessage(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  const record = asRecord(value);
  if (typeof record?.message === "string" && record.message.trim()) {
    return record.message.trim();
  }
  return undefined;
}

export function readVideoPollStatus(body: unknown): string {
  const record = asRecord(body);
  if (!record) {
    return "";
  }
  if (typeof record.status === "string" && record.status.trim()) {
    return record.status.trim().toLowerCase();
  }
  const nested = asRecord(record.data);
  if (typeof nested?.status === "string" && nested.status.trim()) {
    return nested.status.trim().toLowerCase();
  }
  return "";
}

export function extractPollErrorMessage(
  body: unknown,
  fallback: string
): string {
  const record = asRecord(body);
  if (!record) {
    return fallback;
  }
  const nested = asRecord(record.data);
  const inner = asRecord(nested?.data);
  const candidates = [
    readErrorMessage(inner?.error),
    readErrorMessage(nested?.error),
    readErrorMessage(record.error),
    typeof nested?.fail_reason === "string" ? nested.fail_reason.trim() : undefined,
    typeof record.fail_reason === "string" ? record.fail_reason.trim() : undefined,
  ];
  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }
  return fallback;
}

export function parseOfficialVolcanoPollBody(
  body: unknown
): VolcanoVideoPollResult {
  const status = readVideoPollStatus(body);
  if (VIDEO_POLL_FAILED_STATUSES.has(status)) {
    return {
      status: "failed",
      error: extractPollErrorMessage(body, `Video task ${status || "failed"}`),
    };
  }

  const record = asRecord(body);
  const nested = asRecord(record?.data);
  const videoUrl =
    (typeof asRecord(record?.content)?.video_url === "string"
      ? String(asRecord(record?.content)?.video_url).trim()
      : "") ||
    (typeof asRecord(nested?.content)?.video_url === "string"
      ? String(asRecord(nested?.content)?.video_url).trim()
      : "");

  if (status === "succeeded" || status === "success") {
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

export function parsePollResponse(
  body: unknown,
  pollMapping: TransformPollMapping
): VolcanoVideoPollResult {
  const statusRaw = getValueByDotPath(body, pollMapping.statusKey);
  const status = String(statusRaw ?? "").trim().toLowerCase() || readVideoPollStatus(body);
  const failedValues = new Set([
    ...pollMapping.failedValues.map((value) => value.trim().toLowerCase()),
    ...VIDEO_POLL_FAILED_STATUSES,
  ]);
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
