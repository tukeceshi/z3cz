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
  /** How a UI feature is translated into the provider request. */
  readonly implementationMode?: "direct" | "ratio_prompt" | "pixel_size" | "sequential_count";
}
