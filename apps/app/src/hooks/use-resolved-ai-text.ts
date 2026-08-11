import { useEffect, useMemo, useState } from "react";

import { isResourceIdReference } from "@dafthunk/types";

import { readAiTextResult } from "@/components/workflow/ai-text-node-utils";
import {
  readAiTextPreviewExcerpt,
  readAiTextResultContentSha256,
  readAiTextResultReference,
} from "@/components/workflow/ai-text-persist-utils";
import type { WorkflowParameter } from "@/components/workflow/workflow-types";
import { readAiTextContent } from "@/services/ai-text-storage-service";
import { notifyTextContentConflict } from "@/services/text-content-conflict";
import {
  downloadTextContentFromUrl,
  syncTextContent,
} from "@/services/text-content-service";
import { sha256HexFromText } from "@/utils/text-content-utils";

interface UseResolvedAiTextParams {
  readonly organizationId: string | undefined;
  readonly workflowId: string | undefined;
  readonly inputs: readonly WorkflowParameter[];
  readonly outputs?: readonly WorkflowParameter[];
}

export interface ResolvedAiText {
  readonly text: string;
  readonly excerpt: string | undefined;
  readonly loading: boolean;
  readonly reference: ReturnType<typeof readAiTextResultReference>;
}

export function useResolvedAiText(
  params: UseResolvedAiTextParams
): ResolvedAiText {
  const reference = readAiTextResultReference(params.inputs);
  const sessionText = readAiTextResult(params.inputs, params.outputs) ?? "";
  const workflowSha = readAiTextResultContentSha256(params.inputs);
  const [resolved, setResolved] = useState(sessionText);
  const [loading, setLoading] = useState(false);

  const excerpt = useMemo(
    () => (resolved.trim() ? readAiTextPreviewExcerpt(resolved) : undefined),
    [resolved]
  );

  useEffect(() => {
    if (!reference || !params.organizationId || !params.workflowId) {
      setResolved(sessionText);
      setLoading(false);
      return;
    }

    if (sessionText.trim().length > 0 && !isResourceIdReference(reference)) {
      setResolved(sessionText);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      const localBody = await readAiTextContent({
        organizationId: params.organizationId!,
        workflowId: params.workflowId!,
        value: reference,
      });

      if (cancelled) return;

      if (localBody && workflowSha) {
        const localSha = await sha256HexFromText(localBody);
        if (localSha === workflowSha) {
          setResolved(localBody);
          setLoading(false);
          return;
        }
      }

      if (!isResourceIdReference(reference)) {
        setResolved(localBody ?? sessionText);
        setLoading(false);
        return;
      }

      try {
        const sync = await syncTextContent({
          organizationId: params.organizationId!,
          resourceId: reference.resourceId,
          localSha: workflowSha,
          localText: localBody ?? "",
        });

        if (cancelled) return;

        if (sync.conflict) {
          notifyTextContentConflict();
          setResolved(localBody ?? sessionText);
          setLoading(false);
          return;
        }

        if (sync.downloadUrl) {
          const downloaded = await downloadTextContentFromUrl(sync.downloadUrl);
          if (cancelled) return;
          const downloadedSha = await sha256HexFromText(downloaded);
          if (workflowSha && downloadedSha !== workflowSha) {
            setResolved(downloaded);
            setLoading(false);
            return;
          }
          setResolved(downloaded);
          setLoading(false);
          return;
        }

        setResolved(sync.text || localBody || sessionText);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setResolved(localBody ?? sessionText);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    params.inputs,
    params.organizationId,
    params.outputs,
    params.workflowId,
    reference,
    sessionText,
    workflowSha,
  ]);

  return {
    text: resolved,
    excerpt,
    loading,
    reference,
  };
}
