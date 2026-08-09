import { useTranslation } from "@/components/locale-provider";
import { cn } from "@/utils/utils";

import { useCreativeStudio } from "./creative-studio-context";
import { STUDIO_SHELL } from "./creative-studio-surface";
import { WorkflowAddNodeMenuPanel } from "./workflow-add-node-menu-panel";

export function CreativeStudioEmptyAddNode() {
  const { t } = useTranslation();
  const { addGenerativeNode } = useCreativeStudio();

  if (!addGenerativeNode) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
        {t("workflow.studio.empty")}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-0 items-center justify-center p-6",
        STUDIO_SHELL
      )}
    >
      <WorkflowAddNodeMenuPanel onSelect={addGenerativeNode} />
    </div>
  );
}
