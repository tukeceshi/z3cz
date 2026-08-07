import type { MediaReference } from "@dafthunk/types";

export const MEDIA_RESOURCE_REKEYED_EVENT = "dafthunk:media-resource-rekeyed";

export interface MediaResourceRekeyedDetail {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly fromMediaId: string;
  readonly toMediaReference: MediaReference;
}

export function dispatchMediaResourceRekeyed(
  detail: MediaResourceRekeyedDetail
): void {
  window.dispatchEvent(
    new CustomEvent<MediaResourceRekeyedDetail>(MEDIA_RESOURCE_REKEYED_EVENT, {
      detail,
    })
  );
}
