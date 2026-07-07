interface PendingEventWait {
  readonly resolve: (payload: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout> | undefined;
}

function parseTimeoutMs(timeout: string): number | undefined {
  const match = timeout.trim().match(/^(\d+(?:\.\d+)?)\s*(second|minute|hour|day)s?$/i);
  if (!match) {
    return undefined;
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    second: 1000,
    minute: 60_000,
    hour: 3_600_000,
    day: 86_400_000,
  };
  return value * (multipliers[unit] ?? 1000);
}

/**
 * In-memory event bus for Node workflow executions.
 * Replaces Cloudflare Workflows `step.waitForEvent` / `EXECUTE.sendEvent`.
 */
class NodeWorkflowEventHub {
  private readonly waits = new Map<string, PendingEventWait>();

  private waitKey(executionId: string, eventType: string): string {
    return `${executionId}:${eventType}`;
  }

  waitForEvent<T>(
    executionId: string,
    eventType: string,
    timeout?: string
  ): Promise<T> {
    const key = this.waitKey(executionId, eventType);

    return new Promise<T>((resolve, reject) => {
      const existing = this.waits.get(key);
      if (existing) {
        if (existing.timer) {
          clearTimeout(existing.timer);
        }
        this.waits.delete(key);
      }

      const timeoutMs = timeout ? parseTimeoutMs(timeout) : undefined;
      const timer =
        timeoutMs !== undefined
          ? setTimeout(() => {
              this.waits.delete(key);
              reject(
                new Error(
                  `Timed out waiting for event "${eventType}" after ${timeout}`
                )
              );
            }, timeoutMs)
          : undefined;

      this.waits.set(key, {
        resolve: resolve as (payload: unknown) => void,
        reject,
        timer,
      });
    });
  }

  sendEvent(
    executionId: string,
    event: { type: string; payload: unknown }
  ): boolean {
    const key = this.waitKey(executionId, event.type);
    const wait = this.waits.get(key);
    if (!wait) {
      return false;
    }

    if (wait.timer) {
      clearTimeout(wait.timer);
    }
    this.waits.delete(key);
    wait.resolve(event.payload);
    return true;
  }

  cancelExecutionWaits(executionId: string): void {
    const prefix = `${executionId}:`;
    for (const [key, wait] of this.waits) {
      if (!key.startsWith(prefix)) {
        continue;
      }
      if (wait.timer) {
        clearTimeout(wait.timer);
      }
      wait.reject(new Error("Execution cancelled"));
      this.waits.delete(key);
    }
  }
}

export const nodeWorkflowEventHub = new NodeWorkflowEventHub();
