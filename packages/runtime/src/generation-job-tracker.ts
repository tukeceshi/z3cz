export type WorkflowGenerationJobModality = "image" | "video";

export type WorkflowGenerationJobTerminalStatus =
  | "succeeded"
  | "failed"
  | "cancelled";

export interface WorkflowGenerationJobTracker {
  begin(params: {
    readonly organizationId: string;
    readonly workflowId: string;
    readonly executionId?: string;
    readonly nodeId: string;
    readonly modality: WorkflowGenerationJobModality;
    readonly modelCanonicalId: string;
    readonly interfaceId: string;
    readonly upstreamTaskId?: string;
    readonly videoPollUrl?: string;
  }): Promise<string | null>;

  complete(params: {
    readonly organizationId: string;
    readonly jobId: string;
    readonly status: WorkflowGenerationJobTerminalStatus;
    readonly failureReason?: string;
  }): Promise<void>;
}
