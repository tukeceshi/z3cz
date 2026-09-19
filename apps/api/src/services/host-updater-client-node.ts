import type { SystemUpdateStatus } from "@dafthunk/types";
import http from "node:http";

const REQUEST_TIMEOUT_MS = 15_000;

export async function requestHostUpdater(
  socketPath: string,
  token: string,
  method: "GET" | "POST",
  pathname: string,
  body?: Record<string, string>
): Promise<SystemUpdateStatus> {
  const payload = body ? JSON.stringify(body) : undefined;
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        socketPath,
        path: pathname,
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...(payload
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
              }
            : {}),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          try {
            const parsed = JSON.parse(text) as
              | SystemUpdateStatus
              | { error?: string; data?: SystemUpdateStatus };
            if (response.statusCode && response.statusCode >= 400) {
              const failure = parsed as {
                error?: string;
                data?: SystemUpdateStatus;
              };
              const error = new Error(
                failure.error || `Host Updater HTTP ${response.statusCode}`
              );
              (error as Error & { status?: SystemUpdateStatus }).status =
                failure.data;
              reject(error);
              return;
            }
            resolve(parsed as SystemUpdateStatus);
          } catch {
            reject(new Error("Host Updater 返回无效 JSON"));
          }
        });
      }
    );
    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error("连接 Host Updater 超时"));
    });
    request.on("error", (error) => {
      reject(new Error(`连接 Host Updater：${error.message}`));
    });
    if (payload) {
      request.write(payload);
    }
    request.end();
  });
}
