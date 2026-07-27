import type { AiModelInvocationStatus } from "@dafthunk/types";

export function invocationStatusBadgeVariant(
  status: AiModelInvocationStatus
): "default" | "secondary" | "destructive" {
  if (status === "completed") return "default";
  if (status === "pending") return "secondary";
  return "destructive";
}

export function invocationStatusLabelKey(
  status: AiModelInvocationStatus
):
  | "pages.modelCalls.statusPending"
  | "pages.modelCalls.statusCompleted"
  | "pages.modelCalls.statusFailed" {
  if (status === "pending") return "pages.modelCalls.statusPending";
  if (status === "completed") return "pages.modelCalls.statusCompleted";
  return "pages.modelCalls.statusFailed";
}
