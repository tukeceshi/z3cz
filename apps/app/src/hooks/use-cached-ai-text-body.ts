import {
  getResourceIdFromValue,
  isResourceIdReference,
} from "@dafthunk/types";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { readAiTextResultReference } from "@/components/workflow/ai-text-persist-utils";
import { CACHE_STATS_EVENT } from "@/services/ai-media-cache-events";
import { readAiTextContent } from "@/services/ai-text-storage-service";
import { AI_TEXT_DISPLAY_EVENT } from "@/services/ai-text-display-registry";

export function useCachedAiTextBody(params: {
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
  const [revision, setRevision] = useState(0);
  void revision;

  useEffect(() => {
    setText("");
  }, [mediaId, workflowSha]);

  useEffect(() => {
    const bump = () => setRevision((value) => value + 1);
    window.addEventListener(AI_TEXT_DISPLAY_EVENT, bump);
    window.addEventListener(CACHE_STATS_EVENT, bump);
    return () => {
      window.removeEventListener(AI_TEXT_DISPLAY_EVENT, bump);
      window.removeEventListener(CACHE_STATS_EVENT, bump);
    };
  }, []);

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

    void readAiTextContent({
      organizationId,
      workflowId,
      value: current,
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
    revision,
  ]);

  if (!params.enabled) {
    return { text: "", loading: false };
  }

  return { text, loading };
}
