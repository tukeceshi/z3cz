const workflowNames = new Map<string, string>();

function workflowNameKey(organizationId: string, workflowId: string): string {
  return `${organizationId}:${workflowId}`;
}

export function rememberAiMediaCacheWorkflowName(
  organizationId: string,
  workflowId: string,
  workflowName: string
): void {
  const trimmed = workflowName.trim();
  if (!trimmed || trimmed === workflowId) {
    return;
  }
  workflowNames.set(workflowNameKey(organizationId, workflowId), trimmed);
}

export function resolveAiMediaCacheWorkflowName(
  organizationId: string,
  workflowId: string,
  explicitName?: string
): string {
  const trimmed = explicitName?.trim();
  if (trimmed && trimmed !== workflowId) {
    return trimmed;
  }
  return (
    workflowNames.get(workflowNameKey(organizationId, workflowId)) ?? workflowId
  );
}
