import type { Node as ReactFlowNode } from "@xyflow/react";
import ArrowLeft from "lucide-react/icons/arrow-left";
import X from "lucide-react/icons/x";
import { useEffect, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";

import { useCreativeStudio } from "./creative-studio-context";
import { CreativeStudioDetailContent } from "./creative-studio-detail-content";
import { CreativeStudioEditableTitle } from "./creative-studio-editable-title";
import {
  STUDIO_DETAIL_CARD,
  STUDIO_PANEL_HEADER,
  STUDIO_SHELL,
} from "./creative-studio-surface";
import { shouldShowGenerativeBottomPanel } from "./generative-card-mode-utils";
import { GenerativeStudioConfigPanel } from "./generative-studio-config-panel";
import type { WorkflowNodeType } from "./workflow-types";

export type CreativeStudioDetailViewRole = "primary" | "secondary";

export interface CreativeStudioDetailViewProps {
  readonly node: ReactFlowNode<WorkflowNodeType>;
  readonly role?: CreativeStudioDetailViewRole;
}

export function CreativeStudioDetailView({
  node,
  role = "primary",
}: CreativeStudioDetailViewProps) {
  const { t } = useTranslation();
  const { returnToCanvasFromDetail, closeSecondaryDetail } = useCreativeStudio();
  const [emptyTextEditing, setEmptyTextEditing] = useState(false);
  const showBottomPanel =
    shouldShowGenerativeBottomPanel(node.data.metadata) && !emptyTextEditing;
  const isPrimary = role === "primary";

  useEffect(() => {
    setEmptyTextEditing(false);
  }, [node.id]);

  return (
    <div className={cn("flex h-full min-h-0 flex-col", STUDIO_SHELL)}>
      <div className={STUDIO_DETAIL_CARD}>
        {isPrimary ? (
          <header className={cn(STUDIO_PANEL_HEADER, "gap-2")}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 gap-1 px-2"
              onClick={returnToCanvasFromDetail}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("workflow.studio.backToCanvas")}
            </Button>
            <CreativeStudioEditableTitle node={node} />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={returnToCanvasFromDetail}
            >
              <X className="h-4 w-4" />
            </Button>
          </header>
        ) : (
          <header className="flex h-11 shrink-0 items-center gap-2 px-4 py-3">
            <CreativeStudioEditableTitle node={node} />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={closeSecondaryDetail}
            >
              <X className="h-4 w-4" />
            </Button>
          </header>
        )}

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <CreativeStudioDetailContent
            node={node}
            onEmptyTextEditingChange={setEmptyTextEditing}
          />
        </div>

        {showBottomPanel ? (
          <GenerativeStudioConfigPanel
            key={node.id}
            nodeId={node.id}
            data={node.data}
            layout="studio-dock"
            detailRole={role}
          />
        ) : null}
      </div>
    </div>
  );
}
