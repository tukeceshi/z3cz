import type { AiGenerativeNodeType } from "@dafthunk/types";
import Plus from "lucide-react/icons/plus";
import { useCallback, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/utils/utils";

import { useCreativeStudioOptional } from "./creative-studio-context";
import { WorkflowAddNodeMenuPanel } from "./workflow-add-node-menu-panel";

export interface StudioTextSectionFrameActionsProps {
  readonly sectionBody: string;
  readonly precedingText: string;
  readonly showEditHint?: boolean;
  readonly className?: string;
}

export function StudioTextSectionFrameActions({
  sectionBody,
  precedingText,
  showEditHint = false,
  className,
}: StudioTextSectionFrameActionsProps) {
  const { t } = useTranslation();
  const studio = useCreativeStudioOptional();
  const [open, setOpen] = useState(false);

  const handleSelect = useCallback(
    (nodeType: AiGenerativeNodeType) => {
      studio?.addGenerativeNode?.(nodeType, {
        prompt: sectionBody,
        precedingText,
      });
      setOpen(false);
    },
    [precedingText, sectionBody, studio]
  );

  if (!studio?.addGenerativeNode || !sectionBody.trim()) {
    return null;
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute top-full left-1/2 z-20 mt-1.5 -translate-x-1/2",
        className
      )}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "studio-text-section-frame-action pointer-events-auto",
              "flex items-center gap-1.5 rounded-full border border-border/50",
              "px-3 py-1.5 text-sm font-medium shadow-sm backdrop-blur-sm",
              "bg-background/50 text-foreground/70",
              "opacity-0 transition-[opacity,background-color,color,border-color]",
              showEditHint && "opacity-40",
              "group-hover/section:opacity-100",
              "group-focus-within/section:opacity-100",
              "data-[state=open]:border-border/70 data-[state=open]:bg-background/90",
              "data-[state=open]:text-foreground data-[state=open]:opacity-100",
              "hover:border-border/60 hover:bg-background/60 hover:text-foreground/85",
              "data-[state=open]:hover:bg-background/90",
              "focus-visible:opacity-100 focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring/40"
            )}
            aria-label={t("workflow.studio.sectionCreateNodeAria")}
          >
            <Plus className="size-4 shrink-0" aria-hidden />
            {t("workflow.studio.sectionCreateNode")}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="center"
          side="bottom"
          sideOffset={6}
          className="w-auto border-0 bg-transparent p-0 shadow-none"
        >
          <WorkflowAddNodeMenuPanel onSelect={handleSelect} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
