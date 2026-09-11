import { createHmac } from "node:crypto";

export const PERSIST_WORKER_FORWARD_MAX_SKEW_MS = 5 * 60 * 1000;

export function derivePersistWorkerForwardHmacKey(jwtSecret: string): string {
  return createHmac("sha256", jwtSecret)
    .update("persist-worker-forward")
    .digest("hex");
}

export function signPersistWorkerForwardRequest(params: {
  readonly hmacKey: string;
  readonly timestampMs: number;
  readonly method: string;
  readonly url: string;
}): string {
  return createHmac("sha256", params.hmacKey)
    .update(`${params.timestampMs}\n${params.method}\n${params.url}`)
    .digest("hex");
}

export function isPersistWorkerForwardSignatureValid(params: {
  readonly hmacKey: string;
  readonly timestampMs: number;
  readonly method: string;
  readonly url: string;
  readonly signature: string;
  readonly nowMs?: number;
}): boolean {
  const nowMs = params.nowMs ?? Date.now();
  if (
    !Number.isFinite(params.timestampMs) ||
    Math.abs(nowMs - params.timestampMs) > PERSIST_WORKER_FORWARD_MAX_SKEW_MS
  ) {
    return false;
  }

  const expected = signPersistWorkerForwardRequest({
    hmacKey: params.hmacKey,
    timestampMs: params.timestampMs,
    method: params.method,
    url: params.url,
  });
  return expected === params.signature;
}
