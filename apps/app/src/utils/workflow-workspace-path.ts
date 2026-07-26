/** Org workflow editor canvas route: /org/:orgId/workflows/:workflowId */
export function isWorkflowWorkspacePath(pathname: string): boolean {
  return /^\/org\/[^/]+\/workflows\/[^/]+$/.test(pathname);
}
