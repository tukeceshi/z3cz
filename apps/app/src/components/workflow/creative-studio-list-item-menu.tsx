import MoreHorizontal from "lucide-react/icons/more-horizontal";
import { useEffect, useRef, useState } from "react";

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
  const {
    requestDeleteStudioNode,
    requestListNodeRename,
    commitActiveListNodeRename,
  } = useCreativeStudio();
  const [open, setOpen] = useState(false);
  const [itemsInteractive, setItemsInteractive] = useState(false);
  const renameIntentRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setItemsInteractive(false);
      return;
    }

    const frame = requestAnimationFrame(() => {
      setItemsInteractive(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  if (!requestDeleteStudioNode) {
    return null;
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      commitActiveListNodeRename();
      renameIntentRef.current = false;
    }
    setOpen(nextOpen);
  };

  const handleRename = () => {
    if (!itemsInteractive) {
      return;
    }
    renameIntentRef.current = true;
    setOpen(false);
    requestListNodeRename(nodeId);
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
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
      <DropdownMenuContent
        align="end"
        className={STUDIO_LIST_ITEM_MENU_CONTENT}
        onCloseAutoFocus={(event) => {
          if (!renameIntentRef.current) {
            return;
          }
          event.preventDefault();
          renameIntentRef.current = false;
        }}
      >
        <DropdownMenuItem
          className={cn(
            "h-auto justify-center px-2 py-0.5 text-xs focus:bg-muted/30 dark:focus:bg-neutral-700/40",
            !itemsInteractive && "pointer-events-none"
          )}
          onSelect={(event) => event.preventDefault()}
          onClick={handleRename}
        >
          {t("workflow.studio.renameNode")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className={cn(
            STUDIO_LIST_ITEM_MENU_DELETE,
            !itemsInteractive && "pointer-events-none"
          )}
          onSelect={() => requestDeleteStudioNode(nodeId)}
        >
          {t("workflow.canvas.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
