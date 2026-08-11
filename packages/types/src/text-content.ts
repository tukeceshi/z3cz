/** Incremental text edit — UTF-8 byte offsets for replace. */
export type TextEditOp =
  | { readonly op: "append"; readonly text: string }
  | {
      readonly op: "replace";
      readonly start: number;
      readonly end: number;
      readonly text: string;
    };

export interface TextContentRegisterRequest {
  readonly contentSha256: string;
  readonly mimeType: string;
  readonly contentLength: number;
  readonly workflowId?: string;
  readonly replacesResourceId?: string;
}

export interface TextContentRegisterResponse {
  readonly resourceId: string;
  readonly uploadUrl: string;
  readonly uploadHeaders: Record<string, string>;
}

export interface TextContentStageRequest {
  readonly resourceId: string;
  readonly baseSha256: string;
  readonly pendingSha256: string;
  readonly ops: readonly TextEditOp[];
}

export interface TextContentStageResponse {
  readonly ok: true;
}

export interface TextContentConflictResponse {
  readonly conflict: true;
  readonly dbSha256?: string;
}

export type TextContentSyncEvent =
  | { readonly type: "unchanged"; readonly dbSha256: string }
  | {
      readonly type: "download";
      readonly downloadUrl: string;
      readonly dbSha256: string;
    }
  | { readonly type: "append"; readonly text: string }
  | {
      readonly type: "replace";
      readonly start: number;
      readonly end: number;
      readonly text: string;
    }
  | { readonly type: "done"; readonly pendingSha256: string }
  | { readonly type: "conflict"; readonly dbSha256?: string };
