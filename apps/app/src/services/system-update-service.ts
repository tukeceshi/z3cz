import type { SystemUpdateStatus } from "@dafthunk/types";

import { buildApiUrl } from "@/config/api";

import { makeRequest } from "./utils";

export const SYSTEM_UPDATE_KEY = "/admin/system-update";
export const BROWSER_GITHUB_BLOCKED = "BROWSER_GITHUB_BLOCKED";

export async function getSystemUpdateStatus(): Promise<SystemUpdateStatus> {
  return makeRequest<SystemUpdateStatus>(SYSTEM_UPDATE_KEY);
}

export async function checkSystemUpdate(): Promise<SystemUpdateStatus> {
  return makeRequest<SystemUpdateStatus>(`${SYSTEM_UPDATE_KEY}/check`, {
    method: "POST",
  });
}

export async function startSystemUpdate(
  targetVersion: string
): Promise<SystemUpdateStatus> {
  return makeRequest<SystemUpdateStatus>(`${SYSTEM_UPDATE_KEY}/start`, {
    method: "POST",
    body: JSON.stringify({ targetVersion }),
  });
}

export async function startSystemUpdateUpload(
  targetVersion: string
): Promise<SystemUpdateStatus> {
  return makeRequest<SystemUpdateStatus>(`${SYSTEM_UPDATE_KEY}/upload/start`, {
    method: "POST",
    body: JSON.stringify({ targetVersion }),
  });
}

export function isSystemUpdateAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError") ||
    (error instanceof Error && error.message === "已中止更新下载")
  );
}

export async function abortSystemUpdate(): Promise<SystemUpdateStatus> {
  return makeRequest<SystemUpdateStatus>(`${SYSTEM_UPDATE_KEY}/abort`, {
    method: "POST",
  });
}

export async function uploadSystemUpdateFile(
  file: File,
  onProgress: (loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const handleAbort = () => {
      request.abort();
    };
    if (signal?.aborted) {
      reject(new DOMException("The user aborted a request.", "AbortError"));
      return;
    }
    signal?.addEventListener("abort", handleAbort, { once: true });
    const cleanup = () => signal?.removeEventListener("abort", handleAbort);
    request.open(
      "PUT",
      buildApiUrl(
        `${SYSTEM_UPDATE_KEY}/upload/${encodeURIComponent(file.name)}`
      )
    );
    request.withCredentials = true;
    request.upload.onprogress = (event) =>
      onProgress(event.loaded, event.total || file.size);
    request.onload = () => {
      cleanup();
      if (request.status >= 200 && request.status < 300) resolve();
      else {
        let message = "上传失败";
        try {
          message = JSON.parse(request.responseText).error || message;
        } catch {
          /* keep default */
        }
        reject(new Error(message));
      }
    };
    request.onerror = () => {
      cleanup();
      reject(new Error("上传连接失败"));
    };
    request.onabort = () => {
      cleanup();
      reject(new DOMException("The user aborted a request.", "AbortError"));
    };
    request.send(file);
  });
}

async function downloadGithubAsset(
  url: string,
  onProgress: (loaded: number, total: number) => void,
  signal: AbortSignal
): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal,
      credentials: "omit",
      redirect: "follow",
    });
  } catch (error) {
    if (signal.aborted || isSystemUpdateAbortError(error)) {
      throw new DOMException("The user aborted a request.", "AbortError");
    }
    throw new Error(BROWSER_GITHUB_BLOCKED);
  }
  if (!response.ok) {
    throw new Error(`下载返回 HTTP ${response.status}`);
  }
  if (!response.body) {
    throw new Error("下载失败");
  }
  const total = Number(response.headers.get("content-length") || 0);
  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    loaded += value.byteLength;
    onProgress(loaded, total || loaded);
  }
  return new Blob(chunks);
}

export async function transferBrowserUpdateFile(
  url: string,
  fileName: string,
  onProgress: (loaded: number, total: number) => void,
  signal: AbortSignal
): Promise<void> {
  const blob = await downloadGithubAsset(url, onProgress, signal);
  const file = new File([blob], fileName);
  await uploadSystemUpdateFile(file, onProgress, signal);
}

export async function finishSystemUpdateUpload(): Promise<SystemUpdateStatus> {
  return makeRequest<SystemUpdateStatus>(`${SYSTEM_UPDATE_KEY}/upload/finish`, {
    method: "POST",
  });
}

export async function rollbackSystemUpdate(
  reason: string
): Promise<SystemUpdateStatus> {
  return makeRequest<SystemUpdateStatus>(`${SYSTEM_UPDATE_KEY}/rollback`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
