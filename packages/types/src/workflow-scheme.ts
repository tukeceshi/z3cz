import type { WorkflowRuntime, WorkflowTrigger } from "./workflow";

export const WORKFLOW_SCHEME_OMNIPOTENT_ID = "omnipotent" as const;
export const WORKFLOW_SCHEME_BASIC_CANVAS_ID = "basic-canvas" as const;

export const ALL_WORKFLOW_TRIGGERS = [
  "manual",
  "http_webhook",
  "http_request",
  "form_webhook",
  "form_request",
  "email_message",
  "queue_message",
  "scheduled",
  "discord_event",
  "telegram_event",
  "whatsapp_event",
  "slack_event",
] as const satisfies readonly WorkflowTrigger[];

export const ALL_WORKFLOW_RUNTIMES = [
  "worker",
  "workflow",
] as const satisfies readonly WorkflowRuntime[];

export interface WorkflowSchemeNodeRules {
  includeTags?: readonly string[];
  includeNodeTypes?: readonly string[];
  excludeNodeTypes?: readonly string[];
  alwaysIncludeNodeTypes?: readonly string[];
}

export interface WorkflowScheme {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  allowedTriggers: WorkflowTrigger[];
  allowedRuntimes: WorkflowRuntime[];
  nodeRules: WorkflowSchemeNodeRules;
  isDefault: boolean;
  isSystem: boolean;
  sortOrder: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string | null;
}

/** Public catalog entry for workflow creation */
export interface PublicWorkflowScheme {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  allowedTriggers: WorkflowTrigger[];
  allowedRuntimes: WorkflowRuntime[];
  isDefault: boolean;
}

export interface ListPublicWorkflowSchemesResponse {
  schemes: PublicWorkflowScheme[];
}

export interface ListWorkflowSchemesResponse {
  schemes: WorkflowScheme[];
}

export interface GetWorkflowSchemeResponse {
  scheme: WorkflowScheme;
}

export interface CreateWorkflowSchemeRequest {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  allowedTriggers: WorkflowTrigger[];
  allowedRuntimes: WorkflowRuntime[];
  nodeRules?: WorkflowSchemeNodeRules;
  sortOrder?: number;
  enabled?: boolean;
}

export interface UpdateWorkflowSchemeRequest {
  name?: string;
  description?: string | null;
  icon?: string | null;
  allowedTriggers?: WorkflowTrigger[];
  allowedRuntimes?: WorkflowRuntime[];
  nodeRules?: WorkflowSchemeNodeRules;
  sortOrder?: number;
  enabled?: boolean;
  isDefault?: boolean;
}
