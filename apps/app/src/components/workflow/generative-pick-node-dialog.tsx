import ImageIcon from "lucide-react/icons/image";
import TypeIcon from "lucide-react/icons/type";
import VideoIcon from "lucide-react/icons/video";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { AiTextReferenceKind } from "./ai-text-node-utils";

export interface GenerativePickNodeEntry {
  readonly nodeId: string;
  readonly outputId: string;
  readonly nodeName: string;
  readonly outputName: string;
  readonly kind: AiTextReferenceKind;
}

export interface GenerativePickNodeDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly emptyMessage: string;
  readonly entries: readonly GenerativePickNodeEntry[];
  readonly onPick: (nodeId: string, outputId: string) => void;
}

function iconForKind(kind: AiTextReferenceKind) {
  if (kind === "text") return <TypeIcon className="h-4 w-4 shrink-0 text-muted-foreground" />;
  if (kind === "video") return <VideoIcon className="h-4 w-4 shrink-0 text-muted-foreground" />;
  return <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

export function GenerativePickNodeDialog({
  open,
  onOpenChange,
  title,
  emptyMessage,
  entries,
  onPick,
}: GenerativePickNodeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {entries.length === 0 ? (
            <p className="text-xs text-muted-foreground">{emptyMessage}</p>
          ) : (
            entries.map((entry) => (
              <button
                key={`${entry.nodeId}:${entry.outputId}`}
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-2.5 py-2 text-left text-xs hover:bg-muted/50"
                onClick={() => onPick(entry.nodeId, entry.outputId)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {iconForKind(entry.kind)}
                  <span className="truncate">
                    {entry.nodeName}
                    <span className="text-muted-foreground">
                      {" · "}
                      {entry.outputName}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-[10px] uppercase text-muted-foreground">
                  {entry.kind}
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
