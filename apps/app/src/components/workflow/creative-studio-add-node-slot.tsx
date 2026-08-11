import type { AiGenerativeNodeType } from "@dafthunk/types";
import Plus from "lucide-react/icons/plus";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type DragEvent,
  type ReactNode,
} from "react";

import { useTranslation } from "@/components/locale-provider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/utils/utils";

import { STUDIO_ADD_NODE_SLOT } from "./creative-studio-surface";
import { GENERATIVE_STUDIO_DROP_EXTENSIONS } from "./generative-card-upload-utils";
import { useStudioGenerativeFileDrop } from "./studio-generative-file-upload";
import { WorkflowAddNodeMenuPanel } from "./workflow-add-node-menu-panel";

export interface CreativeStudioAddNodeSlotProps {
  readonly mode: "menu" | "direct";
  readonly nodeType?: AiGenerativeNodeType;
  readonly onAddDirect?: () => void;
  readonly onAddFromMenu: (nodeType: AiGenerativeNodeType) => void;
  readonly addNodeMenuOpen: boolean;
  readonly onAddNodeMenuOpenChange: (open: boolean) => void;
}

function DropExtensionList() {
  return (
    <p className="mt-1 text-center text-[10px] leading-relaxed text-muted-foreground/90">
      {GENERATIVE_STUDIO_DROP_EXTENSIONS.join(" ")}
    </p>
  );
}

interface DropZoneShellProps {
  readonly fileDragOver: boolean;
  readonly uploading: boolean;
  readonly onDragEnter: (event: DragEvent) => void;
  readonly onDragOver: (event: DragEvent) => void;
  readonly onDragLeave: (event: DragEvent) => void;
  readonly onDrop: (event: DragEvent) => void;
  readonly children: ReactNode;
}

function DropZoneShell({
  fileDragOver,
  uploading,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: DropZoneShellProps) {
  return (
    <div
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(uploading && "pointer-events-none opacity-60")}
    >
      {children}
    </div>
  );
}

interface AddNodeSlotButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  readonly fileDragOver: boolean;
  readonly uploading: boolean;
  readonly children?: ReactNode;
}

const AddNodeSlotButton = forwardRef<HTMLButtonElement, AddNodeSlotButtonProps>(
  function AddNodeSlotButton(
    { fileDragOver, uploading, children, className, disabled, ...props },
    ref
  ) {
    const { t } = useTranslation();

    const slotClassName = cn(
      STUDIO_ADD_NODE_SLOT,
      "h-auto w-full flex-col py-2 transition-[min-height,background-color,border-color]",
      fileDragOver
        ? "min-h-[72px] border-primary/40 bg-primary/10"
        : "min-h-10",
      uploading && "opacity-80",
      className
    );

    const content = fileDragOver ? (
      <>
        <span className="text-xs font-medium text-foreground/90">
          {t("workflow.studio.addNodeDrop.release")}
        </span>
        <DropExtensionList />
      </>
    ) : (
      <>
        <span className="inline-flex items-center gap-1.5 text-sm">
          <Plus className="size-4 shrink-0" strokeWidth={2} />
          <span>{t("workflow.studio.addNewNode")}</span>
        </span>
        <span className="text-xs text-muted-foreground/80">
          {t("workflow.studio.addNodeDrop.hint")}
        </span>
      </>
    );

    return (
      <button
        ref={ref}
        type="button"
        className={slotClassName}
        aria-label={t("workflow.studio.addNewNode")}
        disabled={disabled ?? uploading}
        {...props}
      >
        {children ?? content}
      </button>
    );
  }
);

export function CreativeStudioAddNodeSlot({
  mode,
  onAddDirect,
  onAddFromMenu,
  addNodeMenuOpen,
  onAddNodeMenuOpenChange,
}: CreativeStudioAddNodeSlotProps) {
  const { uploading, fileDragOver, dropZoneProps } = useStudioGenerativeFileDrop();

  return (
    <DropZoneShell uploading={uploading} fileDragOver={fileDragOver} {...dropZoneProps}>
      {mode === "menu" ? (
        <Popover open={addNodeMenuOpen} onOpenChange={onAddNodeMenuOpenChange}>
          <PopoverTrigger asChild>
            <AddNodeSlotButton
              fileDragOver={fileDragOver}
              uploading={uploading}
            />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            side="bottom"
            sideOffset={6}
            className="w-auto border-0 bg-transparent p-0 shadow-none"
          >
            <WorkflowAddNodeMenuPanel onSelect={onAddFromMenu} />
          </PopoverContent>
        </Popover>
      ) : (
        <AddNodeSlotButton
          fileDragOver={fileDragOver}
          uploading={uploading}
          onClick={onAddDirect}
        />
      )}
    </DropZoneShell>
  );
}
