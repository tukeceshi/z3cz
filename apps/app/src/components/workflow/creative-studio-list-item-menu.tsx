import MoreHorizontal from "lucide-react/icons/more-horizontal";

import { useTranslation } from "@/components/locale-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/utils/utils";

import { useCreativeStudio } from "./creative-studio-context";
import {
  STUDIO_LIST_ITEM_MENU_CONTENT,
  STUDIO_LIST_ITEM_MENU_DELETE,
  STUDIO_LIST_ITEM_MENU_TRIGGER,
} from "./creative-studio-surface";

export interface CreativeStudioListItemMenuProps {
  readonly nodeId: string;
  readonly className?: string;
}

export function CreativeStudioListItemMenu({
  nodeId,
  className,
}: CreativeStudioListItemMenuProps) {
  const { t } = useTranslation();
  const { requestDeleteStudioNode } = useCreativeStudio();

  if (!requestDeleteStudioNode) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(STUDIO_LIST_ITEM_MENU_TRIGGER, className)}
          aria-label={t("workflow.canvas.delete")}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-3.5" strokeWidth={1.75} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={STUDIO_LIST_ITEM_MENU_CONTENT}>
        <DropdownMenuItem
          className={STUDIO_LIST_ITEM_MENU_DELETE}
          onClick={() => requestDeleteStudioNode(nodeId)}
        >
          {t("workflow.canvas.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
