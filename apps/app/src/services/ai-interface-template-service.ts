import type {
  AiInterfaceTemplateDetail,
  AiInterfaceTemplateIndex,
  SaveAiInterfaceTemplateRequest,
} from "@dafthunk/types";
import useSWR from "swr";

import { makeRequest } from "./utils";

const ADMIN_ENDPOINT = "/admin/ai-interface-templates";

export function useAdminAiInterfaceTemplates() {
  const { data, error, isLoading, mutate } = useSWR(ADMIN_ENDPOINT, async () => {
    const response = await makeRequest<{ templates: AiInterfaceTemplateIndex[] }>(
      ADMIN_ENDPOINT
    );
    return response.templates;
  });

  return {
    templates: data ?? [],
    templatesError: error,
    isTemplatesLoading: isLoading,
    refreshTemplates: mutate,
  };
}

export async function fetchAdminAiInterfaceTemplate(
  id: string
): Promise<AiInterfaceTemplateDetail> {
  const response = await makeRequest<{ template: AiInterfaceTemplateDetail }>(
    `${ADMIN_ENDPOINT}/${id}`
  );
  return response.template;
}

export async function saveAdminAiInterfaceTemplate(
  id: string,
  input: SaveAiInterfaceTemplateRequest
): Promise<AiInterfaceTemplateDetail> {
  const response = await makeRequest<{ template: AiInterfaceTemplateDetail }>(
    `${ADMIN_ENDPOINT}/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    }
  );
  return response.template;
}

export async function deleteAdminAiInterfaceTemplate(id: string): Promise<void> {
  await makeRequest(`${ADMIN_ENDPOINT}/${id}`, {
    method: "DELETE",
  });
}
