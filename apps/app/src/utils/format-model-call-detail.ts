import type { AiModelInvocation } from "@dafthunk/types";

/** User-facing invocation detail (no API logs). */
export function formatModelCallSummary(invocation: AiModelInvocation): string {
  if (invocation.status === "cancelled") {
    if (invocation.content.trim().length > 0) {
      return invocation.content;
    }
    return invocation.promptExcerpt;
  }
  if (invocation.content.trim().length > 0) {
    return invocation.content;
  }
  if (invocation.error?.trim()) {
    return invocation.error;
  }
  return invocation.promptExcerpt;
}
