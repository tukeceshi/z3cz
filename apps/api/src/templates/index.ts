import type { WorkflowTemplate } from "@dafthunk/types";

export const workflowTemplates: WorkflowTemplate[] = [];

export function getTemplateById(id: string): WorkflowTemplate | undefined {
  return workflowTemplates.find((t) => t.id === id);
}
