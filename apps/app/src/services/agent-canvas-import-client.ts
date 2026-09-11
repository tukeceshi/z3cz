import type {
  CanvasImportSourceRequest,
  CanvasImportSourceResponse,
} from "@dafthunk/types";

import { makeRequest } from "@/services/utils";

export async function fetchCanvasImportSourceDocument(
  organizationId: string,
  url: string
): Promise<unknown> {
  const body: CanvasImportSourceRequest = { url };
  const response = await makeRequest<CanvasImportSourceResponse>(
    `/${organizationId}/platform-ai/canvas-import/source`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
  return response.document;
}
