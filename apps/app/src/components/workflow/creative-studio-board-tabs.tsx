import type { AiGenerativeNodeType } from "@dafthunk/types";
import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
} from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";
import Maximize2 from "lucide-react/icons/maximize-2";
import { useCallback, useState } from "react";
import Masonry from "react-masonry-css";

import { useTranslation } from "@/components/locale-provider";
import type { TranslationKey } from "@/i18n";
import { cn } from "@/utils/utils";

import { CreativeStudioAddNodeSlot } from "./creative-studio-add-node-slot";
import { CreativeStudioAudioTile } from "./creative-studio-audio-tile";
import { useCreativeStudio } from "./creative-studio-context";
import { CreativeStudioListItem } from "./creative-studio-list-item";
import { CreativeStudioNodeCard } from "./creative-studio-node-card";
import {
  STUDIO_LIST_BODY,
  STUDIO_SCROLL,
  STUDIO_TAB,
  STUDIO_TAB_ACTIVE,
  STUDIO_TAB_BAR,
  STUDIO_TAB_EXPAND,
  STUDIO_TAB_GROUP,
} from "./creative-studio-surface";
import type { StudioListNodeInteractionHandlers } from "./studio-list-node-interaction-handlers";
import type { WorkflowNodeType } from "./workflow-types";
import { isStudioListNodeActive } from "./creative-studio-utils";

export type StudioBoardTab = "all" | "audio" | "text" | "image" | "video";

type StudioBoardTypeTab = Exclude<StudioBoardTab, "all">;

const TAB_CONFIG: readonly {
  readonly id: StudioBoardTab;
  readonly labelKey: TranslationKey;
  readonly nodeType?: AiGenerativeNodeType;
}[] = [
  {
    id: "all",
    labelKey: "workflow.studio.tabAll",
  },
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
  readonly allNodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly audioNodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly textNodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly imageNodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly videoNodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly primaryNodeId: string | null;
  readonly secondaryNodeId: string | null;
  readonly listInteraction: StudioListNodeInteractionHandlers;
  readonly onExpandList: () => void;
  readonly referenceDragEnabled?: boolean;
  readonly className?: string;
}

function nodesForTab(
  tab: StudioBoardTab,
  allNodes: readonly ReactFlowNode<WorkflowNodeType>[],
  audioNodes: readonly ReactFlowNode<WorkflowNodeType>[],
  textNodes: readonly ReactFlowNode<WorkflowNodeType>[],
  imageNodes: readonly ReactFlowNode<WorkflowNodeType>[],
  videoNodes: readonly ReactFlowNode<WorkflowNodeType>[]
): readonly ReactFlowNode<WorkflowNodeType>[] {
  if (tab === "all") return allNodes;
  if (tab === "audio") return audioNodes;
  if (tab === "text") return textNodes;
  if (tab === "image") return imageNodes;
  return videoNodes;
}

function isAudioNode(node: ReactFlowNode<WorkflowNodeType>): boolean {
  return node.data.nodeType === AI_AUDIO_NODE_TYPE;
}

interface StudioNodeListItemProps {
  readonly node: ReactFlowNode<WorkflowNodeType>;
  readonly primaryNodeId: string | null;
  readonly secondaryNodeId: string | null;
  readonly listInteraction: StudioListNodeInteractionHandlers;
  readonly referenceDragEnabled: boolean;
}

function StudioNodeListItem({
  node,
  primaryNodeId,
  secondaryNodeId,
  listInteraction,
  referenceDragEnabled,
}: StudioNodeListItemProps) {
  const isActive = isStudioListNodeActive(
    node.id,
    primaryNodeId,
    secondaryNodeId
  );
  const handleListNodeDoubleClick = () => {
    listInteraction.onListNodeDoubleClick(node.id);
  };

  if (isAudioNode(node)) {
    return (
      <CreativeStudioListItem
        focusId={node.id}
        isActive={isActive}
        variant="media"
        onNodeDoubleClick={handleListNodeDoubleClick}
      >
        <CreativeStudioAudioTile
          node={node}
          onOpenDetail={() => listInteraction.onListNodeClick(node.id)}
          onCancelPendingListClick={listInteraction.cancelPendingListClick}
          referenceDragEnabled={referenceDragEnabled}
        />
      </CreativeStudioListItem>
    );
  }

  return (
    <CreativeStudioListItem
      focusId={node.id}
      isActive={isActive}
      variant="media"
      onNodeDoubleClick={handleListNodeDoubleClick}
    >
      <CreativeStudioNodeCard
        node={node}
        onOpenDetail={() => listInteraction.onListNodeClick(node.id)}
        onCancelPendingListClick={listInteraction.cancelPendingListClick}
        referenceDragEnabled={referenceDragEnabled}
      />
    </CreativeStudioListItem>
  );
}

function StudioMediaMasonryList({
  nodes,
  primaryNodeId,
  secondaryNodeId,
  listInteraction,
  referenceDragEnabled,
}: {
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly primaryNodeId: string | null;
  readonly secondaryNodeId: string | null;
  readonly listInteraction: StudioListNodeInteractionHandlers;
  readonly referenceDragEnabled: boolean;
}) {
  const isActive = (nodeId: string) =>
    isStudioListNodeActive(nodeId, primaryNodeId, secondaryNodeId);

  return (
    <Masonry
      breakpointCols={STUDIO_MEDIA_MASONRY_BREAKPOINTS}
      className="studio-masonry-grid"
      columnClassName="studio-masonry-grid_column"
    >
      {nodes.map((node) => (
        <CreativeStudioListItem
          key={node.id}
          focusId={node.id}
          isActive={isActive(node.id)}
          variant="media"
          onNodeDoubleClick={() => listInteraction.onListNodeDoubleClick(node.id)}
        >
          <CreativeStudioNodeCard
            node={node}
            onOpenDetail={() => listInteraction.onListNodeClick(node.id)}
            onCancelPendingListClick={listInteraction.cancelPendingListClick}
            referenceDragEnabled={referenceDragEnabled}
          />
        </CreativeStudioListItem>
      ))}
    </Masonry>
  );
}

export function CreativeStudioBoardTabs({
  activeTab,
  onTabChange,
  allNodes,
  audioNodes,
  textNodes,
  imageNodes,
  videoNodes,
  primaryNodeId,
  secondaryNodeId,
  listInteraction,
  onExpandList,
  referenceDragEnabled = false,
  className,
}: CreativeStudioBoardTabsProps) {
  const { t } = useTranslation();
  const { addGenerativeNode } = useCreativeStudio();
  const [addNodeMenuOpen, setAddNodeMenuOpen] = useState(false);
  const activeTabConfig = TAB_CONFIG.find((tab) => tab.id === activeTab);
  const activeNodes = nodesForTab(
    activeTab,
    allNodes,
    audioNodes,
    textNodes,
    imageNodes,
    videoNodes
  );

  const handleAddNodeSelect = useCallback(
    (nodeType: AiGenerativeNodeType) => {
      addGenerativeNode?.(nodeType);
      setAddNodeMenuOpen(false);
    },
    [addGenerativeNode]
  );

  const isActive = (nodeId: string) =>
    isStudioListNodeActive(nodeId, primaryNodeId, secondaryNodeId);

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className={STUDIO_TAB_BAR}>
        <div className={STUDIO_TAB_GROUP} role="tablist">
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
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

      {addGenerativeNode ? (
        <div className="shrink-0 px-4 pb-2">
          <CreativeStudioAddNodeSlot
            mode={activeTab === "all" ? "menu" : "direct"}
            nodeType={activeTabConfig?.nodeType}
            addNodeMenuOpen={addNodeMenuOpen}
            onAddNodeMenuOpenChange={setAddNodeMenuOpen}
            onAddFromMenu={handleAddNodeSelect}
            onAddDirect={
              activeTab !== "all" && activeTabConfig?.nodeType
                ? () => addGenerativeNode(activeTabConfig.nodeType!)
                : undefined
            }
          />
        </div>
      ) : null}

      <div className={cn(STUDIO_LIST_BODY, STUDIO_SCROLL)}>
        {activeNodes.length === 0 ? (
          <div className="py-8 text-center text-xs italic text-muted-foreground/50">
            {t("workflow.studio.empty")}
          </div>
        ) : activeTab === "audio" ? (
          <div className="min-w-0">
            <Masonry
              breakpointCols={STUDIO_MEDIA_MASONRY_BREAKPOINTS}
              className="studio-masonry-grid"
              columnClassName="studio-masonry-grid_column"
            >
              {activeNodes.map((node) => (
                <CreativeStudioListItem
                  key={node.id}
                  focusId={node.id}
                  isActive={isActive(node.id)}
                  variant="media"
                  onNodeDoubleClick={() =>
                    listInteraction.onListNodeDoubleClick(node.id)
                  }
                >
                  <CreativeStudioAudioTile
                    node={node}
                    onOpenDetail={() => listInteraction.onListNodeClick(node.id)}
                    onCancelPendingListClick={listInteraction.cancelPendingListClick}
                    referenceDragEnabled={referenceDragEnabled}
                  />
                </CreativeStudioListItem>
              ))}
            </Masonry>
          </div>
        ) : activeTab === "all" ? (
          <div className="min-w-0">
            <Masonry
              breakpointCols={STUDIO_MEDIA_MASONRY_BREAKPOINTS}
              className="studio-masonry-grid"
              columnClassName="studio-masonry-grid_column"
            >
              {activeNodes.map((node) => (
                <StudioNodeListItem
                  key={node.id}
                  node={node}
                  primaryNodeId={primaryNodeId}
                  secondaryNodeId={secondaryNodeId}
                  listInteraction={listInteraction}
                  referenceDragEnabled={referenceDragEnabled}
                />
              ))}
            </Masonry>
          </div>
        ) : (
          <div className="min-w-0">
            <StudioMediaMasonryList
              nodes={activeNodes}
              primaryNodeId={primaryNodeId}
              secondaryNodeId={secondaryNodeId}
              listInteraction={listInteraction}
              referenceDragEnabled={referenceDragEnabled}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function studioBoardTabForNodeType(
  nodeType: string | undefined
): StudioBoardTypeTab {
  if (nodeType === AI_AUDIO_NODE_TYPE) return "audio";
  if (nodeType === AI_IMAGE_NODE_TYPE) return "image";
  if (nodeType === AI_VIDEO_NODE_TYPE) return "video";
  return "text";
}
