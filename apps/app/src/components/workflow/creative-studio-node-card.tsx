import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
} from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";

import { CreativeStudioAudioTile } from "./creative-studio-audio-tile";
import { CreativeStudioMediaCard } from "./creative-studio-media-card";
import { CreativeStudioTextRow } from "./creative-studio-text-row";
import type { WorkflowNodeType } from "./workflow-types";

export interface CreativeStudioNodeCardProps {
  readonly node: ReactFlowNode<WorkflowNodeType>;
  readonly isActive: boolean;
  readonly onOpenDetail: () => void;
}

export function CreativeStudioNodeCard({
  node,
  isActive,
  onOpenDetail,
}: CreativeStudioNodeCardProps) {
  const nodeType = node.data.nodeType ?? "";

  if (nodeType === AI_AUDIO_NODE_TYPE) {
    return (
      <CreativeStudioAudioTile
        node={node}
        isActive={isActive}
        onOpenDetail={onOpenDetail}
      />
    );
  }

  if (nodeType === AI_TEXT_NODE_TYPE) {
    return (
      <CreativeStudioTextRow
        node={node}
        isActive={isActive}
        onOpenDetail={onOpenDetail}
      />
    );
  }

  if (nodeType === AI_IMAGE_NODE_TYPE || nodeType === AI_VIDEO_NODE_TYPE) {
    return (
      <CreativeStudioMediaCard
        node={node}
        onOpenDetail={onOpenDetail}
      />
    );
  }

  return null;
}
