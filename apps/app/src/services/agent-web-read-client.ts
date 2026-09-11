import type { WebReadRequest, WebReadResponse } from "@dafthunk/types";

import { makeRequest } from "@/services/utils";

export async function fetchAgentWebRead(
  organizationId: string,
  request: WebReadRequest
): Promise<WebReadResponse> {
  return makeRequest<WebReadResponse>(
    `/${organizationId}/platform-ai/web/read`,
    {
      method: "POST",
      body: JSON.stringify(request),
    }
  );
}
