import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
} from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";
import Maximize2 from "lucide-react/icons/maximize-2";
import Masonry from "react-masonry-css";

import { useTranslation } from "@/components/locale-provider";
import type { TranslationKey } from "@/i18n";
import { cn } from "@/utils/utils";

import { CreativeStudioAudioTile } from "./creative-studio-audio-tile";
import { CreativeStudioListItem } from "./creative-studio-list-item";
import { CreativeStudioNodeCard } from "./creative-studio-node-card";
import {
  STUDIO_AUDIO_GRID,
  STUDIO_LIST_BODY,
  STUDIO_SCROLL,
  STUDIO_TAB,
  STUDIO_TAB_ACTIVE,
  STUDIO_TAB_BAR,
  STUDIO_TAB_EXPAND,
  STUDIO_TAB_GROUP,
} from "./creative-studio-surface";
import type { WorkflowNodeType } from "./workflow-types";

export type StudioBoardTab = "audio" | "text" | "image" | "video";

const TAB_CONFIG: readonly {
  readonly id: StudioBoardTab;
  readonly nodeType: string;
  readonly labelKey: TranslationKey;
}[] = [
  {
    id: "audio",
    nodeType: AI_AUDIO_NODE_TYPE,
    labelKey: "workflow.canvas.aiAudio",
  },
  {
    id: "text",
    nodeType: AI_TEXT_NODE_TYPE,
    labelKey: "workflow.canvas.aiText",
  },
  {
    id: "image",
    nodeType: AI_IMAGE_NODE_TYPE,
    labelKey: "workflow.canvas.aiImage",
  },
  {
    id: "video",
    nodeType: AI_VIDEO_NODE_TYPE,
    labelKey: "workflow.canvas.aiVideo",
  },
] as const;

const STUDIO_MEDIA_MASONRY_BREAKPOINTS = {
  default: 3,
  1800: 3,
  1280: 2,
  820: 1,
} as const;

export interface CreativeStudioBoardTabsProps {
  readonly activeTab: StudioBoardTab;
  readonly onTabChange: (tab: StudioBoardTab) => void;
  readonly audioNodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly textNodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly imageNodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly videoNodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly focusedNodeId: string | null;
  readonly onOpenDetail: (nodeId: string) => void;
  readonly onExpandList: () => void;
  readonly className?: string;
}

function nodesForTab(
  tab: StudioBoardTab,
  audioNodes: readonly ReactFlowNode<WorkflowNodeType>[],
  textNodes: readonly ReactFlowNode<WorkflowNodeType>[],
  imageNodes: readonly ReactFlowNode<WorkflowNodeType>[],
  videoNodes: readonly ReactFlowNode<WorkflowNodeType>[]
): readonly ReactFlowNode<WorkflowNodeType>[] {
  if (tab === "audio") return audioNodes;
  if (tab === "text") return textNodes;
  if (tab === "image") return imageNodes;
  return videoNodes;
}

export function CreativeStudioBoardTabs({
  activeTab,
  onTabChange,
  audioNodes,
  textNodes,
  imageNodes,
  videoNodes,
  focusedNodeId,
  onOpenDetail,
  onExpandList,
  className,
}: CreativeStudioBoardTabsProps) {
  const { t } = useTranslation();
  const activeNodes = nodesForTab(
    activeTab,
    audioNodes,
    textNodes,
    imageNodes,
    videoNodes
  );

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className={STUDIO_TAB_BAR}>
        <div className={STUDIO_TAB_GROUP}>
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cn(
                STUDIO_TAB,
                activeTab === tab.id ? STUDIO_TAB_ACTIVE : undefined
              )}
              onClick={() => onTabChange(tab.id)}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={STUDIO_TAB_EXPAND}
          aria-label={t("workflow.studio.expand")}
          title={t("workflow.studio.expand")}
          onClick={onExpandList}
        >
          <Maximize2 className="size-3.5" strokeWidth={2} />
        </button>
      </div>

      <div className={cn(STUDIO_LIST_BODY, STUDIO_SCROLL)}>
        {activeNodes.length === 0 ? (
          <div className="py-8 text-center text-xs italic text-muted-foreground/50">
            {t("workflow.studio.empty")}
          </div>
        ) : activeTab === "audio" ? (
          <div className={STUDIO_AUDIO_GRID}>
            {activeNodes.map((node) => (
              <CreativeStudioAudioTile
                key={node.id}
                node={node}
                isActive={node.id === focusedNodeId}
                onOpenDetail={() => onOpenDetail(node.id)}
              />
            ))}
          </div>
        ) : (
          <div className="min-w-0">
            {activeTab === "text" ? (
              <Masonry
                breakpointCols={STUDIO_MEDIA_MASONRY_BREAKPOINTS}
                className="studio-masonry-grid"
                columnClassName="studio-masonry-grid_column"
              >
                {activeNodes.map((node) => (
                  <CreativeStudioListItem
                    key={node.id}
                    focusId={node.id}
                    isActive={node.id === focusedNodeId}
                    variant="mediaPlain"
                  >
                    <CreativeStudioNodeCard
                      node={node}
                      isActive={node.id === focusedNodeId}
                      onOpenDetail={() => onOpenDetail(node.id)}
                    />
                  </CreativeStudioListItem>
                ))}
              </Masonry>
            ) : (
              <Masonry
                breakpointCols={STUDIO_MEDIA_MASONRY_BREAKPOINTS}
                className="studio-masonry-grid"
                columnClassName="studio-masonry-grid_column"
              >
                {activeNodes.map((node) => (
                  <CreativeStudioListItem
                    key={node.id}
                    focusId={node.id}
                    isActive={node.id === focusedNodeId}
                    variant="media"
                  >
                    <CreativeStudioNodeCard
                      node={node}
                      isActive={node.id === focusedNodeId}
                      onOpenDetail={() => onOpenDetail(node.id)}
                    />
                  </CreativeStudioListItem>
                ))}
              </Masonry>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function studioBoardTabForNodeType(
  nodeType: string | undefined
): StudioBoardTab {
  if (nodeType === AI_AUDIO_NODE_TYPE) return "audio";
  if (nodeType === AI_IMAGE_NODE_TYPE) return "image";
  if (nodeType === AI_VIDEO_NODE_TYPE) return "video";
  return "text";
}
