import type { Node as ReactFlowNode } from "@xyflow/react";

import { useTranslation } from "@/components/locale-provider";
import { cn } from "@/utils/utils";

import { readAiTextResult } from "./ai-text-node-utils";
import { readStudioModelLabel } from "./creative-studio-media-meta";
import {
  STUDIO_META_ROW,
  STUDIO_META_TAG,
  STUDIO_NODE_LABEL,
} from "./creative-studio-surface";
import { resolveStudioNodeLabel } from "./creative-studio-utils";
import type { WorkflowNodeType } from "./workflow-types";

export interface CreativeStudioTextRowProps {
  readonly node: ReactFlowNode<WorkflowNodeType>;
  readonly isActive?: boolean;
  readonly onOpenDetail: () => void;
}

export function CreativeStudioTextRow({
  node,
  isActive = false,
  onOpenDetail,
}: CreativeStudioTextRowProps) {
  const { t } = useTranslation();
  const label = resolveStudioNodeLabel(node, t);
  const previewText = (readAiTextResult(node.data.inputs, node.data.outputs) ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  const modelLabel = readStudioModelLabel(node.data);

  return (
    <button
      type="button"
      className={cn(
        "flex h-[168px] w-full flex-col gap-2 rounded-xl border border-border/50 p-3 text-left transition-colors dark:border-neutral-700",
        "bg-card dark:bg-neutral-800",
        "hover:bg-muted/25 dark:hover:bg-neutral-700/35",
        isActive && "bg-muted/30 dark:bg-neutral-700/40"
      )}
      onClick={onOpenDetail}
    >
      <p
        className={cn(STUDIO_NODE_LABEL, "truncate text-[13px] text-foreground/90")}
        title={label}
      >
        {label}
      </p>
      <div className="min-h-0 flex-1 overflow-hidden">
        {previewText ? (
          <p className="line-clamp-6 text-xs leading-5 text-foreground/80 break-words">
            {previewText}
          </p>
        ) : (
          <p className="text-xs italic leading-5 text-muted-foreground/50">
            {t("workflow.aiTextPanel.cardInputPlaceholder")}
          </p>
        )}
      </div>
      {modelLabel ? (
        <div className={STUDIO_META_ROW}>
          <span className={cn(STUDIO_META_TAG, "truncate")}>{modelLabel}</span>
        </div>
      ) : null}
    </button>
  );
}
