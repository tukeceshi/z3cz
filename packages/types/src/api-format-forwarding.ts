import type {
  CreateFormatTransformTemplateRequest,
  FormatTransformTemplate,
  UpdateFormatTransformTemplateRequest,
} from "./format-transform-template";

/** @deprecated Use FormatTransformTemplate */
export type ApiFormatForwardingRule = FormatTransformTemplate;

/** @deprecated Use ListFormatTransformTemplatesResponse */
export interface ListApiFormatForwardingRulesResponse {
  readonly rules: readonly FormatTransformTemplate[];
}

/** @deprecated Use FormatTransformTemplate */
export interface GetApiFormatForwardingRuleResponse {
  readonly rule: FormatTransformTemplate;
}

/** @deprecated Use CreateFormatTransformTemplateRequest */
export type CreateApiFormatForwardingRuleRequest =
  CreateFormatTransformTemplateRequest;

/** @deprecated Use UpdateFormatTransformTemplateRequest */
export type UpdateApiFormatForwardingRuleRequest =
  UpdateFormatTransformTemplateRequest;
