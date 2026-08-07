import {
  getMediaReferenceKey,
  isMediaReference,
  type MediaReference,
} from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";

import type { WorkflowNodeType, WorkflowParameter } from "@/components/workflow/workflow-types";

const MEDIA_INPUT_IDS = new Set([
  "manual_images",
  "images_result",
  "videos_result",
  "audios_result",
  "images_history",
  "videos_history",
  "audios_history",
  "reference_images",
  "reference_videos",
  "reference_audios",
]);

function rekeyMediaValue(
  value: unknown,
  fromMediaId: string,
  toMediaReference: MediaReference
): unknown {
  if (isMediaReference(value) && getMediaReferenceKey(value) === fromMediaId) {
    return toMediaReference;
  }

  if (!Array.isArray(value)) {
    return value;
  }

  let changed = false;
  const next = value.map((item) => {
    if (isMediaReference(item) && getMediaReferenceKey(item) === fromMediaId) {
      changed = true;
      return toMediaReference;
    }
    return item;
  });
  return changed ? next : value;
}

function rekeyHistoryValue(
  value: unknown,
  fromMediaId: string,
  toMediaReference: MediaReference,
  mediaField: "images" | "videos" | "audios"
): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as {
    readonly items?: readonly unknown[];
    readonly selectedId?: string | null;
  };
  if (!Array.isArray(record.items)) {
    return value;
  }

  let changed = false;
  const items = record.items.map((item) => {
    if (!item || typeof item !== "object") {
      return item;
    }
    const entry = item as Record<string, unknown>;
    const media = entry[mediaField];
    const nextMedia = rekeyMediaValue(media, fromMediaId, toMediaReference);
    if (nextMedia !== media) {
      changed = true;
      return { ...entry, [mediaField]: nextMedia };
    }
    return item;
  });

  return changed ? { ...record, items } : value;
}

function rekeyInputs(
  inputs: readonly WorkflowParameter[],
  fromMediaId: string,
  toMediaReference: MediaReference
): readonly WorkflowParameter[] {
  let changed = false;
  const next = inputs.map((input) => {
    if (!MEDIA_INPUT_IDS.has(input.id)) {
      return input;
    }

    let value = input.value;
    if (
      input.id === "images_history" ||
      input.id === "videos_history" ||
      input.id === "audios_history"
    ) {
      const mediaField =
        input.id === "images_history"
          ? "images"
          : input.id === "videos_history"
            ? "videos"
            : "audios";
      value = rekeyHistoryValue(value, fromMediaId, toMediaReference, mediaField);
    } else {
      value = rekeyMediaValue(value, fromMediaId, toMediaReference);
    }

    if (value !== input.value) {
      changed = true;
      return { ...input, value };
    }
    return input;
  });

  return changed ? next : inputs;
}

function rekeyOutputs(
  outputs: readonly WorkflowParameter[],
  fromMediaId: string,
  toMediaReference: MediaReference
): readonly WorkflowParameter[] {
  let changed = false;
  const next = outputs.map((output) => {
    if (output.id !== "output") {
      return output;
    }
    const value = rekeyMediaValue(output.value, fromMediaId, toMediaReference);
    if (value !== output.value) {
      changed = true;
      return { ...output, value };
    }
    return output;
  });
  return changed ? next : outputs;
}

export function rekeyMediaReferencesInNodeData(
  data: WorkflowNodeType,
  fromMediaId: string,
  toMediaReference: MediaReference
): WorkflowNodeType | null {
  const inputs = rekeyInputs(data.inputs, fromMediaId, toMediaReference);
  const outputs = rekeyOutputs(data.outputs, fromMediaId, toMediaReference);
  if (inputs === data.inputs && outputs === data.outputs) {
    return null;
  }
  return { ...data, inputs, outputs };
}

export function rekeyMediaReferencesInNodes(
  nodes: readonly ReactFlowNode<WorkflowNodeType>[],
  fromMediaId: string,
  toMediaReference: MediaReference
): ReactFlowNode<WorkflowNodeType>[] | null {
  let changed = false;
  const next = nodes.map((node) => {
    const patched = rekeyMediaReferencesInNodeData(
      node.data,
      fromMediaId,
      toMediaReference
    );
    if (!patched) {
      return node;
    }
    changed = true;
    return { ...node, data: patched };
  });
  return changed ? next : null;
}
