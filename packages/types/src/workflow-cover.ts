import { AI_IMAGE_NODE_TYPE } from "./ai-interface";
import {
  AI_IMAGE_HISTORY_INPUT,
  AI_IMAGE_RESULT_INPUT,
} from "./generative-node-content";
import {
  isDisplayableWorkflowMedia,
  isObjectReference,
  isResourceIdReference,
} from "./media-reference";
import {
  isWideLayoutSize,
  readNodeLayoutFromMetadata,
} from "./node-layout-metadata";
import type { Node, Parameter } from "./workflow";

export interface WorkflowCoverCandidate {
  readonly resourceId: string;
  readonly mimeType: string;
}

function readJsonInputValue(
  inputs: readonly Parameter[],
  name: string
): unknown | null {
  const input = inputs.find((entry) => entry.name === name);
  if (!input || input.value === undefined || input.value === null) {
    return null;
  }
  return input.value;
}

function isCoverImageMimeType(mimeType: string | undefined): boolean {
  return typeof mimeType === "string" && mimeType.startsWith("image/");
}

function candidateFromResourceValue(
  value: unknown
): WorkflowCoverCandidate | null {
  if (isResourceIdReference(value) && isDisplayableWorkflowMedia(value)) {
    const mimeType = value.mimeType;
    if (!isCoverImageMimeType(mimeType)) {
      return null;
    }
    return { resourceId: value.resourceId, mimeType };
  }

  if (isObjectReference(value) && isCoverImageMimeType(value.mimeType)) {
    return { resourceId: value.id, mimeType: value.mimeType };
  }

  return null;
}

function firstCandidateFromValues(
  values: readonly unknown[]
): WorkflowCoverCandidate | null {
  for (const value of values) {
    const candidate = candidateFromResourceValue(value);
    if (candidate) {
      return candidate;
    }
  }
  return null;
}

function collectImageNodeCandidates(
  inputs: readonly Parameter[]
): readonly WorkflowCoverCandidate[] {
  const found: WorkflowCoverCandidate[] = [];

  const result = readJsonInputValue(inputs, AI_IMAGE_RESULT_INPUT);
  if (Array.isArray(result)) {
    const candidate = firstCandidateFromValues(result);
    if (candidate) {
      found.push(candidate);
    }
  }

  const history = readJsonInputValue(inputs, AI_IMAGE_HISTORY_INPUT);
  if (
    history &&
    typeof history === "object" &&
    Array.isArray((history as { items?: unknown }).items)
  ) {
    for (const item of (history as { items: readonly unknown[] }).items) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const images = (item as { images?: readonly unknown[] }).images;
      if (!Array.isArray(images)) {
        continue;
      }
      const candidate = firstCandidateFromValues(images);
      if (candidate) {
        found.push(candidate);
      }
    }
  }

  return found;
}

function collectBlobFieldCandidates(
  parameters: readonly Parameter[]
): WorkflowCoverCandidate | null {
  for (const parameter of parameters) {
    if (parameter.type !== "image") {
      continue;
    }
    const candidate = candidateFromResourceValue(parameter.value);
    if (candidate) {
      return candidate;
    }
  }
  return null;
}

function isWideLayoutNode(node: Node): boolean {
  const layout = readNodeLayoutFromMetadata(node.metadata);
  if (!layout) {
    return false;
  }
  return isWideLayoutSize(layout);
}

function firstCoverCandidateFromNode(node: Node): WorkflowCoverCandidate | null {
  if (node.type === AI_IMAGE_NODE_TYPE) {
    const fromImageNode = collectImageNodeCandidates(node.inputs);
    return fromImageNode[0] ?? null;
  }

  const fromInputs = collectBlobFieldCandidates(node.inputs);
  if (fromInputs) {
    return fromInputs;
  }

  return collectBlobFieldCandidates(node.outputs);
}

/** First displayable image on a wide-layout node, in workflow node order. */
export function findFirstWorkflowCoverCandidate(
  nodes: readonly Node[]
): WorkflowCoverCandidate | null {
  for (const node of nodes) {
    if (!isWideLayoutNode(node)) {
      continue;
    }

    const candidate = firstCoverCandidateFromNode(node);
    if (candidate) {
      return candidate;
    }
  }

  return null;
}
