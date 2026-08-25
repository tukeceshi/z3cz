export interface GenerativeCloudAccelerationCardSession {
  readonly offerVisible: boolean;
  readonly dialogOpen: boolean;
  readonly setDialogOpen: (open: boolean) => void;
  readonly triggerSingle: () => void;
  readonly triggerAlways: () => void;
}

const sessions = new Map<string, GenerativeCloudAccelerationCardSession>();
const listeners = new Map<string, Set<() => void>>();

function notify(nodeId: string): void {
  listeners.get(nodeId)?.forEach((listener) => {
    listener();
  });
}

export function setGenerativeCloudAccelerationCardSession(
  nodeId: string,
  session: GenerativeCloudAccelerationCardSession | null
): void {
  const normalized = nodeId.trim();
  if (!normalized) {
    return;
  }

  if (session) {
    sessions.set(normalized, session);
  } else {
    sessions.delete(normalized);
  }
  notify(normalized);
}

export function getGenerativeCloudAccelerationCardSession(
  nodeId: string
): GenerativeCloudAccelerationCardSession | undefined {
  const normalized = nodeId.trim();
  if (!normalized) {
    return undefined;
  }
  return sessions.get(normalized);
}

export function subscribeGenerativeCloudAccelerationCardSession(
  nodeId: string,
  listener: () => void
): () => void {
  const normalized = nodeId.trim();
  if (!normalized) {
    return () => {};
  }

  const bucket = listeners.get(normalized) ?? new Set();
  bucket.add(listener);
  listeners.set(normalized, bucket);

  return () => {
    const current = listeners.get(normalized);
    if (!current) {
      return;
    }
    current.delete(listener);
    if (current.size === 0) {
      listeners.delete(normalized);
    }
  };
}

/** @internal test helper */
export function resetGenerativeCloudAccelerationSessionsForTests(): void {
  sessions.clear();
  listeners.clear();
}
