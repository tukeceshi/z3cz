import { getResourceIdFromValue, isResourceIdReference } from "@dafthunk/types";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { readAiTextResultReference } from "@/components/workflow/ai-text-persist-utils";
import { readAiTextStagingDisplayState } from "@/components/workflow/ai-text-staging-display-state";
import type { WorkflowNodeType, WorkflowParameter } from "@/components/workflow/workflow-types";
import { readAiTextFullBodyFromStaging } from "@/services/ai-text-cache-layer";
import {
  AI_TEXT_DISPLAY_EVENT,
  getAiTextDisplay,
} from "@/services/ai-text-display-registry";

interface UseResolvedAiTextParams {
  readonly inputs: readonly WorkflowParameter[];
  readonly outputs?: readonly WorkflowParameter[];
  readonly nodeData?: WorkflowNodeType;
}

export interface ResolvedAiText {
  readonly displayExcerpt: string;
  readonly loading: boolean;
  readonly state: "loading" | "ready" | "empty" | "failed";
  readonly reference: ReturnType<typeof readAiTextResultReference>;
}

/** Canvas/list preview hung by resource ID — not the full body, not a cloud fetch. */
export function useResolvedAiText(
  params: UseResolvedAiTextParams
): ResolvedAiText {
  const { organization } = useAuth();
  const { id: workflowId } = useParams<{ id: string }>();
  const organizationId = organization?.id;
  const reference = readAiTextResultReference(params.inputs);
  const mediaId = reference ? getResourceIdFromValue(reference) : null;

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

  const nodeState = readAiTextStagingDisplayState(params.nodeData?.metadata);
  const state =
    nodeState ??
    hung?.state ??
    (reference ? "loading" : "empty");

  return {
    displayExcerpt: hung?.excerpt ?? "",
    loading: state === "loading",
    state,
    reference,
  };
}

export function useAiTextStagingBody(params: {
  readonly reference: ReturnType<typeof readAiTextResultReference>;
  readonly enabled: boolean;
}): {
  readonly text: string;
  readonly loading: boolean;
} {
  const { organization } = useAuth();
  const { id: workflowId } = useParams<{ id: string }>();
  const organizationId = organization?.id;
  const reference = params.reference;
  const mediaId = reference ? getResourceIdFromValue(reference) : null;
  const workflowSha =
    reference && isResourceIdReference(reference)
      ? reference.contentSha256
      : undefined;
  const referenceRef = useRef(reference);
  referenceRef.current = reference;

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setText("");
  }, [mediaId, workflowSha]);

  useEffect(() => {
    if (!params.enabled || !organizationId || !workflowId || !reference) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const current = referenceRef.current;
    if (!current) {
      setLoading(false);
      return;
    }

    void readAiTextFullBodyFromStaging({
      organizationId,
      workflowId,
      reference: current,
      workflowSha,
    }).then((body) => {
      if (cancelled) {
        return;
      }
      setText(body ?? "");
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [
    params.enabled,
    organizationId,
    workflowId,
    mediaId,
    workflowSha,
    reference,
  ]);

  if (!params.enabled) {
    return { text: "", loading: false };
  }

  return { text, loading };
}
