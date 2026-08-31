import { useViewport } from "@xyflow/react";

import { isAiVideoRetakePanel } from "@dafthunk/types";

import { AiVideoRetakeConfigPanel } from "./ai-video-retake-config-panel";
import { AiVideoRetakeTrimPanel } from "./ai-video-retake-trim-panel";
import { armGenerativePanelPointerGuard } from "./generative-panel-pointer-guard";
import { VIDEO_TRIM_PANEL_WIDTH_PX } from "./video-trim-panel-styles";
import type { WorkflowNodeType } from "./workflow-types";

export interface AiVideoRetakeBottomPanelProps {
  readonly nodeId: string;
  readonly data: WorkflowNodeType;
}

export function AiVideoRetakeBottomPanel({
  nodeId,
  data,
}: AiVideoRetakeBottomPanelProps) {
  const { zoom } = useViewport();

  if (!isAiVideoRetakePanel(data.metadata)) {
    return null;
  }

  const panelZoom = zoom > 0 ? zoom : 1;

  return (
    <div
      className="nodrag nopan nowheel absolute top-full left-1/2 z-20 mt-2 flex flex-col gap-2"
      style={{
        width: VIDEO_TRIM_PANEL_WIDTH_PX,
        transform: `translateX(-50%) scale(${1 / panelZoom})`,
        transformOrigin: "top center",
      }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerDownCapture={() => {
        armGenerativePanelPointerGuard(nodeId);
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <AiVideoRetakeTrimPanel nodeId={nodeId} data={data} />
      <AiVideoRetakeConfigPanel nodeId={nodeId} data={data} />
    </div>
  );
}
