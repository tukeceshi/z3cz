import type { SystemUpdateStatus } from "@dafthunk/types";

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

export async function rollbackSystemUpdate(
  reason: string
): Promise<SystemUpdateStatus> {
  return makeRequest<SystemUpdateStatus>(`${SYSTEM_UPDATE_KEY}/rollback`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
