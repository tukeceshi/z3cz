import {
  AI_TEXT_NODE_TYPE,
  getResourceIdFromValue,
  inferAiTextMimeType,
} from "@dafthunk/types";
import type { LocalMediaReference, ResourceIdReference } from "@dafthunk/types";

import {
  buildResourceIdReference,
  withAiTextStagedResult,
  type AiTextStagedResultPatch,
} from "./ai-text-persist-utils";
import {
  AI_TEXT_RESULT_HISTORY_INPUT_ID,
  AI_TEXT_RESULT_INPUT_ID,
  readAiTextResultHistory,
} from "./ai-text-node-utils";
import type { WorkflowNodeType } from "./workflow-types";
import { stageAiTextContent } from "@/services/ai-text-storage-service";
import {
  registerTextContent,
  uploadTextContentBlob,
} from "@/services/text-content-service";
import { sha256HexFromText } from "@/utils/text-content-utils";

export function nodeHasInlineAiText(data: WorkflowNodeType): boolean {
  if (data.nodeType !== AI_TEXT_NODE_TYPE) {
    return false;
  }

  const resultValue = data.inputs.find(
    (input) => input.id === AI_TEXT_RESULT_INPUT_ID
  )?.value;
  if (typeof resultValue === "string" && resultValue.trim().length > 0) {
    return true;
  }

  const history = readAiTextResultHistory(data.inputs);
  return history.items.some(
    (item) =>
      typeof item.text === "string" &&
      item.text.length > 0 &&
      !item.resourceId
  );
}

interface MigrateInlineAiTextNodeParams {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly cloudConfigured: boolean;
  readonly data: WorkflowNodeType;
}

async function stageTextReference(
  params: MigrateInlineAiTextNodeParams,
  text: string
): Promise<{
  readonly reference: LocalMediaReference | ResourceIdReference;
  readonly contentSha256: string;
}> {
  const mimeType = inferAiTextMimeType(text);
  const contentSha256 = await sha256HexFromText(text);

  if (params.cloudConfigured) {
    try {
      const blob = new Blob([text], { type: mimeType });
      const registered = await registerTextContent({
        organizationId: params.organizationId,
        contentSha256,
        mimeType,
        contentLength: blob.size,
        workflowId: params.workflowId,
      });
      await uploadTextContentBlob({
        uploadUrl: registered.uploadUrl,
        uploadHeaders: registered.uploadHeaders,
        blob,
      });
      return {
        reference: buildResourceIdReference({
          resourceId: registered.resourceId,
          contentSha256,
          mimeType,
        }),
        contentSha256,
      };
    } catch {
      // fall through to local staging
    }
  }

  const reference = await stageAiTextContent({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    text,
  });
  return { reference, contentSha256 };
}

export async function migrateInlineAiTextNodeData(
  params: MigrateInlineAiTextNodeParams
): Promise<WorkflowNodeType | null> {
  if (!nodeHasInlineAiText(params.data)) {
    return null;
  }

  const stagedByText = new Map<
    string,
    { reference: LocalMediaReference | ResourceIdReference; contentSha256: string }
  >();
  let changed = false;
  let working = params.data;

  async function stageUniqueText(text: string) {
    const cached = stagedByText.get(text);
    if (cached) {
      return cached;
    }

    const staged = await stageTextReference(params, text);
    stagedByText.set(text, staged);
    return staged;
  }

  const history = readAiTextResultHistory(working.inputs);
  const migratedItems = await Promise.all(
    history.items.map(async (item) => {
      if (
        typeof item.text !== "string" ||
        item.text.length === 0 ||
        item.resourceId
      ) {
        return item;
      }

      changed = true;
      const staged = await stageUniqueText(item.text);
      const resourceId = getResourceIdFromValue(staged.reference);
      return {
        ...item,
        ...(resourceId ? { resourceId } : {}),
        contentSha256: staged.contentSha256,
        text: undefined,
        excerpt: undefined,
      };
    })
  );

  if (changed) {
    working = {
      ...working,
      inputs: working.inputs.map((input) =>
        input.id === AI_TEXT_RESULT_HISTORY_INPUT_ID
          ? {
              ...input,
              value: { items: migratedItems, selectedId: history.selectedId },
            }
          : input
      ),
    };
  }

  const resultInput = working.inputs.find(
    (input) => input.id === AI_TEXT_RESULT_INPUT_ID
  )?.value;
  if (typeof resultInput === "string" && resultInput.trim().length > 0) {
    changed = true;
    const staged = await stageUniqueText(resultInput);
    const patchPayload: AiTextStagedResultPatch = {
      reference: staged.reference,
      contentSha256: staged.contentSha256,
      sessionText: resultInput,
    };
    const patch = withAiTextStagedResult(working, patchPayload);
    working = {
      ...working,
      ...patch,
      inputs: patch.inputs ?? working.inputs,
      outputs: patch.outputs ?? working.outputs,
    } as WorkflowNodeType;
  }

  return changed ? working : null;
}

export function buildInlineAiTextFingerprint(
  nodes: readonly { readonly id: string; readonly data: WorkflowNodeType }[]
): string {
  return nodes
    .filter((node) => node.data.nodeType === AI_TEXT_NODE_TYPE)
    .map((node) => {
      const resultValue = node.data.inputs.find(
        (input) => input.id === AI_TEXT_RESULT_INPUT_ID
      )?.value;
      const history = readAiTextResultHistory(node.data.inputs);
      const inlineHistoryCount = history.items.filter(
        (item) => typeof item.text === "string" && item.text.length > 0
      ).length;
      return `${node.id}:${typeof resultValue === "string" ? "inline" : "ref"}:${inlineHistoryCount}`;
    })
    .join("|");
}
