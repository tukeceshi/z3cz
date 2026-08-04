/** Per-modality model + params remembered at workflow scope (picker selection). */
export interface WorkflowGenerativeDefaultEntry {
  readonly canonicalId: string;
  readonly interfaceId: string;
  readonly params?: Readonly<Record<string, unknown>>;
}

export interface WorkflowGenerativeDefaults {
  readonly text?: WorkflowGenerativeDefaultEntry;
  readonly image?: WorkflowGenerativeDefaultEntry;
  readonly video?: WorkflowGenerativeDefaultEntry;
  readonly audio?: WorkflowGenerativeDefaultEntry;
}
