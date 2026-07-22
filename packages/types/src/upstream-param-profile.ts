/** Built-in upstream parameter profile identifiers. */
export const SEEDANCE_2_0_T2V_OFFICIAL_V1 = "seedance-2.0-t2v-official-v1";

export type UpstreamParamFieldType =
  | "string"
  | "number"
  | "boolean"
  | "json";

export interface UpstreamParamProfileField {
  readonly name: string;
  readonly apiName: string;
  readonly type: UpstreamParamFieldType;
  readonly description: string;
  readonly required?: boolean;
  readonly default?: string | number | boolean;
  readonly hidden?: boolean;
  /** When true, field is UI-only and must not be sent to upstream APIs. */
  readonly clientOnly?: boolean;
  readonly enumValues?: readonly string[];
}

/** Maps editor inputs to an upstream relay create-task body. */
export interface UpstreamParamProfile {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Display-only label for Admin/editor — not used for billing checks */
  readonly referencePriceLabel: string;
  readonly relayModel: string;
  readonly createPath: string;
  readonly pollPathTemplate: string;
  readonly outputName: string;
  readonly outputType: "video" | "image" | "string";
  readonly fields: readonly UpstreamParamProfileField[];
  readonly defaultPollIntervalSec: number;
  readonly defaultTimeoutMinutes: number;
}

export interface RelayAiNodeConfigInputs {
  readonly profile_id?: string;
  readonly timeout?: number;
  readonly poll_interval?: number;
}
