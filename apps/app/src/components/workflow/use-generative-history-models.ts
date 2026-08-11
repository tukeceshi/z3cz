import type {
  OrgAudioModelOption,
  OrgImageModelOption,
  OrgTextModelOption,
  OrgVideoModelOption,
} from "@dafthunk/types";
import { useCallback } from "react";

import { useAuth } from "@/components/auth-context";
import { useAppToast } from "@/hooks/use-app-toast";
import {
  fetchOrgAudioModels,
  fetchOrgImageModels,
  fetchOrgTextModels,
  fetchOrgVideoModels,
  useOrgAudioModels,
  useOrgImageModels,
  useOrgTextModels,
  useOrgVideoModels,
} from "@/services/platform-ai-model-service";

import type { GenerativeModelModality } from "./org-model-selection-utils";

export interface GenerativeHistoryModels {
  readonly text: readonly OrgTextModelOption[];
  readonly image: readonly OrgImageModelOption[];
  readonly video: readonly OrgVideoModelOption[];
  readonly audio: readonly OrgAudioModelOption[];
}

export function useGenerativeHistoryModels(): GenerativeHistoryModels {
  const { organization } = useAuth();
  const orgId = organization?.id;
  const { models: text } = useOrgTextModels(orgId, { enabled: Boolean(orgId) });
  const { models: image } = useOrgImageModels(orgId, { enabled: Boolean(orgId) });
  const { models: video } = useOrgVideoModels(orgId, { enabled: Boolean(orgId) });
  const { models: audio } = useOrgAudioModels(orgId, { enabled: Boolean(orgId) });
  return { text, image, video, audio };
}

export async function fetchGenerativeHistoryModels(
  orgId: string,
  modality: GenerativeModelModality
): Promise<
  | readonly OrgTextModelOption[]
  | readonly OrgImageModelOption[]
  | readonly OrgVideoModelOption[]
  | readonly OrgAudioModelOption[]
> {
  switch (modality) {
    case "text":
      return (await fetchOrgTextModels(orgId)).models;
    case "image":
      return (await fetchOrgImageModels(orgId)).models;
    case "video":
      return (await fetchOrgVideoModels(orgId)).models;
    case "audio":
      return (await fetchOrgAudioModels(orgId)).models;
  }
}

export function useHistoryModelUnavailableToast(): (
  modelUnavailable: boolean
) => void {
  const toast = useAppToast();
  return useCallback(
    (modelUnavailable: boolean) => {
      if (modelUnavailable) {
        toast.warning("workflow.generativeErrors.historyModelUnavailable");
      }
    },
    [toast]
  );
}
