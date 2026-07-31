import type { Node as ReactFlowNode } from "@xyflow/react";
import Masonry from "react-masonry-css";

import { useTranslation } from "@/components/locale-provider";
import type { TranslationKey } from "@/i18n";
import { cn } from "@/utils/utils";

import {
  CreativeStudioBoardTabs,
  type StudioBoardTab,
} from "./creative-studio-board-tabs";
import { CreativeStudioAudioTile } from "./creative-studio-audio-tile";
import { CreativeStudioListItem } from "./creative-studio-list-item";
import { CreativeStudioNodeCard } from "./creative-studio-node-card";
import {
  STUDIO_AUDIO_GRID,
  STUDIO_BOARD_GAP,
  STUDIO_LIST_BODY,
  STUDIO_PANEL,
  STUDIO_PANEL_COUNT,
  STUDIO_PANEL_HEADER,
  STUDIO_PANEL_TITLE,
  STUDIO_SCROLL,
} from "./creative-studio-surface";
import type { WorkflowNodeType } from "./workflow-types";

export interface CreativeStudioNodesByType {
  readonly audio: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly text: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly image: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly video: readonly ReactFlowNode<WorkflowNodeType>[];
}

export interface CreativeStudioBoardProps {
  readonly nodesByType: CreativeStudioNodesByType;
  readonly focusedNodeId: string | null;
  readonly onOpenDetail: (nodeId: string) => void;
  readonly onExpandList?: () => void;
  readonly compact?: boolean;
  readonly boardTab?: StudioBoardTab;
  readonly onBoardTabChange?: (tab: StudioBoardTab) => void;
}

interface SectionHeaderProps {
  readonly labelKey: TranslationKey;
  readonly count: number;
}

const STUDIO_MEDIA_MASONRY_BREAKPOINTS = {
  default: 3,
  1800: 3,
  1280: 2,
  820: 1,
} as const;

function SectionHeader({ labelKey, count }: SectionHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className={STUDIO_PANEL_HEADER}>
      <h3 className={STUDIO_PANEL_TITLE}>{t(labelKey)}</h3>
      <span className={STUDIO_PANEL_COUNT}>{count}</span>
    </div>
  );
}

function EmptySection({ className }: { readonly className?: string }) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "py-6 text-center text-xs italic text-muted-foreground/50",
        className
      )}
    >
      {t("workflow.studio.empty")}
    </div>
  );
}

function AudioListSection({
  nodes,
  focusedNodeId,
  onOpenDetail,
  className,
}: {
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly focusedNodeId: string | null;
  readonly onOpenDetail: (nodeId: string) => void;
  readonly className?: string;
}) {
  return (
    <section className={cn(STUDIO_PANEL, "min-h-0 flex-1", className)}>
      <SectionHeader
        labelKey="workflow.canvas.aiAudio"
        count={nodes.length}
      />
      <div className={cn(STUDIO_LIST_BODY, STUDIO_SCROLL)}>
        <div className={STUDIO_AUDIO_GRID}>
          {nodes.length === 0 ? (
            <EmptySection className="col-span-full" />
          ) : (
            nodes.map((node) => (
              <CreativeStudioAudioTile
                key={node.id}
                node={node}
                isActive={node.id === focusedNodeId}
                onOpenDetail={() => onOpenDetail(node.id)}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function NodeListSection({
  labelKey,
  nodes,
  focusedNodeId,
  onOpenDetail,
  className,
  itemVariant = "default",
  mediaGrid = false,
}: {
  readonly labelKey: TranslationKey;
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly focusedNodeId: string | null;
  readonly onOpenDetail: (nodeId: string) => void;
  readonly className?: string;
  readonly itemVariant?: "default" | "text" | "media" | "mediaPlain";
  readonly mediaGrid?: boolean;
}) {
  return (
    <section className={cn(STUDIO_PANEL, "min-h-0 flex-1", className)}>
      <SectionHeader labelKey={labelKey} count={nodes.length} />
      <div className={cn(STUDIO_LIST_BODY, STUDIO_SCROLL)}>
        {nodes.length === 0 ? (
          <EmptySection />
        ) : (
          <div className={cn(!mediaGrid ? undefined : "min-w-0")}>
            {mediaGrid ? (
              <Masonry
                breakpointCols={STUDIO_MEDIA_MASONRY_BREAKPOINTS}
                className="studio-masonry-grid"
                columnClassName="studio-masonry-grid_column"
              >
                {nodes.map((node) => (
                  <CreativeStudioListItem
                    key={node.id}
                    focusId={node.id}
                    isActive={node.id === focusedNodeId}
                    variant={itemVariant}
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
              nodes.map((node) => (
                <CreativeStudioListItem
                  key={node.id}
                  focusId={node.id}
                  isActive={node.id === focusedNodeId}
                  variant={itemVariant}
                >
                  <CreativeStudioNodeCard
                    node={node}
                    isActive={node.id === focusedNodeId}
                    onOpenDetail={() => onOpenDetail(node.id)}
                  />
                </CreativeStudioListItem>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export function CreativeStudioBoard({
  nodesByType,
  focusedNodeId,
  onOpenDetail,
  onExpandList,
  compact = false,
  boardTab = "text",
  onBoardTabChange,
}: CreativeStudioBoardProps) {
  const { t } = useTranslation();

  const totalCount =
    nodesByType.audio.length +
    nodesByType.text.length +
    nodesByType.image.length +
    nodesByType.video.length;

  if (totalCount === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
        {t("workflow.studio.empty")}
      </div>
    );
  }

  if (compact) {
    return (
      <div className={cn("flex h-full min-h-0 flex-col", STUDIO_BOARD_GAP)}>
        <section className={cn(STUDIO_PANEL, "min-h-0 flex-1")}>
          <CreativeStudioBoardTabs
            activeTab={boardTab}
            onTabChange={onBoardTabChange ?? (() => {})}
            audioNodes={nodesByType.audio}
            textNodes={nodesByType.text}
            imageNodes={nodesByType.image}
            videoNodes={nodesByType.video}
            focusedNodeId={focusedNodeId}
            onOpenDetail={onOpenDetail}
            onExpandList={onExpandList ?? (() => {})}
            className="min-h-0 flex-1"
          />
        </section>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full min-h-0", STUDIO_BOARD_GAP)}>
      <AudioListSection
        nodes={nodesByType.audio}
        focusedNodeId={focusedNodeId}
        onOpenDetail={onOpenDetail}
        className="min-w-0 flex-[1]"
      />
      <NodeListSection
        labelKey="workflow.canvas.aiText"
        nodes={nodesByType.text}
        focusedNodeId={focusedNodeId}
        onOpenDetail={onOpenDetail}
        className="min-w-0 flex-[2]"
        itemVariant="mediaPlain"
        mediaGrid
      />
      <NodeListSection
        labelKey="workflow.canvas.aiImage"
        nodes={nodesByType.image}
        focusedNodeId={focusedNodeId}
        onOpenDetail={onOpenDetail}
        className="min-w-0 flex-[2]"
        mediaGrid
        itemVariant="media"
      />
      <NodeListSection
        labelKey="workflow.canvas.aiVideo"
        nodes={nodesByType.video}
        focusedNodeId={focusedNodeId}
        onOpenDetail={onOpenDetail}
        className="min-h-0 min-w-0 flex-[2]"
        mediaGrid
        itemVariant="media"
      />
    </div>
  );
}
