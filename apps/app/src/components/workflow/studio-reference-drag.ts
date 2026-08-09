import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
} from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";
import type { DragEvent, RefObject } from "react";

import { AI_AUDIO_OUTPUT_ID } from "./ai-audio-node-utils";
import { AI_IMAGE_OUTPUT_ID } from "./ai-image-node-utils";
import { AI_TEXT_OUTPUT_ID } from "./ai-text-node-utils";
import { AI_VIDEO_OUTPUT_ID } from "./ai-video-node-utils";
import type { WorkflowNodeType } from "./workflow-types";

export const STUDIO_REFERENCE_DRAG_MIME =
  "application/x-dafthunk-studio-reference" as const;

export const STUDIO_REFERENCE_DRAGGING_HTML_CLASS = "studio-reference-dragging";

export interface StudioReferenceDragPayload {
  readonly nodeId: string;
  readonly outputId: string;
}

let activeStudioReferenceDragSession: StudioReferenceDragPayload | null = null;
let activeStudioReferenceDragImageEl: HTMLElement | null = null;

function parseStudioReferenceDragPayload(
  raw: string
): StudioReferenceDragPayload | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "nodeId" in parsed &&
      "outputId" in parsed &&
      typeof parsed.nodeId === "string" &&
      typeof parsed.outputId === "string" &&
      parsed.nodeId.length > 0 &&
      parsed.outputId.length > 0
    ) {
      return { nodeId: parsed.nodeId, outputId: parsed.outputId };
    }
  } catch {
    return null;
  }

  return null;
}

export function setStudioReferenceDragSession(
  payload: StudioReferenceDragPayload
): void {
  activeStudioReferenceDragSession = payload;
}

export function readStudioReferenceDragSession(): StudioReferenceDragPayload | null {
  return activeStudioReferenceDragSession;
}

export function clearStudioReferenceDragSession(): void {
  activeStudioReferenceDragSession = null;
}

function setStudioReferenceDragging(active: boolean): void {
  document.documentElement.classList.toggle(
    STUDIO_REFERENCE_DRAGGING_HTML_CLASS,
    active
  );
}

function removeStudioReferenceDragImage(): void {
  activeStudioReferenceDragImageEl?.remove();
  activeStudioReferenceDragImageEl = null;
}

function applyStudioReferenceDragImage(
  event: DragEvent<HTMLElement>,
  sourceElement: HTMLElement
): void {
  removeStudioReferenceDragImage();

  const clone = sourceElement.cloneNode(true) as HTMLElement;
  clone.style.position = "fixed";
  clone.style.top = "-9999px";
  clone.style.left = "-9999px";
  clone.style.width = `${sourceElement.offsetWidth}px`;
  clone.style.opacity = "1";
  clone.style.pointerEvents = "none";
  clone.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.12)";
  document.body.appendChild(clone);
  activeStudioReferenceDragImageEl = clone;

  const rect = sourceElement.getBoundingClientRect();
  event.dataTransfer.setDragImage(
    clone,
    event.clientX - rect.left,
    event.clientY - rect.top
  );
}

export function resolveStudioReferenceDragPayload(
  node: Pick<ReactFlowNode<WorkflowNodeType>, "id" | "data">
): StudioReferenceDragPayload | null {
  const nodeType = node.data.nodeType ?? "";

  if (nodeType === AI_TEXT_NODE_TYPE) {
    return { nodeId: node.id, outputId: AI_TEXT_OUTPUT_ID };
  }
  if (nodeType === AI_IMAGE_NODE_TYPE) {
    return { nodeId: node.id, outputId: AI_IMAGE_OUTPUT_ID };
  }
  if (nodeType === AI_VIDEO_NODE_TYPE) {
    return { nodeId: node.id, outputId: AI_VIDEO_OUTPUT_ID };
  }
  if (nodeType === AI_AUDIO_NODE_TYPE) {
    return { nodeId: node.id, outputId: AI_AUDIO_OUTPUT_ID };
  }

  return null;
}

export function writeStudioReferenceDrag(
  dataTransfer: DataTransfer,
  payload: StudioReferenceDragPayload
): void {
  dataTransfer.setData(STUDIO_REFERENCE_DRAG_MIME, JSON.stringify(payload));
  dataTransfer.effectAllowed = "copy";
  setStudioReferenceDragSession(payload);
}

export function hasStudioReferenceDrag(dataTransfer: DataTransfer): boolean {
  return (
    dataTransfer.types.includes(STUDIO_REFERENCE_DRAG_MIME) ||
    activeStudioReferenceDragSession !== null
  );
}

export function readStudioReferenceDragPayload(
  dataTransfer: DataTransfer
): StudioReferenceDragPayload | null {
  return parseStudioReferenceDragPayload(
    dataTransfer.getData(STUDIO_REFERENCE_DRAG_MIME)
  );
}

/** dragOver cannot read getData — fall back to the active drag session. */
export function resolveStudioReferenceDragPayloadFromTransfer(
  dataTransfer: DataTransfer
): StudioReferenceDragPayload | null {
  return (
    readStudioReferenceDragPayload(dataTransfer) ??
    readStudioReferenceDragSession()
  );
}

export interface StudioReferenceDragSourceProps {
  readonly draggable?: boolean;
  readonly onDragStart?: (event: DragEvent<HTMLElement>) => void;
  readonly onDragEnd?: (event: DragEvent<HTMLElement>) => void;
}

export interface StudioReferenceDragSourceOptions {
  readonly dragImageRootRef?: RefObject<HTMLElement | null>;
  readonly onDragStateChange?: (dragging: boolean) => void;
  readonly onDragStart?: () => void;
}

export function studioReferenceDragSourceProps(
  node: Pick<ReactFlowNode<WorkflowNodeType>, "id" | "data">,
  enabled: boolean,
  options?: StudioReferenceDragSourceOptions
): StudioReferenceDragSourceProps {
  if (!enabled) {
    return {};
  }

  const payload = resolveStudioReferenceDragPayload(node);
  if (!payload) {
    return {};
  }

  return {
    draggable: true,
    onDragStart: (event) => {
      options?.onDragStart?.();
      writeStudioReferenceDrag(event.dataTransfer, payload);
      const dragImageRoot =
        options?.dragImageRootRef?.current ?? event.currentTarget;
      applyStudioReferenceDragImage(event, dragImageRoot);
      setStudioReferenceDragging(true);
      options?.onDragStateChange?.(true);
      event.stopPropagation();
    },
    onDragEnd: () => {
      clearStudioReferenceDragSession();
      removeStudioReferenceDragImage();
      setStudioReferenceDragging(false);
      options?.onDragStateChange?.(false);
    },
  };
}
