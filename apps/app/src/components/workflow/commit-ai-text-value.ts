import type { OrgTextModelOption } from "@dafthunk/types";
import {
  getResourceIdFromValue,
  inferAiTextMimeType,
  isResourceIdReference,
  type ResourceIdReference,
  type WorkflowMediaValue,
} from "@dafthunk/types";

import { applyHistoryItemSettingsToNode } from "./apply-history-item-settings";
import {
  buildResourceIdReference,
  type AiTextStagedResultPatch,
  readAiTextResultContentSha256,
  readAiTextResultReference,
  withAiTextStagedEditedResult,
  withAiTextStagedHistorySelection,
  withAiTextStagedManualResult,
} from "./ai-text-persist-utils";
import {
  hasAiTextGeneratedHistory,
  readAiTextResultHistory,
} from "./ai-text-node-utils";
import type { WorkflowNodeType } from "./workflow-types";
import { createPatchNodeLayoutMetadata } from "./patch-node-layout-metadata";
import { withAiTextStagingDisplayState } from "./ai-text-staging-display-state";
import { stageAiTextContent } from "@/services/ai-text-storage-service";
import {
  hangAiTextExcerptFromKnownText,
  readAiTextFullBodyFromStaging,
} from "@/services/ai-text-cache-layer";
import { notifyTextContentConflict } from "@/services/text-content-conflict";
import {
  saveTextContent,
  TextContentConflictError,
} from "@/services/text-content-service";
import { sha256HexFromText } from "@/utils/text-content-utils";

type UpdateNodeDataFn = (
  nodeId: string,
  data:
    | Partial<WorkflowNodeType>
    | ((current: WorkflowNodeType) => Partial<WorkflowNodeType>)
) => void;

interface CommitAiTextValueParams {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly cloudConfigured: boolean;
  readonly nodeId: string;
  readonly value: string;
  readonly updateNodeData: UpdateNodeDataFn;
  readonly current: WorkflowNodeType;
}

async function persistTextToCloud(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly text: string;
  readonly mimeType: string;
  readonly existingReference?: WorkflowMediaValue;
  readonly baseSha256?: string;
}): Promise<ResourceIdReference> {
  const existingId = params.existingReference
    ? getResourceIdFromValue(params.existingReference)
    : undefined;
  const saved = await saveTextContent({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    text: params.text,
    mimeType: params.mimeType,
    resourceId: existingId || undefined,
    baseSha256: existingId ? params.baseSha256 : undefined,
  });

  return buildResourceIdReference({
    resourceId: saved.resourceId,
    contentSha256: saved.contentSha256,
    mimeType: params.mimeType,
  });
}

export async function commitAiTextValue(
  params: CommitAiTextValueParams
): Promise<void> {
  const mimeType = inferAiTextMimeType(params.value);
  const existingReference = readAiTextResultReference(params.current.inputs);
  const existingId = existingReference
    ? getResourceIdFromValue(existingReference)
    : undefined;
  const baseSha256 = readAiTextResultContentSha256(params.current.inputs);

  const stageFallback = async (): Promise<WorkflowMediaValue> => {
    const patchNodeLayout = createPatchNodeLayoutMetadata(
      params.nodeId,
      params.updateNodeData
    );
    const local = await stageAiTextContent({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      text: params.value,
      mediaId: existingId ?? undefined,
      patchNodeLayout,
    });
    if (existingId && isResourceIdReference(existingReference)) {
      return buildResourceIdReference({
        resourceId: existingId,
        contentSha256,
        mimeType,
      });
    }
    return local;
  };

  let reference: WorkflowMediaValue;
  let contentSha256 = await sha256HexFromText(params.value);

  if (params.cloudConfigured) {
    try {
      const cloudRef = await persistTextToCloud({
        organizationId: params.organizationId,
        workflowId: params.workflowId,
        text: params.value,
        mimeType,
        existingReference,
        baseSha256,
      });
      reference = cloudRef;
      contentSha256 = cloudRef.contentSha256 ?? contentSha256;
    } catch (error) {
      if (error instanceof TextContentConflictError) {
        notifyTextContentConflict();
        return;
      }
      console.warn("[ai-text] cloud persist failed", error);
      reference = await stageFallback();
    }
  } else {
    reference = await stageFallback();
  }

  const staged: AiTextStagedResultPatch = {
    reference,
    contentSha256,
    sessionText: params.value,
  };

  const mediaId = getResourceIdFromValue(reference);
  if (mediaId) {
    try {
      await stageAiTextContent({
        organizationId: params.organizationId,
        workflowId: params.workflowId,
        text: params.value,
        mediaId,
        patchNodeLayout: createPatchNodeLayoutMetadata(
          params.nodeId,
          params.updateNodeData
        ),
      });
    } catch {
      // Local staging is best-effort after a successful cloud write.
    }
  }

  const displayState = hangAiTextExcerptFromKnownText({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    reference,
    body: params.value,
  });

  params.updateNodeData(params.nodeId, (current) => {
    const patch = hasAiTextGeneratedHistory(current.inputs)
      ? withAiTextStagedEditedResult(current, staged)
      : withAiTextStagedManualResult(current, staged);
    return {
      ...patch,
      metadata: withAiTextStagingDisplayState(
        patch.metadata ?? current.metadata,
        displayState
      ),
    };
  });
}

interface CommitAiTextHistorySelectionParams {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly nodeId: string;
  readonly selectedId: string;
  readonly updateNodeData: UpdateNodeDataFn;
  readonly current: WorkflowNodeType;
  readonly models?: readonly OrgTextModelOption[];
}

export interface AiTextHistorySelectionCommit {
  readonly resolvedText: string;
  readonly modelUnavailable: boolean;
}

/** Apply history: write resource ID/sha and cache body/preview in one node update. */
export async function commitAiTextHistorySelection(
  params: CommitAiTextHistorySelectionParams
): Promise<AiTextHistorySelectionCommit> {
  const history = readAiTextResultHistory(params.current.inputs);
  const selected = history.items.find((entry) => entry.id === params.selectedId);
  if (!selected?.resourceId) {
    return { resolvedText: "", modelUnavailable: false };
  }

  const referenceForCache: WorkflowMediaValue = selected.contentSha256
    ? buildResourceIdReference({
        resourceId: selected.resourceId,
        contentSha256: selected.contentSha256,
        mimeType: inferAiTextMimeType(""),
      })
    : {
        resourceId: selected.resourceId,
        mimeType: inferAiTextMimeType(""),
      };

  const sessionText =
    (await readAiTextFullBodyFromStaging({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      reference: referenceForCache,
      workflowSha: selected.contentSha256,
    })) ?? "";

  const mimeType = inferAiTextMimeType(sessionText);
  const contentSha256 = selected.contentSha256 ?? "";
  const reference: WorkflowMediaValue = contentSha256
    ? buildResourceIdReference({
        resourceId: selected.resourceId,
        contentSha256,
        mimeType,
      })
    : {
        resourceId: selected.resourceId,
        mimeType,
      };

  const displayState = hangAiTextExcerptFromKnownText({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    reference,
    body: sessionText,
  });

  const staged: AiTextStagedResultPatch = {
    reference,
    contentSha256,
    sessionText,
  };

  const settings = params.models
    ? applyHistoryItemSettingsToNode({
        current: params.current,
        modality: "text",
        models: params.models,
        historyBinding: selected,
      })
    : { patch: {}, modelUnavailable: false };

  params.updateNodeData(params.nodeId, (latest) => {
    const working: WorkflowNodeType = {
      ...latest,
      inputs: settings.patch.inputs ?? latest.inputs,
      metadata: settings.patch.metadata ?? latest.metadata,
    };
    const patch = withAiTextStagedHistorySelection(
      working,
      params.selectedId,
      staged
    );
    return {
      ...patch,
      metadata: withAiTextStagingDisplayState(
        patch.metadata ?? working.metadata,
        displayState
      ),
    };
  });

  return {
    resolvedText: sessionText,
    modelUnavailable: settings.modelUnavailable,
  };
}
