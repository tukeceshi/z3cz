import type { AiModelInvocationStatus } from "@dafthunk/types";

export function invocationStatusBadgeVariant(
  status: AiModelInvocationStatus
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "completed") return "default";
  if (status === "pending") return "secondary";
  if (status === "cancelled") return "outline";
  return "destructive";
}

export function invocationStatusLabelKey(
  status: AiModelInvocationStatus
):
  | "pages.modelCalls.statusPending"
  | "pages.modelCalls.statusCompleted"
  | "pages.modelCalls.statusCancelled"
  | "pages.modelCalls.statusFailed" {
  if (status === "pending") return "pages.modelCalls.statusPending";
  if (status === "completed") return "pages.modelCalls.statusCompleted";
  if (status === "cancelled") return "pages.modelCalls.statusCancelled";
  return "pages.modelCalls.statusFailed";
}
