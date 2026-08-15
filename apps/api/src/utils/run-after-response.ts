interface WaitUntilContext {
  readonly waitUntil?: (promise: Promise<unknown>) => void;
}

/** Workers: keep the isolate alive. Node: fire-and-forget the same promise. */
export function runAfterResponse(
  executionCtx: WaitUntilContext | undefined,
  work: Promise<unknown>
): void {
  if (typeof executionCtx?.waitUntil === "function") {
    executionCtx.waitUntil(work);
    return;
  }
  void work;
}
