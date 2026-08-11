import type { Node as ReactFlowNode } from "@xyflow/react";

import { cn } from "@/utils/utils";

import { CreativeStudioListItemLabel } from "./creative-studio-list-item-label";
import {
  STUDIO_MEDIA_CARD_FOOTER,
  STUDIO_META_ROW,
  STUDIO_META_TAG,
} from "./creative-studio-surface";
import type { WorkflowNodeType } from "./workflow-types";

export interface CreativeStudioListItemFooterProps {
  readonly node: ReactFlowNode<WorkflowNodeType>;
  readonly onOpenDetail: () => void;
  readonly metaTags?: readonly string[];
}

export function CreativeStudioListItemFooter({
  node,
  onOpenDetail,
  metaTags = [],
}: CreativeStudioListItemFooterProps) {
  return (
    <div className={STUDIO_MEDIA_CARD_FOOTER}>
      <CreativeStudioListItemLabel node={node} onOpenDetail={onOpenDetail} />
      {metaTags.length > 0 ? (
        <button type="button" className="w-full text-left" onClick={onOpenDetail}>
          <div className={STUDIO_META_ROW}>
            {metaTags.map((tag, index) => (
              <span
                key={`${tag}-${index}`}
                className={cn(STUDIO_META_TAG, "truncate")}
              >
                {tag}
              </span>
            ))}
          </div>
        </button>
      ) : null}
    </div>
  );
}
