/** How workflow execution credits are enforced. */
export type WorkflowBillingMode = "platform" | "upstream";

export const ALL_WORKFLOW_BILLING_MODES: readonly WorkflowBillingMode[] = [
  "platform",
  "upstream",
] as const;
