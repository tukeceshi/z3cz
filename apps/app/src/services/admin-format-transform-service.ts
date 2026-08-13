import type {
  CreateFormatTransformTemplateRequest,
  FormatTransformProvider,
  FormatTransformTemplate,
  ForwardingParamMapping,
  ForwardingUpstreamParam,
  UpdateFormatTransformTemplateRequest,
} from "@dafthunk/types";
import useSWR from "swr";

import { makeRequest } from "./utils";

const ADMIN_ENDPOINT = "/admin/format-templates";

export function useAdminFormatTransformTemplates() {
  const { data, error, isLoading, mutate } = useSWR(ADMIN_ENDPOINT, async () => {
    const response = await makeRequest<{ templates: FormatTransformTemplate[] }>(
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

export function useAdminFormatTransformTemplate(id: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? `${ADMIN_ENDPOINT}/${id}` : null,
    async () => {
      const response = await makeRequest<{ template: FormatTransformTemplate }>(
        `${ADMIN_ENDPOINT}/${id}`
      );
      return response.template;
    }
  );

  return {
    template: data,
    templateError: error,
    isTemplateLoading: isLoading,
    refreshTemplate: mutate,
  };
}

export async function createAdminFormatTransformTemplate(
  input: CreateFormatTransformTemplateRequest
): Promise<FormatTransformTemplate> {
  const response = await makeRequest<{ template: FormatTransformTemplate }>(
    ADMIN_ENDPOINT,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
  return response.template;
}

export async function updateAdminFormatTransformTemplate(
  id: string,
  input: UpdateFormatTransformTemplateRequest
): Promise<FormatTransformTemplate> {
  const response = await makeRequest<{ template: FormatTransformTemplate }>(
    `${ADMIN_ENDPOINT}/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
  return response.template;
}

export async function deleteAdminFormatTransformTemplate(
  id: string
): Promise<void> {
  await makeRequest(`${ADMIN_ENDPOINT}/${id}`, {
    method: "DELETE",
  });
}

export interface FormatTransformCreateFormState {
  readonly name: string;
  readonly provider: FormatTransformProvider;
  readonly upstreamParams: readonly ForwardingUpstreamParam[];
  readonly paramMappings: readonly ForwardingParamMapping[];
}

export const emptyFormatTransformCreateForm = (): FormatTransformCreateFormState => ({
  name: "",
  provider: "seedance",
  upstreamParams: [],
  paramMappings: [],
});
