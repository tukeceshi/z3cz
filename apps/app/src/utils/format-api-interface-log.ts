import type { ApiInterfaceRequestLog } from "@dafthunk/types";

export function formatApiLogLine(log: ApiInterfaceRequestLog): string {
  const time = new Date(log.createdAt).toLocaleString();
  const status = log.httpStatus ?? "—";
  const duration =
    log.durationMs !== null ? `${log.durationMs}ms` : "—";
  const operation = log.operation ?? "—";
  return `${time} · ${operation} · ${log.method} · ${status} · ${duration}`;
}

export function formatApiLogDetail(log: ApiInterfaceRequestLog): string {
  return JSON.stringify(
    {
      operation: log.operation,
      method: log.method,
      url: log.url,
      httpStatus: log.httpStatus,
      durationMs: log.durationMs,
      upstreamRequestId: log.upstreamRequestId,
      error: log.error,
      requestBody: log.requestBody,
      responseExcerpt: log.responseExcerpt,
    },
    null,
    2
  );
}
