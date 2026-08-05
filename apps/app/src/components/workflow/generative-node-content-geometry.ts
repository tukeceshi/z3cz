import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
} from "@dafthunk/types";
import type { InternalNode, Node, Node as ReactFlowNode } from "@xyflow/react";

import {
  AI_AUDIO_CARD_HEIGHT_PX,
  AI_AUDIO_CARD_WIDTH_PX,
} from "./ai-audio-node-utils";
import {
  AI_IMAGE_CARD_HEIGHT_PX,
  AI_IMAGE_CARD_WIDTH_PX,
} from "./ai-image-node-utils";
import {
  AI_TEXT_CARD_HEIGHT_PX,
  AI_TEXT_CARD_WIDTH_PX,
} from "./ai-text-node-utils";
import {
  AI_VIDEO_CARD_HEIGHT_PX,
  AI_VIDEO_CARD_WIDTH_PX,
} from "./ai-video-node-utils";

/**
 * Floating mini-header uses `-top-5` and sits above the card.
 * Edge anchors use the content card only (exclude this title band).
 */
export const GENERATIVE_NODE_TITLE_OFFSET_PX = 20;

function fallbackContentSize(nodeType: string | undefined): {
  width: number;
  height: number;
} {
  if (nodeType === AI_TEXT_NODE_TYPE) {
    return { width: AI_TEXT_CARD_WIDTH_PX, height: AI_TEXT_CARD_HEIGHT_PX };
  }
  if (nodeType === AI_IMAGE_NODE_TYPE) {
    return { width: AI_IMAGE_CARD_WIDTH_PX, height: AI_IMAGE_CARD_HEIGHT_PX };
  }
  if (nodeType === AI_VIDEO_NODE_TYPE) {
    return { width: AI_VIDEO_CARD_WIDTH_PX, height: AI_VIDEO_CARD_HEIGHT_PX };
  }
  if (nodeType === AI_AUDIO_NODE_TYPE) {
    return { width: AI_AUDIO_CARD_WIDTH_PX, height: AI_AUDIO_CARD_HEIGHT_PX };
  }
  return { width: AI_TEXT_CARD_WIDTH_PX, height: AI_TEXT_CARD_HEIGHT_PX };
}

/**
 * Shared content-card size for layout and edge anchors.
 * Text/audio use fixed constants (ignore measured border drift).
 * Image/video use measured adaptive size when available.
 */
export function resolveGenerativeLayoutContentSize(
  nodeType: string | undefined,
  node?: Pick<ReactFlowNode, "measured" | "width" | "height">
): { width: number; height: number } {
  if (
    nodeType === AI_TEXT_NODE_TYPE ||
    nodeType === AI_AUDIO_NODE_TYPE
  ) {
    return fallbackContentSize(nodeType);
  }

  const measuredW = node?.measured?.width ?? node?.width;
  const measuredH = node?.measured?.height ?? node?.height;
  if (
    typeof measuredW === "number" &&
    measuredW > 0 &&
    typeof measuredH === "number" &&
    measuredH > 0
  ) {
    return { width: measuredW, height: measuredH };
  }
  return fallbackContentSize(nodeType);
}

/** Content card size — measured body, not the floating title above. */
export function resolveGenerativeNodeContentSize(
  node: InternalNode<Node>
): { width: number; height: number } {
  const nodeType = (node.data as { nodeType?: string } | undefined)?.nodeType;
  return resolveGenerativeLayoutContentSize(nodeType, node);
}

/** Left/right border midpoint of the content card (title excluded). */
export function snapGenerativeContentBorderPoint(
  node: InternalNode<Node>,
  side: "left" | "right"
): { x: number; y: number } {
  const pos = node.internals.positionAbsolute;
  const { width, height } = resolveGenerativeNodeContentSize(node);
  return {
    x: side === "left" ? pos.x : pos.x + width,
    y: pos.y + height / 2,
  };
}
