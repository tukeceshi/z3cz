import type { WorkflowTemplate } from "@dafthunk/types";

/** Mainline ships without legacy-node workflow templates. See LEGACY_ARCHIVE.md. */
export const workflowTemplates: WorkflowTemplate[] = [];

export function getTemplateById(id: string): WorkflowTemplate | undefined {
  return workflowTemplates.find((t) => t.id === id);
}
