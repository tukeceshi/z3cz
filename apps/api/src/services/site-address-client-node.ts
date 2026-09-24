import http from "node:http";

import { SiteAddressClientError } from "./site-address";

const REQUEST_TIMEOUT_MS = 10_000;

export async function requestSiteAddress<T>(
  socketPath: string,
  token: string,
  method: "GET" | "POST",
  pathname: string,
  body?: Record<string, string>
): Promise<T> {
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
            const parsed = JSON.parse(text) as T & {
              error?: string;
              code?: string;
            };
            if (response.statusCode && response.statusCode >= 400) {
              reject(
                new SiteAddressClientError(
                  parsed.error || `site address HTTP ${response.statusCode}`,
                  response.statusCode,
                  parsed.code
                )
              );
              return;
            }
            resolve(parsed);
          } catch {
            reject(
              new SiteAddressClientError(
                "域名服务返回无效 JSON",
                502,
                undefined
              )
            );
          }
        });
      }
    );
    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error("连接域名服务超时"));
    });
    request.on("error", (error) => {
      reject(new SiteAddressClientError(error.message, 502, "unavailable"));
    });
    if (payload) {
      request.write(payload);
    }
    request.end();
  });
}
