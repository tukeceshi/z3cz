import { getResourceIdFromValue, isResourceIdReference } from "@dafthunk/types";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { readAiTextResultReference } from "@/components/workflow/ai-text-persist-utils";
import type { WorkflowNodeType, WorkflowParameter } from "@/components/workflow/workflow-types";
import { loadAiTextBodyFromCache } from "@/services/ai-text-cache-layer";
import {
  AI_TEXT_DISPLAY_EVENT,
  getAiTextDisplay,
} from "@/services/ai-text-display-registry";
import { CACHE_STATS_EVENT } from "@/services/ai-media-cache-events";

interface UseResolvedAiTextParams {
  readonly inputs: readonly WorkflowParameter[];
  readonly outputs?: readonly WorkflowParameter[];
  readonly nodeData?: WorkflowNodeType;
}

export interface ResolvedAiText {
  readonly text: string;
  readonly displayExcerpt: string;
  readonly loading: boolean;
  readonly reference: ReturnType<typeof readAiTextResultReference>;
}

/** Canvas preview/body hung by resource ID — not read from the node. */
export function useResolvedAiText(
  params: UseResolvedAiTextParams
): ResolvedAiText {
  const { organization } = useAuth();
  const { id: workflowId } = useParams<{ id: string }>();
  const organizationId = organization?.id;
  const reference = readAiTextResultReference(params.inputs);
  const mediaId = reference ? getResourceIdFromValue(reference) : null;
  const workflowSha =
    reference && isResourceIdReference(reference)
      ? reference.contentSha256
      : undefined;
  const referenceRef = useRef(reference);
  referenceRef.current = reference;

  const [revision, setRevision] = useState(0);
  const hung =
    organizationId && workflowId && mediaId
      ? getAiTextDisplay({
          organizationId,
          workflowId,
          mediaId,
        })
      : null;
  void revision;

  useEffect(() => {
    const handleDisplay = () => setRevision((value) => value + 1);
    window.addEventListener(AI_TEXT_DISPLAY_EVENT, handleDisplay);
    return () => window.removeEventListener(AI_TEXT_DISPLAY_EVENT, handleDisplay);
  }, []);

  useEffect(() => {
    if (!organizationId || !workflowId || !mediaId) {
      return;
    }

    let cancelled = false;
    const hydrate = () => {
      const current = referenceRef.current;
      if (!current) {
        return;
      }
      void loadAiTextBodyFromCache({
        organizationId,
        workflowId,
        reference: current,
        workflowSha,
      }).then(() => {
        if (!cancelled) {
          setRevision((value) => value + 1);
        }
      });
    };

    if (
      !getAiTextDisplay({ organizationId, workflowId, mediaId })?.body.trim()
    ) {
      hydrate();
    }

    const handleCache = () => hydrate();
    window.addEventListener(CACHE_STATS_EVENT, handleCache);
    return () => {
      cancelled = true;
      window.removeEventListener(CACHE_STATS_EVENT, handleCache);
    };
  }, [mediaId, organizationId, workflowId, workflowSha]);

  return {
    text: hung?.body ?? "",
    displayExcerpt: hung?.excerpt ?? "",
    loading: Boolean(reference) && !hung?.body.trim() && !hung?.excerpt.trim(),
    reference,
  };
}
