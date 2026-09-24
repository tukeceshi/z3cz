import type { SystemUpdateStatus } from "@dafthunk/types";

import { buildApiUrl } from "@/config/api";

import { makeRequest } from "./utils";

export const SYSTEM_UPDATE_KEY = "/admin/system-update";

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

export async function uploadSystemUpdateFile(
  file: File,
  onProgress: (loaded: number, total: number) => void
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
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
    request.onerror = () => reject(new Error("上传连接失败"));
    request.send(file);
  });
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
