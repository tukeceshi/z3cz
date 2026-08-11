import type { AiTextResultHistoryItem, OrgTextModelOption } from "@dafthunk/types";
import {
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
  readAiTextResult,
  readAiTextResultHistory,
} from "./ai-text-node-utils";
import type { WorkflowNodeType } from "./workflow-types";
import { readAiTextContent, stageAiTextContent } from "@/services/ai-text-storage-service";
import { notifyTextContentConflict } from "@/services/text-content-conflict";
import {
  buildTextStageRequest,
  registerTextContent,
  stageTextContentEdits,
  TextContentConflictError,
  uploadTextContentBlob,
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
  readonly previousText?: string;
}): Promise<ResourceIdReference | null> {
  if (!params.existingReference || !isResourceIdReference(params.existingReference)) {
    const contentSha256 = await sha256HexFromText(params.text);
    const blob = new Blob([params.text], { type: params.mimeType });
    const registered = await registerTextContent({
      organizationId: params.organizationId,
      contentSha256,
      mimeType: params.mimeType,
      contentLength: blob.size,
      workflowId: params.workflowId,
    });
    await uploadTextContentBlob({
      uploadUrl: registered.uploadUrl,
      uploadHeaders: registered.uploadHeaders,
      blob,
    });
    return buildResourceIdReference({
      resourceId: registered.resourceId,
      contentSha256,
      mimeType: params.mimeType,
    });
  }

  const resourceId = params.existingReference.resourceId;
  const baseSha256 =
    params.baseSha256 ?? params.existingReference.contentSha256 ?? "";
  const pendingSha256 = await sha256HexFromText(params.text);

  if (!baseSha256 || baseSha256 === pendingSha256) {
    return buildResourceIdReference({
      resourceId,
      contentSha256: pendingSha256,
      mimeType: params.mimeType,
    });
  }

  await stageTextContentEdits({
    organizationId: params.organizationId,
    request: buildTextStageRequest({
      resourceId,
      baseSha256,
      pendingSha256,
      oldText: params.previousText ?? "",
      newText: params.text,
    }),
  });

  return buildResourceIdReference({
    resourceId,
    contentSha256: pendingSha256,
    mimeType: params.mimeType,
  });
}

export async function commitAiTextValue(
  params: CommitAiTextValueParams
): Promise<void> {
  const mimeType = inferAiTextMimeType(params.value);
  const previousText =
    readAiTextResult(params.current.inputs, params.current.outputs) ?? "";
  const existingReference = readAiTextResultReference(params.current.inputs);
  const baseSha256 = readAiTextResultContentSha256(params.current.inputs);

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
        previousText,
      });
      if (cloudRef) {
        reference = cloudRef;
        contentSha256 = cloudRef.contentSha256 ?? contentSha256;
      } else {
        reference = await stageAiTextContent({
          organizationId: params.organizationId,
          workflowId: params.workflowId,
          text: params.value,
        });
      }
    } catch (error) {
      if (error instanceof TextContentConflictError) {
        notifyTextContentConflict();
        return;
      }
      console.warn("[ai-text] cloud persist failed", error);
      reference = await stageAiTextContent({
        organizationId: params.organizationId,
        workflowId: params.workflowId,
        text: params.value,
      });
    }
  } else {
    reference = await stageAiTextContent({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      text: params.value,
    });
  }

  const staged: AiTextStagedResultPatch = {
    reference,
    contentSha256,
    sessionText: params.value,
  };

  params.updateNodeData(params.nodeId, (current) => {
    if (hasAiTextGeneratedHistory(current.inputs)) {
      return withAiTextStagedEditedResult(current, staged);
    }
    return withAiTextStagedManualResult(current, staged);
  });
}

interface CommitAiTextHistorySelectionParams {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly cloudConfigured: boolean;
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

export async function commitAiTextHistorySelection(
  params: CommitAiTextHistorySelectionParams
): Promise<AiTextHistorySelectionCommit> {
  const history = readAiTextResultHistory(params.current.inputs);
  const selected = history.items.find((entry) => entry.id === params.selectedId);
  if (!selected) {
    return { resolvedText: "", modelUnavailable: false };
  }

  let resolvedText = selected.text ?? "";
  if (!resolvedText.trim() && selected.resourceId) {
    resolvedText =
      (await readAiTextContent({
        organizationId: params.organizationId,
        workflowId: params.workflowId,
        value: {
          resourceId: selected.resourceId,
          contentSha256: selected.contentSha256,
          mimeType: inferAiTextMimeType(""),
        },
      })) ?? "";
  }

  let reference: WorkflowMediaValue | null = null;
  if (selected.resourceId && selected.contentSha256) {
    reference = buildResourceIdReference({
      resourceId: selected.resourceId,
      contentSha256: selected.contentSha256,
      mimeType: inferAiTextMimeType(resolvedText),
    });
  } else if (selected.resourceId) {
    reference = {
      resourceId: selected.resourceId,
      mimeType: inferAiTextMimeType(resolvedText),
    };
  } else if (resolvedText.trim()) {
    reference = await stageAiTextContent({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      text: resolvedText,
    });
  }

  if (!reference) {
    return { resolvedText, modelUnavailable: false };
  }

  const contentSha256 =
    (isResourceIdReference(reference) ? reference.contentSha256 : undefined) ??
    selected.contentSha256 ??
    (await sha256HexFromText(resolvedText));

  const staged: AiTextStagedResultPatch = {
    reference,
    contentSha256,
    sessionText: resolvedText,
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
    return withAiTextStagedHistorySelection(working, params.selectedId, staged);
  });

  return {
    resolvedText,
    modelUnavailable: settings.modelUnavailable,
  };
}
